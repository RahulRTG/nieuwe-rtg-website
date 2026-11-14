'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm'), fs = require('node:fs');
const { bundel } = require('../scripts/bundel');
const { fixture } = require('./lib/foundation-ds-fixture');
function opstelling(ds = true, hash = '') {
  const f = fixture({ ds, source: '/* alleen de bestaande DOM-fixture */' });
  f.document.body.className = ds ? 'ds-scherm' : '';
  f.document.readyState = 'complete';
  f.context.location.hash = hash;
  f.context.history = { replaceState(_, __, url) { f.context.location.hash = url; } };
  f.listeners = {};
  f.context.addEventListener = (n, fn) => { (f.listeners[n] ||= []).push(fn); };
  f.main = f.add('main');
  f.main.innerHTML = '<div class="kaart ds-kaart"><h2>Alfa</h2><input id="concept"></div>' +
    '<div class="kaart ds-kaart"><h2>Bravo</h2><p>twee</p><p id="privaat" hidden>geen toegang</p></div>' +
    '<div class="kaart ds-kaart"><h2>Charlie</h2><p>drie</p></div>';
  vm.runInContext(bundel('shared/deelmenu.js'), f.context);
  return f;
}
test('DS deelmenu uses the existing tab component and no legacy style; all section identities remain', () => {
  const f = opstelling();
  assert.deepEqual(Array.from(f.context.RTGDeel.delen()), ['alfa', 'bravo', 'charlie']);
  const nav = f.node('.rtgdeel-balk');
  assert.ok(nav.classList.contains('ds-tabs')); assert.ok(nav.classList.contains('ds-deelmenu'));
  assert.equal(f.node('#rtgdeel-stijl'), null);
  assert.deepEqual(nav.children.map(n => n.getAttribute('data-rtg-adaptive-source')), ['deel-alfa','deel-bravo','deel-charlie']);
  assert.ok(nav.children.every(n => n.classList.contains('ds-tab') && n.classList.contains('ds-deelmenu-knop')));
  assert.equal(nav.children[0].getAttribute('aria-current'), 'true');
});
test('section changes and rescan preserve draft identity, domain hidden and one hash owner', () => {
  const f = opstelling(true, '#deel-bravo'), draft = f.node('#concept'), privateNode = f.node('#privaat');
  draft.value = 'Mijn concept';
  assert.equal(f.node('.rtgdeel-balk').children[1].getAttribute('aria-current'), 'true');
  assert.equal(privateNode.hidden, true);
  f.node('.rtgdeel-balk').children[2].click();
  assert.equal(f.context.location.hash, '#deel-charlie');
  assert.equal(f.storage.get('rtg_deel:/apps/foundation/studie.html'), 'charlie');
  assert.equal(f.main.querySelectorAll('.ds-deelmenu-weg').length, 2);
  f.context.RTGDeel.herscan();
  assert.equal(f.node('#concept'), draft); assert.equal(draft.value, 'Mijn concept');
  assert.equal(privateNode.hidden, true); assert.equal(f.main.querySelectorAll('.rtgdeel-balk').length, 1);
  assert.equal(f.listeners.hashchange.length, 1);
  f.context.location.hash = '#deel-alfa'; f.listeners.hashchange[0]();
  assert.equal(f.node('.rtgdeel-balk').children[0].getAttribute('aria-current'), 'true');
  assert.equal(draft.parentNode.classList.contains('ds-deelmenu-weg'), false);
  f.main.querySelectorAll('.kaart')[2].remove();
  assert.equal(f.context.RTGDeel.herscan(), false);
  assert.equal(f.context.RTGDeel.open('alfa'), null);
  assert.equal(f.main.querySelectorAll('.ds-deelmenu-weg,.rtgdeel-weg').length, 0);
  assert.equal(privateNode.hidden, true, 'menu cleanup never grants domain access');
});
test('legacy host uses the same DS component and keeps the same section behavior', () => {
  const f = opstelling(false), nav = f.node('.rtgdeel-balk');
  assert.ok(nav.classList.contains('ds-tabs')); assert.ok(nav.classList.contains('ds-deelmenu'));
  assert.ok(nav.children.every(n => n.classList.contains('ds-tab') && n.classList.contains('ds-deelmenu-knop')));
  const stijl = f.node('#rtgDsRuntimeCss');
  assert.equal(stijl.tagName, 'LINK'); assert.equal(stijl.rel, 'stylesheet');
  assert.equal(stijl.href, '/ds/rtg-ds.css');
  nav.children[1].click();
  assert.equal(f.main.querySelectorAll('.rtgdeel-weg').length, 2);
  assert.equal(f.main.querySelectorAll('.ds-deelmenu-weg').length, 2);
});
test('canonical presentation uses existing tokens and does not redefine domain hidden', () => {
  const css = fs.readFileSync('public/ds/componenten/deelmenu.css', 'utf8');
  const tokens = fs.readFileSync('public/ds/tokens.css', 'utf8');
  for (const [, name] of css.matchAll(/var\((--ds-[\w-]+)/g)) assert.ok(tokens.includes(name + ':'), name);
  assert.doesNotMatch(css, /!important|\[hidden\]/);
  assert.match(css, /@layer rtg\.scherm\s*\{[\s\S]*\.ds-scherm \.ds-deelmenu-weg \{ display: none; \}/);
  assert.doesNotMatch(css, /html \.ds-deelmenu-weg/);
});
