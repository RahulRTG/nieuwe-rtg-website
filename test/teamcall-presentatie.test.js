'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('TeamCall heeft één statische presentatie zonder inline uitzonderingen', () => {
  const js = lees('public/shared/teamcall.js');
  assert.doesNotMatch(js, /createElement\(['"]style['"]\)|tcStijl|style=|\.style\.cssText/);
  for (const app of ['leverancier', 'personeel']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/teamcall\.css/g) || []).length, 0, app);
    assert.equal((html.match(/\/shared\/teamcall\.js/g) || []).length, 1, app);
  }
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/teamcall\.css/);
});

test('TeamCall houdt kernbediening, safe areas, focus en meelezen zichtbaar', () => {
  const css = lees('public/ds/componenten/teamcall.css');
  assert.match(css, /#tcBalk button \{[^}]*min-inline-size: var\(--ds-doel\); min-block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-teamcall-ring \.knoppen button \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.tc-meelezen \{/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
