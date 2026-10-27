'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('Assets houdt het intrekken van een zojuist gemaakte aanvraag in de bedieningsroute', () => {
  const assets = lees('public/apps/app-main/app-main-32a.js');
  assert.match(assets, /class="mo-code js-asintrek"[^>]+data-contextactie/);
});

test('FocusUI houdt dynamische kaartkoppen in de bedieningsroute', () => {
  const focus = lees('public/shared/focus.js');
  assert.match(focus, /kop\.setAttribute\('data-contextactie', ''\)/);
  assert.match(focus, /kop\.setAttribute\('aria-label', n \+ ' in- of uitklappen'\)/);
});
