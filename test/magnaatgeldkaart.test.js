/* De geldkaart van Magnaat World (ronde A2, stap 1) is compleet en klopt.

   De kaart zelf staat in scripts/lib/magnaatgeldkaart.js. Deze toets zoekt de
   geldplekken OPNIEUW in de code van World (zonder commentaar, met de echte
   regelnummers) en eist dat elke gevonden plek precies een been van een
   gebeurtenis is, en elk been een gevonden plek. Een nieuwe mutatie zonder
   betekenis en tegenzijde laat hem zakken. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('../scripts/lib/bron');
const kaart = require('../scripts/lib/magnaatgeldkaart');
const { REGELS, WORLD_CODE } = require('../scripts/lib/magnaatgrondwet');

const WORTEL = path.join(__dirname, '..');

function worldBestanden() {
  return fs.readdirSync(path.join(WORTEL, WORLD_CODE.map))
    .filter(n => n.endsWith('.js') && !WORLD_CODE.zonder.includes(n))
    .map(n => WORLD_CODE.map + '/' + n);
}
const regelsVan = (rel) => zonderCommentaar(fs.readFileSync(path.join(WORTEL, rel), 'utf8'), { regelsHeel: true }).split('\n');

/* Elke treffer als bestand:regel, zo vaak als hij op die regel staat. */
function treffers(regels = null) {
  const uit = new Map();
  for (const rel of worldBestanden()) {
    const r = regels ? regels(rel) : regelsVan(rel);
    r.forEach((regel, i) => {
      let n = 0;
      for (const z of kaart.ZOEK) n += (regel.match(new RegExp(z.patroon, 'g')) || []).length;
      if (n) uit.set(rel + ':' + (i + 1), n);
    });
  }
  return uit;
}

/* Waar staat een been? De regel die de code bevat, en als `na` er is: de
   regel waarvan de eerstvolgende niet-lege regel `na` bevat. Precies een. */
function vindBeen(been, regels = regelsVan) {
  const r = regels(been.bestand);
  const plekken = [];
  r.forEach((regel, i) => {
    if (!regel.includes(been.code)) return;
    if (been.na) {
      const volgende = r.slice(i + 1).find(x => x.trim());
      if (!volgende || !volgende.includes(been.na)) return;
    }
    plekken.push(been.bestand + ':' + (i + 1));
  });
  return plekken;
}

test('elke geldplek in World is precies een been van een geclassificeerde gebeurtenis', () => {
  const gevonden = treffers();
  const gedekt = new Map();
  for (const g of kaart.GEBEURTENISSEN) {
    for (const been of g.benen) {
      const plekken = vindBeen(been);
      assert.equal(plekken.length, 1, g.id + ': been "' + been.code + '" staat ' + plekken.length + ' keer in ' + been.bestand + ' (verouderd of dubbelzinnig; zet `na`)');
      /* Een gemigreerde gebeurtenis boekt via het grootboek: haar been is geen
         directe mutatie meer en mag dat ook nooit weer worden. */
      if (g.gemigreerd) {
        assert.ok(!gevonden.has(plekken[0]), g.id + ' is gemigreerd (' + g.gemigreerd + ') maar ' + plekken[0] + ' is een directe mutatie');
        continue;
      }
      gedekt.set(plekken[0], (gedekt.get(plekken[0]) || 0) + 1);
    }
  }
  const ongedekt = [...gevonden].filter(([plek, n]) => (gedekt.get(plek) || 0) !== n).map(([plek, n]) => plek + ' (' + n + ' mutatie(s), ' + (gedekt.get(plek) || 0) + ' been/benen)');
  assert.deepEqual(ongedekt, [], 'geldplekken zonder classificatie: ' + ongedekt.join('; '));
  const verzonnen = [...gedekt.keys()].filter(p => !gevonden.has(p));
  assert.deepEqual(verzonnen, [], 'benen op een regel waar de meter geen mutatie ziet');
});

test('elke gebeurtenis heeft een betekenis, een van, een naar en een tegenzijde uit de gesloten lijsten', () => {
  const ids = new Set();
  for (const g of kaart.GEBEURTENISSEN) {
    assert.ok(!ids.has(g.id), 'dubbel id ' + g.id); ids.add(g.id);
    assert.ok(kaart.BETEKENISSEN.includes(g.betekenis), g.id + ': onbekende betekenis ' + g.betekenis);
    assert.ok(kaart.CATEGORIEEN.includes(g.categorie), g.id + ': onbekende categorie ' + g.categorie);
    assert.ok(kaart.TEGENZIJDEN.includes(g.tegenzijde), g.id + ': onbekende tegenzijde ' + g.tegenzijde);
    assert.ok(g.van && g.naar, g.id + ': van en naar zijn verplicht');
    for (const s of g.samengesteld || []) assert.ok(kaart.BETEKENISSEN.includes(s), g.id + ': onbekende deelbetekenis ' + s);
    assert.ok(g.benen.length >= 1, g.id + ': zonder been');
  }
});

test('het saldopatroon van de kaart is dat van de grondwet, dus de 32 van M-001 zitten erin', () => {
  const m001 = REGELS.find(r => r.id === 'M-001').scope.world.schending;
  assert.equal(kaart.ZOEK.find(z => z.naam === 'saldo').patroon, m001.patroon);
  const saldo = new RegExp(m001.patroon, 'g');
  let n = 0;
  for (const rel of worldBestanden()) for (const regel of regelsVan(rel)) n += (regel.match(saldo) || []).length;
  const benen = kaart.GEBEURTENISSEN.filter(g => !g.gemigreerd).flatMap(g => g.benen).filter(been => new RegExp(m001.patroon).test(been.code)).length;
  assert.equal(benen, n, 'elke saldomutatie van de grondwetmeter heeft een been');
});

/* LAT.md regel 10: een toets die je niet hebt zien uitslaan, meet niets. Een
   nagebootste nieuwe mutatie moet als ongedekt worden gevonden. */
test('zelfijking: een nieuwe mutatie zonder classificatie wordt gevonden', () => {
  const doel = WORLD_CODE.map + '/acties.js';
  const extra = (rel) => rel === doel ? regelsVan(rel).concat(['      st.geld[h] += 1000;']) : regelsVan(rel);
  const gevonden = treffers(extra);
  const laatste = doel + ':' + extra(doel).length;
  assert.equal(gevonden.get(laatste), 1, 'de nagebootste mutatie wordt gezien');
  const gedekt = new Set(kaart.GEBEURTENISSEN.flatMap(g => g.benen.flatMap(been => vindBeen(been, extra))));
  assert.ok(!gedekt.has(laatste), 'en is door geen been gedekt');
});
