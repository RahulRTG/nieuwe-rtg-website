'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('Rahul-mond gebruikt het centrale Design System en een expliciete signatuurafhankelijkheid', () => {
  const js = lees('public/shared/rahul-mond.js');
  assert.doesNotMatch(js, /createElement\(['"](?:style|script)['"]\)|\.src\s*=|style\.background|rahul-leeg-stijl/);
  assert.match(js, /window\.RTGMond\.maak\(can\)/);
  assert.match(js, /link\.href = '\/ds\/rtg-ds\.css'/);
  assert.match(js, /className = 'rmond rm-weg ds-rahul-mond'/);
  for (const app of ['office', 'scherm', 'leverancier']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/rahul-mond\.css/g) || []).length, 0, app);
    assert.ok(html.indexOf('/shared/mond.js') < html.indexOf('/shared/rahul-mond.js'), app);
  }
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/rahul-mond\.css/);
});

test('Rahul-mond houdt alle bediening 44px, focusbaar en rustig bij reduced motion', () => {
  const css = lees('public/ds/componenten/rahul-mond.css');
  assert.match(css, /\.ds-rahul-mond\.rmond canvas \{[^}]*inline-size: var\(--ds-doel\); block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-rahul-mond\.rmond \.rm-go \{[^}]*inline-size: var\(--ds-doel\); block-size: var\(--ds-doel\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|!important/);
});

test('de signatuurmond kan ook met toetsenbord worden weggelegd', () => {
  const js = lees('public/shared/rahul-mond.js');
  assert.match(js, /can\.tabIndex = 0/);
  assert.match(js, /can\.setAttribute\('role', 'button'\)/);
  assert.match(js, /e\.key === 'Enter' \|\| e\.key === ' '/);
});
