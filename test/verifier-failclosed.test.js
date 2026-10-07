'use strict';
/* A-P1-04: EEN KAPOTTE VERIFIER IS GEEN JA.

   Onder elke zware handeling staat iets wat moet nakijken: het sessieregister
   (is deze sessie aan een sleutel gebonden?), het bezitsbewijs, de zware poort
   (passkey) en de wachtwoordcontrole. Elk daarvan kan stuk gaan. De vorm die dit
   huis vaker heeft gezien is een `catch` die dan stil verder gaat -- en bij juist
   deze vier betekent verder gaan: doorlaten.

   De storingen zijn ECHT en niet nagebootst in de toets: server/lib/verraad.js
   laat de verifier zelf gooien op het punt waar hij in productie zou gooien
   (catalogusregels sessieregister-faalt, bezitsbewijs-faalt, passkeypoort-faalt,
   wachtwoordcontrole-faalt). Per storing een eigen server op dezelfde datamap,
   zodat het account en zijn binding van VOOR de storing zijn. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { webcrypto } = require('crypto');
const { startServer, stop, stopNet } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-verifier-'));
const WW = 'geheim123';
let base, srv, lid, sleutel;

async function api(pad, body, token, kop) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  if (kop) h['rtg-bezitsbewijs'] = kop;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function maakSleutel() {
  const kp = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const jwk = await webcrypto.subtle.exportKey('jwk', kp.publicKey);
  const sign = async (t) => Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' },
    kp.privateKey, Buffer.from(t, 'utf8'))).toString('base64url');
  const teken = async (methode, pad) => {
    const kop = Buffer.from(JSON.stringify({ methode, pad, tijd: Date.now(),
      jti: 'j' + Math.random().toString(36).slice(2).padEnd(20, 'x').slice(0, 20) })).toString('base64url');
    return kop + '.' + await sign(kop);
  };
  return { jwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, sign, teken };
}
async function opnieuw(verraad) {
  await stopNet(srv.child);
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_VERRAAD: verraad } });
  base = srv.base;
}

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  const u = Date.now().toString(36);
  const reg = await api('/api/auth/register', { name: 'Verifier ' + u, email: 'verifier' + u + '@x.nl', password: WW,
    geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, JSON.stringify(reg.body).slice(0, 160));
  sleutel = await maakSleutel();
  const uit = await api('/api/mijn/toestel/uitdaging', {}, lid);
  const b = await api('/api/mijn/toestel/bind', { jwk: sleutel.jwk, handtekening: await sleutel.sign(uit.body.nonce), naam: 'T' }, lid);
  assert.equal(b.status, 200, JSON.stringify(b.body).slice(0, 160));
  assert.equal(b.body.inSessie, true);
  /* De nulmeting: zonder storing gaat het zware pad met een geldig bewijs door,
     en zonder bewijs niet. Anders bewijst een weigering hieronder niets. */
  assert.notEqual((await api('/api/privacy/inzage', {}, lid, await sleutel.teken('POST', '/api/privacy/inzage'))).status, 401);
  assert.equal((await api('/api/privacy/inzage', {}, lid)).status, 401);
});
test.after(() => { stop(srv); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

test('sessieregister-faalt: een binding die niet te lezen is, klinkt niet als "geen binding"', async () => {
  await opnieuw('sessieregister-faalt');
  /* De dief heeft alleen het token. Met een leesbaar register: 401 (binding,
     geen bewijs). Met een kapot register mocht dat geen "ongebonden" worden --
     in de stand `aanbevolen` (die de toetshelper zet) komt een ongebonden sessie
     door. */
  const dief = await api('/api/privacy/inzage', {}, lid);
  assert.equal(dief.status, 503, 'een onleesbaar register liet een zwaar pad door: ' + dief.status + ' ' + JSON.stringify(dief.body).slice(0, 160));
  assert.equal(dief.body.bezitsbewijs, 'vereist');
  const licht = await api('/api/auth/me', {}, lid);
  assert.equal(licht.status, 200, 'een licht pad loopt door: een storing is geen overtreding');
});

test('bezitsbewijs-faalt: een bewijs dat niet kon worden nagekeken, is geen bewijs', async () => {
  await opnieuw('bezitsbewijs-faalt');
  const r = await api('/api/privacy/inzage', {}, lid, await sleutel.teken('POST', '/api/privacy/inzage'));
  assert.equal(r.status, 503, JSON.stringify(r.body).slice(0, 160));
  assert.equal(r.body.bezitsbewijs, 'vereist');
});

test('passkeypoort-faalt en wachtwoordcontrole-faalt: geen terugval, geen uitdaging', async () => {
  await opnieuw('passkeypoort-faalt,wachtwoordcontrole-faalt');
  /* Dit account heeft geen passkey, dus de zware poort zou op de terugval
     doorlaten -- als een storing als "geen passkey" werd gelezen. */
  const weg = await api('/api/webauthn/weg', { id: 'x' }, lid, await sleutel.teken('POST', '/api/webauthn/weg'));
  assert.equal(weg.status, 503, 'een kapotte passkeypoort viel terug op doorlaten: ' + weg.status + ' ' + JSON.stringify(weg.body).slice(0, 160));
  const reg = await api('/api/webauthn/registreer/opties', { huidig: WW }, lid, await sleutel.teken('POST', '/api/webauthn/registreer/opties'));
  assert.equal(reg.status, 503, 'een wachtwoordcontrole die niet kon draaien gaf een uitdaging: ' + JSON.stringify(reg.body).slice(0, 160));
  assert.equal(reg.body.opties, undefined);
});
