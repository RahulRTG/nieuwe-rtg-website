/* HET SAML-ANTWOORD NA DE HANDTEKENING (server/sso/saml/antwoord.js).

   test/samlxsw.test.js toetst de wrapping-aanvallen. Dit bestand toetst wat
   er NA een kloppende handtekening nog mis kan zijn: een assertie die echt van
   de provider komt maar geen publiek, geen onderwerp, geen inlogmoment of een
   onleesbare datum heeft. Elk antwoord hier is ECHT ondertekend (openssl-
   wegwerpsleutel via test/saml-idp.js), dus een weigering komt van de
   inhoudsregel en niet van een kapotte handtekening.

   Wat hier niet mag sneuvelen:
   1. alleen een samlp:Response; zonder Status (of met een andere dan Success)
      geen inlog;
   2. zonder Issuer, zonder Conditions, met een onleesbare of nog niet geldende
      datum: weigeren;
   3. zonder Subject of zonder AuthnStatement komt niemand binnen;
   4. een bevestiging telt alleen als hij bearer is, data heeft en nog geldt;
      ongeldige bevestigingen naast een geldige stoppen hem niet;
   5. e-mail komt uit de gesloten attribuutlijst (leeg telt niet), anders uit
      de NameID; zonder beide is er geen onderwerp;
   6. een handtekening op de RESPONSE dekt de assertie ook (ID en naam mogen
      dan ontbreken: null, niet verzonnen).

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `if (!cond) throw ...` weggehaald -> "2." ZAKT (RAAK: TypeError in plaats
     van onze weigering);
   - `if (X.attr(c, 'Method') !== BEARER) continue;` weggehaald -> "4." ZAKT
     (RAAK: een sender-vouches-bevestiging liet iemand binnen);
   - `if (!X.kinderen(assertie, ASS, 'AuthnStatement').length)` vervangen door
     `if (false)` -> "3." ZAKT (RAAK).

   Draai: node --test test/saml-antwoord-weerbaar.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const idp = require('./saml-idp');
const antwoord = require('../server/sso/saml/antwoord');

const ACS = 'https://rtg.test/api/sso/saml/acs', ONS = 'https://rtg.test/saml/metadata';
const UITGEVER = 'https://idp.klant.nl/meta', VERZOEK = '_v1';
const kp = idp.sleutelpaar();
const KOPPELING = { org: 'klant', samlEntityId: UITGEVER, samlCert: kp.cert };
const VERWACHT = { entityId: ONS, acs: ACS, verzoekId: VERZOEK };
const P = { id: '_a1', issuer: UITGEVER, sub: 'u-7', acs: ACS, inResponseTo: VERZOEK, publiek: ONS, email: 'pia@klant.nl' };

/* Een ECHT ondertekend antwoord, met de assertie vóór het tekenen bewerkt. */
function maak(bewerk, extra) {
  let sj = idp.assertie(Object.assign({}, P, extra || {}));
  for (const [van, naar] of bewerk || []) { assert.ok(van instanceof RegExp ? van.test(sj) : sj.includes(van), 'bewerking past: ' + van); sj = sj.replace(van, naar); }
  return idp.response(idp.teken(sj, '_a1', { key: kp.key }), { id: '_r1' });
}
const lees = (xml, nu) => antwoord.lees(xml, KOPPELING, VERWACHT, nu);
const BEV = /<saml:SubjectConfirmation Method[\s\S]*?<\/saml:SubjectConfirmation>/;

test('1. alleen een samlp:Response, met Status Success', () => {
  const sj = idp.teken(idp.assertie(P), '_a1', { key: kp.key });
  assert.throws(() => lees(sj), /geen samlp:Response/);
  const xml = maak();
  assert.equal(lees(xml).claims.sub, 'u-7', 'het onbewerkte antwoord komt wel binnen');
  assert.throws(() => lees(xml.replace(/<samlp:Status>.*?<\/samlp:Status>/, '')), /geen geslaagde inlog \(geen status\)/);
  assert.throws(() => lees(xml.replace('status:Success', 'status:Requester')), /geen geslaagde inlog \(urn:oasis:names:tc:SAML:2.0:status:Requester\)/);
});

