'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('ondernemer-poort gebruikt één centraal Design System-contract', () => {
  const bron = lees('public/shared/ondernemerpoort.js');
  const html = lees('public/apps/leverancier.html');
  assert.doesNotMatch(bron, /var CSS\s*=|createElement\(['"]style['"]\)|function stijl|\.style\.(?:top|bottom)/);
  assert.match(bron, /className = 'poort-band poort-toast ds-ondernemerpoort'/);
  assert.match(bron, /link\.href = '\/ds\/rtg-ds\.css'/);
  assert.equal((html.match(/\/shared\/ondernemerpoort\.css/g) || []).length, 0);
  assert.equal((html.match(/<script[^>]+src="\/shared\/ondernemerpoort\.js"/g) || []).length, 1);
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/ondernemerpoort\.css/);
});

test('ondernemer-poort houdt veilige bediening, focus en beweging', () => {
  const bron = lees('public/shared/ondernemerpoort.js');
  const css = lees('public/ds/componenten/ondernemerpoort.css');
  assert.match(bron, /aria-modal/);
  assert.match(bron, /e\.key === 'Escape'/);
  assert.match(bron, /focusVoorOpen/);
  assert.match(css, /\.ds-ondernemerpoort\.poort-band \.p-open \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-ondernemerpoort \.poort-knoprij button \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.ds-ondernemerpoort\.poort-band\[hidden\], \.ds-ondernemerpoort\.poort-waas\[hidden\] \{ display: none; \}/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|!important/);
});
