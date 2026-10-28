'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../public/apps/sitemaker.html'), 'utf8');

test('Website-maker verklaart zijn bestaande dialoogopeners', () => {
  for (const [id, doel] of [['terugKnop', 'openSheet'], ['blokKnop', 'blokSheet'],
    ['openKnop', 'openSheet'], ['onlineKnop', 'onlineSheet']]) {
    assert.match(html, new RegExp('id="' + id + '"[^>]*aria-haspopup="dialog"[^>]*aria-controls="' + doel + '"'));
  }
  for (const id of ['blokSheet', 'openSheet', 'onlineSheet']) {
    assert.match(html, new RegExp('id="' + id + '"[^>]*role="dialog"[^>]*aria-modal="true"'));
  }
});

test('Website-maker houdt diepe bestaande acties in de actieve context bereikbaar', () => {
  assert.match(html, /id="persoonlijkKnop"[^>]*data-contextactie/);
  assert.match(html, /id="publiceerKnop"[^>]*data-contextactie/);
  assert.match(html, /BLOKTYPES\.forEach[\s\S]{0,180}setAttribute\('data-contextactie',''\)/);
  assert.match(html, /ob\.textContent='Open';ob\.setAttribute\('data-contextactie',''\)/);
  assert.match(html, /kb\.textContent='Gebruik';kb\.setAttribute\('data-contextactie',''\)/);
});

test('blokbediening blijft zichtbaar, aanraakbaar en benoemd zonder muishover', () => {
  assert.match(html, /\.bwbalk\{[^}]*display:flex[^}]*opacity:\.72/);
  assert.match(html, /\.wb-blok:focus-within>\.bwbalk\{opacity:1/);
  assert.match(html, /if\(titel\)x\.setAttribute\('aria-label',titel\)/);
  assert.doesNotMatch(html, /\.bwbalk\{[^}]*display:none/);
});
