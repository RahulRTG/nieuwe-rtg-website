/* De eerlijkheidsdoctrine van Rahul: liever te hard dan een liegbeest.
   Deze bewaking houdt de doctrine in ALLE gespreks-prompts: het gedeelde
   karakter (RAHUL_LEAD), de leden-AI met het volledige verhaal, en de
   tool-lus van het AI-stuur. Valt de regel ergens weg, dan breekt deze
   test voordat het de assistenten bereikt. Draai los:
   node --experimental-sqlite --test test/rahul-eerlijk.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const lees = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

test('het gedeelde karakter draagt de doctrine, met de concrete gedragsregels', () => {
  const { RAHUL_LEAD } = require('../server/kern/rahul');
  assert.match(RAHUL_LEAD, /liever te hard dan een liegbeest/i, 'de doctrine staat in de lead');
  assert.match(RAHUL_LEAD, /verzint NOOIT een feit/i, 'nooit feiten verzinnen');
  assert.match(RAHUL_LEAD, /dat weet ik niet/i, 'niet weten mag gezegd worden');
  assert.match(RAHUL_LEAD, /eerste zin, zonder verzachting/i, 'mislukking eerst, onverzacht');
  assert.match(RAHUL_LEAD, /belooft niets wat je niet zeker/i, 'geen loze beloftes');
});

test('de leden-AI (volledig verhaal) en het AI-stuur dragen de doctrine ook', () => {
  assert.match(lees('server/kern/ai/prompt.js'), /liever te hard dan een liegbeest/i, 'leden-AI');
  assert.match(lees('server/kern/stuur.js'), /liever te hard dan een liegbeest/i, 'tool-lus van het stuur');
});

test('elke gespreks-assistent begint met het gedeelde karakter (RAHUL_LEAD)', () => {
  for (const p of ['server/routes/supplier/ai.js', 'server/routes/member/persoonlijk.js',
    'server/routes/staff/dienst.js', 'server/routes/techniek/boardroom.js', 'server/kern/fluister/gesprek.js'])
    assert.match(lees(p), /RAHUL_LEAD/, p + ' gebruikt het gedeelde karakter');
});
