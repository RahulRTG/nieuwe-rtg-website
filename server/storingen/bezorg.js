/* Bezorging met een harde deadline. De eigen ontvanger telt pas na een
   ondertekend opslagbewijs; retries houden dezelfde id en exact dezelfde body. */
'use strict';
const http = require('node:http');
const https = require('node:https');
const protocol = require('./protocol');
function poging({ url, payload, sleutel, id, timeout, getekend }) {
  return new Promise(resolve => {
    let klaar = false, req, timer;
    const eind = r => { if (klaar) return; klaar = true; clearTimeout(timer); resolve(r); };
    try {
      const u = new URL(url);
      const headers = { 'content-type': 'application/json', 'content-length': payload.length, 'user-agent': 'rtg-foutmelder/2' };
      if (getekend) Object.assign(headers, protocol.koppen(sleutel, id, payload));
      req = (u.protocol === 'http:' ? http : https).request({ method: 'POST', hostname: u.hostname,
        port: u.port || undefined, path: u.pathname + u.search, headers }, res => {
        const chunks = []; let lengte = 0;
        res.on('error', () => eind({ ok: false, reden: 'Antwoordverbinding onderbroken.', retry: true }));
        res.on('aborted', () => eind({ ok: false, reden: 'Antwoordverbinding afgebroken.', retry: true }));
        res.on('data', b => {
          lengte += b.length;
          if (lengte > 4096) { eind({ ok: false, reden: 'Ontvangstbewijs te groot.' }); res.destroy(); }
          else chunks.push(b);
        });
        res.on('end', () => {
          const status = res.statusCode;
          const wacht = Number(res.headers['retry-after']);
          if (status < 200 || status >= 300) return eind({ ok: false, status,
            reden: 'ontvanger antwoordde ' + status, retry: status >= 500 && !(wacht > 0),
            retryAfter: wacht > 0 ? wacht : (status === 429 ? 60 : undefined) });
          if (getekend) {
            let bewijs;
            try { bewijs = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (_) {}
            if (!protocol.bewijsGoed(sleutel, id, payload, bewijs)) return eind({ ok: false, status, reden: 'Geen geldig ondertekend opslagbewijs.' });
          }
          eind({ ok: true, status, id, digest: protocol.hash(payload), opgeslagen: getekend });
        });
      });
      req.on('error', () => eind({ ok: false, reden: 'Webhookverbinding mislukt.', retry: true }));
      timer = setTimeout(() => { eind({ ok: false, reden: 'geen antwoord binnen ' + timeout + ' ms', retry: true }); req.destroy(); }, timeout);
      req.end(payload);
    } catch (_) { eind({ ok: false, reden: 'kon niet versturen' }); if (req) req.destroy(); }
  });
}
async function bezorg(opts) {
  const getekend = protocol.eigenEndpoint(opts.url);
  if (getekend && (!protocol.sleutelGoed(opts.sleutel) || opts.payload.length > protocol.MAX_BYTES))
    return { ok: false, reden: 'Ondertekening of meldingsgrootte ongeldig.' };
  for (let n = 0; n < (getekend ? 3 : 1); n++) {
    const r = await poging(Object.assign({}, opts, { getekend }));
    if (r.ok || !r.retry || n === 2 || !getekend) return r;
    await new Promise(resolve => setTimeout(resolve, 200 * (n + 1)));
  }
}
module.exports = { bezorg };
