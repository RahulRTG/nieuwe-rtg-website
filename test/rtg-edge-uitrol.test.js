'use strict';
/* Een wereld zonder Edge is een tweede bedieningsgrammatica. Deze toets houdt
   de centrale uitrol klein, gededupeerd en fail-closed voor niet-werelden. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const DEEL = fs.readFileSync(path.join(ROOT, 'public/shared/basis/basis-01ac-edge.js'), 'utf8');
const BASIS = fs.readFileSync(path.join(ROOT, 'public/shared/basis.js'), 'utf8');

test('de gedeelde basis vult Edge op iedere vaste RTG-wereld aan', () => {
  for (const wereld of ['living', 'travel', 'work', 'foundation']) assert.match(DEEL, new RegExp("'" + wereld + "'"));
  assert.match(DEEL, /script\[src\^="\/shared\/randen\.js"\],script\[src\^="\.\.\/shared\/randen\.js"\]/);
  assert.match(DEEL, /window\.RTGRanden/);
  assert.match(DEEL, /window\.__RTGRandenBoot/);
  assert.match(DEEL, /s\.src = '\/shared\/randen\.js'/);
  assert.match(DEEL, /s\.async = true/);
  assert.doesNotMatch(DEEL, /\bcore\b(?=["'])/);
  assert.ok(BASIS.includes(DEEL.trim()), 'de afgeleide basis mist de Edge-uitrol');
});

test('een route zonder bewezen actie krijgt geen gegokte hoofdhandeling', () => {
  const randen = fs.readFileSync(path.join(ROOT, 'public/shared/randen.js'), 'utf8');
  assert.match(randen, /actie: null/);
  assert.doesNotMatch(randen, /main \.knop|main \.campus-ingang|main \[data-primary\]/);
});
