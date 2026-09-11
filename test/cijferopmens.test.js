/* CAR-05 OVER DE HELE CARRIEREKANT -- er komt geen cijfer op een mens.

   DEZE TOETS BESTAAT OMDAT DE GRENS VIER DOCUMENTEN HAD EN EEN HANDHAVER, en die
   ene dekte precies EEN map. CARRIERE.md par. 4.1 zegt er met zoveel woorden bij
   wanneer hij hoort te komen: *als toets VOOR de eerste carrieremeter, niet
   erna*. Toen kern/rugdekking erbij kwam, gold de grens daar even hard en hield
   hem niets tegen; met het ledger erbij zou dat de derde map zijn.

   DE WOORDENLIJST STAAT OP EEN PLEK (scripts/lib/cijferopmens.js). Drie kopieen
   van een regexp zijn binnen een maand drie verschillende regexps (LAT.md regel
   4), en dan is de strengste de enige die iets zegt terwijl niemand weet welke
   dat is.

   TOETS 1 IS EEN ZELFIJKING EN GEEN FORMALITEIT. Een scan die niets KAN vinden,
   staat groen om dezelfde reden als een scan die niets vindt -- en die twee zijn
   van buiten niet te onderscheiden. Dezelfde vorm als test/getallen.test.js.

   Draai los: node --test test/cijferopmens.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WOORDEN, grensScan, mensVrij } = require('../scripts/lib/cijferopmens');

/* De hele kant van het huis waar een mens die van zijn talent leeft woont. Wie
   er een map bij bouwt, zet hem hier bij -- toets 3 zakt als een bestaande map
   verdwijnt, maar hij kan niet weten dat er een is BIJGEKOMEN. */
const MAPPEN = ['vertegenwoordiging', 'rugdekking', 'carriereledger']
  .map(n => path.join(__dirname, '..', 'server', 'kern', n));

test('1. zelfijking: de scan vindt een woord dat er met opzet in wordt gezet', () => {
  const tijdelijk = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-car05-'));
  try {
    /* In CODE, niet in commentaar -- dat is precies het onderscheid dat de
       handhaver maakt, en dus ook wat de ijking moet aantonen. */
    fs.writeFileSync(path.join(tijdelijk, 'stiekem.js'), 'const score = 87;\nmodule.exports = { score };\n');
    const { gevonden } = grensScan([tijdelijk]);
    assert.equal(gevonden.length, 1, 'de scan hoort een score in code te vinden; doet hij dat niet, ' +
      'dan zegt zijn groen op de echte mappen niets');
    assert.match(gevonden[0], /score/);

    /* En de andere kant: hetzelfde woord in COMMENTAAR mag juist wel, want deze
       lagen moeten kunnen uitleggen waarom er geen score is. */
    fs.writeFileSync(path.join(tijdelijk, 'stiekem.js'), '/* hier komt geen score, zie CAR-05 */\nmodule.exports = {};\n');
    assert.deepStrictEqual(grensScan([tijdelijk]).gevonden, [],
      'een woord in commentaar is geen score; anders kan de laag zijn eigen grens niet opschrijven');
  } finally { fs.rmSync(tijdelijk, { recursive: true, force: true }); }
});

test('2. elk verboden woord draagt een reden', () => {
  assert.ok(WOORDEN.length >= 6, 'een lijst van een paar woorden dekt de vormen niet');
  for (const [woord, reden] of WOORDEN) {
    assert.ok(String(reden || '').trim().length > 10,
      'het woord "' + woord + '" staat op de lijst zonder reden; dan groeit hij met wat iemand ooit ' +
      'verdacht vond en krimpt hij bij de eerste valse treffer');
  }
});

test('3. geen cijfer op een mens in de hele carrierekant', () => {
  const { gevonden, ontbreekt } = grensScan(MAPPEN);
  assert.deepStrictEqual(ontbreekt, [],
    'een map uit de carrierekant is weg of hernoemd; een grens die over een verdwenen map zwijgt, ' +
    'staat groen zonder iets te bewaken');
  assert.deepStrictEqual(gevonden, [],
    'CAR-05: een score op een mens wordt nooit een veld en nooit een sorteersleutel ' +
    '(KANTOORMACHT.md, HDI.md, ONTMOETEN.md, LIFE.md)');
});

test('4. de gedragshelft weigert een uitzondering zonder reden', () => {
  assert.throws(() => mensVrij([{ gewicht: 1 }], { gewicht: '' }),
    /geen reden/, 'een naamloze uitzondering is een achterdeur met een vinkje ervoor');
  assert.deepStrictEqual(mensVrij([{ naam: 'x', plafondCenten: 5 }], { plafondCenten: 'een grens op een BEDRAG' }), []);
  assert.deepStrictEqual(mensVrij([{ naam: 'x', gewicht: 0.87 }], {}), ['gewicht = 0.87'],
    'een getal op een mens dat geen `score` heet, is nog steeds een getal op een mens');
});
