/* Bewijst de JOSE/JWS-laag en de VOLLEDIGE ACME-toestandsmachine offline: een
   nep-CA (een injecteerbare transport) speelt Let's Encrypt na en VERIFIEERT elke
   JWS-handtekening met de accountsleutel, en "valideert" de HTTP-01-challenge door
   -- net als de echte CA -- de keyAuthorization uit dezelfde challenge-winkel te
   lezen die de client publiceert. Komt de flow tot een geldig certificaat, dan
   klopt onze account-, order-, challenge- en finalize-afhandeling. Draai los:
   node --experimental-sqlite --test test/tls-acme.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jws = require('../server/lib/jws');
const x509 = require('../server/lib/x509');
const acme = require('../server/lib/acme');

test('JWS: een ES256-handtekening verifieert, en de thumbprint is stabiel en padding-vrij', () => {
  const key = x509.genKeyPair({ type: 'ec' }).privateKey;
  const { alg, jwk } = jws.jwkVan(key);
  assert.equal(alg, 'ES256');
  const j = jws.tekenJWS({ alg, nonce: 'n1', url: 'https://x/y', jwk }, { hallo: 'wereld' }, key);
  const invoer = Buffer.from(j.protected + '.' + j.payload);
  const ok = crypto.verify('sha256', invoer, { key: crypto.createPublicKey(key), dsaEncoding: 'ieee-p1363' }, Buffer.from(j.signature, 'base64url'));
  assert.ok(ok, 'de JWS-handtekening (RAW r||s) verifieert met de publieke sleutel');
  const t1 = jws.thumbprint(jwk), t2 = jws.thumbprint(jwk);
  assert.equal(t1, t2, 'thumbprint is deterministisch');
  assert.doesNotMatch(t1, /[+/=]/, 'thumbprint is base64url zonder padding');
});

// Nep-CA: minimale ACME-server als vraag()-compatibele transport. Verifieert elke
// binnenkomende JWS en valideert de challenge via de gedeelde winkel.
function nepCA(winkel) {
  const B = 'https://acme.test';
  const url = { dir: B + '/dir', nonce: B + '/nonce', newAccount: B + '/acct', newOrder: B + '/neworder',
    account: B + '/acct/1', order: B + '/order/1', authz: B + '/authz/1', chall: B + '/chall/1', finalize: B + '/finalize/1', cert: B + '/cert/1' };
  const uitgegeven = x509.selfSigned({ names: ['example.test'], cn: 'example.test' }).certPem; // wat de "CA" teruggeeft
  let acctJwk = null, authGeldig = false, orderGeldig = false, n = 0;
  const resp = (status, headers, body) => {
    const tekst = typeof body === 'string' ? body : (body == null ? '' : JSON.stringify(body));
    return Promise.resolve({ status, headers: Object.assign({ 'replay-nonce': 'nonce-' + (++n) }, headers), tekst, json: () => JSON.parse(tekst) });
  };
  function verifieerJWS(bodyStr) {
    const j = JSON.parse(bodyStr);
    const beschermd = JSON.parse(Buffer.from(j.protected, 'base64url').toString());
    const gebruikteJwk = beschermd.jwk || acctJwk;
    const pub = crypto.createPublicKey({ key: gebruikteJwk, format: 'jwk' });
    const ok = crypto.verify('sha256', Buffer.from(j.protected + '.' + j.payload), { key: pub, dsaEncoding: 'ieee-p1363' }, Buffer.from(j.signature, 'base64url'));
    assert.ok(ok, 'de nep-CA verifieert de binnenkomende JWS-handtekening');
    return { beschermd, payload: j.payload ? JSON.parse(Buffer.from(j.payload, 'base64url').toString()) : '' };
  }
  return function vraag(o) {
    if (o.method === 'GET' && o.url === url.dir) return resp(200, {}, { newNonce: url.nonce, newAccount: url.newAccount, newOrder: url.newOrder });
    if (o.method === 'HEAD' && o.url === url.nonce) return resp(200, {}, '');
    const { beschermd } = verifieerJWS(o.body);
    if (o.url === url.newAccount) { acctJwk = beschermd.jwk; return resp(201, { location: url.account }, { status: 'valid' }); }
    if (o.url === url.newOrder) return resp(201, { location: url.order }, { status: 'pending', authorizations: [url.authz], finalize: url.finalize });
    if (o.url === url.authz) return resp(200, {}, { status: authGeldig ? 'valid' : 'pending', identifier: { type: 'dns', value: 'example.test' }, challenges: [{ type: 'http-01', token: 'tok-123', url: url.chall, status: authGeldig ? 'valid' : 'pending' }] });
    if (o.url === url.chall) { // de "CA" haalt de keyAuthorization op zoals via .well-known
      const verwacht = 'tok-123.' + jws.thumbprint(acctJwk);
      if (winkel.haal('tok-123') === verwacht) authGeldig = true;
      return resp(200, {}, { status: authGeldig ? 'valid' : 'pending' });
    }
    if (o.url === url.finalize) { orderGeldig = true; return resp(200, {}, { status: 'valid', certificate: url.cert }); }
    if (o.url === url.order) return resp(200, {}, { status: orderGeldig ? 'valid' : 'processing', certificate: orderGeldig ? url.cert : undefined, finalize: url.finalize, authorizations: [url.authz] });
    if (o.url === url.cert) return resp(200, { 'content-type': 'application/pem-certificate-chain' }, uitgegeven);
    return resp(404, {}, { type: 'urn:ietf:params:acme:error:malformed' });
  };
}

test('ACME: de volledige flow (account -> order -> HTTP-01 -> finalize) levert een geldig certificaat', async () => {
  const winkel = acme.maakUitdagingWinkel();
  const client = acme.maakAcme({
    vraag: nepCA(winkel), winkel, directoryUrl: 'https://acme.test/dir',
    slaap: () => Promise.resolve()          // geen echte wachttijd tijdens het pollen
  });
  const res = await client.verkrijgCertificaat({ domains: ['example.test'], email: 'roellie.i@gmail.com' });
  const info = x509.certInfo(res.certPem);
  assert.match(info.subject, /CN=example\.test/, 'we kregen een certificaat voor het domein terug');
  assert.ok(res.geldigTot > new Date(), 'het certificaat is geldig');
  assert.ok(res.keyPem.includes('PRIVATE KEY'), 'en de bijbehorende private sleutel');
  assert.equal(winkel.aantal(), 0, 'de challenge is na afloop weer opgeruimd uit de winkel');
});

test('de challenge-winkel-middleware serveert alleen de keyAuthorization op het juiste pad', () => {
  const winkel = acme.maakUitdagingWinkel();
  winkel.zet('abc', 'abc.duim');
  const roep = (u) => { let code, body; const res = { setHeader() {}, end(b) { body = b; }, get statusCode() { return code; }, set statusCode(c) { code = c; } };
    let door = false; winkel.middleware({ url: u }, res, () => { door = true; }); return { code: res.statusCode, body, door }; };
  const raak = roep('/.well-known/acme-challenge/abc');
  assert.equal(raak.body, 'abc.duim', 'het juiste token krijgt zijn keyAuthorization');
  const mis = roep('/.well-known/acme-challenge/xyz');
  assert.equal(mis.code, 404, 'een onbekend token is 404');
  const ander = roep('/api/state');
  assert.ok(ander.door, 'een ander pad valt gewoon door naar de app (next)');
});
