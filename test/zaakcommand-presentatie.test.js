'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('Zaak Command gebruikt één centraal Design System-contract in beide werk-apps', () => {
  const bron = lees('public/shared/zaakcommand.js');
  assert.doesNotMatch(bron, /var CSS\s*=|createElement\(['"]style['"]\)|function stijl|Z\.stijl|style="/);
  assert.match(bron, /link\.href = '\/ds\/rtg-ds\.css'/);
  assert.match(bron, /el\.className = 'zc ds-zaakcommand'/);

  for (const app of ['leverancier', 'personeel']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/zaakcommand\.css/g) || []).length, 0, app);
    assert.equal((html.match(/<script[^>]+src="\/shared\/zaakcommand\.js"/g) || []).length, 1, app);
  }
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/zaakcommand\.css/);
});

test('Zaak Command houdt desktop en duimstand toegankelijk en rustig', () => {
  const css = lees('public/ds/componenten/zaakcommand.css');
  assert.match(css, /\.ds-zaakcommand :is\(\.zc-rail button,\.zc-knop\) \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-zaakcommand \.zc-veld \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-zaakcommand\.zc-klein \.zc-tegels/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|!important/);
});
