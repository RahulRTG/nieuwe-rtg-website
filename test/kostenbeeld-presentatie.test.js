'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('het gedeelde kostenbeeld heeft één statische presentatie op alle drie hosts', () => {
  const js = lees('public/shared/kostenbeeld.js');
  assert.doesNotMatch(js, /createElement\(['"]style['"]\)|ksStijl|textContent\s*=\s*['"`][.]ks-/);
  assert.match(js, /K\.stijl\s*=\s*function \(\) \{ return null; \}/);
  for (const app of ['geld', 'kosten', 'zaakkosten']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/kostenbeeld\.css/g) || []).length, 0, app);
    assert.equal((html.match(/<script[^>]+src="\/shared\/kostenbeeld\.js"/g) || []).length, 1, app);
  }
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/kostenbeeld\.css/);
});

test('de kostenbediening blijft focusbaar en heeft een ruim aanraakdoel', () => {
  const css = lees('public/ds/componenten/kostenbeeld.css');
  assert.match(css, /\.ds-kostenbeeld \.ks-waarom \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-kostenbeeld \.ks-waarom:focus-visible \{ outline:/);
  for (const klas of ['ks-hoofd', 'ks-zin', 'ks-kpi', 'ks-keten', 'ks-stap']) {
    assert.match(css, new RegExp('\\.' + klas));
  }
});
