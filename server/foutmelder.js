/* Eigen externe fout-melder, i.p.v. het pakket @sentry/node.

   De fout-AGGREGATIE (groeperen op vingerafdruk, tonen op het techniekbord) zit
   al in server/log.js -- dat is het stuk dat Sentry's UI en groepering dekt. Wat
   Sentry daarbovenop deed is EXTERNE bezorging: een melding naar buiten sturen,
   zodat je het ook ziet als de doos zelf plat ligt. Dat doen we hier zelf: een
   dunne HTTPS-POST naar een instelbare webhook (Slack/Discord/eigen endpoint),
   op Node's https -- geen SDK, geen dependency.

   Bewust nuchter: fire-and-forget (een fout-melder mag de app nooit ophouden of
   laten crashen), en getemperd op vingerafdruk zodat een fout-storm de webhook
   niet plat gooit. Aan te zetten met ERR_WEBHOOK_URL; zonder blijft alleen de
   eigen in-memory aggregatie draaien (net als voorheen zonder SENTRY_DSN). */
'use strict';
const crypto = require('node:crypto');
const protocol = require('./storingen/protocol');
const { bezorg } = require('./storingen/bezorg');
const { URL } = require('url');
const ssrf = require('./kern/ssrf');

function maakFoutmelder(opts) {
  opts = opts || {};
  // SSRF-afweer op de uitgaande webhook: het doel komt uit config, maar een
  // fout-webhook mag nooit een intern/metadata-adres port-scannen. Standaard
  // streng (privé + metadata geweigerd); ERR_WEBHOOK_INTERN=1 staat een bewuste
  // interne collector toe en blokkeert dan alleen het metadata/link-local-adres.
  const intern = opts.intern === true || String(process.env.ERR_WEBHOOK_INTERN || '') === '1';
  const logger = opts.log && typeof opts.log.warn === 'function' ? opts.log.warn.bind(opts.log) : console.warn;
  let url = opts.url || process.env.ERR_WEBHOOK_URL || '';
  if (url) {
    const keur = ssrf.veiligeWebhookUrl(url, { intern });
    if (!keur.ok) {
      logger('[foutmelder] ERR_WEBHOOK_URL geweigerd (' + keur.reden + '); externe bezorging uit.');
      url = '';
    }
  }
  const sleutel = opts.sleutel || process.env.ERR_WEBHOOK_SECRET || '';
  if (protocol.eigenEndpoint(url) && !protocol.sleutelGoed(sleutel)) {
    logger('[foutmelder] Ondertekeningssleutel ontbreekt; eigen webhook uit.'); url = '';
  }
  /* ONAFHANKELIJK IS EEN VRAAG MET DRIE ANTWOORDEN, EN "NIET VAST TE STELLEN"
     IS ER EEN VAN.

     Hier stond `let onafhankelijk = true` met een try/catch eromheen, en dat is
     fail-OPEN op precies het veld dat moet waarschuwen: elke fout in de
     berekening liet de waarde op `true` staan. Een ontvanger op een ANDERE
     herkomst die toch deze app is (loopback met ERR_WEBHOOK_INTERN=1, een
     tweede hostnaam) telde daardoor als externe bewaking, en het alarmbord
     noemde "de externe webhook (ERR_WEBHOOK_URL)" als uitgang terwijl er bij
     een volledige app- of hostuitval niets afgaat. Dat is exact wat de kop van
     kern/command/alarm-uitgang.js belooft te voorkomen.

     De betrouwbare bron stond drie regels hoger al berekend en wordt in
     server/config/productie.js voor hetzelfde oordeel gebruikt:
     protocol.eigenEndpoint(url) kijkt naar het PAD en heeft geen APP_URL nodig.
     Die gaat voorop. Pas daarna de herkomstvergelijking -- en die kan mislukken,
     want APP_URL is buiten productie niet afgedwongen. Dan is het antwoord
     `null` MET de reden, en niet stilzwijgend "ja". */
  let onafhankelijk = null;
  let onafhankelijkReden = 'Er is geen uitgang: ERR_WEBHOOK_URL is niet gezet of werd geweigerd.';
  if (url) {
    let zelfdeHerkomst = null;
    try { zelfdeHerkomst = new URL(url).origin === new URL(String(opts.appUrl || process.env.APP_URL || '')).origin; }
    catch (_) { zelfdeHerkomst = null; }
    if (protocol.eigenEndpoint(url)) {
      onafhankelijk = false;
      onafhankelijkReden = 'Ontvangst op de eigen storingenwebhook; geen bewaking bij volledige app- of hostuitval.';
    } else if (zelfdeHerkomst === true) {
      onafhankelijk = false;
      onafhankelijkReden = 'Ontvangst op dezelfde app; geen bewaking bij volledige app- of hostuitval.';
    } else if (zelfdeHerkomst === false) {
      onafhankelijk = true;
      onafhankelijkReden = '';
    } else {
      onafhankelijkReden = 'APP_URL ontbreekt of is geen geldig adres, dus of deze ontvanger buiten deze app staat is niet vast te stellen.';
    }
  }
  const app = opts.app || process.env.RTG_APP_NAAM || 'rtg';
  const timeout = opts.timeout || 5000;
  const venster = opts.vensterMs || 60000;        // per vingerafdruk max 1x per minuut
  const gezien = new Map();                        // vingerafdruk -> laatste verzending (ms)

  /* EEN ALARM DAT JE NIET KUNT ZIEN AANKOMEN, IS GEEN ALARM.

     Hieronder staat `req.on('error', () => {})`, en dat hoort ook zo: een
     fout-melder mag de app nooit ophouden of zelf omvallen. Maar het gevolg was
     dat een webhook met een typefout, een verlopen Slack-adres of een host die
     niet meer bestaat PRECIES hetzelfde deed als een werkende: niets zichtbaars.
     Je merkt het pas op de dag dat je het alarm nodig hebt.

     Daarom een kleine boekhouding: hoeveel is er geprobeerd, hoeveel is er
     aangekomen (2xx), en wat was de laatste fout. Die staat op het techniekbord
     en in de zelfproef hieronder. Stil blijven mag; onzichtbaar zijn niet. */
  const staat = { geprobeerd: 0, bezorgd: 0, mislukt: 0, laatsteFout: null, laatsteFoutAt: null, laatsteOkAt: null };
  function misging(reden) {
    staat.mislukt++;
    staat.laatsteFout = String(reden || 'onbekend').slice(0, 200);
    staat.laatsteFoutAt = new Date().toISOString();
  }

  function vinger(err, ctx) {
    const m = (err && err.message) || String(err);
    const p = (ctx && (ctx.p || ctx.plaats)) || '';
    return (m + '|' + p).slice(0, 200);
  }

  /* Een enkele POST. `soort` staat in het lijf zodat de ontvanger een echte
     storing van een zelfproef kan onderscheiden. Geeft een belofte terug die
     ALTIJD slaagt (met ok true/false); de aanroeper mag hem negeren -- melden()
     doet dat, de zelfproef niet. */
  async function post(lijf, soort) {
    staat.geprobeerd++;
    let r;
    try {
      const payload = Buffer.from(JSON.stringify(Object.assign({ app, soort: soort || 'fout' }, lijf)));
      r = await bezorg({ url, payload, sleutel, id: crypto.randomUUID(), timeout });
    } catch (_) { r = { ok: false, reden: 'kon niet versturen' }; }
    if (r.ok) { staat.bezorgd++; staat.laatsteOkAt = new Date().toISOString(); }
    else misging(r.reden);
    return r;
  }

  function melden(err, ctx) {
    if (!url || (ctx && (ctx.p === protocol.PAD || ctx.bron === 'storingen-webhook'))) return;
    try {
      const vf = vinger(err, ctx);
      const nu = Date.now();
      const vorige = gezien.get(vf);
      if (vorige && nu - vorige < venster) return;   // te snel opnieuw: overslaan
      gezien.set(vf, nu);
      if (gezien.size > 2000) for (const [k, t] of gezien) if (nu - t > venster) gezien.delete(k);

      post({
        tijd: new Date(nu).toISOString(),
        fout: (err && err.message) || String(err),
        stack: (err && err.stack) ? String(err.stack).slice(0, 4000) : undefined,
        context: ctx || undefined
      }, 'fout');
    } catch (e) { /* bewust stil: bezorging faalt liever dan de app te raken */ }
  }

  /* DE ZELFPROEF. Het go-live-vinkje luidde "er komt een testfout binnen" en
     dat was niet af te vinken zonder met de hand een echte storing te maken.
     Dit stuurt er een, met soort "zelfproef" zodat de ontvanger weet dat het
     geen echte storing is, en WACHT op het antwoord. Zo weet je of het adres
     klopt in plaats van het te hopen. */
  async function zelfproef(door) {
    if (!url) return { ok: false, reden: 'ERR_WEBHOOK_URL is niet gezet; er is geen externe alarmering.' };
    const r = await post({
      tijd: new Date().toISOString(),
      fout: 'Zelfproef van de RTG-foutmelder: dit is GEEN storing.',
      context: { door: door || 'onbekend', waarom: 'controleren of de alarmweg werkt' }
    }, 'zelfproef');
    return r;
  }

  /* `beperking` is leeg BIJ EEN BEWEZEN ONAFHANKELIJKE UITGANG en anders de
     reden -- ook als die reden "wij weten het niet" is. Een leeg vak leest als
     een uitgang die er is. */
  const stand = () => Object.assign({ actief: !!url, onafhankelijk,
    beperking: onafhankelijk === true ? null : (onafhankelijkReden || null) }, staat);

  return { melden, zelfproef, stand, actief: !!url };
}

module.exports = { maakFoutmelder };
