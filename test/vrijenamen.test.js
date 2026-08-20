/* DE VRIJE-NAMEN-SCANNER: ziet hij een naam die na een knip nergens meer woont?

   WAAROM DEZE ER IS. Op 19 augustus 2026 gingen zes verhuizingen mis doordat een
   blok code een naam uit zijn OUDE omringende bereik bleef gebruiken. Alle zes
   stil: geldige syntaxis, de server start gewoon op, en de fout valt pas als de
   regel echt draait -- meestal binnen een try/catch die er een 500 van maakt.

   scripts/lib/vrijenamen.js is de meter daarvoor en keuringsregel 50 de poort.
   Deze toets doet twee dingen, en het tweede is het belangrijkste: de zes echte
   gevallen in het klein nabouwen (zodat de meter bewezen bijt), EN de vormen
   nalopen die GEEN bevinding mogen zijn. Een meter die alles meldt is net zo
   nutteloos als een die niets meldt, en bij deze is dat het echte risico:
   eigenschapsnamen, objectsleutels en labels lijken op verwijzingen.

   Draai los: node --experimental-sqlite --test test/vrijenamen.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { vrijeNamen } = require('../scripts/lib/vrijenamen');

const WORTEL = path.join(__dirname, '..');
const namenVan = (bron) => vrijeNamen(bron).namen;

test('de zes echte gevallen van 19 augustus worden alle zes gezien', () => {
  /* Elk stukje hieronder is de vorm waarin de fout er die dag stond, in het
     klein. Zonder deze zaak is "de meter werkt" een bewering en geen meting. */
  assert.deepEqual(
    namenVan('module.exports = ({ app, doe }) => { app.post("/x", () => BUREAUS.map(b => kies(b))); };'),
    ['BUREAUS', 'kies'], 'werkplek-bureaus-b.js: kies en BUREAUS bleven achter');

  assert.deepEqual(
    namenVan('module.exports = (kern) => { const d = new Date(klokNu() + 1); return d; };'),
    ['klokNu'], 'rtmail-lid.js: de klok bleef achter');

  assert.deepEqual(
    namenVan('module.exports = ({ db }) => ({ zoek: (c) => db.get(c) || grootSupplierSync(c) });'),
    ['grootSupplierSync'], 'leverancierpoort.js: de grote kast bleef achter');

  assert.deepEqual(
    namenVan('module.exports = ({ OID }) => ({ csr: (o) => o.key || genKeyPair(o) });'),
    ['genKeyPair'], 'x509-pakket.js: het sleutelpaar bleef achter');

  assert.deepEqual(
    namenVan('module.exports = (opties) => ({ start: () => luister(poort, host, tlsOpties) }); function luister() {}'),
    ['host', 'poort', 'tlsOpties'], 'imap-server.js: drie namen werden nergens uit de opties gehaald');

  assert.deepEqual(
    namenVan('module.exports = (octx) => { const { anthropic } = octx; return () => ctx.kiesBuddy(1) && anthropic; };'),
    ['ctx'], 'schrift.js: de context heet octx, de code las ctx');
});

test('DE TEGENPROEF: wat op een verwijzing LIJKT maar het niet is, telt niet mee', () => {
  /* Dit is de kant waar deze meter kapot kan gaan zonder dat iemand het merkt:
     als hij eigenschapsnamen meetelt, staat de keuring bij elk bestand rood en
     wordt de regel binnen een week uitgezet. */
  assert.deepEqual(namenVan('module.exports = (k) => k.iets.anders;'), [],
    'een eigenschap achter een punt is geen naam uit het bereik');
  assert.deepEqual(namenVan('const x = { alfa: 1, beta: 2 }; module.exports = () => x.alfa;'), [],
    'een sleutel in een object-literal ook niet');
  assert.deepEqual(namenVan('module.exports = (p) => ({ p, q: p });'), [],
    'shorthand telt de waarde en niet de sleutel');
  assert.deepEqual(namenVan('module.exports = ({ a: { b }, c = 1, ...rest }) => b + c + rest.d;'), [],
    'destructuring bindt: geneste patronen, standaardwaarden en rest');
  assert.deepEqual(namenVan('module.exports = () => { try { return 1; } catch (e) { return e; } };'), [],
    'de vangvariabele is gebonden');
  assert.deepEqual(namenVan('module.exports = () => { buiten: for (const x of [1]) { break buiten; } };'), [],
    'een label is geen naam uit het bereik');
  assert.deepEqual(namenVan('const f = function g() { return g; }; module.exports = f;'), [],
    'een benoemde functie-expressie kent zichzelf');
  assert.deepEqual(namenVan('module.exports = () => JSON.stringify(Math.max(1, 2)) + process.pid;'), [],
    'globals tellen niet mee');
});

test('een berekende eigenschap is WEL een verwijzing', () => {
  /* a.b niet, maar a[b] wel -- dat verschil is het hele punt van de tak. Zou hij
     ook de berekende overslaan, dan glipt precies de vorm erdoor die het meest
     op een verwijzing lijkt omdat hij er een IS. */
  assert.deepEqual(namenVan('module.exports = (a) => a[sleutel];'), ['sleutel']);
  assert.deepEqual(namenVan('module.exports = () => ({ [dynamisch]: 1 });'), ['dynamisch']);
});

test('een bestand dat de eigen parser niet leest, meldt dat en telt niet als bevinding', () => {
  const r = vrijeNamen('import x from "y";');
  assert.ok(r.fout, 'ESM hoort een parsefout te geven en geen lijst namen');
  assert.match(r.fout, /ESM/i, 'en die fout hoort te zeggen WAT er niet gaat: ' + r.fout);
  assert.deepEqual(r.namen, [], 'zonder boom geen namen -- geen half antwoord');
});

test('de hele server- en scriptsboom staat op nul, en dat is echt gemeten', () => {
  /* Dezelfde ronde als keuringsregel 50, hier zodat hij ook in `npm test` staat
     -- de suite die tijdens het werk draait. Een handhaver die alleen in CI
     staat, betrapt een fout pas als de tak al af is. */
  const kapot = [];
  let gekeken = 0;
  const loop = (map) => {
    for (const n of fs.readdirSync(map)) {
      const p = path.join(map, n);
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (!/^(node_modules|data|dist|\.git|target)$/.test(n)) loop(p); continue; }
      if (!n.endsWith('.js')) continue;
      gekeken++;
      const r = vrijeNamen(fs.readFileSync(p, 'utf8'));
      if (!r.fout && r.namen.length) kapot.push(path.relative(WORTEL, p) + ' -> ' + r.namen.join(', '));
    }
  };
  loop(path.join(WORTEL, 'server'));
  loop(path.join(WORTEL, 'scripts'));
  assert.ok(gekeken > 2000, 'de ronde hoort echt langs de boom te gaan, gezien: ' + gekeken);
  assert.deepEqual(kapot, [], 'deze bestanden gebruiken een naam die ze nergens hebben');
});
