'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('WerkOS heeft één statische presentatie op alle drie hosts', () => {
  const js = lees('public/shared/werkos.js');
  assert.doesNotMatch(js, /const CSS\s*=|createElement\(['"]style['"]\)|stijl\.textContent/);
  for (const app of ['backoffice', 'leverancier', 'personeel']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/ds\/componenten\/werkos\.css/g) || []).length, 1, app);
    assert.ok(html.indexOf('/ds/componenten/werkos.css') < html.indexOf('/shared/werkos.js'), app);
  }
});

test('WerkOS CSS bevat de werktafel, drie bedieningslagen, bordschil en reduced motion', () => {
  const js = lees('public/shared/werkos.js');
  const css = lees('public/ds/componenten/werkos.css');
  assert.match(css, /@layer rtg\.component/);
  assert.match(js, /classList\.add\('ds-werkos'/);
  for (const selector of ['.wos-grid', '.wos-rail', '.wos-top-context', '.wos-dock', '.wos-zoek', '.wos-bord'])
    assert.match(css, new RegExp(selector.replace('.', '\\.')));
  assert.match(css, /prefers-reduced-motion:no-preference/);
  assert.match(css, /safe-area-inset-bottom/);
});
