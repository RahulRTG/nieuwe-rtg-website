'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const vm = require('node:vm');
// Lees de canonieke delen: een achtergebleven uitvoerbundel mag een verdwenen
// bronreparatie niet groen houden. De centrale bundelaar schrijft later uitvoer.
const bron = require('../scripts/bundel').bundel('shared/randen.js').toString('utf8');
function omgeving(ds, embed = false, vertraag = false) {
  const loaded = [], kinderen = [], events = {}, timers = [];
  let geopend = 0;
  function node(tag) {
    const attrs = {}, handlers = {}, klassen = new Set();
    return { tag, handlers, style: {}, classList: { add: k => klassen.add(k), remove: k => klassen.delete(k),
      toggle(k, aan) { if (aan) klassen.add(k); else klassen.delete(k); } },
      addEventListener: (k, f) => { handlers[k] = f; }, setAttribute: (k, v) => { attrs[k] = v; },
      getAttribute: k => attrs[k] || null, click() { handlers.click(); } };
  }
  const d = { readyState: 'complete', title: 'PDA', documentElement: { hasAttribute: k => ds && k === 'data-ds' },
    body: { dataset: { rtgWorld: 'work' }, classList: { add() {} }, appendChild: n => kinderen.push(n) },
    head: { appendChild: n => loaded.push(n) }, createElement: node, querySelectorAll: () => [],
    getElementById: id => loaded.find(n => n.id === id),
    addEventListener: (k, f) => { (events[k] ||= []).push(f); },
    removeEventListener: (k, f) => { events[k] = (events[k] || []).filter(x => x !== f); } };
  const w = { location: { pathname: '/apps/studio-pda.html', href: 'http://rtg.test/apps/studio-pda.html', search: '' },
    RTGBediening: { aanwezig: true, open() { geopend++; } } };
  w.self = w; w.top = embed ? {} : w;
  vm.runInNewContext(bron, { window: w, document: d, URL, URLSearchParams, setTimeout: f => timers.push(f) });
  if (!vertraag) timers.shift()?.();
  return { w, d, loaded, kinderen, zetDs(v) { ds = v; }, start() { timers.shift()?.(); }, geopend: () => geopend,
    event(k, extra = {}) { for (const f of [...events[k] || []]) f({ clientY: 0, target: {}, pointerType: 'touch', ...extra }); } };
}
test('DS randen behoudt instellingengebaar en toetsenbordingang zonder tweede Edge of injectie', () => {
  const o = omgeving(true);
  assert.equal(o.loaded.length, 0);
  assert.ok(o.kinderen.some(n => n.className === 'rnd-hint boven ds-randen-hint'));
  const knop = o.kinderen.find(n => n.className === 'rnd-toets ds-randen-toets');
  assert.ok(knop);
  assert.equal(knop.tag, 'rtg-randen-toets');
  assert.equal(knop.getAttribute('role'), 'button');
  assert.equal(knop.getAttribute('tabindex'), '0');
  let toetsenbordTegenhouden = 0;
  knop.handlers.keydown({ key: 'Enter', preventDefault() { toetsenbordTegenhouden++; } });
  assert.equal(o.geopend(), 1); assert.equal(toetsenbordTegenhouden, 1);
  knop.handlers.keydown({ key: 'Escape', preventDefault() { toetsenbordTegenhouden++; } });
  assert.equal(o.geopend(), 1); assert.equal(toetsenbordTegenhouden, 1);
  knop.click(); assert.equal(o.geopend(), 2);
  o.event('pointerdown', { clientY: 10 });
  o.event('pointermove', { clientY: 35 }); assert.equal(o.geopend(), 2);
  o.event('pointermove', { clientY: 55 }); assert.equal(o.geopend(), 3);
  o.event('pointermove', { clientY: 80 }); assert.equal(o.geopend(), 3, 'één haal opent één keer');
  let tegengehouden = 0;
  o.event('click', { preventDefault() { tegengehouden++; }, stopPropagation() {} });
  assert.equal(tegengehouden, 1, 'de geslaagde haal activeert niet de onderliggende knop');
  o.w.RTGRanden.boven(); assert.equal(o.geopend(), 4);
});
test('legacy behoudt bestaande Edge-laders en randpresentatie', () => {
  const o = omgeving(false);
  assert.ok(o.loaded.some(n => n.href === '/shared/rtg-edge-system.css'));
  assert.ok(o.loaded.some(n => n.href === '/ds/componenten/randen.css'));
  assert.ok(o.loaded.some(n => n.src === '/shared/rtg-edge-worlds.js'));
  assert.equal(o.loaded.some(n => n.tag === 'style'), false, 'ook legacy gebruikt de centrale randencomponent');
  assert.ok(o.kinderen.some(n => n.className === 'rnd-toets ds-randen-toets'));
  assert.equal(o.w.RTGRanden.boven(), true);
});
test('DS in een paneel maakt geen extra globale rand of Edge', () => {
  const o = omgeving(true, true);
  assert.equal(o.loaded.length, 0);
  assert.equal(o.kinderen.length, 0);
  assert.equal(o.w.RTGRanden, undefined);
  o.event('pointerdown', { clientY: 0 }); o.event('pointermove', { clientY: 90 });
  assert.equal(o.geopend(), 0);
});

test('late legacy afhankelijkheden laden na DS-activatie geen Edge meer', () => {
  const o = omgeving(false, false, true);
  const eerder = o.loaded.slice();
  o.zetDs(true);
  o.w.RTGEdgeWorlds = {}; o.w.RTGEdgeIcons = {}; o.w.RTGEdgeLibrary = {};
  for (const n of eerder) n.handlers.load();
  assert.equal(o.loaded.some(n => n.src === '/shared/rtg-edge-system.js'), false);
  o.start();
  assert.equal(o.loaded.some(n => n.tag === 'style'), false, 'late stijl injecteert geen tweede presentatie');
  assert.ok(o.kinderen.some(n => n.className === 'rnd-hint boven ds-randen-hint'), 'late hint gebruikt dezelfde actuele DS-presentatie');
  const knop = o.kinderen.find(n => n.className === 'rnd-toets ds-randen-toets');
  assert.ok(knop, 'late toetsenbordingang heeft centrale DS-CSS');
  knop.click(); assert.equal(o.geopend(), 1);
  assert.equal(o.w.RTGRanden.boven(), true, 'bestaande bediening blijft bereikbaar');
});
test('legacy afhankelijkheden voltooien normaal zonder DS-overgang', () => {
  const o = omgeving(false);
  o.w.RTGEdgeWorlds = {}; o.w.RTGEdgeIcons = {}; o.w.RTGEdgeLibrary = {};
  for (const n of o.loaded.slice().filter(n => n.handlers.load)) n.handlers.load();
  assert.ok(o.loaded.some(n => n.src === '/shared/rtg-edge-system.js'));
});
test('bestaande scanner bewijst lokale DS-grenzen zonder uitzondering', () => {
  const a = require('../scripts/ontwerpsysteem').scriptLaadAnalyse(bron, { ds: true });
  assert.deepEqual(a.onzeker, []); assert.equal(a.injecties + a.mogelijkeInjecties, 0);
  assert.deepEqual(a.verwijzingen, []);
});
