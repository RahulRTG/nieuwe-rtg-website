'use strict';
/* EEN JA OP EEN GELDVOORSTEL VAN RAHUL VRAAGT EEN BEZITSBEWIJS (integrator,
   19 oktober 2026: "een ja op een Rahul-voorstel die geld verplaatst hoort zeker
   in PADEN").

   /api/fluister is het gewone gesprek, en daar staat het stille codewoord: het
   hele pad zwaar maken laat een lid in nood op een toestelbewijs stranden. Dus
   is het pad VOORWAARDELIJK zwaar (server/kern/identiteit/bezitspaden.js):
     - het gesprek en het voorstel zelf blijven licht;
     - een ja op een vers Tik-voorstel zonder bewijs wordt geweigerd, en het
       voorstel BLIJFT staan, zodat het lid het op zijn toestel kan afmaken;
     - met een geldig bewijs gaat de ja door naar de uitvoering;
     - een ja zonder geldvoorstel is gewoon een gesprek. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { webcrypto } = require('crypto');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geldja-'));
async function api(pad, body, token, kop) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  if (kop) h['rtg-bezitsbewijs'] = kop;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_BEZITSBEWIJS: 'verplicht' } }); base = srv.base; });
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

async function lid() {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reg = (await api('/api/auth/register', { name: 'Ja ' + u, email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body;
  assert.ok(reg.token, 'registreren');
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const sign = async (t) => Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(t, 'utf8'))).toString('base64url');
  const teken = async (pad) => {
    const kop = Buffer.from(JSON.stringify({ methode: 'POST', pad, tijd: Date.now(), jti: 'j' + Math.random().toString(36).slice(2).padEnd(20, 'x').slice(0, 20) })).toString('base64url');
    return kop + '.' + await sign(kop);
  };
  return { token: reg.token, jwk, sign, teken };
}
const zeg = (l, q, kop) => api('/api/fluister', { q }, l.token, kop);
const geweigerd = (r) => r.body && r.body.bezitsbewijs === 'vereist';

test('een ja op een Tik zonder bewijs verplaatst niets; het voorstel blijft staan', async () => {
  const l = await lid();
  assert.equal(geweigerd(await zeg(l, 'ja')), false, 'een ja zonder geldvoorstel is gewoon een gesprek');
  const v = await zeg(l, 'stuur 5 euro naar Noordelijke Ster');
  assert.equal(v.status, 200, 'het voorstel zelf is licht: ' + JSON.stringify(v.body).slice(0, 160));

  const los = await zeg(l, 'ja');
  assert.equal(los.status, 403, 'ongebonden: ' + JSON.stringify(los.body).slice(0, 160));
  assert.ok(geweigerd(los));
  assert.equal(geweigerd(await zeg(l, 'hoe laat is het?')), false, 'het gesprek zelf blijft licht');

  const u = (await api('/api/mijn/toestel/uitdaging', {}, l.token)).body;
  assert.equal((await api('/api/mijn/toestel/bind', { jwk: l.jwk, handtekening: await l.sign(u.nonce), naam: 'Telefoon' }, l.token)).status, 200);
  const zonder = await zeg(l, 'ja');
  assert.equal(zonder.status, 401, 'gebonden zonder bewijs: ' + JSON.stringify(zonder.body).slice(0, 160));

  const met = await zeg(l, 'ja', await l.teken('/api/fluister'));
  assert.equal(geweigerd(met), false, 'met een geldig bewijs gaat de ja door: ' + JSON.stringify(met.body).slice(0, 160));
  assert.doesNotMatch(String(met.body.antwoord || ''), /niets open om te bevestigen/,
    'het voorstel stond nog open na de weigeringen');
});
