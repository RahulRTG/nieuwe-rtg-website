'use strict';
/* PEOPLE_TIME_LOOP_COMPLETENESS_CHECK (server/kern/vrijheid/lus.js) tegen de
   boom: elke schakel die STAAT of DEELS heet, wijst naar een bestand dat
   bestaat en een toets die bestaat. Een schakel die zijn bewijs kwijtraakt,
   laat de bouw zakken -- en READY kan alleen als elke schakel staat. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const lus = require('../server/kern/vrijheid/lus');

const ROOT = path.join(__dirname, '..');
const VOLGORDE = ['PERSON', 'POLICY', 'ROSTER', 'WORK', 'COVERAGE', 'FAIRNESS', 'DECISION', 'HANDOVER', 'TIME', 'IMPACT', 'CAPACITY', 'IMPROVEMENT'];

test('de lus heeft alle schakels in volgorde', () => {
  assert.deepEqual(lus.SCHAKELS.map(s => s.schakel), VOLGORDE);
});

test('elke schakel met een stand wijst naar een bestaand bestand en een bestaande toets', () => {
  for (const s of lus.SCHAKELS) {
    assert.ok(['STAAT', 'DEELS', 'ONTBREEKT'].includes(s.stand), s.schakel);
    if (s.stand === 'ONTBREEKT') { assert.ok(s.ontbreekt, s.schakel + ' zegt wat er ontbreekt'); continue; }
    assert.ok(fs.existsSync(path.join(ROOT, s.waar)), s.schakel + ': ' + s.waar);
    const [bestand, naam] = s.bewijs;
    const bron = fs.readFileSync(path.join(ROOT, bestand), 'utf8');
    assert.ok(bron.includes("test('" + naam), s.schakel + ': toets "' + naam + '" bestaat niet');
    if (s.stand === 'DEELS') assert.ok(s.ontbreekt, s.schakel + ' zegt wat er ontbreekt');
  }
});

test('geen READY zolang een schakel ontbreekt', () => {
  const st = lus.status();
  assert.equal(st.PEOPLE_TIME_STATUS, 'BLOCKED');
  assert.ok(st.blockers.some(b => b.startsWith('IMPACT:')));
  const alles = lus.SCHAKELS.every(s => s.stand === 'STAAT') && !lus.OVERIG.length;
  assert.equal(st.PEOPLE_TIME_STATUS === 'READY', alles);
});
