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
const https = require('https');
const http = require('http');
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
  function post(lijf, soort) {
    return new Promise((klaar) => {
      staat.geprobeerd++;
      try {
        const payload = Buffer.from(JSON.stringify(Object.assign({ app, soort: soort || 'fout' }, lijf)));
        const u = new URL(url);
        const mod = u.protocol === 'http:' ? http : https;
        const req = mod.request({
          method: 'POST', hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search,
          headers: { 'content-type': 'application/json', 'content-length': payload.length, 'user-agent': 'rtg-foutmelder/1' }
        });
        req.on('response', (res) => {
          res.resume();                               // lijf weggooien, verbinding vrijgeven
          if (res.statusCode >= 200 && res.statusCode < 300) {
            staat.bezorgd++; staat.laatsteOkAt = new Date().toISOString();
            klaar({ ok: true, status: res.statusCode });
          } else {
            misging('ontvanger antwoordde ' + res.statusCode);
            klaar({ ok: false, status: res.statusCode, reden: 'ontvanger antwoordde ' + res.statusCode });
          }
        });
        // een fout-melder mag nooit zelf een fout opwerpen -- wel meetellen
        req.on('error', (e) => { misging(e && e.message); klaar({ ok: false, reden: (e && e.message) || 'netwerkfout' }); });
        req.setTimeout(timeout, () => { misging('geen antwoord binnen ' + timeout + ' ms'); req.destroy(); });
        req.write(payload); req.end();
      } catch (e) {
        misging(e && e.message);
        klaar({ ok: false, reden: (e && e.message) || 'kon niet versturen' });
      }
    });
  }

  function melden(err, ctx) {
    if (!url) return;
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

  const stand = () => Object.assign({ actief: !!url }, staat);

  return { melden, zelfproef, stand, actief: !!url };
}

module.exports = { maakFoutmelder };
