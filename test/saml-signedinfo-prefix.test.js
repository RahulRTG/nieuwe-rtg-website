/* SIGNEDINFO KRIJGT ZIJN EIGEN PREFIXLIJST (server/sso/saml/handtekening.js).

   Bij exclusieve canonicalisatie (exc-c14n) bepaalt de InclusiveNamespaces
   PrefixList welke naamruimten in scope tóch in de bytes komen. Er staan er
   in een handtekening twee, met elk een eigen bereik (XML-DSig par. 4.4.3 en
   exc-c14n par. 3): die op het REFERENCE-transform geldt voor het gedekte
   element, die op de CanonicalizationMethod van SignedInfo voor SignedInfo.
   De controle gebruikte de eerste voor allebei. Een IdP die PrefixList="xs"
   op het transform zet (gewoon bij getypte AttributeValues) met xmlns:xs op de
   Assertion, kreeg dan xmlns:xs in onze SignedInfo-bytes en niet in de zijne:
   een GELDIGE handtekening werd geweigerd. Dat faalde dicht, maar het blijft
   een fout -- en de herstelling mag niets versoepelen.

   Wat hier niet mag sneuvelen:
   1. PrefixList op het reference-transform raakt SignedInfo niet: de echte
      ondertekenaar (SignedInfo zonder eigen PrefixList) wordt aanvaard;
   2. een SignedInfo ondertekend met de VERKEERDE prefixlijst (die van het
      transform) blijft geweigerd;
   3. een PrefixList OP de CanonicalizationMethod van SignedInfo wordt
      gehonoreerd;
   4. SignedInfo na het ondertekenen veranderen -- ook alleen zijn PrefixList
      erbij zetten of weghalen -- blijft een weigering.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - de oude regel terug (`canoniek(si, ..., prefixLijst, null)`) -> "1.",
     "2." en "3." ZAKKEN (RAAK: "1." weigert de echte ondertekenaar, "2."
     aanvaardt de verkeerde prefixlijst);
   - `siPrefix` vast op `[]` (de PrefixList van SignedInfo genegeerd) -> "3."
     ZAKT (RAAK);
   - `siPrefix` vast op `['xs']` -> "0.", "1." en "2." ZAKKEN (RAAK).

   Draai: node --test test/saml-signedinfo-prefix.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const X = require('../server/sso/saml/xml');
const { canoniek, EXCLUSIEF } = require('../server/sso/saml/c14n');
const { controleer, DS } = require('../server/sso/saml/handtekening');
const idp = require('./saml-idp');

const rsa = idp.sleutelpaar('si-prefix.test');
/* xmlns:xs staat op het gedekte element en is dus in scope van de handtekening. */
const DOC = '<a:Doc xmlns:a="urn:a" xmlns:xs="urn:xs" ID="_d">{{SIG}}<a:W soort="xs:string">1</a:W></a:Doc>';
const inc = (lijst) => lijst ? '<ec:InclusiveNamespaces xmlns:ec="' + EXCLUSIEF + '" PrefixList="' + lijst.join(' ') + '"/>' : '';

/* refPrefix: PrefixList op het transform; siPrefix: op SignedInfo's
   CanonicalizationMethod; tekenMet: de lijst waarmee de ondertekenaar
   SignedInfo werkelijk canonicaliseerde; na: verander SignedInfo achteraf. */
function teken(o) {
  const digest = crypto.createHash('sha256')
    .update(canoniek(X.lees(DOC.replace('{{SIG}}', '')), EXCLUSIEF, o.refPrefix || [], null)).digest('base64');
  const si = '<ds:SignedInfo><ds:CanonicalizationMethod Algorithm="' + EXCLUSIEF + '">' + inc(o.siPrefix) +
    '</ds:CanonicalizationMethod><ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>' +
    '<ds:Reference URI="#_d"><ds:Transforms><ds:Transform Algorithm="' + DS + 'enveloped-signature"/>' +
    '<ds:Transform Algorithm="' + EXCLUSIEF + '">' + inc(o.refPrefix) + '</ds:Transform></ds:Transforms>' +
    '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/><ds:DigestValue>' + digest +
    '</ds:DigestValue></ds:Reference></ds:SignedInfo>';
  let xml = DOC.replace('{{SIG}}', '<ds:Signature xmlns:ds="' + DS + '">' + si + '<ds:SignatureValue>W</ds:SignatureValue></ds:Signature>');
  const siEl = X.alle(X.lees(xml)).find(e => e.ns === DS && e.naam === 'SignedInfo');
  const tekenMet = o.tekenMet !== undefined ? o.tekenMet : (o.siPrefix || []);
  xml = xml.replace('>W<', '>' + crypto.sign('sha256', canoniek(siEl, EXCLUSIEF, tekenMet, null), rsa.key).toString('base64') + '<');
  return X.lees(o.na ? o.na(xml) : xml);
}
const ok = (o) => assert.equal(controleer(teken(o), rsa.cert).naam, 'Doc');
const nee = (o) => assert.throws(() => controleer(teken(o), rsa.cert), /niet van de sleutel van deze koppeling/);

test('0. de proef is de goede proef: met en zonder xs verschillen de SignedInfo-bytes werkelijk', () => {
  const siEl = X.alle(teken({})).find(e => e.ns === DS && e.naam === 'SignedInfo');
  assert.notEqual(canoniek(siEl, EXCLUSIEF, [], null).toString(), canoniek(siEl, EXCLUSIEF, ['xs'], null).toString());
  ok({});
});

test('1. PrefixList op het reference-transform raakt SignedInfo niet', () => {
  ok({ refPrefix: ['xs'] });
});

test('2. SignedInfo ondertekend met de prefixlijst van het transform blijft geweigerd', () => {
  nee({ refPrefix: ['xs'], tekenMet: ['xs'] });
  nee({ tekenMet: ['xs'] });
});

test('3. PrefixList op de CanonicalizationMethod van SignedInfo wordt gehonoreerd', () => {
  ok({ siPrefix: ['xs'] });
  ok({ siPrefix: ['xs'], refPrefix: ['xs'] });
  nee({ siPrefix: ['xs'], tekenMet: [] });
});

test('4. SignedInfo na het ondertekenen veranderen blijft een weigering', () => {
  /* PrefixList erbij zetten of weghalen verandert welke bytes worden gecontroleerd. */
  nee({ refPrefix: ['xs'], na: (x) => x.replace('<ds:CanonicalizationMethod Algorithm="' + EXCLUSIEF + '">',
    '$&' + inc(['xs'])) });
  nee({ siPrefix: ['xs'], na: (x) => x.replace(/<ds:CanonicalizationMethod([^>]*)><ec:InclusiveNamespaces[^>]*\/>/, '<ds:CanonicalizationMethod$1>') });
  nee({ na: (x) => x.replace('URI="#_d"', 'URI="#_d" Id="extra"') });
});
