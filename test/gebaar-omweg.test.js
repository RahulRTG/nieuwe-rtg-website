/* GEEN OMWEG LANGS veegDoor IN DE GEBAARPROEVEN (EDGE.md par. 11, ronde 2).

   veegDoor (test/helper.js) bestaat omdat een eigen reeks -- mouse.down() en
   daarna losse moves -- racet met de timer van lang drukken: tussen down() en de
   eerste move() zit een aparte CDP-ronde, en op een pagina die nog opstart haalt
   die de 520 ms. De helper stuurt ze in een vlucht en heeft een terugval. Maar
   vier reeksen liepen er nog omheen (gebaar.e2e.js, het bord, de post en de
   Salon), en die hadden dus de oude dobbelsteen nog. Ze gaan er nu doorheen, en
   deze scan houdt dat zo.

   WAT TELT ALS OMWEG, op de bron zonder commentaar van test/gebaar*.e2e.js:

     - een `.mouse.down(` met een `.mouse.move(` erachter voor de eerstvolgende
       `.mouse.up(` -- slepen buiten de helper;
     - een eigen `mousePressed` over het protocol -- dezelfde reeks, een laag
       dieper;
     - een `touchStart` met een `touchMove` erachter voor de eerstvolgende
       `touchEnd` -- slepen met een vinger buiten de helper.

   WAT ER MET OPZET BUITEN VALT: vasthouden zonder bewegen. De borgproeven van
   stap 7 drukken en laten los zonder te schuiven; daar kan de timer niets
   inhalen, want er komt geen beweging die te laat kan zijn. Een move VOOR de
   down (erheen gaan) is ook geen slepen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('../scripts/lib/bron');

const MAP = __dirname;
const regelVan = (code, i) => code.slice(0, i).split('\n').length;

function omwegen(code) {
  const uit = [];
  const tussen = (open, dicht, midden, wat) => {
    for (const m of code.matchAll(open)) {
      const rest = code.slice(m.index + m[0].length);
      const eind = rest.search(dicht);
      if (midden.test(eind < 0 ? rest : rest.slice(0, eind))) uit.push({ regel: regelVan(code, m.index), wat });
    }
  };
  tussen(/\.mouse\.down\(/g, /\.mouse\.up\(/, /\.mouse\.move\(/, 'mouse.down met moves erachter');
  tussen(/['"]touchStart['"]/g, /['"]touchEnd['"]/, /['"]touchMove['"]/, 'touchStart met touchMove erachter');
  for (const m of code.matchAll(/['"]mousePressed['"]/g)) uit.push({ regel: regelVan(code, m.index), wat: 'eigen mousePressed' });
  return uit;
}

test('de scan ziet een omweg, en ziet vasthouden niet als omweg', () => {
  /* De ijking. Zonder deze proeven is "nul omwegen" ook de uitslag van een scan
     die niets herkent. */
  assert.equal(omwegen('await page.mouse.move(1,2);\nawait page.mouse.down();\nfor (;;) await page.mouse.move(3,4);\nawait page.mouse.up();').length, 1,
    'een down met moves erachter hoort een omweg te zijn');
  assert.equal(omwegen("cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed' })").length, 1,
    'een eigen mousePressed hoort een omweg te zijn');
  assert.equal(omwegen("send({ type: 'touchStart' }); send({ type: 'touchMove' }); send({ type: 'touchEnd' });").length, 1,
    'een touchStart met een touchMove erachter hoort een omweg te zijn');
  assert.deepEqual(omwegen('await page.mouse.move(1,2);\nawait page.mouse.down();\nawait page.clock.runFor(150);\nawait page.mouse.up();\nawait page.mouse.move(5,6);'), [],
    'vasthouden zonder bewegen, en erheen gaan, is geen omweg');
  assert.deepEqual(omwegen("send({ type: 'touchStart' }); wacht(); send({ type: 'touchEnd' });"), [],
    'een vinger die blijft liggen is geen omweg');
});

test('geen gebaarproef sleept buiten veegDoor om', () => {
  const bestanden = fs.readdirSync(MAP).filter((n) => /^gebaar.*\.e2e\.js$/.test(n)).sort();
  /* Nul omwegen over nul bestanden is geen uitslag (LAT.md regel 9). */
  assert.ok(bestanden.length >= 5, 'de scan hoort de gebaarproeven te vinden (gevonden: ' + bestanden.join(', ') + ')');
  const gevonden = [];
  for (const n of bestanden) {
    for (const o of omwegen(zonderCommentaar(fs.readFileSync(path.join(MAP, n), 'utf8'), { regelsHeel: true }))) gevonden.push(n + ':' + o.regel + ' ' + o.wat);
  }
  assert.deepEqual(gevonden, [], 'deze reeksen slepen buiten veegDoor (test/helper.js) om, en racen dus met de timer van lang drukken');
});
