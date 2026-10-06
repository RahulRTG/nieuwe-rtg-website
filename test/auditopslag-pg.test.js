'use strict';
/* A-P1-05, open beperking: de PG-stand van de auditopslag staat vast (zie AUDITOPSLAG.md). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const poort = require('../server/db/audit-poort');

test('bij PostgreSQL geeft de auditpoort geen opslag, en dat is vastgelegd', () => {
  const p = poort({ db: {}, store: 'postgres', sqlite: null, bundelDoos: null, bewaar() {} });
  assert.equal(p.open('apiSpoor'), null);
  assert.equal(p.open('handelingLog'), null);
});

test('beide aanroepers vangen null op met een terugval (geen crash, geen stil verlies)', () => {
  const a = fs.readFileSync(path.join(__dirname, '..', 'server', 'opzet', 'auditspoor.js'), 'utf8');
  const b = fs.readFileSync(path.join(__dirname, '..', 'server', 'lib', 'handelingsspoor.js'), 'utf8');
  assert.match(a, /save\.audit\?\.open\('apiSpoor'\)/);
  assert.match(b, /save\.audit\?\.open\('handelingLog'\)/);
  assert.match(b, /opslag \? opslag\.view\(\) : eigen\.bak\('handelingLog'\)/);
});

test('het document noemt de beperking en het openstaande besluit', () => {
  const d = fs.readFileSync(path.join(__dirname, '..', 'AUDITOPSLAG.md'), 'utf8');
  assert.match(d, /Open besluit/);
  assert.match(d, /geen tijdgebonden bewaring/);
});

test('mutatie: een poort die voor postgres wel iets teruggeeft laat de eerste toets zakken', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'server', 'db', 'audit-poort.js'), 'utf8');
  assert.match(src, /if \(store !== 'sqlite'\) return null;/);
});
