/* OIDC-DANS, SLEUTELKAST EN STATE (server/sso/oidc.js, jwks.js,
   staat.js, haal.js).

   De TOKENWISSEL (wisselCode) en de sleutelkast (jwks.maakBos) waren nergens
   aangeroepen, en juist die beslissen of een code uit de browser een
   ingelogde medewerker wordt. Zonder netwerk: POST en ophaler ingespoten.

   Wat hier niet mag sneuvelen:
   1. zonder id_token niets; het client-geheim gaat als Basic-kop, niet in de body;
   2. het id_token wordt tegen iss, aud (= client-id) en nonce gecontroleerd;
   3. een onbekende kid geeft één verversing van de bos, een andere fout geen
      (anders zet elke aanvaller ons aan het werk);
   4. sleutelkast: binnen de houdbaarheid niet opnieuw halen; bij storing de
      oude bos; de rem stopt een stortvloed kids; zonder oude bos een fout;
   5. discovery: geen object of geen issuer is een weigering; cache vervalt;
   6. state: geknoeid, geen JSON, verlopen of onvolledig is null; postForm
      weigert een intern adres vóór er een verbinding is.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - wisselCode `if (!e.onbekendeKid) throw e;` weg -> "3." ZAKT (RAAK);
   - jwks.ververs `nu - staat.laatstePoging < VERVERS_RUST_MS` -> `false`:
     "4." ZAKT (RAAK: binnen de rust werd opnieuw gehaald);
   - in staat.uitpakken `Number(o.tot) < Date.now()` vervangen door `false`
     -> "6." ZAKT (RAAK).

   Draai: node --test test/sso-oidc-weerbaar.test.js */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-oidc-'));
