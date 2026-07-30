/* RTG dynamische code: de "gesloten" laag onder onze QR's. Een RTG-code is geen
   gewone, leesbare QR-inhoud meer, maar een kort, ondertekend en aan de tijd
   gebonden token:

       RTG1.<base64url(body)>.<base64url(hmac)[0..16]>

   met body = soort|code|vervalt(base36)|nonce. De handtekening is een HMAC-SHA256
   met een serversleutel die alleen op de node staat (dyncode.key, 0600, in
   .gitignore -- net als de andere sleutels). Daardoor:

   - kan alleen ONS systeem een geldige code maken en verifieren; een generieke
     QR-lezer ziet enkel "RTG1.xxxx", geen URL en geen leesbare data, en kan er
     niets mee. De code werkt dus alleen via onze eigen app (die de code langs
     /api/code/scan haalt).
   - is de code DYNAMISCH: hij vervalt na een korte TTL (standaard 45s), dus een
     foto of schermafdruk is binnen een halve minuut waardeloos. De app ververst
     de getoonde code vanzelf.

   Geen eigen cryptografie: HMAC-SHA256 uit node:crypto. Puur een utility; de
   autorisatie en de echte actie blijven in de bestaande routes. */
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = ({ crypto, dataDir }) => {
  const keyPad = path.join(dataDir, 'dyncode.key');
  let sleutel;
  try { sleutel = fs.readFileSync(keyPad); }
  catch (e) { sleutel = crypto.randomBytes(32); try { fs.writeFileSync(keyPad, sleutel, { mode: 0o600 }); } catch (e2) {} }

  const DEFAULT_TTL = 45000;                 // 45 seconden: dynamisch, kort houdbaar
  const MAX_TTL = 5 * 60000;                 // nooit langer dan 5 minuten
  const SOORTEN = ['kas', 'tafel', 'entree', 'zegel', 'deur', 'pas'];
  const b64 = buf => Buffer.from(buf).toString('base64url');
  const vanB64 = s => Buffer.from(String(s), 'base64url');

  function hmac(body) { return crypto.createHmac('sha256', sleutel).update(body).digest('base64url').slice(0, 16); }

  // een schoon codedeel: geen scheidingstekens, kort en leesbaar
  function schoonDeel(v) { return String(v == null ? '' : v).replace(/[|.\s]/g, '').slice(0, 48); }

  /* Maak een verse, ondertekende RTG-code. soort bepaalt wat het is (kas, tafel,
     entree ...), code is de payload (betaalcode, zaakcode:tafel, ...). */
  function maak(opts) {
    opts = opts || {};
    const soort = String(opts.soort || '').toLowerCase();
    if (!SOORTEN.includes(soort)) throw new Error('dyncode: onbekende soort ' + soort);
    const code = schoonDeel(opts.code);
    const ttl = Math.min(MAX_TTL, Math.max(1000, Number(opts.ttlMs) || DEFAULT_TTL));
    const exp = Date.now() + ttl;
    const nonce = crypto.randomBytes(4).toString('hex');
    const body = soort + '|' + code + '|' + Math.floor(exp / 1000).toString(36) + '|' + nonce;
    const token = 'RTG1.' + b64(body) + '.' + hmac(body);
    return { token, soort, code, exp, ttlMs: ttl };
  }

  /* Lees en verifieer een gescande code. Geeft { ok, soort, code, exp } terug,
     of { ok:false, reden }. Verwerpt vreemde (niet-RTG1), gemanipuleerde en
     verlopen codes -- timingvast op de handtekening. */
  function lees(token) {
    const s = String(token == null ? '' : token).trim();
    const p = s.split('.');
    if (p.length !== 3 || p[0] !== 'RTG1') return { ok: false, reden: 'geen RTG-code' };
    let body;
    try { body = vanB64(p[1]).toString('utf8'); } catch (e) { return { ok: false, reden: 'onleesbaar' }; }
    const verwacht = hmac(body);
    // timingvaste vergelijking van de handtekening
    const a = Buffer.from(p[2]), b = Buffer.from(verwacht);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reden: 'ongeldige handtekening' };
    const d = body.split('|');
    if (d.length !== 4) return { ok: false, reden: 'onleesbaar' };
    const exp = parseInt(d[2], 36) * 1000;
    if (!(exp > 0)) return { ok: false, reden: 'onleesbaar' };
    if (Date.now() > exp) return { ok: false, reden: 'verlopen' };
    return { ok: true, soort: d[0], code: d[1], exp };
  }

  return { maak, lees, SOORTEN, DEFAULT_TTL };
};
