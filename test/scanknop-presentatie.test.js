'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('de huisoverlay gebruikt de centrale DS-presentatie op iedere echte host', () => {
  const js = lees('public/shared/scanknop.js');
  assert.doesNotMatch(js, /createElement\(['"]style['"]\)|rtg-scanknop-stijl/);
  for (const app of ['app', 'leverancier', 'pay', 'foundation/vrienden']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/scanknop\.css/g) || []).length, 0, app);
    assert.equal((html.match(/<script[^>]+src="\/shared\/scanknop\.js"/g) || []).length, 1, app);
  }
  assert.match(js, /className = 'rtg-scan-ov ds-scanknop'/);
  assert.match(js, /scanknopStijlLink\.href = '\/ds\/rtg-ds\.css'/);
});

test('de scanuitwegen houden veilige randen, focus en 44px bediening', () => {
  const css = lees('public/ds/componenten/scanknop.css');
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.rtg-scan-x \{[^}]*inline-size: var\(--ds-doel\); block-size: var\(--ds-doel\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.rtg-scan-hand button \{[^}]*min-inline-size: var\(--ds-doel\); min-block-size: var\(--ds-doel\)/);
  assert.doesNotMatch(css, /!important|#[0-9a-f]{3,8}\b/i);
});