process.env.RTG_DATA_DIR = TMP;
require('../server/accounts').init();
const kluis = require('../server/accounts/kluis');
const oidc = require('../server/sso/oidc');
const jwks = require('../server/sso/jwks');
const staat = require('../server/sso/staat');
const { postForm, keurUrl } = require('../server/sso/haal');
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const paar = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const JWK = Object.assign(paar.publicKey.export({ format: 'jwk' }), { kid: 'k1', use: 'sig' });
const ISS = 'https://idp.oidc.test';
const DOC = { issuer: ISS, token_endpoint: ISS + '/token', jwks_uri: ISS + '/jwks', authorization_endpoint: ISS + '/auth' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(claims, kid) {
  const stuk = b64({ alg: 'RS256', kid: kid || 'k1' }) + '.' + b64(Object.assign({ iss: ISS, aud: 'cl', sub: 's1', nonce: 'n', exp: Math.floor(Date.now() / 1000) + 300 }, claims));
  return stuk + '.' + crypto.sign('sha256', Buffer.from(stuk), paar.privateKey).toString('base64url');
}
function klok() { const echt = Date.now; let nu = echt(); Date.now = () => nu; return { verder: (ms) => { nu += ms; }, terug: () => { Date.now = echt; } }; }

test('1+2. de tokenwissel: geheim als Basic-kop, id_token gecontroleerd tegen client en nonce', async () => {
  let gezien;
  const post = async (adres, velden, opties) => { gezien = { adres, velden, opties }; return { id_token: token({}) }; };
  const bos = { bos: async () => ({ keys: [JWK] }), ververs: async () => assert.fail('geen reden om te verversen') };
  const uit = await oidc.wisselCode(DOC, { clientId: 'cl', clientSecret: 'geheim', redirectUri: 'https://rtg.test/terug', code: 'c1', verifier: 'v1' },
    { postForm: post, bos, nonce: 'n' });
  assert.equal(uit.claims.sub, 's1');
  assert.equal(gezien.adres, ISS + '/token');
  assert.equal(gezien.opties.basic, 'cl:geheim');
  assert.equal(gezien.velden.client_secret, undefined, 'het geheim staat niet in de body');
  assert.deepEqual([gezien.velden.code, gezien.velden.code_verifier, gezien.velden.grant_type], ['c1', 'v1', 'authorization_code']);

  await oidc.wisselCode(DOC, { clientId: 'cl', code: 'c', verifier: 'v' }, { postForm: post, bos, nonce: 'n' });
  assert.deepEqual(gezien.opties, {});
  await assert.rejects(oidc.wisselCode(DOC, { clientId: 'andere-client', code: 'c', verifier: 'v' }, { postForm: post, bos, nonce: 'n' }), /niet voor ons bestemd/);
  await assert.rejects(oidc.wisselCode(DOC, { clientId: 'cl', code: 'c', verifier: 'v' }, { postForm: post, bos, nonce: 'ander' }), /nonce/);
  await assert.rejects(oidc.wisselCode(DOC, { clientId: 'cl', code: 'c', verifier: 'v' }, { postForm: async () => ({ access_token: 'x' }), bos }), /geen id_token/);
  await assert.rejects(oidc.wisselCode(DOC, { clientId: 'cl', code: 'c', verifier: 'v' }, { postForm: async () => null, bos }), /geen id_token/);
});

test('3. een onbekende kid geeft één verversing; een andere fout geen enkele', async () => {
  let ververst = 0;
  const vers = Object.assign({}, JWK, { kid: 'k2' });
  const bos = { bos: async () => ({ keys: [JWK] }), ververs: async () => { ververst++; return { keys: [vers] }; } };
  const post = async () => ({ id_token: token({}, 'k2') });
  const uit = await oidc.wisselCode(DOC, { clientId: 'cl', code: 'c', verifier: 'v' }, { postForm: post, bos, nonce: 'n' });
  assert.equal(uit.claims.sub, 's1');
  assert.equal(ververst, 1);
  const vals = async () => ({ id_token: token({}).slice(0, -6) + 'AAAAAA' });
  await assert.rejects(oidc.wisselCode(DOC, { clientId: 'cl', code: 'c', verifier: 'v' }, { postForm: vals, bos, nonce: 'n' }), /handtekening/);
  assert.equal(ververst, 1, 'een kapotte handtekening is geen reden om te verversen');
});

test('4. de sleutelkast: houdbaarheid, oude bos bij storing, verversingsrem, lege bos', async () => {
  const k = klok();
  try {
    const adres = 'https://idp.kast.test/jwks';
    jwks.leeg();
    let gehaald = 0, stuk = false;
    const haal = async () => { gehaald++; if (stuk) throw new Error('provider plat'); return { keys: [JWK] }; };
    const post = async () => ({ id_token: token({}) });
    await oidc.wisselCode(Object.assign({}, DOC, { jwks_uri: adres }), { clientId: 'cl', code: 'c', verifier: 'v' }, { postForm: post, haalJson: haal, nonce: 'n' });
    const b = jwks.maakBos(haal);
    await b.bos(adres);
    assert.equal(gehaald, 1, 'binnen de houdbaarheid niet opnieuw halen');
    k.verder(jwks.HOUDBAAR_MS + 1); stuk = true;
    assert.deepEqual(await b.bos(adres), { keys: [JWK] }, 'de provider hapert: de oude bos blijft');
    assert.equal(gehaald, 2);
    assert.deepEqual(await b.ververs(adres), { keys: [JWK] }, 'binnen de rust geen nieuwe poging');
    assert.equal(gehaald, 2);
    k.verder(jwks.VERVERS_RUST_MS + 1);
    assert.deepEqual(await b.ververs(adres), { keys: [JWK] }, 'na de rust wel een poging; die faalt: oude bos');
    assert.equal(gehaald, 3);
    jwks.leeg(adres);
    await assert.rejects(b.ververs(adres), /provider plat/, 'zonder oude bos is een storing een fout');
    stuk = false;
    const leeg = jwks.maakBos(async () => ({ keys: [] }));
    await assert.rejects(leeg.bos('https://idp.leeg.test/jwks'), /lege of onbruikbare sleutelbos/);
  } finally { k.terug(); jwks.leeg(); }
});

test('5. discovery: geen object, geen issuer, en de cache vervalt na een uur', async () => {
  const iss = 'https://idp.ontdek.test';
  oidc.leegOntdek();
  await assert.rejects(oidc.ontdek(iss, async () => null), /geen bruikbaar discovery-document/);
  await assert.rejects(oidc.ontdek(iss, async () => ({ authorization_endpoint: 'x' })), /andere issuer/);
  let n = 0;
  const haal = async () => { n++; return { issuer: iss + '/', authorization_endpoint: iss + '/a', token_endpoint: iss + '/t', jwks_uri: iss + '/j' }; };
  const k = klok();
  try {
    await oidc.ontdek(iss, haal); await oidc.ontdek(iss + '/', haal);
    assert.equal(n, 1, 'binnen het uur uit de cache, ook met slash');
    k.verder(oidc.ONTDEK_HOUDBAAR_MS + 1);
    const doc = await oidc.ontdek(iss, haal);
    assert.equal(n, 2);
    const u = new URL(oidc.startAdres(doc, { clientId: 'c', redirectUri: 'https://r', state: 's', nonce: 'n', challenge: 'x', hint: 'piet@klant.test' }));
    assert.equal(u.searchParams.get('login_hint'), 'piet@klant.test');
  } finally { k.terug(); oidc.leegOntdek(iss); }
});

test('6. de state: geknoeid, geen JSON, verlopen of onvolledig is null; postForm weigert intern', () => {
  const pak = (o) => Buffer.from(kluis.enc(typeof o === 'string' ? o : JSON.stringify(o)), 'base64').toString('base64url');
  const goed = staat.inpakken({ org: 'klant', nonce: staat.maakNonce(), verifier: 'v', terug: '/x' });
  assert.equal(staat.uitpakken(goed).org, 'klant');
  assert.equal(staat.uitpakken(goed.slice(0, -4) + 'AAAA'), null);
  assert.equal(staat.uitpakken(undefined), null);
  assert.equal(staat.uitpakken(pak('{geen json')), null);
  assert.equal(staat.uitpakken(pak('null')), null);
  assert.equal(staat.uitpakken(pak({ org: 'k', nonce: 'n', verifier: 'v', tot: Date.now() - 1 })), null);
  assert.equal(staat.uitpakken(pak({ org: 'k', nonce: 'n', tot: Date.now() + 1e5 })), null);
  assert.equal(staat.uitpakken(pak({ org: 'k', nonce: 'n', verifier: 'v', tot: Date.now() + 1e5, terug: 'https://kwaad.test' })).terug, '/');
  assert.equal(staat.veiligTerug(undefined), '/');
  assert.notEqual(staat.maakNonce(), staat.maakNonce());
  assert.throws(() => postForm('https://10.1.2.3/token', { a: 1 }), /interne netwerk/);
  assert.throws(() => keurUrl('geen adres'), /Geen geldig adres/);
});
