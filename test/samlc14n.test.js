/* CANONICALISATIE, MET LIBXML2 ALS SCHEIDSRECHTER.

   Waarom deze toets apart staat van de aanvalstoets. Een XML-handtekening gaat
   niet over de tekst die binnenkwam maar over de CANONIEKE vorm daarvan. Zit
   onze canonicalisatie ernaast, dan gebeurt er een van twee dingen, en ze zijn
   allebei erg:

     te streng  -> geen enkele echte provider komt binnen (luidruchtig kapot)
     te soepel  -> twee documenten leveren dezelfde bytes, en dan dekt een
                   handtekening iets anders dan wat wij lezen (stil kapot)

   Onszelf toetsen met onze eigen implementatie zegt over geen van beide iets.
   Daarom is de scheidsrechter hier `xmllint` (libxml2), een implementatie die
   niets met ons te maken heeft. Wie deze acht gevallen naast elkaar legt en ze
   allemaal gelijk krijgt, weet dat onze c14n niet alleen consistent is met
   zichzelf.

   EN HIJ SLAAT ZICHZELF NIET OVER. Ontbreekt xmllint, dan zakt deze toets met
   die reden. Dat is een bewuste afwijking van de huisregel voor ontbrekende
   diensten (Postgres, Redis): daar is de toets nutteloos zonder de dienst, hier
   is de toets een VEILIGHEIDSMETING waarvan de afwezigheid niet mag lijken op
   een groen vinkje. libxml2-utils staat op elke ubuntu-runner.

   Draai los: node --test test/samlc14n.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const X = require('../server/sso/saml/xml');
const { canoniek, EXCLUSIEF, INCLUSIEF } = require('../server/sso/saml/c14n');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-c14n-'));
test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

function libxml(xml, vlag) {
  const f = path.join(TMP, 'x.xml');
  fs.writeFileSync(f, xml);
  try { return execFileSync('xmllint', [vlag, f]); }
  catch (e) {
    throw new Error('xmllint ontbreekt of weigerde dit document. Deze toets wordt NIET overgeslagen: ' +
      'zonder onafhankelijke scheidsrechter is er geen enkele reden om onze eigen canonicalisatie te geloven. (' + e.message + ')');
  }
}

/* Acht documenten die elk een regel raken waar een eigen implementatie op
   struikelt. De namen zeggen welke. */
const GEVALLEN = [
  ['attribuutvolgorde en naamruimten door elkaar',
    '<a:doc xmlns:a="urn:a" xmlns:b="urn:b" xmlns="urn:def" xml:lang="nl" z="26" a="1" b:m="2" a:k="3">' +
    '<kind b:p="q"/><leeg></leeg></a:doc>'],
  ['een prefix die dieper opnieuw wordt gebonden',
    '<r xmlns:p="urn:1"><p:a xmlns:p="urn:2"><p:b/></p:a></r>'],
  ['de standaardnaamruimte die weer wordt UITgezet',
    '<r xmlns="urn:d"><a><b xmlns=""><c/></b></a></r>'],
  ['CDATA wordt gewone tekst',
    '<r><t><![CDATA[a & b < c]]></t></r>'],
  ['tekens in een attribuutwaarde worden verwijzingen',
    '<r a="tab&#x9;lf&#xA;cr&#xD;quote&quot;amp&amp;lt&lt;"/>'],
  ['een regelterugloop in tekst blijft &#xD;',
    '<r>regel1&#xD;regel2</r>'],
  ['sorteren op naamruimte-URI en niet op prefix',
    '<r xmlns:z="urn:z" xmlns:a="urn:a" z:b="1" a:b="2" b="3" a="4"/>'],
  ['lege elementen krijgen een sluittag, witruimte blijft',
    '<r><a/><b></b><c>   </c></r>']
];

