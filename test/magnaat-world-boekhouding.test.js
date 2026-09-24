/* Magnaat World ronde A2.2: de vijf tegenpartijen, minimaal (MAGNAAT.md).

   1. Er zijn er precies vijf, en elk heeft een betekenis.
   2. Elke kant van elke gebeurtenis op de geldkaart is een besloten partij --
      daarmee is elk van de 27 gebeurtenissen sluitend te boeken.
   3. De boekhouding kent dezelfde gebeurtenissoorten als de geldkaart.
   4. Een overdracht is dubbel geboekt, exact, en in hele centen.
   5. Elke rekening draagt de wereld in haar naam: twee werelden die een opslag
      delen, raken elkaars rekeningen en journaal nooit.
   6. Een module beweegt geld alleen in een gekoppelde partij, en het handvat
      daarvoor wordt niet opgeslagen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const kaart = require('../scripts/lib/magnaatgeldkaart');
const { TEGENPARTIJEN, SOORTEN, REKENING, maakBoekhouding, beweeg } = require('../server/kern/spellen/magnaat/boekhouding');

const potje = (id) => ({ id, staat: { maand: 3, geld: {} } });
/* Een gekoppelde partij en haar boekhouding. */
const open = (bh, id) => { const p = potje(id); bh.koppel(p); return bh.voor(p.staat); };

test('1. er zijn precies vijf tegenpartijen, elk met een betekenis', () => {
  assert.deepEqual(Object.keys(TEGENPARTIJEN).sort(), ['aannemer', 'bank', 'huishoudens', 'stad', 'verzekeraar']);
  for (const [naam, wat] of Object.entries(TEGENPARTIJEN)) assert.ok(wat.length > 20, naam + ' heeft een betekenis');
});

test('2. elke kant van elke gebeurtenis op de geldkaart is een besloten partij', () => {
  for (const t of Object.keys(TEGENPARTIJEN)) assert.ok(kaart.PARTIJEN.includes(t), t + ' staat in de partijen van de kaart');
  for (const g of kaart.GEBEURTENISSEN) {
    for (const kant of [g.van, g.naar]) assert.ok(kaart.PARTIJEN.includes(kant), g.id + ': ' + kant + ' is geen besloten partij');
    for (const s of g.samengesteld || []) {
      assert.ok(g.delen && g.delen[s], g.id + ': het deel ' + s + ' heeft een betaler en een ontvanger');
      for (const kant of g.delen[s]) assert.ok(kaart.PARTIJEN.includes(kant), g.id + ' ' + s + ': ' + kant);
    }
  }
});

test('3. de boekhouding kent precies de gebeurtenissoorten van de geldkaart', () => {
  assert.deepEqual(Object.keys(SOORTEN).sort(), kaart.BETEKENISSEN.slice().sort());
});

test('4. een overdracht is dubbel geboekt, exact, en in hele centen', () => {
  const b = open(maakBoekhouding(), 'p1');
  b.overdracht({ soort: 'LENING', sleutel: 'l1', van: ['macro', 'bank'], naar: ['kas', 'anna'], bedrag: 1234567, omschrijving: 'Lening' });
  b.overdracht({ soort: 'RENTE', sleutel: 'r1', van: ['kas', 'anna'], naar: ['macro', 'bank'], bedrag: 1235, omschrijving: 'Rente' });
  assert.equal(b.saldo('kas', 'anna'), 1234567 - 1235);
  assert.equal(b.saldo('macro', 'bank'), -(1234567 - 1235), 'wat de speler heeft, is wat de bank netto uitgaf');
  assert.throws(() => b.overdracht({ soort: 'RENTE', sleutel: 'r2', van: ['kas', 'anna'], naar: ['macro', 'bank'], bedrag: 12.5, omschrijving: 'x' }), /rondt niet af/);
  assert.throws(() => b.overdracht({ soort: 'RENTE', sleutel: 'r3', van: ['kas', 'anna'], naar: ['macro', 'overheid'], bedrag: 1, omschrijving: 'x' }), /Geen tegenpartij/);
  assert.equal(b.bevestig(), 2);
  assert.deepEqual(b.verifieer().bevindingen, []);
  const [lening] = b.gebeurtenissen(1, 1);
  assert.equal(lening.wereld, 'world:p1');
  assert.equal(lening.dag, 3, 'de periode is de spelmaand');
});

test('5. twee werelden die een opslag delen, raken elkaars rekeningen en journaal nooit', () => {
  assert.notEqual(REKENING.macro('world:a', 'bank'), REKENING.macro('world:b', 'bank'));
  assert.equal(REKENING.macro('world:a', 'bank'), 'world:a:macro:bank');
  const db = { data: {} };
  const bh = maakBoekhouding({ db });
  const a = open(bh, 'a'), b = open(bh, 'b');
  a.overdracht({ soort: 'LENING', sleutel: 'zelfde', van: ['macro', 'bank'], naar: ['kas', 'x'], bedrag: 100, omschrijving: 'a' });
  b.overdracht({ soort: 'LENING', sleutel: 'zelfde', van: ['macro', 'bank'], naar: ['kas', 'x'], bedrag: 700, omschrijving: 'b' });
  a.bevestig(); b.bevestig();
  assert.equal(a.saldo('kas', 'x'), 100);
  assert.equal(b.saldo('kas', 'x'), 700, 'dezelfde sleutel in een andere wereld is een andere gebeurtenis');
  assert.equal(a.gebeurtenissen().length, 1);
  assert.ok(a.gebeurtenissen()[0].regels.every(r => r.rekening.startsWith('world:a:')));
  assert.ok(b.gebeurtenissen()[0].regels.every(r => r.rekening.startsWith('world:b:')));
  /* En zonder database een eigen journaal per boekhouding: twee proefwerelden met
     hetzelfde potje-id delen dan niets. */
  const los1 = open(maakBoekhouding(), 'zelfde'), los2 = open(maakBoekhouding(), 'zelfde');
  los1.overdracht({ soort: 'LENING', sleutel: 's', van: ['macro', 'bank'], naar: ['kas', 'x'], bedrag: 1, omschrijving: 'x' });
  los1.bevestig();
  assert.equal(los2.gebeurtenissen().length, 0);
});

test('6. geld bewegen kan alleen in een gekoppelde partij, en het handvat gaat niet mee in de opslag', () => {
  const p = potje('p6');
  p.staat.geld = { anna: 0, boris: 0 };
  const zet = () => beweeg(p.staat, { soort: 'AANDELENKOOP', van: ['kas', 'anna'], naar: ['kas', 'boris'], bedrag: 500 });
  assert.throws(zet, /aan het grootboek hangt/);
  maakBoekhouding().koppel(p);
  zet();
  assert.deepEqual(p.staat.geld, { anna: -500, boris: 500 });
  const opgeslagen = JSON.parse(JSON.stringify(p.staat));
  assert.throws(() => beweeg(opgeslagen, { soort: 'AANDELENKOOP', van: ['kas', 'anna'], naar: ['kas', 'boris'], bedrag: 1 }), /aan het grootboek hangt/,
    'een partij uit de opslag moet eerst opnieuw gekoppeld worden');
});
