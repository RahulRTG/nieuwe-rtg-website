/* DE INDEX VAN DE BUNDELDELEN LOOPT NIET ACHTER.

   BUNDELS.md wordt voortgebracht door scripts/deelindex.js. Een voortgebracht
   bestand dat niemand vers houdt, is binnen twee weken een leugen met een
   inhoudsopgave -- en dit bestand is er juist om iemand de weg te wijzen, dus
   een verkeerde wegwijzer is erger dan geen.

   Draai los: node --experimental-sqlite --test test/deelindex.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { bouw } = require('../scripts/deelindex.js');
const { onderwerpVan } = require('../scripts/lib/bundeldeel.js');

const WORTEL = path.join(__dirname, '..');

test('BUNDELS.md is gelijk aan wat de delen vandaag zeggen', () => {
  const opSchijf = fs.readFileSync(path.join(WORTEL, 'BUNDELS.md'), 'utf8');
  assert.equal(opSchijf, bouw(),
    'BUNDELS.md loopt achter op de delen -- draai: node scripts/deelindex.js');
});

test('de index noemt elk deel van elke bundel', () => {
  const { bundels } = require('../scripts/bundel');
  const tekst = fs.readFileSync(path.join(WORTEL, 'BUNDELS.md'), 'utf8');
  let geteld = 0;
  for (const map of Object.values(bundels)) {
    const dir = path.join(WORTEL, 'public', map);
    if (!fs.existsSync(dir)) continue;
    for (const naam of fs.readdirSync(dir).filter(n => n.endsWith('.js'))) {
      assert.ok(tekst.includes('`' + naam + '`'), naam + ' staat niet in BUNDELS.md');
      geteld++;
    }
  }
  assert.ok(geteld > 300, 'er zijn echt delen nagelopen (' + geteld + ')');
});

/* DE TEGENPROEF op de zeef zelf: zonder deze zou een onderwerpzoeker die altijd
   null teruggeeft ook een geldige index opleveren -- eentje met 394 streepjes. */
test('DE TEGENPROEF: de onderwerpzoeker vindt echt onderwerpen, en niet overal een', () => {
  assert.equal(onderwerpVan('/* ==== RTG Werk-OS ==== */\ncode();'), 'RTG Werk-OS',
    'een kop tussen isgelijktekens is het onderwerp, ook al is hij kort');
  assert.equal(onderwerpVan('/* de contactpin: je eigen code, als tekst en als QR */'),
    'de contactpin: je eigen code, als tekst en als QR');
  assert.equal(onderwerpVan('const a = 1;\n/* pas hieronder een uitleg die lang genoeg is */'), null,
    'een bestand dat met code begint heeft geen onderwerpregel');
  assert.equal(onderwerpVan('/* deel 4b */\ncode();'), null, 'zeven letters is geen onderwerp');
  assert.equal(onderwerpVan(''), null);
  assert.equal(onderwerpVan('/* een zin die over twee\n   regels loopt en pas hier eindigt. En dan nog wat. */'),
    'een zin die over twee regels loopt en pas hier eindigt',
    'een onderwerp mag over regels lopen maar houdt op bij de eerste punt');
});

/* DE DERDE TEGENPROEF, en die komt uit een echte fout. De zeef liep door in de
   CODE onder een kort commentaar, want hij zocht naar een punt en een
   commentaarregel zonder punt heeft die niet. In BUNDELS.md stond daardoor
   "mijn zorgprofiel el.innerHTML = '<div class=..." -- een wegwijzer die leest
   als een fout. Het commentaar is afgelopen bij zijn sluitteken, en daar houdt
   het onderwerp dus ook op. */
test('DE DERDE TEGENPROEF: het onderwerp stopt waar het commentaar stopt', () => {
  assert.equal(onderwerpVan("/* mijn zorgprofiel */\nel.innerHTML = '<div class=\"live-start\">';"),
    'mijn zorgprofiel', 'de code onder het commentaar hoort er niet bij');
  assert.equal(onderwerpVan('// een regelcommentaar zonder punt\nconst x = 1;'),
    'een regelcommentaar zonder punt', 'en bij een regelcommentaar houdt het op aan het eind van de regel');
  assert.equal(onderwerpVan('// eerste regel van een uitleg\n// die op de tweede doorloopt\ncode();'),
    'eerste regel van een uitleg die op de tweede doorloopt',
    'twee regelcommentaren achter elkaar horen wel bij elkaar');
});
