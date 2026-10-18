/* DE KOPPELING, DE AANMELDING EN HET SAML-VERZOEK OP DE ECHTE DATABASE
   (server/sso/koppelingen.js, server/sso/index.js, server/sso/saml/index.js).

   Een SSO-koppeling bepaalt welke provider welke e-maildomeinen mag claimen;
   de aanmelding maakt van claims een account; het SAML-verzoek is de
   eenmalige sleutel waarmee een antwoord bij ONZE aanvraag hoort. test/sso.test.js
   en test/samlacs.test.js dekken de hoofdpaden. Hier de randen, op een echte
   (tijdelijke) accountdatabase.

   Wat hier niet mag sneuvelen:
   1. een koppeling zonder org of client-id wordt niet opgeslagen; weg() haalt
      hem echt weg en kent een onbekende org niet; een wijziging zonder nieuw
      geheim laat het oude staan;
   2. claims zonder e-mailadres koppelen niemand; de naam valt terug op
      given_name en daarna op het deel voor de @ -- en die naam staat in de
      kluis, niet in een operationele kolom;
   3. een subject waarvan het account is VERGETEN (AVG) wijst niet meer naar
      dat account: de oude verwijzing gaat weg, ook als de nieuwe aanmelding
      daarna mislukt;
   4. een SAML-verzoek is eenmalig, hoort bij één organisatie en vervalt; een
      assertie-ID zonder waarde of voor de tweede keer wordt geweigerd;
   5. SAML-velden zetten vraagt een bestaande koppeling, een entityID, een
      https-adres en een LEESBAAR certificaat; het verzoek-XML ontsnapt wat de
      koppeling aanlevert.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in aanmelden de DELETE van de oude sso_identiteiten-rij weggehaald -> "3."
     ZAKT (RAAK: mislukt de nieuwe aanmelding, dan bleef de verwijzing naar het
     vergeten account staan; slaagt hij, dan overschrijft legVast hem wel);
   - in neemVerzoek `r.org === String(org)` vervangen door `true` -> "4."
     ZAKT (RAAK);
   - in zetSaml `require('./handtekening').sleutelUit(c)` weggehaald -> "5."
     ZAKT (RAAK: een onleesbaar certificaat werd opgeslagen).

   Draai: node --test test/sso-koppeling-weerbaar.test.js */
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ssok-'));
process.env.RTG_DATA_DIR = TMP;
const accounts = require('../server/accounts');
accounts.init();
const S = require('../server/accounts/state');
const koppelingen = require('../server/sso/koppelingen');
const sso = require('../server/sso');
const saml = require('../server/sso/saml');
sso.zorgTabel(); saml.zorgTabel();
const idp = require('./saml-idp');
after(() => fs.rmSync(TMP, { recursive: true, force: true }));

const ISS = 'https://idp.rand.test';
const K = () => koppelingen.vind('rand');
koppelingen.zet({ org: 'Rand', issuer: ISS, clientId: 'c1', clientSecret: 'oud-geheim-1', domeinen: 'rand.test' });
const claims = (x) => Object.assign({ sub: 's', email: 'a@rand.test', email_verified: true }, x);

test('1. koppeling: org en client-id verplicht, weg() echt weg, oud geheim blijft', () => {
  assert.throws(() => koppelingen.zet({ org: '  ', issuer: ISS, clientId: 'c', domeinen: 'x.test' }), /hoort bij een organisatie/);
  assert.throws(() => koppelingen.zet({ org: 'y', issuer: ISS, domeinen: 'y.test' }), /client-id/);
  assert.throws(() => koppelingen.zet({ org: 'y', issuer: ISS, clientId: '  ', domeinen: 'y.test' }), /client-id/);
  assert.throws(() => koppelingen.zet({ org: 'y', clientId: 'c', domeinen: 'y.test' }), /https-adres/);
  const k = koppelingen.zet({ org: 'rand', issuer: ISS + '  ', clientId: ' c2 ', domeinen: 'rand.test' });
  assert.deepEqual([k.naam, k.issuer, k.clientId], ['rand', ISS, 'c2']);
  assert.deepEqual(koppelingen.geheimenVoorRuil('RAND').geheimen, ['oud-geheim-1'], 'zonder nieuw geheim blijft het oude');
  assert.equal(koppelingen.geheimStand('bestaat-niet'), null);
  koppelingen.zet({ org: 'tijdelijk', issuer: ISS, clientId: 'c', domeinen: 'tijdelijk.test' });
  assert.equal(koppelingen.weg(' Tijdelijk ').org, 'tijdelijk');
  assert.equal(koppelingen.vind('tijdelijk'), null);
  assert.equal(koppelingen.weg('tijdelijk'), null);
  assert.equal(koppelingen.weg(undefined), null);
  assert.equal(koppelingen.vindVoorEmail('x@tijdelijk.test'), null, 'het domein is weer vrij');
});

