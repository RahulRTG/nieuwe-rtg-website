/* DE RELAYSTAND: of realtime bellen (voice/video) op dit moment mag bestaan.

   Drie regels die hier niet mogen sneuvelen:

   1. BESCHIKBAAR WORDT NERGENS OPGESLAGEN. `stand()` rekent bij elke vraag
      opnieuw uit de onderliggende voorwaarden. Er is geen veld, geen cache en
      geen databasekolom die "rtc beschikbaar" zegt; de enige toestand is de
      laatste UITSLAG van de relayproef, en die heeft een verloop.

   2. GEVERIFIEERD IS GEEN KNOP. Er is geen exporteerbare setter. De enige weg
      naar `geverifieerd: true` is `proef()`, die zelf de echte TURN-relayproef
      draait (kern/rtc/relayproef.js) tegen de LIVE configuratie. Geen route,
      beheerder, tenant of omgevingsvariabele kan een uitslag aanleveren.

   3. DE VOLGORDE IS MONOTOON. kill switch > configuratie > bewijs. Een
      lagere voorwaarde maakt een hogere DENY nooit ALLOW: elke stap kan
      alleen weigeren, geen stap kan een eerdere weigering opheffen.

   Bewijs is gebonden aan de configuratievingerafdruk (TURN-URL's, geheim als
   HMAC, TTL) en aan de vingerafdruk van de draaiende release. Verandert een van
   beide, dan vervalt het bewijs vanzelf -- er hoeft niets "gecorrigeerd" te
   worden, de volgende `stand()` ziet het verschil.

   Buiten publieke productie (lokaal, private beta) is een relais niet
   VEREIST: daar mag bellen direct (STUN) en zegt de stand eerlijk dat er geen
   relais is. Dat is de bestaande afspraak uit productie-communicatie.js. */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const turn = require('../../config/turn');
const relayproef = require('./relayproef');

const GELDIG_MS = 10 * 60 * 1000;     // een geslaagde proef draagt 10 minuten
const INTERVAL_MS = 4 * 60 * 1000;    // ruim binnen die 10 minuten opnieuw

let laatste = null;                  // module-privé: de enige toestand
let lopend = null;

const publiek = env => env.NODE_ENV === 'production' && env.RTG_PRIVATE_BETA !== '1';

/* De release die nu draait. Een proef van release A geldt niet voor B, ook
   niet als ze in hetzelfde proces terechtkwamen (hot reload, tests). */
function releaseVingerafdruk() {
  for (const p of [path.join(__dirname, '..', '..', '..', '.release', 'herkomst.json'),
    path.join(__dirname, '..', '..', '..', '.release', 'release.json')]) {
    try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch (e) {}
  }
  return 'werkboom';
}

function binding(env) {
  return { config: turn.vingerafdruk(env, { publiekeProductie: publiek(env) }), release: releaseVingerafdruk() };
}

function weiger(reden, extra) {
  return Object.freeze({ beschikbaar: false, relayVereist: true, geverifieerd: false, reden, ...(extra || {}) });
}

/* Puur afgeleid uit (configuratie, bewijs, binding, tijd). `beoordeel` is een
   PURE functie: hij geeft een stand terug en verandert niets. Daardoor kunnen
   de toetsen elke weigertak raken met een zelfgemaakt (vervalst, verlopen,
   misvormd) bewijs, zonder dat er een setter bestaat die zo'n bewijs in de
   draaiende server zou kunnen zetten. */
