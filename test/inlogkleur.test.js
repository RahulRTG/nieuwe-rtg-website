'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const lees = bestand => fs.readFileSync(path.join(__dirname, '..', bestand), 'utf8');

test('de levende inlogkleur bepaalt alleen variabelen en het donkere DS-vlak', () => {
  const waarden = {}, klassen = [], vlak = { setAttribute(name, value) { this[name] = value; },
    classList: { add(name) { klassen.push(name); } } };
  const document = {
    readyState: 'complete',
    documentElement: { hasAttribute: () => false, style: { setProperty(name, value) { waarden[name] = value; } } },
    getElementById: () => null,
    createElement: () => ({}),
    head: { appendChild(el) { document.link = el; } },
    querySelector: selector => selector === '[data-inlogkleur]' ? vlak : null,
    querySelectorAll: selector => selector === '[data-inlogkleur]' ? [vlak] : []
  };
  const window = { location: { search: '?uur=18.5&dag=200&seizoen=zomer' } };
  const sandbox = { window, document, Date, Math, URLSearchParams, parseFloat, parseInt, isNaN,
    setInterval: () => ({ unref() {} }) };
  vm.createContext(sandbox); vm.runInContext(lees('public/shared/inlogkleur.js'), sandbox);
  assert.deepEqual(Object.keys(waarden).sort(), ['--inlog-accent', '--inlog-basis', '--inlog-onder', '--inlog-top']);
  assert.ok(Object.values(waarden).every(value => /^rgba\(/.test(value)));
  assert.equal(vlak['data-rtg-vlak'], 'onyx');
  assert.deepEqual(klassen, ['ds-inlogkleur']);
  assert.equal(document.link.href, '/ds/rtg-ds.css');
  assert.equal(window.Inlogkleur.palet(new Date('2026-07-19T12:00:00Z')).seizoen, 'zomer');
});

test('alle hosts gebruiken de centrale inlogkleurcomponent', () => {
  const bron = lees('public/shared/inlogkleur.js');
  assert.doesNotMatch(bron, /createElement\(['"]style['"]\)|inlogkleur-stijl/);
  assert.match(bron, /inlogkleurStijlLink\.href = '\/ds\/rtg-ds\.css'/);
  for (const app of ['app', 'backoffice', 'leverancier', 'personeel']) {
    const html = lees('public/apps/' + app + '.html');
    assert.equal((html.match(/\/shared\/inlogkleur\.css/g) || []).length, 0, app);
    assert.equal((html.match(/\/shared\/inlogkleur\.js/g) || []).length, 1, app);
  }
  const css = lees('public/ds/componenten/inlogkleur.css');
  assert.match(css, /radial-gradient\(155% 78%/);
  assert.doesNotMatch(css, /!important|#[0-9a-f]{3,8}\b/i);
});
