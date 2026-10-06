'use strict';
/* A-P1-04: zware paden vragen STANDAARD een bezitsbewijs van een gebonden sessie,
   over de echte server en zonder RTG_BEZITSBEWIJS in de omgeving. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { webcrypto } = require('crypto');
const { startServer, stop } = require('./helper');

let srv, base;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bezit-'));
async function api(pad, body, token, kop) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  if (kop) h['rtg-bezitsbewijs'] = kop;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})), kop: r.headers };
}
test.before(async () => {
  const env = { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_BEZITSBEWIJS: '' };
  srv = await startServer({ env }); base = srv.base;
});
test.after(() => stop(srv));

async function lidMetToestel() {
  const u = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const reg = (await api('/api/auth/register', { name: 'Bezit ' + u, email: u + '@x.nl',
    phone: '06' + u.replace(/\D/g, '').padEnd(8, '1').slice(0, 8),
    password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })).body;
  assert.ok(reg.token);
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const sign = async (t) => Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(t, 'utf8'))).toString('base64url');
  const teken = async (methode, pad) => {
    const kop = Buffer.from(JSON.stringify({ methode, pad, tijd: Date.now(), jti: 'j' + Math.random().toString(36).slice(2).padEnd(20, 'x').slice(0, 20) })).toString('base64url');
    return kop + '.' + await sign(kop);
  };
  return { token: reg.token, jwk, sign, teken };
}

test('1. een ONGEBONDEN sessie met account wordt standaard geweigerd, met de weg erheen', async () => {
  const l = await lidMetToestel();
  const r = await api('/api/privacy/inzage', {}, l.token);
  assert.equal(r.status, 403, 'zonder toestelbinding geen zwaar pad: ' + JSON.stringify(r.body).slice(0, 160));
  assert.match(String(r.body.error), /Bevestig dit toestel/, 'de weigering zegt hoe het wel kan');
  assert.equal(r.body.bezitsbewijs, 'vereist');
});

test('1b. de weg erheen blijft open: binden zelf is geen zwaar pad', async () => {
  const l = await lidMetToestel();
  const u = (await api('/api/mijn/toestel/uitdaging', {}, l.token));
  assert.equal(u.status, 200, 'een ongebonden sessie moet kunnen binden, anders is dit een buitensluiting');
});

test('2. een GEBONDEN sessie zonder bewijs wordt standaard geweigerd; met geldig bewijs niet', async () => {
  const l = await lidMetToestel();
  const u = (await api('/api/mijn/toestel/uitdaging', {}, l.token)).body;
  assert.ok(u.nonce, 'uitdaging: ' + JSON.stringify(u).slice(0, 120));
  const b = await api('/api/mijn/toestel/bind', { jwk: l.jwk, handtekening: await l.sign(u.nonce), naam: 'Testtoestel' }, l.token);
  assert.equal(b.status, 200, 'binden: ' + JSON.stringify(b.body).slice(0, 160));
  assert.equal(b.body.inSessie, true);

  const zonder = await api('/api/privacy/inzage', {}, l.token);
  assert.equal(zonder.status, 401, 'een gestolen token uit een gebonden sessie komt er niet door: ' + JSON.stringify(zonder.body));
  assert.equal(zonder.body.bezitsbewijs, 'vereist');

  const met = await api('/api/privacy/inzage', {}, l.token, await l.teken('POST', '/api/privacy/inzage'));
  assert.notEqual(met.status, 401, 'met een geldig bewijs gaat hij door: ' + JSON.stringify(met.body).slice(0, 160));

  const hergebruik = await api('/api/privacy/inzage', {}, l.token, await l.teken('POST', '/api/privacy/export'));
  assert.equal(hergebruik.status, 401, 'een bewijs voor een ander pad dekt deze handeling niet');
});
