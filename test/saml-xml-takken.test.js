/* DE EIGEN XML-LEZER EN DE CANONICALISATIE (server/sso/saml/xml.js, c14n.js).

   Alles wat een identiteitsprovider ons als SAML-antwoord stuurt, gaat eerst
   door deze lezer. Hij is met opzet streng: een lezer die "ongeveer" leest,
   leest anders dan de ondertekenaar, en precies in dat verschil zit een
   handtekening die klopt over iets anders dan wij gebruiken. De gelukkige
   paden staan in test/samlc14n.test.js (met xmllint als scheidsrechter); hier
   staan de WEIGERINGEN en de randen die daar niet stonden.

   Wat hier niet mag sneuvelen:
   1. kapotte tags, attributen zonder waarde of aanhalingstekens, een
      onafgesloten waarde, een sluittag zonder open element: een nette fout;
   2. een losse &, een tekenverwijzing buiten Unicode of naar 0: weigeren;
      decimaal en hexadecimaal worden goed gelezen;
   3. commentaar wordt weggegooid (nooit tekst), een CDATA of tekst buiten de
      wortel, een tweede wortel, een niet-gesloten element, een
      verwerkingsinstructie anders dan de XML-declaratie vooraan: weigeren;
   4. een prefix zonder naamruimte, op element of attribuut: weigeren;
   5. inclusieve c14n neemt xml:*-attributen van voorouders mee op de apex,
      exclusieve niet; het enveloped-transform knipt alleen binnen de apex.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in lees() `if (eind < 0) fout('commentaar zonder einde')` weggehaald ->
     "3." ZAKT (RAAK: i = 2 en de lezer leest het commentaar als element);
   - in ontsnap `cp < 1` weggehaald -> "2." ZAKT (RAAK: &#0; gaf een NUL-teken);
   - in c14n `if (!exclusief && isApex)` vervangen door `if (isApex)` -> "5."
     ZAKT (RAAK).

   Draai: node --test test/saml-xml-takken.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const X = require('../server/sso/saml/xml');
const { canoniek, EXCLUSIEF, INCLUSIEF } = require('../server/sso/saml/c14n');

const weigert = (xml, patroon) => assert.throws(() => X.lees(xml), patroon, JSON.stringify(xml));

test('1. kapotte tags en attributen', () => {
  weigert('<a></a', /sluittag zonder >/);
  weigert('</a>', /sluittag a zonder open element/);
  weigert('< a/>', /element zonder naam/);
  weigert('<a ', /tag zonder >/);
  weigert('<a "x"/>', /onleesbaar attribuut/);
  weigert('<a b/>', /attribuut b zonder waarde/);
  weigert('<a b=1/>', /niet tussen aanhalingstekens/);
  weigert('<a b=', /niet tussen aanhalingstekens/);
  weigert('<a b="1', /wordt niet afgesloten/);
  const a = X.lees("<a  b = '1'\tc=\"2\"/>");
  assert.deepEqual([X.attr(a, 'b'), X.attr(a, 'c'), X.attr(a, 'd')], ['1', '2', null]);
});

test('2. entiteiten: losse &, onbruikbare tekenverwijzingen, decimaal en hex', () => {
  weigert('<a>x & y</a>', /losse & in tekst/);
  weigert('<a>&#0;</a>', /onbruikbare tekenverwijzing/);
  weigert('<a>&#x110000;</a>', /onbruikbare tekenverwijzing/);
  weigert('<a>&#xZZ;</a>', /onbruikbare tekenverwijzing/);
  assert.equal(X.tekstVan(X.lees('<a>&#65;&#x42;&#X43;&lt;</a>')), 'ABC<');
});

test('3. commentaar, CDATA, wortels, verwerkingsinstructies', () => {
  const a = X.lees('<?xml version="1.0"?><a>een<!-- <b>geen element</b> -->twee</a>\r\n');
  assert.equal(X.tekstVan(a), 'eentwee', 'commentaar telt nooit als tekst');
  assert.equal(a.kinderen.length, 2);
  weigert('<a><!-- nooit dicht</a>', /commentaar zonder einde/);
  weigert('<a><![CDATA[x</a>', /CDATA zonder einde/);
  weigert('<![CDATA[x]]><a/>', /CDATA buiten het wortelelement/);
  weigert('<a/>tekst', /tekst buiten het wortelelement/);
  weigert('<a/><b/>', /een tweede wortelelement/);
  weigert('<a><b></b>', /<a> wordt nooit gesloten/);
  weigert('', /leeg document/);
  weigert(undefined, /leeg document/);
  weigert('<!-- alleen commentaar -->', /leeg document/);
  weigert('<?xml version="1.0"', /verwerkingsinstructie zonder einde/);
  weigert('<?pi x?><a/>', /alleen een XML-declaratie vooraan/);
  weigert('<a><?xml version="1.0"?></a>', /alleen een XML-declaratie vooraan/);
  assert.equal(X.lees('<a/>\n  ').naam, 'a', 'witruimte na de wortel mag');
  assert.equal(X.tekstVan(X.lees('<a>x<b>y<c>z</c></b></a>')), 'xyz', 'tekst van de kinderen telt mee, in volgorde');
});

test('4. een prefix zonder naamruimte wordt geweigerd; xml: is altijd gebonden', () => {
  weigert('<p:a/>', /element p:a gebruikt een onbekende naamruimte/);
  weigert('<a p:b="1"/>', /attribuut p:b gebruikt een onbekende naamruimte/);
  weigert('<a xmlns:p="urn:p"><b xmlns:p=""><p:c/></b></a>', /onbekende naamruimte/);
  const a = X.lees('<a><xml:b/></a>');
  assert.equal(a.kinderen[0].ns, X.XML_NS);
  assert.equal(a.ns, null, 'zonder xmlns geen naamruimte');
  assert.deepEqual([X.kinderen({}, null, 'x'), X.tekstVan({}), X.attr({}, 'x'), X.alle({}).length], [[], '', null, 1]);
});

test('5. c14n: xml:-attributen erven alleen inclusief mee; enveloped knipt binnen de apex', () => {
  const w = X.lees('<a xml:lang="nl" xmlns:q="urn:q"><b q:x="1">t<s/>u</b></a>');
  const b = w.kinderen[0];
  assert.equal(canoniek(b, INCLUSIEF).toString(), '<b xmlns:q="urn:q" xml:lang="nl" q:x="1">t<s></s>u</b>');
  assert.equal(canoniek(b, EXCLUSIEF).toString(), '<b xmlns:q="urn:q" q:x="1">t<s></s>u</b>');
  assert.equal(canoniek(b, EXCLUSIEF, [], b.kinderen[1]).toString(), '<b xmlns:q="urn:q" q:x="1">tu</b>',
    'het handtekeningelement valt weg, de tekst eromheen blijft');
  const vreemd = X.lees('<z/>');
  assert.equal(canoniek(b, EXCLUSIEF, [], vreemd).toString(), canoniek(b, EXCLUSIEF, []).toString(),
    'een element buiten de apex knipt niets weg');
  const d = X.lees('<a xmlns="urn:d"><b xmlns=""><c/></b></a>');
  assert.equal(canoniek(d.kinderen[0], INCLUSIEF).toString(), '<b><c></c></b>', 'een lege standaardnaamruimte hoeft niet geschreven');
  assert.equal(canoniek(d, INCLUSIEF).toString(), '<a xmlns="urn:d"><b xmlns=""><c></c></b></a>', 'onder een gezette wel');
  const p = X.lees('<a xmlns:xs="urn:xs"><b/></a>');
  assert.equal(canoniek(p.kinderen[0], EXCLUSIEF, ['xs', '#default']).toString(), '<b xmlns:xs="urn:xs"></b>',
    'de PrefixList zet een niet-zichtbaar gebruikte prefix er toch in');
  assert.throws(() => canoniek(b, 'http://www.w3.org/2006/12/xml-c14n11'), /wordt hier niet gedaan/);
});
