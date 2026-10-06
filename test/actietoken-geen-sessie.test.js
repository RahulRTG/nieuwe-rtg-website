/* EEN ACTIETOKEN IS GEEN SESSIE (audit B-1, P0).

   WAT ER MISGING. Sessietokens (`<id>.<exp>.<uitgegeven>.<sid>`) en actietokens
   (`<id>.<doel>.<exp>.<nonce>`) worden met dezelfde sleutel ondertekend.
   verifyToken controleerde na de handtekening `Number(exp) < Date.now()`, maar
   bij een actietoken staat het DOEL in dat slot: Number("inlog2") is NaN en
   NaN < x is false. Elk actietoken -- verify-email, sso-overdracht, mailwissel
   en het 2FA-bewijs `inlog2` -- werkte daardoor als volwaardige sessie.

   DE TOETS. Een sessietoken blijft werken; elk actietoken als bearer is 401,
   ook het 2FA-bewijs (dat is de volledige tweefactor-bypass). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

const call = (base) => async (pad, body, tok) => {
  const r = await fetch(base + pad, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test('verify-email-actietoken als bearer is geen sessie, het sessietoken wel', async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const p = call(srv.base);
  try {
    const reg = await p('/api/auth/register', { name: 'Actie Lid', email: 'actielid@x.nl',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' });
    const sessie = reg.body.token;
    assert.ok(sessie, 'registreren: ' + JSON.stringify(reg.body).slice(0, 140));
    const m = String(reg.body.devVerifyUrl || '').match(/[?&]verify=([^&]+)/);
    assert.ok(m, 'de testopstelling geeft de verify-link terug: ' + JSON.stringify(reg.body).slice(0, 200));
    const vtok = decodeURIComponent(m[1]);

    // het echte sessietoken werkt
    assert.equal((await p('/api/auth/resend', {}, sessie)).status, 200, 'sessietoken moet blijven werken');
    // anoniem niet
    assert.equal((await p('/api/auth/resend', {})).status, 401);
    // het actietoken als bearer: dat was de bug
    const r = await p('/api/auth/resend', {}, vtok);
    assert.equal(r.status, 401, 'een verify-email-actietoken mag nooit als sessie gelden: ' + JSON.stringify(r.body).slice(0, 140));
  } finally { await stop(srv); }
});
