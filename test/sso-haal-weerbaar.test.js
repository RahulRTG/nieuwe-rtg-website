/* DE UITGAANDE DEUR NAAR DE IDENTITEITSPROVIDER (server/sso/haal.js).

   haalJson en postForm zijn de enige plek waar de server op verzoek van een
   INSTELLING een adres aanroept. keurUrl (https, geen intern adres) staat al in
   test/sso.test.js; wat de deur doet met het ANTWOORD stond nergens. Hier
   wordt https.get/https.request vervangen door een nep-verbinding (zonder
   netwerk, zonder timers), zodat elk antwoord van de provider precies na te
   bootsen is -- ook dat de hele tokenwissel via de echte deur loopt.

   Wat hier niet mag sneuvelen:
   1. een omleiding wordt NIET gevolgd (een 302 naar een intern adres is hoe je
      keurUrl omzeilt), en het lichaam ervan wordt weggegooid;
   2. een andere status dan 200, een antwoord groter dan MAX_BYTES, geen JSON,
      een stille provider (timeout) of een netwerkfout: een nette fout, en bij
      te groot of te traag wordt de verbinding afgebroken;
   3. bij de tokenwissel gaat het client-geheim als Basic-kop mee en nooit in
      de body; een foutantwoord van de provider geeft alleen error en
      error_description door, niet de rest van wat hij stuurde;
   4. wisselCode zonder ingespoten gereedschap gebruikt deze echte deur, voor
      zowel de POST als de sleutelbos.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in haalJson de omleidingsweigering (`if (res.statusCode >= 300 ...)`)
     vervangen door `if (false)` -> "1." ZAKT (RAAK);
   - in postForm `if (lengte > MAX_BYTES)` vervangen door `if (false)` -> "2."
     ZAKT (RAAK: de verbinding bleef open);
   - in postForm `json.error + ...` vervangen door `tekst` -> "3." ZAKT (RAAK:
     het geheime veld van de provider lekte in de foutmelding).

   Draai: node --test test/sso-haal-weerbaar.test.js */
'use strict';
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const https = require('https');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const haal = require('../server/sso/haal');
const oidc = require('../server/sso/oidc');
const jwks = require('../server/sso/jwks');

const echt = { get: https.get, request: https.request };
afterEach(() => { https.get = echt.get; https.request = echt.request; jwks.leeg(); });

/* Een nep-verbinding: `script(req)` zegt wat de provider doet. */
function nep(soort, script) {
  const log = [];
  https[soort] = (u, opties, cb) => {
    const req = new EventEmitter();
    const r = { adres: String(u), opties, body: '', afgebroken: false };
    log.push(r);
    req.destroy = () => { r.afgebroken = true; };
    req.end = (b) => { r.body = String(b || ''); };
    process.nextTick(() => {
      const a = typeof script === 'function' ? script(r) : script;
      if (a.timeout) return req.emit('timeout');
      if (a.fout) return req.emit('error', new Error(a.fout));
      const res = new EventEmitter();
      res.statusCode = a.status || 200;
      res.resume = () => { r.hervat = true; };
      cb(res);
      for (const d of a.delen || []) res.emit('data', Buffer.from(d));
      res.emit('end');
    });
    return req;
  };
  return log;
}
const ADRES = 'https://idp.haal.test/.well-known/openid-configuration';

test('1. een omleiding wordt niet gevolgd, en het lichaam wordt weggegooid', async () => {
  const log = nep('get', { status: 302, delen: ['{"issuer":"x"}'] });
  await assert.rejects(haal.haalJson(ADRES), /stuurt een omleiding \(302\)/);
  assert.equal(log.length, 1, 'geen tweede verzoek');
  assert.equal(log[0].hervat, true);
  assert.equal(log[0].opties.headers.accept, 'application/json');
});

test('2. status, grootte, JSON, timeout en netwerkfout bij het ophalen', async () => {
  nep('get', { status: 500 });
  await assert.rejects(haal.haalJson(ADRES), /antwoordde met status 500/);
  const groot = nep('get', { delen: ['x'.repeat(haal.MAX_BYTES), 'y'] });
  await assert.rejects(haal.haalJson(ADRES), /groter dan 524288 bytes/);
  assert.equal(groot[0].afgebroken, true, 'een te groot antwoord breekt de verbinding af');
  nep('get', { delen: ['{geen json'] });
  await assert.rejects(haal.haalJson(ADRES), /geen geldige JSON/);
  const traag = nep('get', { timeout: true });
  await assert.rejects(haal.haalJson(ADRES), /niet binnen 8000 ms/);
  assert.equal(traag[0].afgebroken, true);
  nep('get', { fout: 'ECONNREFUSED' });
  await assert.rejects(haal.haalJson(ADRES), /niet bereikbaar: ECONNREFUSED/);
  nep('get', { delen: ['{"a":', '1}'] });
  assert.deepEqual(await haal.haalJson(ADRES), { a: 1 }, 'een antwoord in stukken wordt heel');
});

