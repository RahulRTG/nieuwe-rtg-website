'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('het gedeelde bord heeft één statische presentatie op alle drie hosts', () => {
  const js = lees('public/shared/borden.js');
  assert.doesNotMatch(js, /createElement\(['"]style['"]\)|bordStijl|style=/);
  for (const app of ['app', 'leverancier', 'personeel']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/borden\.css/g) || []).length, 0, app);
    assert.equal((html.match(/\/shared\/borden\.js/g) || []).length, 1, app);
  }
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/borden\.css/);
});

test('bordbediening blijft zichtbaar, focusbaar en bruikbaar op touch', () => {
  const css = lees('public/ds/componenten/borden.css');
  assert.match(css, /\.ds-borden \.bd-chip \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-borden \.bd-add \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.bd-knopjes button[^}]*min-inline-size: var\(--ds-doel\)/);
  for (const klas of ['bd-notitie', 'bd-bweg', 'bd-kopknop', 'bd-leeg']) assert.match(css, new RegExp('\\.' + klas));
});
