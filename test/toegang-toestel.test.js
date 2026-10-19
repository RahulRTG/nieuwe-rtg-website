/* EEN PASSKEY HOORT BIJ ELK ACCOUNT, OOK EEN GRATIS ACCOUNT (eigenaarsbesluit
   19 oktober 2026; uitwerking bij AUTHORITY.md par. 7a).

   /api/mijn/toestel/{uitdaging,bind,noem,introk} weigerden tier "guest" -- en
   daarmee ook het gratis account, dat een echt account is met die tier. Nu:
     - een gratis account bindt een toestel (en kan het noemen en intrekken);
     - een gastsessie zonder account blijft geweigerd (buiten de demo al 401);
     - een account bindt nooit een toestel aan een ANDER account: de sleutel
       komt uit de sessie, een uitdaging hoort bij het account dat hem vroeg, en
       een toestel van A is voor B onbekend. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { webcrypto } = require('crypto');
const { startServer, stop } = require('./helper');
const { registreerGratis } = require('../scripts/lib/gratisaccount');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-toegang-toestel-'));
let srv, BASE;
const post = (pad, body, tok) => fetch(BASE + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
async function paar() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const teken = async (n) => Buffer.from(await webcrypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, kp.privateKey, Buffer.from(String(n), 'utf8'))).toString('base64url');
  return { jwk, teken };
}

test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } }); BASE = srv.base; });
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('een gratis account bindt een toestel, een gastsessie niet', async () => {
  const a = await registreerGratis(BASE);
  const t = await paar();
  const u = await post('/api/mijn/toestel/uitdaging', {}, a.token);
  assert.equal(u.status, 200, 'een uitdaging voor een gratis account: ' + JSON.stringify(u.body));
  const b = await post('/api/mijn/toestel/bind', { jwk: t.jwk, handtekening: await t.teken(u.body.nonce), naam: 'Telefoon' }, a.token);
  assert.equal(b.status, 200, 'een gratis account bindt een toestel: ' + JSON.stringify(b.body));
  assert.equal((await post('/api/mijn/toestel/noem', { toestelId: b.body.toestelId, naam: 'Mijn telefoon' }, a.token)).status, 200,
    'en noemt het');

  const gast = (await post('/api/login', { tier: 'guest', pasApp: 'rtg' })).body.token;   // de demo-gastinlog: geen account
  assert.ok(gast, 'de demo heeft nog een gastinlog');
  assert.equal((await post('/api/mijn/toestel/uitdaging', {}, gast)).status, 403, 'een gastsessie zonder account bindt niets');
});

test('een account bindt nooit een toestel aan een ander account', async () => {
  const a = await registreerGratis(BASE);
  const b = await registreerGratis(BASE);
  const t = await paar();
  const uA = await post('/api/mijn/toestel/uitdaging', {}, a.token);
  /* B stuurt de handtekening over de uitdaging van A, en noemt A in het lijf:
     de sleutel komt uit de sessie en de uitdaging hoort bij A, dus niets. */
  const kaping = await post('/api/mijn/toestel/bind', { jwk: t.jwk, handtekening: await t.teken(uA.body.nonce),
    lidKey: 'user-1', key: 'user-1', account: 'user-1' }, b.token);
  assert.notEqual(kaping.status, 200, 'een handtekening over de uitdaging van een ander bindt niets: ' + JSON.stringify(kaping.body));

  const bindA = await post('/api/mijn/toestel/bind', { jwk: t.jwk, handtekening: await t.teken(uA.body.nonce) }, a.token);
  assert.equal(bindA.status, 200, JSON.stringify(bindA.body));
  const tid = bindA.body.toestelId;
  assert.notEqual((await post('/api/mijn/toestel/noem', { toestelId: tid, naam: 'Van mij' }, b.token)).status, 200,
    'B noemt het toestel van A niet');
  assert.notEqual((await post('/api/mijn/toestel/introk', { toestelId: tid }, b.token)).status, 200,
    'B trekt het toestel van A niet in');
  assert.equal((await post('/api/mijn/toestel/noem', { toestelId: tid, naam: 'Nog steeds van mij' }, a.token)).status, 200,
    'het toestel staat nog op A');
});