test('1. inclusieve canonicalisatie is gelijk aan die van libxml2', () => {
  for (const [naam, xml] of GEVALLEN) {
    const mij = canoniek(X.lees(xml), INCLUSIEF, [], null);
    assert.equal(mij.toString(), libxml(xml, '--c14n').toString(), naam);
  }
});

test('2. exclusieve canonicalisatie is gelijk aan die van libxml2', () => {
  for (const [naam, xml] of GEVALLEN) {
    const mij = canoniek(X.lees(xml), EXCLUSIEF, [], null);
    assert.equal(mij.toString(), libxml(xml, '--exc-c14n').toString(), naam);
  }
});

/* HET GEVAL DAT ER BIJ SAML ECHT TOE DOET: niet het hele document, maar EEN
   element eruit. Dat is wat een handtekening dekt. Bij exclusieve
   canonicalisatie hoort dat stuk dezelfde bytes op te leveren als wanneer het
   los had gestaan -- daar is exclusief voor gemaakt, en daarom overleeft een
   assertie het feit dat hij in een Response zit. */
test('3. een element UIT een document geeft dezelfde bytes als los', () => {
  const paren = [
    ['<r xmlns="urn:d" xmlns:x="urn:x" xmlns:ongebruikt="urn:weg"><binnen x:a="1"><k/></binnen></r>',
      '<binnen xmlns="urn:d" xmlns:x="urn:x" x:a="1"><k/></binnen>'],
    ['<samlp:Response xmlns:samlp="urn:p"><saml:Assertion xmlns:saml="urn:a" ID="_1"><saml:Issuer>ik</saml:Issuer></saml:Assertion></samlp:Response>',
      '<saml:Assertion xmlns:saml="urn:a" ID="_1"><saml:Issuer>ik</saml:Issuer></saml:Assertion>']
  ];
  for (const [heel, los] of paren) {
    const wortel = X.lees(heel);
    const binnen = wortel.kinderen.find(k => k.soort === 'el');
    const mij = canoniek(binnen, EXCLUSIEF, [], null);
    assert.equal(mij.toString(), libxml(los, '--exc-c14n').toString(),
      'exclusief hoort een deelboom los te maken van zijn omgeving');
    /* En de ongebruikte naamruimte van de ouder hoort er NIET in te staan --
       dat is precies wat exclusief van inclusief onderscheidt. */
    assert.ok(!mij.toString().includes('ongebruikt'), 'een ongebruikte naamruimte lekt niet mee');
  }
});

/* WithComments wordt geweigerd, en dat is geen luiheid: onze lezer gooit
   commentaar weg, dus de commentaarvorm zou de VERKEERDE bytes vergelijken --
   en dan faalt hij niet, dan slaagt hij ten onrechte. */
test('4. de commentaarvarianten en alles daarbuiten worden geweigerd', () => {
  const el = X.lees('<r><a/></r>');
  for (const alg of [EXCLUSIEF + 'WithComments', INCLUSIEF + '#WithComments',
    'http://www.w3.org/TR/1999/REC-xslt-19991116', '']) {
    assert.throws(() => canoniek(el, alg, [], null), /wordt hier niet gedaan/, alg || '(leeg)');
  }
});

/* De lezer weigert waar een gewone parser toegeeflijk is. Elk van deze vijf is
   een aanvalsweg en geen slordigheid. */
test('5. de lezer weigert DOCTYPE, entiteiten en losse verwerkingsinstructies', () => {
  const weiger = [
    ['<!DOCTYPE r [<!ENTITY x SYSTEM "file:///etc/passwd">]><r>&x;</r>', /DOCTYPE/],
    ['<r>&onbekend;</r>', /onbekende entiteit/],
    ['<r><?stiekem doe dit ?></r>', /verwerkingsinstructie hoort hier niet/],
    ['<r><a></b></r>', /sluit/],
    ['<r a="1" a="2"/>', /twee keer/]
  ];
  for (const [xml, patroon] of weiger) assert.throws(() => X.lees(xml), patroon, xml.slice(0, 40));
});
