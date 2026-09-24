/* BEDIENBAAR, OPNIEUW GEDEFINIEERD -- de pure kern van de meterreparatie.

   scripts/lib/bedieningsmeting.js zet de vier meetfouten van 24 september 2026
   recht (navigatie, een noemer die onder het examen groeide, de schil in de
   noemer, een onhaalbaar budget). Dit bestand bewaakt de kern zonder browser;
   test/appwerkt-meter.e2e.js bewaakt het geheel op een synthetisch scherm.

     1. De schil is herleidbaar: elk teken wordt aangemaakt door een script in
        public/shared/, en dat script bestaat.
     2. De noemer telt alleen app-knoppen die te raken zijn, ontdubbeld, en
        zonder de onomkeerbare.
     3. Budget en drempel volgen uit de noemer, en een drempel boven het budget
        is een MeterConfigFout -- nooit een NIET_GETEST.
     4. Het oordeel: onder de drempel NIET_GETEST, erop of erboven BEWEZEN, en
        een lege noemer is NIET_GETEST met zijn reden. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const M = require('../scripts/lib/bedieningsmeting');

const WORTEL = path.join(__dirname, '..');
const k = (merk, herkomst, raakpunten, onomkeerbaar) => ({ merk, herkomst, raakpunten, onomkeerbaar: !!onomkeerbaar });

test('1. elk schilteken wordt aangemaakt door een gedeeld script', () => {
  assert.ok(M.SCHIL.length >= 10);
  for (const s of M.SCHIL) {
    assert.ok(s.bron.startsWith('public/shared/'), s.teken + ': de bron hoort in public/shared/ te staan');
    const pad = path.join(WORTEL, s.bron);
    assert.ok(fs.existsSync(pad), s.teken + ': ' + s.bron + ' bestaat niet');
    assert.ok(fs.readFileSync(pad, 'utf8').includes(s.teken), s.teken + ' komt niet voor in ' + s.bron);
  }
  assert.equal(M.isSchil('div.rtg-edge-chrome'), true);
  assert.equal(M.isSchil('button#osMenuBtn.amn-knop'), true);
  assert.equal(M.isSchil('main#main'), false);
  assert.equal(M.isSchil('div.rtg-edge-chromeachtig'), false, 'een teken is een heel teken, geen voorvoegsel');
});

test('2. de noemer: alleen te raken app-knoppen, ontdubbeld, zonder onomkeerbare', () => {
  const p = M.plan([
    k('a1', 'main#app', 5), k('a2', 'main#app', 1), k('a2', 'main#app', 5),
    k('a3', 'main#app', 0), k('a4', 'main#app', 5, true),
    k('s1', 'div.rtg-edge-chrome', 5), k('s2', 'div.rtg-edge-chrome', 0)
  ]);
  assert.deepEqual(p.app.noemer, ['a1', 'a2'], 'gedeeltelijk te raken telt mee, bedekt niet, dubbel een keer');
  assert.deepEqual(p.schil.noemer, ['s1']);
  assert.deepEqual(p.nietRaakbaar, { app: 1, schil: 1 });
  assert.deepEqual(p.onomkeerbaar, { app: 1, schil: 0 });
});

test('3. budget en drempel volgen uit de noemer; onhaalbaar is een meterfout', () => {
  const zes = Array.from({ length: 6 }, (_, i) => k('a' + i, 'main#app', 5));
  const p = M.plan(zes);
  assert.equal(p.app.budget, 6);
  assert.equal(p.app.drempel, 3);
  const veel = Array.from({ length: 30 }, (_, i) => k('a' + i, 'main#app', 5));
  assert.throws(() => M.plan(veel, { plafond: 10 }), (e) => e.name === 'MeterConfigFout' && /drempel \(15\) ligt boven het budget \(10\)/.test(e.message));
  assert.doesNotThrow(() => M.plan(veel, { plafond: 15 }), 'drempel gelijk aan budget is haalbaar');
});

test('4. het oordeel', () => {
  const p = M.plan(Array.from({ length: 6 }, (_, i) => k('a' + i, 'main#app', 5))).app;
  assert.equal(M.oordeel(p, { geprobeerd: 6, gelukt: 2 }).status, 'NIET_GETEST');
  assert.equal(M.oordeel(p, { geprobeerd: 6, gelukt: 3 }).status, 'BEWEZEN');
  assert.match(M.oordeel(p, { geprobeerd: 6, gelukt: 6, teruggekeerd: 1 }).reden, /6 te raken bij het laden.*teruggekeerd/);
  const leeg = M.plan([]).app;
  assert.equal(M.oordeel(leeg, {}).status, 'NIET_GETEST');
  assert.match(M.oordeel(leeg, {}).reden, /geen knop die bij het laden te raken is/);
});
