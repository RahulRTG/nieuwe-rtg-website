'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('Split heeft één centraal Design System-contract in de apphost', () => {
  const js = lees('public/shared/split.js');
  const html = lees('public/apps/app.html');
  assert.doesNotMatch(js, /createElement\(['"]style['"]\)|rtgSplitCss|function stijl/);
  assert.equal((html.match(/\/shared\/split\.css/g) || []).length, 0);
  assert.equal((html.match(/<script[^>]+src="\/shared\/split\.js"/g) || []).length, 1);
  assert.match(js, /link\.href = '\/ds\/rtg-ds\.css'/);
  assert.match(js, /ov\.className = 'ds-split'/);
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/split\.css/);
});

test('Split houdt bediening en selecties 44px, focusbaar en safe-area-bewust', () => {
  const css = lees('public/ds/componenten/split.css');
  assert.match(css, /\.ds-split \.sp-balk button \{[^}]*min-inline-size: var\(--ds-doel\);[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-split \.sp-kop select \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /safe-area-inset-top/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|!important/);
  const js = lees('public/shared/split.js');
  assert.match(js, /greep\.tabIndex = 0/);
  assert.match(js, /aria-valuenow/);
  assert.match(js, /ArrowUp/);
  assert.match(js, /ArrowRight/);
  assert.match(js, /focusVoorOpen/);
});
