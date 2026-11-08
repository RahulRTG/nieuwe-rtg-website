'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.resolve(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(ROOT, bestand), 'utf8');

test('de gedeelde kantoordeur vervaagt een uitgeschakelde actie niet', () => {
  const component = lees('public/ds/componenten/kantoorgesprek.css');
  const merken = lees('public/apps/merken.html');
  const register = lees('public/apps/platformregister.html');
  assert.match(component, /\.ds-kantoorgesprek \.kg-rij button:disabled\s*\{\s*opacity:\s*1;/,
    'de disabled knop houdt zijn contrastrijke accentvlak tijdens het verzoek');
  assert.doesNotMatch(component, /\.ds-kantoorgesprek \.kg-rij button:disabled\s*\{[^}]*opacity:\s*(?:0?\.[0-9]+)/,
    'component-opacity mag de letter en achtergrond niet met het ivoor mengen');
  assert.doesNotMatch(merken, /(?:^|\n)\s*button\s*\{/,
    'Merken mag de ingesloten kantoordeur niet via een globale button-owner overschrijven');
  assert.doesNotMatch(register, /(?:^|\n)\s*button(?::[^,{]+)?\s*\{/,
    'Platformregister mag de ingesloten kantoordeur niet via een globale button-owner overschrijven');
});