test('2. zonder e-mailadres niemand; de naam valt terug en staat in de kluis', async () => {
  await assert.rejects(sso.aanmelden(accounts, K(), claims({ email: undefined })), /geen e-mailadres/);
  await assert.rejects(sso.aanmelden(accounts, K(), claims({ email: '   ' })), /geen e-mailadres/);
  const a = await sso.aanmelden(accounts, K(), claims({ sub: 'g1', email: 'gerda@rand.test', given_name: 'Gerda' }));
  assert.equal(accounts.realNameOf(a.user), 'Gerda');
  const b = await sso.aanmelden(accounts, K(), claims({ sub: 'g2', email: 'Kees.Jansen@rand.test' }));
  assert.equal(accounts.realNameOf(b.user), 'kees.jansen');
  assert.equal(b.nieuw, true);
  assert.ok(!JSON.stringify(S.db.prepare('SELECT * FROM users WHERE id = ?').get(b.user.id)).includes('kees.jansen'),
    'de naam staat nergens leesbaar in de accountrij');
});

test('3. een vergeten account: de oude verwijzing gaat weg', async () => {
  const eerst = await sso.aanmelden(accounts, K(), claims({ sub: 'vergeten-1', email: 'v@rand.test' }));
  const vergeten = Object.assign({}, accounts, { getUserById: (id) => (id === eerst.user.id ? null : accounts.getUserById(id)),
    findByLogin: () => null });
  const kapot = Object.assign({}, vergeten, { createUser: async () => { throw new Error('opslag vol'); } });
  await assert.rejects(sso.aanmelden(kapot, K(), claims({ sub: 'vergeten-1', email: 'v2@rand.test' })), /opslag vol/);
  assert.equal(sso.vindIdentiteit('rand', 'vergeten-1'), null, 'ook als de nieuwe aanmelding mislukt, wijst niets meer naar het vergeten account');
  const daarna = await sso.aanmelden(vergeten, K(), claims({ sub: 'vergeten-1', email: 'v2@rand.test' }));
  assert.notEqual(daarna.user.id, eerst.user.id);
  assert.equal(daarna.nieuw, true);
  assert.equal(sso.vindIdentiteit('rand', 'vergeten-1').user_id, daarna.user.id, 'het subject wijst naar het nieuwe account');
});

test('4. een SAML-verzoek is eenmalig, per organisatie, en vervalt', () => {
  const k = { org: 'rand', samlSsoUrl: 'https://idp.rand.test/sso?tenant=1' };
  const { id, url } = saml.verzoekUrl(k, { acs: 'https://rtg.test/acs?a=1&b=2', entityId: 'urn:"rtg"<x>' });
  const u = new URL(url);
  assert.equal(u.searchParams.get('tenant'), '1');
  assert.equal(u.searchParams.get('RelayState'), id);
  const xml = zlib.inflateRawSync(Buffer.from(u.searchParams.get('SAMLRequest'), 'base64')).toString();
  assert.ok(xml.includes('AssertionConsumerServiceURL="https://rtg.test/acs?a=1&amp;b=2"'));
  assert.ok(xml.includes('<saml:Issuer>urn:&quot;rtg&quot;&lt;x></saml:Issuer>'), 'wat de koppeling aanlevert, wordt ontsnapt');
  assert.equal(saml.neemVerzoek(id, 'ander'), null, 'een verzoek van een andere organisatie telt niet');
  assert.equal(saml.neemVerzoek(id, 'rand'), null, 'en het is daarmee ook opgebruikt');
  const tweede = saml.bewaarVerzoek('rand');
  assert.equal(saml.neemVerzoek(tweede, 'rand').terug, '/');
  assert.equal(saml.neemVerzoekBijId(undefined), null);
  const echt = Date.now; const verlopen = saml.bewaarVerzoek('rand', '/x');
  try { Date.now = () => echt() + saml.VERZOEK_MS + 1; assert.equal(saml.neemVerzoekBijId(verlopen), null); } finally { Date.now = echt; }
  assert.equal(saml.markeerGebruikt('', 'rand', 0), false);
  assert.equal(saml.markeerGebruikt('_a9', 'rand'), true);
  assert.equal(saml.markeerGebruikt('_a9', 'rand'), false, 'een assertie is eenmalig');
  assert.equal(saml.markeerGebruikt('_a9', 'ander'), true, 'per organisatie');
});

test('5. SAML-velden zetten: bestaande koppeling, entityID, https, leesbaar certificaat', () => {
  const cert = idp.sleutelpaar('rand.test').cert;
  const z = (x) => saml.zetSaml(Object.assign({ org: 'rand', entityId: 'urn:rand', ssoUrl: 'https://idp.rand.test/sso', certificaat: cert }, x));
  assert.throws(() => z({ org: undefined }), /Maak eerst de koppeling voor ""/);
  assert.throws(() => z({ entityId: ' ' }), /entityID/);
  assert.throws(() => z({ ssoUrl: undefined }), /https-adres/);
  assert.throws(() => z({ certificaat: null }), /ondertekencertificaat/);
  assert.throws(() => z({ certificaat: 'MIIBkapot' }));
  assert.equal(saml.samlVan('rand'), null, 'na alle weigeringen is er niets opgeslagen');
  assert.equal(z({}).samlEntityId, 'urn:rand');
  assert.equal(saml.samlVan(undefined), null);
});