test('3. de tokenwissel: geheim in de kop, foutantwoord alleen met de protocolvelden', async () => {
  const log = nep('request', { delen: ['{"id_token":"t"}'] });
  assert.deepEqual(await haal.postForm('https://idp.haal.test/token', { code: 'c', client_id: 'k' }, { basic: 'k:geheim' }), { id_token: 't' });
  assert.equal(log[0].opties.method, 'POST');
  assert.equal(log[0].opties.headers.authorization, 'Basic ' + Buffer.from('k:geheim').toString('base64'));
  assert.equal(log[0].body, 'code=c&client_id=k');
  assert.ok(!log[0].body.includes('geheim') && !log[0].adres.includes('geheim'), 'het geheim staat niet in body of adres');
  const zonder = nep('request', { delen: ['{}'] });
  await haal.postForm('https://idp.haal.test/token', { a: 1 });
  assert.equal(zonder[0].opties.headers.authorization, undefined);

  nep('request', { status: 400, delen: [JSON.stringify({ error: 'invalid_grant', error_description: 'code gebruikt', intern: 'GEHEIM-SPOOR' })] });
  const fout = await haal.postForm('https://idp.haal.test/token', {}).catch(e => e);
  assert.match(fout.message, /wees de tokenwissel af \(invalid_grant: code gebruikt\)/);
  assert.ok(!fout.message.includes('GEHEIM-SPOOR'));
  nep('request', { status: 401, delen: ['{"error":"invalid_client"}'] });
  await assert.rejects(haal.postForm('https://idp.haal.test/token', {}), /\(invalid_client\)/);
  nep('request', { status: 503, delen: ['<html>storing</html>'] });
  await assert.rejects(haal.postForm('https://idp.haal.test/token', {}), /\(status 503\)/);
  nep('request', { delen: ['geen json'] });
  await assert.rejects(haal.postForm('https://idp.haal.test/token', {}), /geen geldige JSON bij de tokenwissel/);
  const groot = nep('request', { delen: ['x'.repeat(haal.MAX_BYTES + 1)] });
  await assert.rejects(haal.postForm('https://idp.haal.test/token', {}), /te groot/);
  assert.equal(groot[0].afgebroken, true);
  const traag = nep('request', { timeout: true });
  await assert.rejects(haal.postForm('https://idp.haal.test/token', {}), /niet binnen/);
  assert.equal(traag[0].afgebroken, true);
  nep('request', { fout: 'EHOSTUNREACH' });
  await assert.rejects(haal.postForm('https://idp.haal.test/token', {}), /niet bereikbaar: EHOSTUNREACH/);
});

test('4. wisselCode zonder gereedschap loopt via de echte deur, voor POST en sleutelbos', async () => {
  const paar = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = Object.assign(paar.publicKey.export({ format: 'jwk' }), { kid: 'h1' });
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const stuk = b64({ alg: 'RS256', kid: 'h1' }) + '.' + b64({ iss: 'https://idp.haal.test', aud: 'cl', sub: 'mw-1', exp: Math.floor(Date.now() / 1000) + 60 });
  const idToken = stuk + '.' + crypto.sign('sha256', Buffer.from(stuk), paar.privateKey).toString('base64url');
  const posts = nep('request', { delen: [JSON.stringify({ id_token: idToken })] });
  const gets = nep('get', { delen: [JSON.stringify({ keys: [jwk] })] });
  const doc = { issuer: 'https://idp.haal.test', token_endpoint: 'https://idp.haal.test/token', jwks_uri: 'https://idp.haal.test/jwks' };
  const uit = await oidc.wisselCode(doc, { clientId: 'cl', code: 'c', verifier: 'v' });
  assert.equal(uit.claims.sub, 'mw-1');
  assert.equal(posts[0].adres, 'https://idp.haal.test/token');
  assert.equal(gets[0].adres, 'https://idp.haal.test/jwks');
});
