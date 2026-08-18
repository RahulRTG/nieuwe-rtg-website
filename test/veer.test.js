/* DE IJKING VAN DE VEER.

   De veer in scripts/norm.js wijst aan welke meter het langst stilstaat terwijl
   er nog werk aan is. Hij houdt niets tegen, en juist daarom moet hij kloppen:
   een lijst die niemand tegenhoudt, wordt alleen gelezen -- en een lijst die de
   verkeerde meter bovenaan zet, stuurt werk naar de verkeerde plek zonder dat
   ooit iets rood wordt. Er is geen exitcode die dat ondervangt; alleen deze
   proeven.

   Twee dingen worden hier bewezen: dat een meter die AF is er niet in staat
   (anders staat de lijst vol met wat er niet meer te doen valt), en dat een
   meter zonder plafond er niet in staat (anders staan "meer toetsen schrijven"
   en "meer schermtoetsen schrijven" eeuwig bovenaan en is de rest onzichtbaar).

   Draai los: node --test test/veer.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const norm = require('../scripts/norm.js');

const VANDAAG = '2026-08-18';
const bouw = (meters, sinds) => ({ vastgelegd: '2026-01-01', meters, sinds: sinds || {} });
const sleutels = (n) => norm.traagsteTanden(n, VANDAAG).map(t => t.sleutel);

test('een meter die AF is staat niet in de lijst', () => {
  /* keuringTeGroot moet omlaag. Op nul valt er niets meer te doen, en dan is
     stilstand geen schuld maar de eindtoestand. */
  assert.deepEqual(sleutels(bouw({ keuringTeGroot: 0 })), [], 'nul is af');
  assert.deepEqual(sleutels(bouw({ keuringTeGroot: 1 })), ['keuringTeGroot'], 'een is niet af');
});

test('een percentage dat op honderd staat is af; eronder niet', () => {
  assert.deepEqual(sleutels(bouw({ dekkingPct: 100 })), []);
  assert.deepEqual(sleutels(bouw({ dekkingPct: 99 })), ['dekkingPct']);
});

test('een meter ZONDER plafond doet niet mee, hoe lang hij ook stilstaat', () => {
  /* testbestanden moet omhoog en is nooit "af" -- meer toetsen is altijd beter.
     Zou hij meedoen, dan stond hij met zijn oudste datum permanent bovenaan en
     was de lijst onbruikbaar voor het doel waarvoor hij bestaat. */
  assert.deepEqual(sleutels(bouw({ testbestanden: 5 }, { testbestanden: '2020-01-01' })), [],
    'een meter zonder bekend einde hoort er niet in, ook niet na zes jaar stilstand');
});

test('de langste stilstand staat bovenaan', () => {
  const n = bouw({ keuringTeGroot: 3, keuringDubbeling: 4, inlineStijlAttributen: 5 },
    { keuringTeGroot: '2026-08-01', keuringDubbeling: '2025-01-01', inlineStijlAttributen: '2026-06-01' });
  assert.deepEqual(sleutels(n), ['keuringDubbeling', 'inlineStijlAttributen', 'keuringTeGroot']);
  assert.equal(norm.traagsteTanden(n, VANDAAG)[0].dagen, 594);
});

test('zonder eigen datum geldt de dag van de grondwaarde, en dat staat er als GESCHAT bij', () => {
  /* Het verschil is niet cosmetisch: wie een geschatte datum voor een meting
     aanziet, denkt dat een meter sinds januari stilstaat terwijl we alleen
     weten dat de norm toen is vastgelegd. */
  const t = norm.traagsteTanden(bouw({ keuringTeGroot: 3 }), VANDAAG)[0];
  assert.equal(t.sinds, '2026-01-01');
  assert.equal(t.geschat, true);

  const gemeten = norm.traagsteTanden(bouw({ keuringTeGroot: 3 }, { keuringTeGroot: '2026-07-01' }), VANDAAG)[0];
  assert.equal(gemeten.geschat, false);
  assert.equal(gemeten.sinds, '2026-07-01');
});

test('een meter die niet in NORM.json staat, of een onleesbare datum, levert geen regel', () => {
  assert.deepEqual(sleutels(bouw({})), [], 'zonder waarde valt er niets te zeggen');
  assert.deepEqual(sleutels(bouw({ keuringTeGroot: 3 }, { keuringTeGroot: 'gisteren' })), [],
    'een datum die geen datum is levert liever niets dan een verzonnen aantal dagen');
  assert.deepEqual(sleutels({ meters: { keuringTeGroot: 3 } }), [],
    'zonder vastgelegd-datum en zonder sinds is er geen beginpunt');
});

test('dagenTussen telt hele dagen en gaat nooit negatief', () => {
  assert.equal(norm.dagenTussen('2026-08-01', '2026-08-18'), 17);
  assert.equal(norm.dagenTussen('2026-08-18', '2026-08-18'), 0);
  assert.equal(norm.dagenTussen('2026-08-20', '2026-08-18'), 0, 'een datum in de toekomst is geen negatieve stilstand');
  assert.equal(norm.dagenTussen('rommel', '2026-08-18'), null);
});

test('heeftEinde kent het verschil tussen een vloer, een plafond en geen van beide', () => {
  assert.equal(norm.heeftEinde({ sleutel: 'x', richting: 'omlaag' }, 1), true);
  assert.equal(norm.heeftEinde({ sleutel: 'x', richting: 'omlaag' }, 0), false);
  assert.equal(norm.heeftEinde({ sleutel: 'xPct', richting: 'omhoog' }, 99), true);
  assert.equal(norm.heeftEinde({ sleutel: 'xPct', richting: 'omhoog' }, 100), false);
  assert.equal(norm.heeftEinde({ sleutel: 'x', richting: 'omhoog' }, 5), false, 'omhoog zonder plafond is nooit af');
  assert.equal(norm.heeftEinde({ sleutel: 'x', richting: 'omlaag' }, undefined), false);
});
