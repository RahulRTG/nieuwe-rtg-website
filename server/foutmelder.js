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

function maakFoutmelder(opts) {
  opts = opts || {};
  const url = opts.url || process.env.ERR_WEBHOOK_URL || '';
  const app = opts.app || process.env.RTG_APP_NAAM || 'rtg';
  const timeout = opts.timeout || 5000;
  const venster = opts.vensterMs || 60000;        // per vingerafdruk max 1x per minuut
  const gezien = new Map();                        // vingerafdruk -> laatste verzending (ms)

  function vinger(err, ctx) {
    const m = (err && err.message) || String(err);
    const p = (ctx && (ctx.p || ctx.plaats)) || '';
    return (m + '|' + p).slice(0, 200);
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

      const payload = Buffer.from(JSON.stringify({
        app, tijd: new Date(nu).toISOString(),
        fout: (err && err.message) || String(err),
        stack: (err && err.stack) ? String(err.stack).slice(0, 4000) : undefined,
        context: ctx || undefined
      }));
      const u = new URL(url);
      const mod = u.protocol === 'http:' ? http : https;
      const req = mod.request({
        method: 'POST', hostname: u.hostname, port: u.port || undefined, path: u.pathname + u.search,
        headers: { 'content-type': 'application/json', 'content-length': payload.length, 'user-agent': 'rtg-foutmelder/1' }
      });
      req.on('error', () => {});                      // een fout-melder mag nooit zelf een fout opwerpen
      req.setTimeout(timeout, () => req.destroy());
      req.write(payload); req.end();
    } catch (e) { /* bewust stil: bezorging faalt liever dan de app te raken */ }
  }

  return { melden, actief: !!url };
}

module.exports = { maakFoutmelder };
