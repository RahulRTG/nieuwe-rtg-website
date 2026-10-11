/* ============================================================================
   DE WERELD VAN EEN VOLTOOIPROEF -- een wegwerpserver die je mag herstarten,
   laten crashen en daarna in de opslag mag nakijken.

   Wat dit toevoegt boven scripts/lib/wegwerpserver.js is precies wat bewijs 5
   (persistent) en bewijs 7 (herstelbaar) uit BETROUWBAARHEID.md nodig hebben en
   een ketenproef niet heeft (scripts/lib/appcontract.js, kop):

     herstart()   een NETTE stop (SIGTERM, wachten tot het proces weg is) en
                  dezelfde datamap opnieuw starten. Dat is een deploy.
     crash()      SIGKILL en opnieuw starten. Dat is een stroomstoring: de server
                  krijgt geen kans iets weg te schrijven. Die twee zijn met opzet
                  twee functies -- wie een garantie over herstarts met een
                  stroomstoring toetst (of andersom) slaagt om de verkeerde reden
                  (zie de kop van stopNetjes in test/helper.js).
     opslag()     een tabel lezen UIT HET BESTAND, met een eigen verbinding die
                  alleen leest. Niet via een route: "na de herstart geeft de route
                  het juiste antwoord" en "het staat op schijf" zijn twee
                  beweringen, en een cache kan de eerste waar maken terwijl de
                  tweede vals is.
     berichten()  de postvanger uitlezen (./postvanger.js).

   DE TESTWERELD IS FAIL-CLOSED. Voordat er iets start, vraagt deze module aan de
   postvanger of er in DEZE omgeving post naar buiten kan; zo ja, dan weigert hij
   te meten met de reden. Een proef die "wij hebben u gemaild" afmaakt en daarbij
   echte post verstuurt, is een ongeluk en geen meting.
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { start, gereedschapsomgeving } = require('./wegwerpserver');
const postvanger = require('./postvanger');

const WACHT_STOP_MS = 30000;

function wachtOpEinde(kind, ms) {
  if (kind.exitCode !== null || kind.signalCode !== null) return Promise.resolve(true);
  return new Promise((res) => {
    const t = setTimeout(() => res(false), ms);
    kind.once('exit', () => { clearTimeout(t); res(true); });
  });
}

async function maakWereld(naam, eigenEnv) {
  const datamap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-voltooi-' + naam + '-'));
  const env = Object.assign({ NODE_ENV: 'test' }, eigenEnv || {}, postvanger.omgeving());
  /* Dezelfde omgeving die het kind krijgt, en dezelfde waaromNiet() die de
     server leest: de vraag "kan hier post naar buiten" heeft een antwoord. */
  postvanger.eis(gereedschapsomgeving({ poort: 0, datamap }, env));
  let srv = await start({ naam: 'voltooi-' + naam, datamap, env, gereed: 'ready' });
  const herstarts = { netjes: 0, crash: 0 };

  /* `koppen`: extra kopregels, zoals het bezitsbewijs van een gebonden toestel. */
  async function post(pad, lijf, tok, koppen) {
    const h = Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}, koppen || {});
    let r;
    try { r = await fetch(srv.basis + pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}) }); }
    catch (e) { return { status: 0, data: null, fout: String(e && e.message || e) }; }
    return { status: r.status, data: await r.json().catch(() => null) };
  }

  /* Een verzoek dat de client halverwege opgeeft. Het lijf is verstuurd; het
     antwoord wordt niet afgewacht. Wat de server ermee deed, is precies wat de
     proef daarna moet uitzoeken -- het kan beide zijn. */
  async function afgebroken(pad, lijf, tok, kop) {
    const ac = new AbortController();
    const h = Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}, kop || {});
    const belofte = fetch(srv.basis + pad, { method: 'POST', headers: h, body: JSON.stringify(lijf || {}), signal: ac.signal })
      .then((r) => ({ status: r.status }), (e) => ({ status: 0, afgebroken: /abort/i.test(String(e && e.name || e)) }));
    setTimeout(() => ac.abort(), 2);
    const uit = await belofte;
    /* Geef de server even de tijd om af te maken wat hij eventueel begon,
       zodat de volgende stap niet met een half verzoek racet. */
    await new Promise((r) => setTimeout(r, 300));
    return uit;
  }

  async function opnieuw() {
    srv = await start({ naam: 'voltooi-' + naam, datamap, env, gereed: 'ready' });
  }

  async function herstart() {
    srv.kind.kill('SIGTERM');
    const weg = await wachtOpEinde(srv.kind, WACHT_STOP_MS);
    if (!weg) {
      srv.kind.kill('SIGKILL');
      await wachtOpEinde(srv.kind, 5000);
      throw new Error('de server stopte niet binnen ' + (WACHT_STOP_MS / 1000) + ' s na SIGTERM; een nette herstart is dan niet te meten');
    }
    herstarts.netjes++;
    await opnieuw();
  }

  async function crash() {
    srv.kind.kill('SIGKILL');
    await wachtOpEinde(srv.kind, 5000);
    herstarts.crash++;
    await opnieuw();
  }

  /* Een tabel lezen uit het bestand zelf. node:sqlite met readOnly, zodat de
     meting niets kan schrijven in de wereld die hij meet. */
  function opslag(bestand, sql, ...args) {
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(path.join(datamap, bestand), { readOnly: true });
    try { return db.prepare(sql).all(...args); } finally { db.close(); }
  }

  /* Een collectie uit de kv-opslag (server/db/sqlite.js), ontsleuteld met
     dezelfde kluis als de server. null als hij er niet staat. */
  function collectie(naamCollectie) {
    const rij = opslag('store.db', 'SELECT val FROM kv WHERE key = ? AND deleted = 0', naamCollectie)[0];
    if (!rij) return null;
    return JSON.parse(require('../../server/kluis').ontsleutel(rij.val));
  }

  function klaar() {
    try { srv.kind.kill('SIGKILL'); } catch (e) { /* al weg */ }
    try { fs.rmSync(datamap, { recursive: true, force: true }); } catch (e) { /* al weg */ }
  }
  process.on('exit', klaar);

  return { post, afgebroken, herstart, crash, opslag, collectie, klaar, datamap, herstarts,
    berichten: () => postvanger.berichten(datamap),
    get basis() { return srv.basis; } };
}

/* Een vers lid langs de echte registratie, met een eigen account (de
   sessiepagina en de postpagina eisen dat; een demo-persona heeft er geen). */
async function nieuwLid(w, merk) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const email = (merk || 'vp') + u + '@voorbeeld.nl';
  const wachtwoord = 'geheim12345';
  const r = await w.post('/api/auth/register', { name: 'Voltooilid', email, phone: '06' + u.slice(0, 8),
    password: wachtwoord, geboortedatum: '1985-05-05', tier: 'rtg' });
  if (r.status !== 200 || !r.data || !r.data.token) throw new Error('registratie lukte niet (' + r.status + ')');
  return { token: r.data.token, email, wachtwoord };
}

async function inloggen(w, lid) {
  const r = await w.post('/api/auth/login', { login: lid.email, password: lid.wachtwoord });
  if (r.status !== 200 || !r.data || !r.data.token) throw new Error('inloggen lukte niet (' + r.status + ')');
  return r.data.token;
}

module.exports = { maakWereld, nieuwLid, inloggen };
