/* DE SAML-POORT: het verzoek, het eenmalige gebruik, en de inrichting.

   De aanvalstoets ernaast (test/samlxsw.test.js) gaat over de handtekening.
   Dit gaat over de drie dingen die een GELDIGE, correct ondertekende assertie
   alsnog waardeloos horen te maken zodra hij een tweede keer langskomt:

     1. een antwoord hoort bij EEN verzoek dat WIJ hebben gestuurd
     2. een verzoek werkt een keer
     3. een assertie werkt een keer

   Zonder die drie is een assertie die iemand een keer heeft opgevangen -- uit
   een logregel van een proxy, uit de geschiedenis van een browser, uit een
   verkeerd geadresseerde mail -- een sleutel die blijft werken tot hij verloopt.
   Dat is het verschil tussen "de handtekening klopt" en "deze persoon logt nu in".

   Draai los: node --experimental-sqlite --test test/samlpoort.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-samlpoort-'));
process.env.RTG_DATA_DIR = TMP;

const accounts = require('../server/accounts');
accounts.init();
const koppelingen = require('../server/sso/koppelingen');
koppelingen.zorgTabel();
const saml = require('../server/sso/saml');
saml.zorgTabel();

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const CERT = require('./saml-idp').sleutelpaar('poort.test').cert;

test.before(() => {
  koppelingen.zet({ org: 'KLANT', naam: 'Klant BV', issuer: 'https://idp.klant.nl',
    clientId: 'x', domeinen: ['klant.nl'] });
});

test('1. een verzoek werkt EEN keer, en alleen bij zijn eigen organisatie', () => {
  const id = saml.bewaarVerzoek('klant', '/apps/werk.html');
  assert.match(id, /^_[0-9a-f]{40}$/, 'een SAML-ID begint niet met een cijfer');

  /* De org komt uit de RIJ en niet van de aanroeper. Zou de aanroeper hem
     meegeven, dan kon iemand een verzoek-ID van organisatie A inleveren met de
     koppeling van B erbij -- en dan wordt de assertie tegen het verkeerde
     certificaat gehouden. */
  assert.equal(saml.neemVerzoek(id, 'iemand-anders'), null);

  const opnieuw = saml.bewaarVerzoek('klant', '/apps/werk.html');
  const r = saml.neemVerzoek(opnieuw, 'klant');
  assert.equal(r.terug, '/apps/werk.html');
  assert.equal(saml.neemVerzoek(opnieuw, 'klant'), null, 'een tweede keer bestaat het verzoek niet meer');
});

test('2. een verlopen verzoek telt niet, en laat ook niets achter', () => {
  const id = saml.bewaarVerzoek('klant', '/');
  const S = require('../server/accounts/state');
  S.db.prepare('UPDATE saml_verzoeken SET tot = ? WHERE id = ?').run(Date.now() - 1000, id);
  assert.equal(saml.neemVerzoek(id, 'klant'), null);
  assert.equal(S.db.prepare('SELECT COUNT(*) n FROM saml_verzoeken WHERE id = ?').get(id).n, 0,
    'ook een verlopen verzoek wordt opgeruimd; een tabel die alleen groeit is een lek');
});

test('3. een assertie werkt EEN keer', () => {
  const tot = Date.now() + 300000;
  assert.equal(saml.markeerGebruikt('_ass1', 'klant', tot), true);
  assert.equal(saml.markeerGebruikt('_ass1', 'klant', tot), false, 'herhaling is hergebruik');
  /* Per organisatie: twee providers mogen los van elkaar hetzelfde ID kiezen. */
  assert.equal(saml.markeerGebruikt('_ass1', 'andere', tot), true);

  /* Geen ID = niet te ontdubbelen. Dan is er geen manier om herhaling te zien,
     en dus is de enige veilige uitkomst nee. */
  assert.equal(saml.markeerGebruikt('', 'klant', tot), false);
  assert.equal(saml.markeerGebruikt(null, 'klant', tot), false);
});

test('4. de inrichting eist alle drie de velden, en leest het certificaat meteen', () => {
  const fout = (p, patroon) => assert.throws(() => saml.zetSaml(p), patroon, JSON.stringify(p).slice(0, 60));
  fout({ org: 'bestaatniet', entityId: 'a', ssoUrl: 'https://x/y', certificaat: CERT }, /Maak eerst de koppeling/);
  fout({ org: 'klant', entityId: '', ssoUrl: 'https://x/y', certificaat: CERT }, /entityID/);
  fout({ org: 'klant', entityId: 'a', ssoUrl: 'http://x/y', certificaat: CERT }, /https/);
  fout({ org: 'klant', entityId: 'a', ssoUrl: 'https://x/y', certificaat: '' }, /certificaat/);
  /* Een onleesbaar certificaat hoort NU te stranden en niet bij de eerste
     inlog van de eerste medewerker. */
  fout({ org: 'klant', entityId: 'a', ssoUrl: 'https://x/y', certificaat: 'dit-is-geen-certificaat' }, /./);

  const uit = saml.zetSaml({ org: 'KLANT', entityId: 'https://idp.klant.nl/meta',
    ssoUrl: 'https://idp.klant.nl/sso', certificaat: CERT });
  assert.equal(uit.org, 'klant', 'een org is hoofdletterongevoelig');
  assert.equal(uit.samlEntityId, 'https://idp.klant.nl/meta');
});

test('5. de koppeling blijft EEN koppeling -- geen tweede identiteitsmodel', () => {
  /* De SAML-velden hangen aan de bestaande rij. Zou er een tweede tabel zijn,
     dan bestond dezelfde organisatie twee keer met twee domeinlijsten -- en de
     domeinlijst IS de beveiliging (sso/koppelingen.js). */
  const k = koppelingen.vind('klant');
  assert.deepEqual(k.domeinen, ['klant.nl'], 'de domeinlijst van de OIDC-kant staat er nog');
  assert.equal(saml.samlVan('klant').org, k.org, 'en het is dezelfde organisatie');
  assert.equal(saml.samlVan('nooit-ingericht'), null);
});

test('6. het AuthnRequest is ingepakt, draagt ons antwoordadres, en zet een verzoek klaar', () => {
  const zlib = require('zlib');
  const k = saml.samlVan('klant');
  const { id, url } = saml.verzoekUrl(k, { acs: 'https://rtg.test/api/sso/saml/acs',
    entityId: 'https://rtg.test/saml/metadata', terug: '/apps/werk.html' });
  assert.ok(url.startsWith('https://idp.klant.nl/sso?SAMLRequest='));

  const p = new URL(url).searchParams;
  assert.equal(p.get('RelayState'), id, 'RelayState draagt ons verzoek-ID en niets anders (80 bytes)');
  const xml = zlib.inflateRawSync(Buffer.from(p.get('SAMLRequest'), 'base64')).toString('utf8');
  assert.ok(xml.includes('ID="' + id + '"'));
  assert.ok(xml.includes('AssertionConsumerServiceURL="https://rtg.test/api/sso/saml/acs"'));
  assert.ok(xml.includes('<saml:Issuer>https://rtg.test/saml/metadata</saml:Issuer>'));
  assert.ok(saml.neemVerzoek(id, 'klant'), 'en het verzoek staat klaar om het antwoord tegen te houden');
});
