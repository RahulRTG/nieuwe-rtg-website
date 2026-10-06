'use strict';
/* VONK: DE VOLGORDE IS EEN DAGLOT, GEEN OORDEEL.

   De dagselectie sorteerde op een verborgen sleutel -- punten per wens maal
   honderd, plus gedeelde interesses, min afstand -- en knipte daarna op zes.
   Daarmee besliste een cijfer op een mens WIE er verscheen, wat ONTMOETEN.md
   par. 4.4 "ook niet intern als sorteersleutel" verbiedt. Omdat de sleutel vast
   was, zag een lid elke dag dezelfde zes, en wie een sterke wens niet haalde
   kwam in een volle pool nooit in beeld (par. 3.7: een redelijke kans).

   Hier draait de echte selectie met een nagemaakte context, onder een
   verzette huisklok (RTG_KLOK, server/lib/klok.js) zodat "morgen" te meten is. */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SELECTIE = require.resolve('../server/kern/vonk/selectie');
const KLOK = require.resolve('../server/lib/klok');

function selectieOp(dag) {
  const was = process.env.RTG_KLOK;
  process.env.RTG_KLOK = dag + 'T12:00:00Z';
  try {
    delete require.cache[SELECTIE]; delete require.cache[KLOK];
    return require(SELECTIE);
  } finally {
    if (was == null) delete process.env.RTG_KLOK; else process.env.RTG_KLOK = was;
    delete require.cache[KLOK];
  }
}

function profiel(o = {}) {
  return Object.assign({ actief: true, geslacht: 'v', zoekt: ['v', 'm'], leeftijd: 30,
    leeftijdMin: 18, leeftijdMax: 99, maxKm: 50, interesses: [], kenmerken: {}, wensen: {} }, o);
}

/* Een kijker die sterk 'serieus' wil, twintig kandidaten die dat zijn, en een
   die 'casual' is. Onder de oude sleutel stond die laatste altijd onderaan. */
function pool() {
  const profielen = {
    ik: profiel({ wensen: { relatievorm: { in: ['serieus'], gewicht: 'sterk' } } })
  };
  for (let i = 0; i < 20; i++) profielen['k' + i] = profiel({ kenmerken: { relatievorm: 'serieus' }, interesses: ['koken'] });
  profielen.anders = profiel({ kenmerken: { relatievorm: 'casual' } });
  return profielen;
}

function draai(dag, profielen = pool()) {
  const maak = selectieOp(dag);
  const { vonkSelectie } = maak({
    d: () => ({ profielen }), mag: () => ({ ok: true }), likeVan: () => false, matchTussen: () => false,
    haversine: () => null, publiek: k => ({ k }), DAG_MAX: 6, rooster: () => null, tafelkaart: () => null,
    geblokkeerd: () => false
  });
  return vonkSelectie('ik').mensen.map(m => m.k);
}

test('1. dezelfde dag geeft dezelfde zes, een andere dag andere', () => {
  const vandaag = draai('2026-10-04');
  assert.equal(vandaag.length, 6);
  assert.deepEqual(draai('2026-10-04'), vandaag, 'binnen een dag ligt de selectie vast');
  const morgen = draai('2026-10-05');
  assert.notDeepEqual(morgen, vandaag, 'morgen weer nieuwe mensen');
});

test('2. wie een sterke wens niet haalt, krijgt ook een kans', () => {
  let gezien = 0;
  for (let d = 0; d < 60; d++) {
    const dag = new Date(Date.UTC(2026, 10, 1) + d * 86400000).toISOString().slice(0, 10);
    if (draai(dag).includes('anders')) gezien++;
  }
  /* 6 van de 21 per dag: verwacht ongeveer 17 van de 60. De ondergrens is ruim
     gekozen zodat de toets alleen zakt als iemand structureel wegvalt. */
  assert.ok(gezien >= 5, 'in 60 dagen ' + gezien + ' keer gezien; met een sorteersleutel was dat 0');
});

test('3. de harde filters blijven filters', () => {
  const profielen = pool();
  profielen.ik.wensen.relatievorm.gewicht = 'verplicht';
  for (let d = 1; d <= 20; d++) {
    assert.ok(!draai('2026-10-' + String(d).padStart(2, '0'), profielen).includes('anders'),
      'een verplichte eis tegen een uitgesproken tegenpool haalt de kandidaat weg');
  }
});

test('4. de bron: geen puntentelling op mensen meer', () => {
  const selectie = fs.readFileSync(path.join(__dirname, '..', 'server', 'kern', 'vonk', 'selectie.js'), 'utf8');
  assert.ok(!/\bW\.weegt\b|\borde\s*:/.test(selectie), 'selectie.js ordent weer op een sleutel');
  assert.equal(require('../server/kern/vonk/wensen').weegt, undefined, 'wensen.js exporteert weer een weegfunctie');
});
