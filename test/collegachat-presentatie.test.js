'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('CollegaChat heeft één statische presentatie voor beide werk-apps', () => {
  const bron = lees('public/shared/collegachat.js');
  assert.doesNotMatch(bron, /createElement\(['"]style['"]\)|ccStijl|function stijl|style=/);
  assert.match(bron, /link\.href = '\/ds\/rtg-ds\.css'/);
  assert.match(bron, /el\.className = 'ds-collegachat'/);
  assert.match(bron, /el\.hidden\s*=\s*!c\.ongelezen/);

  for (const app of ['leverancier', 'personeel']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/collegachat\.css/g) || []).length, 0, app);
    assert.equal((html.match(/\/shared\/collegachat\.js/g) || []).length, 1, app);
  }
  assert.match(lees('public/ds/rtg-ds.css'), /componenten\/collegachat\.css/);
});

test('CollegaChat houdt dialoog, bediening, focus, safe areas en rust aantoonbaar', () => {
  const bron = lees('public/shared/collegachat.js');
  const css = lees('public/ds/componenten/collegachat.css');

  assert.match(bron, /role="dialog" aria-modal="true"/);
  assert.match(bron, /e\.key === 'Escape'/);
  assert.match(bron, /focusVoorOpen/);
  assert.match(css, /\.ds-collegachat #ccKop button \{[^}]*inline-size: var\(--ds-doel\);[^}]*block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-collegachat #ccVoet input \{[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /\.ds-collegachat #ccVoet button \{[^}]*min-inline-size: var\(--ds-doel\);[^}]*min-block-size: var\(--ds-doel\)/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|!important/);
});

test('ongelezenstatus gebruikt hetzelfde badgecontract in beide bronbundels', () => {
  for (const bestand of ['public/apps/leverancier.js', 'public/apps/personeel.js']) {
    const bron = lees(bestand);
    assert.match(bron, /class="cc-badge/);
    assert.match(bron, /ds-collegachat-badge/);
    assert.match(bron, /data-dmbadge=/);
    assert.doesNotMatch(bron, /data-dmbadge=[^>]*style=/);
  }
});
