'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('leveranciersoverlays gebruiken de centrale statische presentatielaag', () => {
  const bron = lees('public/apps/leverancier.js');
  const html = lees('public/apps/leverancier.html');

  assert.doesNotMatch(bron, /(?:zc|aw|tt)StijlEenmalig|rtg-(?:zc|aw|tt)-stijl|createElement\(['"]style['"]\)/);
  assert.equal((html.match(/\/apps\/leverancier-overlays\.css/g) || []).length, 0);
  assert.match(bron, /function leverancierOverlayPresentatie\(\)/);
  assert.match(bron, /link\.href = '\/ds\/rtg-ds\.css'/);
  assert.match(bron, /ds-leverancier-overlay (?:zc|aw|tt)-ov/);
});

test('de drie overlays houden bediening, safe areas, focus en rustige beweging', () => {
  const css = lees('public/ds/componenten/leverancier-overlays.css');
  assert.doesNotMatch(css, /(?:^|,)\s*\.(?:zc|aw|tt)-/m);

  for (const selector of ['.zc-ov', '.aw-ov', '.tt-ov', '.zc-card', '.aw-card', '.tt-card']) {
    assert.match(css, new RegExp(selector.replace('.', '\\.') + '(?:,|\\s*\\{)'), selector);
  }
  assert.match(css, /\.zc-btn,[\s\S]*min-block-size:\s*var\(--ds-doel\)/);
  assert.match(css, /\.aw-btn,[\s\S]*inline-size:\s*var\(--ds-doel\);[\s\S]*block-size:\s*var\(--ds-doel\)/);
  assert.match(css, /\.tt-sluit[\s\S]*inline-size:\s*var\(--ds-doel\);[\s\S]*block-size:\s*var\(--ds-doel\)/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
