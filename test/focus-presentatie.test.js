'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('FocusUI gebruikt de centrale DS-component op alle vier hosts', () => {
  const bron = lees('public/shared/focus.js');
  assert.doesNotMatch(bron, /createElement\(['"](?:style|link)['"]\)|fxStijl|rtgDsRuntimeCss|\.textContent\s*=\s*['"]\.fx-/);
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/focus\.css/);
  for (const app of ['app', 'backoffice', 'leverancier', 'personeel']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/focus\.css/g) || []).length, 0, app);
    assert.equal((html.match(/\/shared\/focus\.js/g) || []).length, 1, app);
    assert.equal((html.match(/\/ds\/componenten\/focus\.css/g) || []).length, 1, app);
  }
});

test('FocusUI behoudt inhoud, melding, toetsenbordfocus en reduced motion zonder important', () => {
  const css = lees('public/ds/componenten/focus.css');
  const bron = lees('public/shared/focus.js');
  assert.match(bron, /const inhoudWeergave = new WeakMap\(\)/);
  assert.match(bron, /el\.style\.setProperty\('display', 'none'\)/);
  assert.match(bron, /el\.style\.removeProperty\('display'\)/);
  assert.match(css, /\.ds-focus-kop:focus-visible/);
  assert.match(css, /\.ds-focus-kaart\.ds-focus-dicht\.ds-focus-melding/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /!important|#[0-9a-f]{3,8}\b/i);
});
