/* Het sprekersregister: het enige dat "ongemeten" in "gemeten" verandert.

   Twee dingen worden hier hard gemaakt, en de tweede is de belangrijkste:

   1. De VORM van een oordeel klopt -- een oordeel zonder taal, datum, bron of
      bereik is geen bewijs maar een aantekening.
   2. Een genoteerde correctie is ook echt DOORGEVOERD. Een spreker die zegt
      dat het Tigrinya voor "huiswerk" fout is en wiens correctie in een
      JSON-bestand blijft liggen, heeft niets veranderd voor de mens op het
      scherm. Dat is het doodspoor-patroon uit DOODSPOOR.json, en het is hier
      extra pijnlijk: het register zou dan zeggen dat de taal is nagekeken
      terwijl de fout er nog staat. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { TALEN } = require('../server/talen');
const { KERN, dictVan } = require('../server/translate/woordenboek/wereld');

const register = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'TAALOORDEEL.json'), 'utf8'));
const HERKOMST = ['moedertaalspreker', 'docent', 'beeedigd vertaler', 'vertaalbureau'];

test('het register draagt zijn eigen uitleg en grens', () => {
  /* Een leeg register moet zelf vertellen waarom het leeg is; anders leest een
     nul als een vergeten bestand in plaats van als een eerlijke stand. */
  for (const veld of ['uitleg', 'waarom', 'grens', 'vorm', 'oordelen']) {
    assert.ok(register[veld], 'TAALOORDEEL.json mist "' + veld + '"');
  }
  assert.ok(Array.isArray(register.oordelen));
});

test('elk oordeel noemt taal, bereik, datum, wie en waarvandaan', () => {
  const codes = new Set(TALEN.map(t => t.code));
  for (const o of register.oordelen) {
    assert.ok(codes.has(o.taal), 'onbekende taalcode: ' + o.taal);
    assert.ok(o.bereik, 'oordeel zonder bereik voor ' + o.taal);
    assert.match(String(o.beoordeeld || ''), /^\d{4}-\d{2}-\d{2}$/, 'oordeel zonder datum voor ' + o.taal);
    assert.ok(o.door && String(o.door).trim(), 'oordeel zonder naam of rol voor ' + o.taal);
    assert.ok(HERKOMST.includes(o.herkomst), 'onbekende herkomst voor ' + o.taal + ': ' + o.herkomst);
    assert.ok(['goed', 'fouten-gevonden'].includes(o.uitslag), 'onbekende uitslag voor ' + o.taal);
  }
});

test('een genoteerde correctie staat ook echt in de tabel', () => {
  /* De regel die dit register eerlijk houdt. Zonder deze toets kan een taal op
     "bewezen" komen te staan terwijl de gevonden fout nog op het scherm staat. */
  const nietDoorgevoerd = [];
  for (const o of register.oordelen) {
    for (const c of (o.correcties || [])) {
      if (o.bereik !== 'kernwoordenboek') continue;
      assert.ok(KERN.includes(c.woord), 'correctie op een woord dat niet in KERN staat: ' + c.woord);
      const d = dictVan(o.taal) || {};
      if (d[c.woord] !== c.wordt) nietDoorgevoerd.push(o.taal + ':' + c.woord + ' zou "' + c.wordt + '" moeten zijn, staat "' + d[c.woord] + '"');
    }
  }
  assert.deepEqual(nietDoorgevoerd, [], 'correcties die zijn opgeschreven maar niet doorgevoerd');
});

test('de meter leest het register en houdt vorm en betekenis uit elkaar', () => {
  const m = require('../scripts/taalkwaliteit').meet();
  assert.equal(m.talen, TALEN.length);
  /* Zolang er geen enkel sprekersoordeel is, staat de betekenis van ELKE taal
     op ongemeten -- ook van de talen waarvan de vorm "gemeten" is. Die twee
     mogen nooit worden opgeteld tot een gerustheid die er niet is. */
  const zonderOordeel = TALEN.length - register.oordelen.length;
  assert.ok(m.betekenisOngemeten >= zonderOordeel);
  assert.equal(m.graden.bewezen, register.oordelen.length ? m.graden.bewezen : 0);
  if (!register.oordelen.length) {
    assert.equal(m.betekenisOngemeten, TALEN.length, 'zonder spreker is geen enkele betekenis gemeten');
    assert.equal(m.graden.bewezen, 0);
  }
});
