'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ontwerp = require('../scripts/ontwerpsysteem');
const bron = fs.readFileSync('public/shared/uurwerk.js', 'utf8');
const css = fs.readFileSync('public/ds/uurwerk.css', 'utf8');

test('Uurwerk houdt toestand in JavaScript en presentatie in één statisch blad', () => {
  assert.doesNotMatch(bron, /createElement\(['"]style['"]\)/);
  assert.doesNotMatch(bron, /\.textContent\s*=\s*['"](?:#rtgGanglijn|::selection)/);
  const analyse = ontwerp.scriptLaadAnalyse(bron, { ds: false });
  assert.deepEqual(analyse.onzeker, []);
  assert.deepEqual(analyse.verwijzingen, [{ href: '/ds/uurwerk.css', soort: 'dom' }]);
  assert.equal(analyse.injecties + analyse.mogelijkeInjecties, 0);
});

test('het statische uurwerkblad behoudt taal, ganglijn en reduced motion', () => {
  for (const contract of ['::selection', '.rtg-minuutbaan', '#rtgGanglijn', '@keyframes rtgKlop',
    '@media (prefers-reduced-motion: reduce)']) assert.ok(css.includes(contract), contract);
  assert.match(css, /inline-size/);
  assert.match(css, /inset-inline/);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|!important/);
});

test('Heritage-order gebruikt alleen de vaste IDs van de bestaande loaders', () => {
  const order = fs.readFileSync('public/shared/rtg-heritage-order.js', 'utf8');
  assert.match(order, /getElementById\('rtgHeritageCss'\)/);
  assert.match(order, /getElementById\('rtgEditorialV4Css'\)/);
  assert.doesNotMatch(order, /querySelector\(['"]link\[href/);
  assert.deepEqual(ontwerp.scriptLaadAnalyse(order, { ds: false }).onzeker, []);
});
