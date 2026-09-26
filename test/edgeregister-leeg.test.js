/* HET TWEEDE REGISTER BESTAAT NIET MEER, EN KAN NIET STIL TERUGKOMEN.

   Naast RTGAdaptief had de Edge een eigen register: registerAction,
   setProjection en een eigen uitvoerweg (voer). Ronde 2 (EDGE.md par. 11, stap 17
   en 18) heeft het leeggehaald en daarna weggehaald. Er staat geen tand op een
   AANTAL registraties, want een aantal kan op nul staan terwijl de API er nog is
   en morgen weer een vuller krijgt. Deze toets maakt de API zelf onmogelijk: hij
   laadt de kern en de weergave echt, in een nagemaakt venster, en kijkt wat ze
   naar buiten geven.

   De workspace-broker (shared/interface/workspace-broker.js) heeft ook een
   registerAction, maar dat is een ander ding -- de acties van een module in de
   werkruimte, met een eigen machtiging. Hij valt hier met naam buiten.

   DE MUTATIES, elk nagetrokken: exporteer registerAction opnieuw uit de weergave
   (toets 1 zakt), zet register terug in de kern (toets 2 zakt), en laat de
   kern weer een lijst acties in de momentopname geven (toets 2 zakt). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const VERBODEN = ['registerAction', 'setProjection', 'register', 'voer', 'actions', 'defaults'];

function laad(bestand, venster) {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, bestand), 'utf8'), venster, { filename: bestand });
}

test('de weergave van de Edge geeft geen registerAction of setProjection naar buiten', () => {
  const w = { document: {} };
  w.window = w;
  laad('public/shared/rtg-adaptive-edge-core.js', Object.assign(w, { globalThis: w }));
  laad('public/shared/rtg-adaptive-edge.js', w);
  assert.ok(w.RTGAdaptiveEdge, 'de weergave hoort te laden');
  assert.equal(typeof w.RTGAdaptiveEdge.start, 'function', 'de proef laadde de echte weergave');
  for (const naam of VERBODEN) assert.equal(w.RTGAdaptiveEdge[naam], undefined, 'RTGAdaptiveEdge.' + naam + ' bestaat weer');
});

test('de kern van de Edge kent geen register, en zijn momentopname geen acties', () => {
  const kern = require('../public/shared/rtg-adaptive-edge-core.js');
  assert.equal(typeof kern.momentopname, 'function', 'de proef laadde de echte kern');
  for (const naam of VERBODEN) assert.equal(kern[naam], undefined, 'RTGAdaptiveEdgeCore.' + naam + ' bestaat weer');
  kern.model();
  const snap = kern.momentopname();
  assert.ok(snap, 'na model() hoort er een momentopname te zijn');
  assert.equal(snap.acties, undefined, 'de momentopname draagt weer een lijst acties');
});