function beoordeel({ env = process.env, bewijs = null, binding: b = null, nu = Date.now() } = {}) {
  if (env.RTG_RTC_UIT === '1') return weiger('RTC_KILL_SWITCH', { relayVereist: publiek(env) });
  const vereist = publiek(env);
  const lijst = turn.ontleedLijst(env.TURN_URL, { publiekeProductie: vereist });
  const auth = turn.credentials(env, { publiekeProductie: vereist });
  const geconfigureerd = lijst.urls.length > 0 && !!auth && (!vereist || lijst.fouten.length === 0);
  const bind = b || binding(env);
  const vorm = !!(bewijs && typeof bewijs === 'object' && typeof bewijs.config === 'string' &&
    typeof bewijs.release === 'string' && Number.isFinite(bewijs.gemetenOp) && Number.isFinite(bewijs.geldigTot));
  const geldig = vorm && bewijs.ok === true && bewijs.config === bind.config &&
    bewijs.release === bind.release && nu >= bewijs.gemetenOp && nu < bewijs.geldigTot &&
    bewijs.geldigTot - bewijs.gemetenOp <= GELDIG_MS;
  if (!vereist) {
    return Object.freeze({ beschikbaar: true, relayVereist: false, geverifieerd: geldig,
      reden: geldig ? 'RELAY_GEVERIFIEERD' : geconfigureerd ? 'RELAY_NIET_BEWEZEN_NIET_VEREIST' : 'RELAY_NIET_VEREIST' });
  }
  if (!geconfigureerd) return weiger('TURN_CONFIG_ONGELDIG');
  if (!bewijs) return weiger('TURN_NOG_NIET_BEWEZEN');
  if (!vorm) return weiger('TURN_BEWIJS_MISVORMD');
  if (bewijs.ok !== true) return weiger(bewijs.reden || 'TURN_PROEF_GEZAKT', { gemetenOp: bewijs.gemetenOp });
  if (bewijs.config !== bind.config) return weiger('TURN_BEWIJS_ANDERE_CONFIG');
  if (bewijs.release !== bind.release) return weiger('TURN_BEWIJS_ANDERE_RELEASE');
  if (!geldig) return weiger('TURN_BEWIJS_VERLOPEN');
  return Object.freeze({ beschikbaar: true, relayVereist: true, geverifieerd: true, reden: 'RELAY_GEVERIFIEERD',
    gemetenOp: bewijs.gemetenOp, geldigTot: bewijs.geldigTot });
}

function stand(env = process.env, nu = Date.now()) {
  return beoordeel({ env, bewijs: laatste, nu });
}

const gereed = (env, nu) => stand(env, nu).beschikbaar === true;

/* Draai de echte proef tegen ELKE geconfigureerde URL. Alle URL's moeten
   slagen: een client kiest zelf welke hij gebruikt, dus een half werkende
   lijst is geen werkend relais. De uitslag vervangt de vorige altijd, ook
   als hij slechter is -- een gezakte proef zet de stand direct dicht. */
async function proef(env = process.env, opties = {}) {
  if (lopend) return lopend;
  lopend = (async () => {
    const begin = Date.now();
    const b = binding(env);
    const vereist = publiek(env);
    const lijst = turn.ontleedLijst(env.TURN_URL, { publiekeProductie: vereist });
    const auth = turn.credentials(env, { publiekeProductie: vereist });
    let uitslag;
    if (!lijst.urls.length || !auth || (vereist && lijst.fouten.length)) {
      uitslag = { ok: false, reden: 'TURN_CONFIG_ONGELDIG', urls: [] };
    } else {
      const credential = () => {
        const p = turn.projecteerTurn(env, { publiekeProductie: vereist, actor: 'rtg-relayproef' });
        return { username: p.server.username, credential: p.server.credential };
      };
      const urls = [];
      for (const u of lijst.urls) {
        const ont = turn.ontleedUrl(u, { publiekeProductie: vereist });
        urls.push(await relayproef.proefUrl(ont, credential, { ...opties, eisOpenbaarRelay: vereist }));
      }
      const fout = urls.find(x => !x.ok);
      uitslag = { ok: !fout, reden: fout ? fout.reden : null, urls };
    }
    laatste = Object.freeze({ ...uitslag, config: b.config, release: b.release,
      gemetenOp: begin, geldigTot: uitslag.ok ? begin + GELDIG_MS : begin });
    return laatste;
  })();
  try { return await lopend; } finally { lopend = null; }
}

/* De proef periodiek laten lopen zolang er een relais is geconfigureerd. De
   timer houdt het proces niet in leven. */
let timer = null;
function start(env = process.env, log = () => {}) {
  if (timer || !String(env.TURN_URL || '').trim()) return false;
  const ronde = () => proef(env).then(u => log(u)).catch(() => {});
  ronde();
  timer = setInterval(ronde, INTERVAL_MS);
  if (timer.unref) timer.unref();
  return true;
}
function stop() { if (timer) clearInterval(timer); timer = null; }

/* Wat buiten mag zien: geen URL's met credentials, geen geheimen. */
function publiekeUitslag() {
  const l = laatste;
  if (!l) return null;
  return { ok: l.ok, reden: l.reden, gemetenOp: l.gemetenOp, geldigTot: l.geldigTot,
    urls: (l.urls || []).map(u => ({ url: u.url, transport: u.transport, ok: u.ok, reden: u.reden || null,
      bytesAB: u.bytesAB || 0, bytesBA: u.bytesBA || 0 })) };
}

/* Alleen voor de toetsen: vergeet de uitslag. Dit kan de stand alleen DICHT
   zetten (geen bewijs = geen relais), nooit open. */
function vergeet() { laatste = null; }

module.exports = Object.freeze({ stand, beoordeel, binding, gereed, proef, start, stop, publiekeUitslag, vergeet,
  GELDIG_MS, INTERVAL_MS });
