/* De oude Rahul-controller was door de constante eigenRahul=true onbereikbaar.
   Bewaak de actieve leveranciers-bootstrap en de publieke Samen-aansluiting. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { bundel } = require('../scripts/bundel');
const ontwerp = require('../scripts/ontwerpsysteem');
const root = path.join(__dirname, '..');
const bron = fs.readFileSync(path.join(root, 'public/shared/metgezel.js'), 'utf8');
function start(token, ds = true) {
  const geladen = [], events = [];
  const window = { addEventListener: type => events.push(type) };
  window.self = window; window.top = window;
  const document = {
    body: { dataset: {} }, documentElement: { hasAttribute: key => ds && key === 'data-ds', classList: { add() {} } }, head: { appendChild: el => geladen.push(el) },
    querySelector: () => null, getElementById: () => null,
    createElement: tag => ({ tag }), addEventListener: type => events.push(type)
  };
  const localStorage = { getItem: key => key === 'rtg_sup_token' ? token : null };
  vm.runInNewContext(bron, { window, document, localStorage });
  return { geladen, events, window };
}
test('metgezel: selectieve bundel is gelijk aan de bronparts en oude controller ontbreekt', () => {
  assert.equal(bron, bundel('shared/metgezel.js').toString());
  assert.doesNotMatch(bron, /eigenRahul|function zetMaat\(|function opengaan\(|rtg_rahul_gezien/);
  assert.doesNotMatch(bron, /fetch\(pad,/);
  assert.match(bron, /function laadScript\(path, klaar, uitgesteld\)/);
  assert.doesNotMatch(bron, /location\.href\s*=/);
  const analyse = ontwerp.scriptLaadAnalyse(bron, { ds: true });
  assert.deepEqual(analyse.onzeker, []);
  assert.deepEqual(analyse.verwijzingen.map(x => x.href),
    ['/shared/wauw.js', '/shared/stroom.js', '/shared/rahul-tab.js', '/shared/handenvrij.js']);
});
test('metgezel: leverancierssessie behoudt actieve Rahul-tab en handenvrij, zonder oude verzoeken', () => {
  const r = start('lokale-leverancierssessie');
  const scripts = r.geladen.filter(x => x.tag === 'script').map(x => x.src);
  assert.deepEqual(scripts, ['/shared/wauw.js', '/shared/rahul-tab.js?v=command7', '/shared/handenvrij.js']);
  assert.equal(r.window.__metgezel, true);
  assert.equal(r.window.RTGMetgezel, undefined, 'geen leden-Samen voor een leverancier zonder lidtoken');
});
test('metgezel: zonder sessie start geen Rahul of handenvrij', () => {
  assert.deepEqual(start(null).geladen.map(x => x.src), ['/shared/wauw.js']);
});
test('metgezel: actieve publieke Samen-hook en gedeelde stroom blijven aangesloten', () => {
  assert.match(bron, /window\.RTGMetgezel\.samen = toonSamen/);
  assert.match(bron, /function metStroom\(doe\)/);
  assert.match(bron, /if \(!memTok\) return/);
  assert.match(bron, /maakSleepbaar\(sSheet/);
  const tab = fs.readFileSync(path.join(root, 'public/shared/rahul-tab.js'), 'utf8');
  assert.match(tab, /window\.RTGMetgezel\.rahul=(?:async )?function/);
  assert.match(tab, /\/api\/supplier\/ai/);
  assert.match(tab, /beslissingen\(\)\.show/);
});

test('metgezel: exclusieve dode balk- en seintjesstijlen keren niet terug', () => {
  assert.doesNotMatch(bron, /\.mgz-(?:balk|orb|klein|meld|stip|seintje)|@keyframes mgzPuls/);
  for (const selector of ['.mgz-sheet', '.mgz-kop', '.mgz-x', '.mgz-uit', '.mgz-rij', '.mgz-go', '.mgz-stil', '.mgz-banner', '.mgz-code', '.mgz-chat']) {
    assert.ok(bron.includes(selector.slice(1)), 'actieve Samen-gedragshaak: ' + selector);
  }
});

 test('Samen: canonieke component geldt op iedere host en behoudt verborgen vensters', () => {
  const css = fs.readFileSync(path.join(root, 'public/ds/componenten/samen.css'), 'utf8');
  assert.match(css, /@layer rtg.component/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgba?\(|!important/i);
  assert.match(css, /\.ds-samen-venster\[hidden\] \{ display: none;/);
  assert.match(css, /var\(--ds-focus\)/);
  assert.match(bron, /metgezelDs \? ' ds-samen-venster'/);
  assert.match(bron, /metgezelDs \? ' ds-samen-banner'/);
  assert.equal(start('supplier', true).geladen.filter(x => x.tag === 'style').length, 0);
  assert.equal(start('supplier', false).geladen.filter(x => x.tag === 'style').length, 0);
  assert.doesNotMatch(bron, /createElement\(['"]style|var css\s*=/);
});

test('Fab: metgezel injecteert geen verbergstijl; alleen een bestaande Rahul-owner mag onderdrukken', () => {
  assert.doesNotMatch(bron, /mgzFabWeg/);
  assert.equal(start('supplier', true).geladen.filter(x => x.tag === 'style').length, 0);
  const loader = fs.readFileSync(path.join(root, 'public/shared/rahul-tab/style-base.js'), 'utf8');
  for (const owner of [false, true]) {
    const nodes = new Map(), klassen = new Set();
    const document = {
      body: { classList: { add: k => klassen.add(k) } },
      documentElement: { hasAttribute: key => key === 'data-ds' },
      getElementById: id => nodes.get(id),
      querySelector: selector => owner && selector === '.rtg-rahul-page' ? {} : null,
      createElement: tag => ({ tag }), head: { appendChild: node => nodes.set(node.id, node) }
    };
    const context = { document, window: {} };
    vm.runInNewContext(loader, context);
    assert.equal(klassen.has('ds-rahul-eigenaar'), owner, 'zonder vervangende owner blijft de bestaande ingang staan');
    vm.runInNewContext(loader, context);
    assert.equal(nodes.size, 0, 'DS gebruikt de canonieke eigenaarstaat, zonder injectie of legacy-loader');
  }
});
