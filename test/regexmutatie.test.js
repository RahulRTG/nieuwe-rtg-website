/* DE REGEX-OPERATOR VAN DE MUTATIEMOTOR.

   scripts/lib/regexmutatie.js laat het laatste alternatief van een regex
   vallen, zodat de mutatiemotor ook beweringen kan beproeven die aan een regex
   hangen. Voor de reden zie de kop van die module; kort: test/strenge-poort.test.js
   overleefde 28 mutaties omdat geen enkele operator een regex raakte, terwijl
   diezelfde toets met de hand kapotgemaakt netjes zakt.

   Wat hier vastligt is niet dat de operator "iets doet" maar dat hij het GOEDE
   doet: alleen top-niveau alternatieven, en nooit een regex die niet meer
   compileert -- want een stukgemaakt bestand laat een toets zakken om de
   verkeerde reden, en dat heet dan ten onrechte "bewezen gevoelig".

   Draai los: node --experimental-sqlite --test test/regexmutatie.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ontleed, laatsteTopNiveauPijp, laatsteAlternatiefWeg } = require('../scripts/lib/regexmutatie.js');

test('HET GEVAL WAAR HIJ VOOR GEBOUWD IS: de crashdetectie van test/helper.js', () => {
  const fataal = '/"bron":"(uncaughtException|unhandledRejection)"|"serverfout":true/';
  assert.equal(laatsteAlternatiefWeg(fataal), '/"bron":"(uncaughtException|unhandledRejection)"/',
    'het laatste alternatief valt weg, de groep blijft heel');
});

test('een | BINNEN een groep of een klasse telt niet mee', () => {
  assert.equal(laatsteTopNiveauPijp('a(b|c)d'), -1, 'binnen haakjes hoort bij die groep');
  assert.equal(laatsteTopNiveauPijp('[a|b]c'), -1, 'binnen een tekenklasse is | gewoon een teken');
  assert.equal(laatsteTopNiveauPijp('a|b'), 1);
  assert.equal(laatsteTopNiveauPijp('a|b|c'), 3, 'het LAATSTE, niet het eerste');
  assert.equal(laatsteTopNiveauPijp('a\\|b'), -1, 'een ontsnapte pijp is een teken');
});

test('zonder top-niveau alternatief levert hij geen mutatie op', () => {
  assert.equal(laatsteAlternatiefWeg('/stopte tijdens opstarten/'), null);
  assert.equal(laatsteAlternatiefWeg('/(a|b)/'), null, 'alleen binnen een groep is geen top-niveau |');
  assert.equal(laatsteAlternatiefWeg('/|b/'), null, 'een leeg eerste stuk laten staan zou niets zeggen');
});

test('vlaggen blijven staan', () => {
  assert.equal(laatsteAlternatiefWeg('/kat|hond/gi'), '/kat/gi');
});

test('wat geen regex-literal is, raakt hij niet aan', () => {
  assert.equal(ontleed('gewone tekst'), null);
  assert.equal(laatsteAlternatiefWeg('a / b | c / d'), null, 'twee delingen zijn geen regex');
  assert.equal(laatsteAlternatiefWeg(''), null);
});

/* DE TEGENPROEF DIE ERTOE DOET. Een mutatie die een regex oplevert die niet
   compileert, laat de toets zakken omdat het BESTAND stuk is -- en dan heet een
   zwakke toets ten onrechte bewezen gevoelig. */
test('DE TEGENPROEF: hij geeft nooit een regex terug die niet compileert', () => {
  const gevallen = ['/a(b|c/', '/[a|b/', '/a|b)/', '/a|(/'];
  for (const g of gevallen) {
    const uit = laatsteAlternatiefWeg(g);
    if (uit === null) continue;                       // niets teruggeven mag altijd
    const d = ontleed(uit);
    assert.ok(d, g + ' -> ' + uit + ' is geen geldige literal');
    assert.doesNotThrow(() => new RegExp(d.lijf, d.vlaggen), g + ' -> ' + uit + ' compileert niet');
  }
});

test('DE TWEEDE TEGENPROEF: de mutatie verandert echt wat er matcht', () => {
  /* Zonder deze zou een operator die de regex ongemoeid teruggeeft alle
     beweringen hierboven halen -- en dan meet de motor niets. */
  const uit = laatsteAlternatiefWeg('/kat|hond/');
  const d = ontleed(uit);
  const na = new RegExp(d.lijf, d.vlaggen);
  assert.equal(na.test('kat'), true, 'het eerste alternatief matcht nog');
  assert.equal(na.test('hond'), false, 'en het weggelaten alternatief niet meer');
  assert.equal(/kat|hond/.test('hond'), true, 'terwijl het origineel dat wel deed');
});
