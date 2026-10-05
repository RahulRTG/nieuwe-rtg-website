/* ============================================================================
   DE BOTSING TUSSEN PROCESSEN IS HOORBAAR -- regressie voor RTG-V1-RELEASE C6.

   server/db/merge.js laat bij twee wijzigingen van hetzelfde blad de onze
   winnen. De uitkomst blijft zo (merge3 is puur, en de productiekeuring houdt
   een tweede schrijvend proces op SQLite tegen), maar een verloren update was
   STIL. Nu meldt merge3 zo'n botsing aan een opBotsing-functie met het pad, en
   de SQLite-opslag geeft beide merges een melder mee (server/db/botsing.js).

   Draai los: node --test test/sqlite-botsing.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { merge3 } = require('../server/db/merge');

function met(base, ons, hun) {
  const paden = [];
  const uit = merge3(base, ons, hun, (p) => paden.push(p));
  return { uit, paden };
}

test('1. beide kanten wijzigen hetzelfde saldo: de onze wint, en het wordt gemeld met het pad', () => {
  const { uit, paden } = met({ a: { saldo: 10 } }, { a: { saldo: 15 } }, { a: { saldo: 7 } });
  assert.deepEqual(uit, { a: { saldo: 15 } }, 'de uitkomst verandert niet');
  assert.deepEqual(paden, ['a.saldo']);
});

test('2. een item in een lijst met id: het pad noemt het item', () => {
  const b = [{ id: 1, n: 0 }], o = [{ id: 1, n: 1 }], h = [{ id: 1, n: 2 }];
  assert.deepEqual(met(b, o, h).paden, ['[id:1].n']);
});

test('3. geen botsing als maar een kant wijzigde, of beide hetzelfde deden', () => {
  assert.deepEqual(met({ x: 1 }, { x: 2 }, { x: 1 }).paden, []);
  assert.deepEqual(met({ x: 1 }, { x: 1 }, { x: 3 }).paden, []);
  assert.deepEqual(met({ x: 1 }, { x: 4 }, { x: 4 }).paden, []);
  assert.deepEqual(met({ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }).paden, [], 'verschillende velden botsen niet');
});

test('4. een lijst zonder sleutel die beide kanten anders wijzigen, botst ook', () => {
  assert.deepEqual(met({ l: [1] }, { l: [1, 2] }, { l: [1, 3] }).paden, ['l']);
});

test('5. zonder opBotsing gedraagt merge3 zich als voorheen', () => {
  assert.deepEqual(merge3({ s: 1 }, { s: 2 }, { s: 3 }), { s: 2 });
});

/* De volledige aanroep, met gebalanceerde haakjes: een regex stopt bij de
   eerste ')' en ziet dan merge3(JSON.parse(x) zonder de rest. */
function aanroepen(bron, kop) {
  const uit = [];
  for (let i = bron.indexOf(kop); i >= 0; i = bron.indexOf(kop, i + 1)) {
    let diepte = 0;
    for (let j = i + kop.length - 1; j < bron.length; j++) {
      if (bron[j] === '(') diepte++;
      else if (bron[j] === ')' && --diepte === 0) { uit.push(bron.slice(i, j + 1)); break; }
    }
  }
  return uit;
}

test('6. ELKE SQLite-merge in server/db geeft een melder mee (in code, niet in commentaar)', () => {
  /* Eerst stond hier alleen sqlite.js, en zei het commitbericht "beide merges".
     Het waren er vier: de herkeuring vond er twee op het GELDPAD zonder melder
     (economische-boeking-sqlite.js voor saldi en boekingen, collectie-sqlite.js
     voor bewerkCollectie). Daarom leest deze toets nu de hele map, en zakt hij
     ook als er een vijfde bijkomt zonder melder. */
  const map = path.join(__dirname, '..', 'server/db');
  const bestanden = fs.readdirSync(map).filter((f) => /sqlite.*\.js$/.test(f));
  let gevonden = 0;
  for (const f of bestanden) {
    const bron = fs.readFileSync(path.join(map, f), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    for (const a of aanroepen(bron, 'merge3(')) {
      gevonden++;
      assert.match(a, /melder\(/, f + ': deze merge meldt een botsing niet: ' + a);
    }
  }
  assert.ok(gevonden >= 4, 'verwacht minstens de vier bekende SQLite-merges, gevonden: ' + gevonden);
});

test('7. de melder telt en noemt geen inhoud', () => {
  const { melder, teller } = require('../server/db/botsing');
  const voor = teller.aantal;
  const oud = console.warn; let regel = '';
  console.warn = (m) => { regel = m; };
  try { melder('wallets')('a.saldo'); } finally { console.warn = oud; }
  assert.equal(teller.aantal, voor + 1);
  assert.match(regel, /wallets/); assert.match(regel, /a\.saldo/);
});
