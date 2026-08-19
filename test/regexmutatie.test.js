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

/* DE TWEEDE NIEUWE OPERATOR: getal+1.

   Plafonds, drempels, tijden en indexen staan overal in dit huis, en tot deze
   ronde keek geen enkele operator naar WAARDEN -- alleen naar tekens. Daardoor
   kreeg juist een toets over een grens bijna geen schoten: test/txkap.test.js
   gaat over wat er gebeurt bij de 50.001e boeking, en dat is een getal.

   Wat hier vastligt is dat hij het goede getal pakt en de rest met rust laat:
   een getal in een tekenreeks of in commentaar is geen gedrag, en muteren daar
   meet of de toets tekst leest. */
const { OPERATOREN, muteer, codemasker } = require('../scripts/mutatie.js');

const op = (naam) => {
  const gevonden = OPERATOREN.find(o => o.naam === naam);
  assert.ok(gevonden, 'operator ' + naam + ' bestaat');
  return gevonden;
};

test('getal+1 verhoogt het eerste getal in CODE met een', () => {
  assert.equal(muteer('const cap = 5;', op('getal+1'), 0), 'const cap = 6;');
  assert.equal(muteer('const a = 0; const b = 9;', op('getal+1'), 1), 'const a = 0; const b = 10;',
    'en met een index pakt hij de tweede');
});

test('DE TEGENPROEF: een getal in een tekenreeks of commentaar telt niet als gedrag', () => {
  /* Zou hij die wel pakken, dan meet de proef of de toets TEKST leest in plaats
     van gedrag -- en dan is "gezakt" een valse geruststelling. */
  assert.equal(muteer("const s = 'versie 5';", op('getal+1'), 0), null,
    'een getal in een tekenreeks is geen gedrag');
  assert.equal(muteer('/* wacht 10 seconden */', op('getal+1'), 0), null,
    'en een getal in commentaar al helemaal niet');
  const gemengd = "/* 7 */ const s = 'x 8'; const echt = 9;";
  assert.equal(muteer(gemengd, op('getal+1'), 0), "/* 7 */ const s = 'x 8'; const echt = 10;",
    'tussen ruis door pakt hij precies het getal dat in code staat');
});

test('het masker markeert commentaar en tekenreeksen als niet-code', () => {
  const bron = "const a = 1; /* twee */ const b = 'drie';";
  const masker = codemasker(bron);
  assert.equal(masker[bron.indexOf('1')], true, 'een getal in code telt');
  assert.equal(masker[bron.indexOf('twee')], false, 'commentaar niet');
  assert.equal(masker[bron.indexOf('drie')], false, 'een tekenreeks niet');
});

test('regex-alternatief-weg pakt alleen echte regex-tokens, geen deling', () => {
  const regexOp = op('regex-alternatief-weg');
  assert.equal(muteer('const r = /kat|hond/;', regexOp, 0), 'const r = /kat/;');
  assert.equal(muteer('const q = a / b | c / d;', regexOp, 0), null,
    'twee delingen met een pijp ertussen zijn geen regex -- daar muteren zou onzin-code geven');
});

test('ontleed loopt een literal zonder sluitende slash lineair af, niet exponentieel', () => {
  /* CodeQL vond hier js/redos (bevindingen 120 en 121). Er stond een regex
     waarvan de drie alternatieven elkaar overlapten -- een teken binnen [...]
     valt ook onder [^/] -- en die probeert bij een NIET-passende invoer elke
     verdeling van de tekens over die alternatieven.

     Dat is geen theorie: ontleed() krijgt tokentekst uit willekeurige
     bronbestanden. Nagemeten met het oude patroon: 20 herhalingen van [] zonder
     sluitende slash kostte 81 ms, en het is exponentieel -- 26 herhalingen is
     ruim vier seconden, 30 is anderhalve minuut. De mutatiemotor staat dan stil
     op een bestand dat niets bijzonders doet.

     Deze toets gebruikt 30 herhalingen: onder de oude versie loopt hij niet af
     binnen de grens, onder de nieuwe kost hij microseconden. De grens staat op
     een seconde en niet op tien milliseconden, want een trage bouwmachine mag
     dit niet rood maken -- het verschil dat we meten is vier ordes groot. */
  const kwaad = '/' + '[]'.repeat(30) + 'X';
  const start = process.hrtime.bigint();
  assert.equal(ontleed(kwaad), null, 'zonder sluitende slash is het geen literal');
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  assert.ok(ms < 1000, 'ontleed deed er ' + ms.toFixed(1) + ' ms over; dat hoort microseconden te zijn');
});

test('DE TEGENPROEF: ontleed leest een literal MET klassen nog steeds goed', () => {
  /* De reparatie hierboven mag niet "altijd null" worden -- dan is de snelheid
     gekocht met blindheid. Een slash binnen een tekenklasse sluit de literal
     niet af, en dat is precies wat de oude regex ook deed. */
  assert.deepEqual(ontleed('/[/]|a/g'), { lijf: '[/]|a', vlaggen: 'g' });
  assert.deepEqual(ontleed('/a\\/b/'), { lijf: 'a\\/b', vlaggen: '' });
  assert.equal(ontleed('//'), null, 'een leeg lijf is geen literal maar commentaar');
  assert.equal(ontleed('/a/G'), null, 'vlaggen zijn kleine letters');
  assert.equal(ontleed('/[a/'), null, 'een klasse die openblijft is geen literal');
});
