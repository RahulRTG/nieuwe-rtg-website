'use strict';
/* De gouden lus van RTG Academy (de opdracht, par. 38) als toets.

   Wat hij bewijst: elke schakel van NEED tot NEXT TRAINEE sluit, gemeten bij de
   ONTVANGER, en de vijf storingen in scripts/leerhuisproef.js houden.

   Wat hem laat zakken (met de hand nagetrokken): haal in
   server/kern/leerhuis/oordeel.js de hercertificering uit certStand() weg en
   IMPACT en EMPLOYEE REFRESH gaan open; laat in graaf.js de trainers op het
   kale curriculumobject vergelijken en IMPACT gaat open (dat was de eerste
   echte fout die deze proef vond).

   En de tweede helft: een gesloten lus is geen productieklaar. ACADEMY_STATUS
   moet BLOCKED blijven zolang er blokkades zijn, en elke blokkade moet in
   ACADEMY.md staan -- anders loopt de status los van het document.

   Draai los: node --test test/leerhuis-lus.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { meet, BLOKKADES, MIN_SCHAKELS } = require('../scripts/leerhuisproef');

const KETEN = ['NEED', 'ROLE', 'KNOWLEDGE', 'COMPETENCY', 'CURRICULUM', 'QUALIFIED TRAINER', 'TRAINEE', 'PRACTICE',
  'SIMULATION', 'SUPERVISED WORK', 'EVIDENCE', 'ASSESSMENT', 'CERTIFICATION', 'AUTHORITY ELIGIBILITY', 'AUTHORITY POLICY',
  'REAL WORK', 'FEEDBACK', 'IMPROVEMENT', 'KNOWLEDGE CHANGE', 'IMPACT', 'TRAINER UPDATE', 'EMPLOYEE REFRESH', 'NEXT TRAINER', 'NEXT TRAINEE'];

const uit = meet();

test('1. elke schakel van de lus sluit, in de volgorde van de opdracht', () => {
  const open = uit.schakels.filter(s => s.stand !== 'gesloten');
  assert.deepEqual(open, [], 'open schakels: ' + JSON.stringify(open));
  assert.deepEqual(uit.schakels.map(s => s.naar).filter(n => KETEN.includes(n)), KETEN);
  assert.ok(uit.telling.schakels >= MIN_SCHAKELS);
  assert.equal(uit.LOOP_COMPLETENESS, 'CLOSED');
});

test('2. elke schakel draagt een waarneming en niet alleen true', () => {
  for (const s of uit.schakels) assert.ok(typeof s.ziet === 'string' && s.ziet.length > 3, s.naar + ' zag niets concreets');
});

test('3. de storingen houden hun belofte', () => {
  assert.equal(uit.telling.gebroken, 0, JSON.stringify(uit.storingen.filter(s => s.stand !== 'gehouden')));
  assert.ok(uit.telling.storingen >= 5);
});

test('4. een gesloten lus is geen READY: de status blijft BLOCKED zolang er blokkades zijn', () => {
  assert.ok(BLOKKADES.length > 0);
  assert.equal(uit.ACADEMY_STATUS, 'BLOCKED');
  assert.deepEqual(uit.blokkades.map(b => b.id), BLOKKADES.map(b => b.id));
});

test('5. elke blokkade staat in ACADEMY.md, zodat status en document niet uit elkaar lopen', () => {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'ACADEMY.md'), 'utf8');
  for (const b of BLOKKADES) assert.ok(doc.includes('`' + b.id + '`'), 'ACADEMY.md noemt blokkade ' + b.id + ' niet');
  assert.ok(doc.includes('ACADEMY_STATUS=BLOCKED'), 'ACADEMY.md noemt de huidige status niet');
});

test('6. de uitslag zegt wat hij NIET bewijst', () => {
  assert.match(uit.grens, /geen server/);
});
