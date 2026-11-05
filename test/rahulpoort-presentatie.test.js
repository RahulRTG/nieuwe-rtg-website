'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('Rahul-poort gebruikt één centraal Design System-contract op zijn drie werkhosts', () => {
  const js = lees('public/shared/rahulpoort.js');
  assert.doesNotMatch(js, /createElement\(['"]style['"]\)|rpStijl|var CSS\s*=/);
  assert.match(js, /link\.href = '\/ds\/rtg-ds\.css'/);
  assert.match(js, /<div class="rp ds-rahulpoort">/);
  for (const app of ['leverancier', 'meldkamer', 'personeel']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/rahulpoort\.css/g) || []).length, 0, app);
  }
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/rahulpoort\.css/);
});

test('Rahul-poort houdt gesprek, focus, touch en reduced motion bruikbaar', () => {
  const css = lees('public/ds/componenten/rahulpoort.css');
  assert.match(css, /\.ds-rahulpoort \.rp-rij button \{[^}]*min-inline-size: var\(--ds-doel\); min-block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-rahulpoort \.rp-pad \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|!important/);
});
