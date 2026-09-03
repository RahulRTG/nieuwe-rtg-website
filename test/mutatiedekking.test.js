/* DUN EN BEPROEFD ZIJN NIET HETZELFDE SOORT OVERLEVER (TAKEN.md 4.53).

   WAAROM DEZE TOETS ER IS. `MUTATIES.json` droeg een getal `overleefd` dat twee
   dingen bij elkaar optelde. Een toets die drieentwintig mutaties heeft
   doorstaan zegt iets over die TOETS; een die er een kreeg omdat zijn module
   bijna geen muteerbaar construct draagt, zegt iets over de MOTOR. Ze stonden
   naast elkaar in dezelfde regel, en de werkvoorraad in BEWIJS.md las daardoor
   als een lijst zwakke toetsen waar de helft dat niet was.

   DRIE DINGEN DIE HIER VASTLIGGEN:

     1. DE GRENS IS EEN KEUZE MET EEN NAAM, en hij staat op EEN plek. Zou
        scripts/bewijs.js zijn eigen drempel dragen, dan lopen het cijfer op het
        scherm en het cijfer in BEWIJS.md stil uit elkaar -- de klasse fout waar
        dit huis er al een paar van heeft gehad.
     2. EEN ONTBREKEND VELD VALT DE STRENGE KANT OP. Een oud verdict zonder
        `dekking` wordt uit `geprobeerd` afgeleid en telt als DUN. Andersom zou
        een verouderd register de bevinding wegpoetsen: alles zonder veld heet
        dan beproefd, en dat is precies de geruststelling die niemand heeft
        verdiend.
     3. HET SPLITST EN HET FILTERT NIET. Een dunne overlever blijft een
        overlever: totaal = dun + beproefd, altijd. Zou hij uit de telling
        vallen, dan is dit geen onderscheid maar een manier om het cijfer te
        verlagen.

   Draai los: node --test test/mutatiedekking.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { DUN_ONDER, dekkingVan, overleverTelling } = require('../scripts/mutatie');

const WORTEL = path.join(__dirname, '..');

test('de grens ligt op DUN_ONDER, en aan beide kanten ervan', () => {
  assert.ok(DUN_ONDER > 1, 'een drempel van 1 of lager onderscheidt niets');
  assert.equal(dekkingVan(0), 'dun');
  assert.equal(dekkingVan(DUN_ONDER - 1), 'dun');
  assert.equal(dekkingVan(DUN_ONDER), 'beproefd', 'de grens hoort erbij te horen');
  assert.equal(dekkingVan(DUN_ONDER + 100), 'beproefd');
});

test('de telling splitst, en telt niets weg', () => {
  const uitslag = {
    'een.test.js': { staat: 'overleefd', geprobeerd: 1, dekking: 'dun' },
    'twee.test.js': { staat: 'overleefd', geprobeerd: 23, dekking: 'beproefd' },
    'drie.test.js': { staat: 'overleefd', geprobeerd: 30, dekking: 'beproefd' },
    'vier.test.js': { staat: 'gezakt' },
    'vijf.test.js': { staat: 'geen module gevonden' }
  };
  const t = overleverTelling(uitslag);
  assert.deepEqual(t, { totaal: 3, dun: 1, beproefd: 2 });
  assert.equal(t.dun + t.beproefd, t.totaal, 'een dunne overlever mag niet uit de telling vallen');
});

test('een oud verdict ZONDER `dekking` valt de strenge kant op', () => {
  /* Het register is een bestand dat een half jaar kan blijven staan. Wie het
     ontbrekende veld als "beproefd" leest, maakt van elke verouderde regel
     stilzwijgend een bevinding tegen de toets. */
  const t = overleverTelling({
    'oud-dun.test.js': { staat: 'overleefd', geprobeerd: 2 },
    'oud-veel.test.js': { staat: 'overleefd', geprobeerd: 40 }
  });
  assert.deepEqual(t, { totaal: 2, dun: 1, beproefd: 1 });
});

test('een lege of ontbrekende uitslag geeft nul en geen uitzondering', () => {
  assert.deepEqual(overleverTelling({}), { totaal: 0, dun: 0, beproefd: 0 });
  assert.deepEqual(overleverTelling(null), { totaal: 0, dun: 0, beproefd: 0 });
});

test('elke overlever in het ECHTE register draagt zijn dekking', () => {
  /* Zonder deze bewering is de splitsing een functie die niemand voedt: het
     register kan dan overlevers dragen die alleen via het oude pad worden
     ingedeeld, en dan meet de kolom in BEWIJS.md iets anders dan de motor. */
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8'));
  const over = Object.entries(reg.toetsen).filter(([, v]) => v.staat === 'overleefd');
  for (const [naam, v] of over) {
    assert.ok(['dun', 'beproefd'].includes(v.dekking),
      naam + ' staat als overleefd zonder dekking; draai `npm run mutatie ' + naam + ' --opnieuw`');
    assert.equal(v.dekking, dekkingVan(v.geprobeerd || 0),
      naam + ': de vastgelegde dekking klopt niet met het aantal pogingen');
  }
});

test('BEWIJS.md meldt hetzelfde aantal overlevers als het register', () => {
  const reg = JSON.parse(fs.readFileSync(path.join(WORTEL, 'MUTATIES.json'), 'utf8'));
  const t = overleverTelling(reg.toetsen);
  const doc = fs.readFileSync(path.join(WORTEL, 'BEWIJS.md'), 'utf8');
  const regel = /\|\s\*\*overleefd\*\*[^|]*\|\s*(\d+)([^|]*)\|/.exec(doc);
  assert.ok(regel, 'BEWIJS.md draagt geen overleefd-regel meer');
  assert.equal(Number(regel[1]), t.totaal);
  if (t.totaal) {
    assert.match(regel[2], new RegExp('waarvan ' + t.dun + ' met minder dan ' + DUN_ONDER),
      'BEWIJS.md noemt de dunne overlevers niet apart');
  }
});

test('scripts/bewijs.js draagt GEEN eigen drempel', () => {
  /* Twee drempels lopen uit elkaar, altijd, en dan zegt het ene scherm iets
     anders dan het andere over dezelfde toets. */
  const bron = fs.readFileSync(path.join(WORTEL, 'scripts', 'bewijs.js'), 'utf8');
  assert.match(bron, /require\('\.\/mutatie'\)/, 'bewijs.js haalt de telling niet uit de motor');
  assert.doesNotMatch(bron.replace(/DUN_ONDER/g, ''), /\bgeprobeerd\b\s*(<|>|<=|>=)/,
    'bewijs.js vergelijkt zelf op `geprobeerd`; dan draagt hij een tweede drempel');
});