test('2. zonder Issuer of Conditions, met onleesbare of nog niet geldende datum', () => {
  assert.throws(() => lees(maak([[/<saml:Issuer>.*?<\/saml:Issuer>/, '']])), /komt van "" en niet van/);
  assert.throws(() => lees(maak([[/<saml:Conditions[\s\S]*<\/saml:Conditions>/, '']])), /zonder Conditions/);
  assert.throws(() => lees(maak([[/NotBefore="[^"]*"/, 'NotBefore="gisteren"']])), /onleesbare geldigheidsdatum/);
  assert.throws(() => lees(maak(), Date.now() - 600000), /geldt nog niet/);
  assert.equal(lees(maak([[/ NotBefore="[^"]*"/, '']])).claims.sub, 'u-7', 'zonder NotBefore geldt hij meteen');
});

test('3. zonder Subject of zonder AuthnStatement komt niemand binnen', () => {
  assert.throws(() => lees(maak([[/<saml:Subject>[\s\S]*<\/saml:Subject>/, '']])), /zonder Subject/);
  assert.throws(() => lees(maak([[/<saml:AuthnStatement[\s\S]*<\/saml:AuthnStatement>/, '']])), /geen AuthnStatement/);
});

test('4. alleen een geldige bearer-bevestiging telt', () => {
  const t = Date.now();
  const echt = idp.assertie(P).match(BEV)[0];
  const ongeldig = [
    echt.replace('cm:bearer', 'cm:sender-vouches'),
    '<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer"/>',
    echt.replace(/NotOnOrAfter="[^"]*"/, 'NotOnOrAfter="' + idp.nu(t - 600000) + '"'),
    echt.replace(/ NotOnOrAfter="[^"]*"/, ''),
    echt.replace(/NotOnOrAfter="[^"]*"/, 'NotOnOrAfter="ooit"')
  ];
  for (const b of ongeldig)
    assert.throws(() => lees(maak([[BEV, b]])), /geen bruikbare bevestiging/, b.slice(0, 80));
  assert.equal(lees(maak([[BEV, ongeldig.join('') + echt]])).claims.sub, 'u-7', 'naast ongeldige telt de geldige wel');
});

test('5. e-mail uit de gesloten lijst, anders de NameID; zonder beide geen onderwerp', () => {
  const geenMail = maak([['Name="email"', 'Name="telefoon"']]);
  assert.equal(lees(geenMail).claims.email, 'u-7', 'zonder adresattribuut valt e-mail terug op de NameID');
  const leegEnMail = maak([['<saml:Attribute Name="email"><saml:AttributeValue>pia@klant.nl</saml:AttributeValue></saml:Attribute>',
    '<saml:Attribute Name="email"><saml:AttributeValue> </saml:AttributeValue></saml:Attribute>' +
    '<saml:Attribute FriendlyName="mail"><saml:AttributeValue>Pia@Klant.NL</saml:AttributeValue></saml:Attribute>' +
    '<saml:Attribute><saml:AttributeValue>naamloos@kwaad.nl</saml:AttributeValue></saml:Attribute>']]);
  const uit = lees(leegEnMail);
  assert.equal(uit.claims.email, 'pia@klant.nl', 'een lege waarde telt niet; FriendlyName wel; zonder naam niets');
  const zonderNameId = maak([[/<saml:NameID[^>]*>.*?<\/saml:NameID>/, '']]);
  assert.equal(lees(zonderNameId).claims.sub, 'pia@klant.nl', 'zonder NameID is het adres het onderwerp');
  assert.throws(() => lees(maak([[/<saml:NameID[^>]*>.*?<\/saml:NameID>/, ''], ['Name="email"', 'Name="telefoon"']])), /geen onderwerp/);
});

test('6. een handtekening op de Response dekt de assertie; ontbrekend ID en naam worden null', () => {
  const a = idp.assertie(Object.assign({}, P, { metSig: false })).replace(' ID="_a1"', '')
    .replace(/<saml:Attribute Name="name">.*?<\/saml:Attribute>/, '');
  const sj = idp.response(a, { id: '_r1', inResponseTo: VERZOEK }).replace('</samlp:Status>', '</samlp:Status>{{SIG}}');
  const uit = lees(idp.teken(sj, '_r1', { key: kp.key }));
  assert.equal(uit.id, null);
  assert.equal(uit.claims.name, null);
  assert.equal(uit.claims.email, 'pia@klant.nl');
});
