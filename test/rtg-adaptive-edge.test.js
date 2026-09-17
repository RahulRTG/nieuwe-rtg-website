'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const lees = naam => fs.readFileSync(path.join(ROOT, naam), 'utf8');
const kern = require('../public/shared/rtg-adaptive-edge-core.js');
const VIEW = lees('public/shared/rtg-adaptive-edge.js');
const INPUT = lees('public/shared/rtg-adaptive-edge-input.js');
const CSS = lees('public/shared/rtg-adaptive-edge.css');
const LOADER = lees('public/shared/rtg-edge-2-loader.js');
const ADAPTIVE_LOADER = lees('public/shared/rtg-adaptive-edge-loader.js');
const SIGNALS = lees('public/shared/rtg-adaptive-edge-signals.js');
const SW = lees('public/sw.js');

test('Adaptive Edge heeft vier toestanden en vijf vaste decks', () => {
  assert.deepEqual(kern.STATES, ['peek', 'dock', 'deck', 'expanded']);
  assert.deepEqual(kern.DECKS, ['home', 'context', 'actions', 'connect', 'rahul']);
  assert.equal(kern.nextDeck('home', 1), 'context');
  assert.equal(kern.nextDeck('home', -1), 'rahul');
  assert.equal(kern.nextDeck('rahul', 1), 'home');
  assert.equal(kern.normState('onbekend'), 'dock');
});

test('intentprojectie toont uitsluitend geregistreerde en toegestane acties', () => {
  const model = kern.model();
  let toegestaan = true;
  kern.register(model, { id: 'reis', label: 'Reis', allowed: () => toegestaan, run() {} });
  kern.register(model, { id: 'verboden', label: 'Verboden', allowed: false, run() {} });
  kern.register(model, { id: 'hotel', label: 'Hotel', allowed: true, run() {} });
  assert.deepEqual(kern.project(['reis', 'verboden', 'onbekend', 'reis', 'hotel'], model.registry, 4)
    .map(x => x.id), ['reis', 'hotel']);
  toegestaan = false;
  assert.deepEqual(kern.project(['reis'], model.registry, 4), []);
  kern.register(model, { id: 'boeken', label: 'Boeken', confirm: 'Boeking bevestigen?', allowed: true });
  assert.equal(model.registry.boeken.confirm, 'Boeking bevestigen?');
});

test('voorspelde acties verdringen geen veilige terugval en blijven begrensd', () => {
  const model = kern.model();
  ['primary', 'worlds', 'presence', 'boarding', 'hotel'].forEach(id => {
    kern.register(model, { id, label: id, allowed: true });
  });
  kern.setProjection(model, { deck: 'home', actions: ['boarding', 'hotel', 'boarding'] });
  assert.deepEqual(kern.actions(model).map(x => x.id), ['boarding', 'hotel', 'primary', 'worlds']);
  assert.equal(kern.actions(model).length, 4);
});

test('één zwevend oppervlak vervangt de oude zichtbare onderrand', () => {
  assert.match(CSS, /data-rtg-adaptive-ready="true"\] \.rtg-edge-bottom\{display:none!important\}/);
  assert.match(CSS, /grid-template-columns:repeat\(5,minmax\(48px,1fr\)\)/);
  assert.match(CSS, /\.rtg-adaptive-item\{[^}]*min-width:48px;min-height:64px/);
  assert.match(CSS, /backdrop-filter:blur\(28px\) saturate\(1\.32\)/);
  assert.match(VIEW, /class="rtg-adaptive-lips"/);
  assert.doesNotMatch(VIEW, /rtg-adaptive-lips[^\n]+(?:circle|ellipse)/);
  assert.doesNotMatch(VIEW, /rtg-adaptive-caption/);
  assert.match(CSS, /data-rtg-adaptive-state="peek"[^}]*width:136px;height:50px/);
  assert.match(VIEW, /Mandaat gecontroleerd/);
  assert.match(CSS, /\.rtg-adaptive-sheet \.rtg-edge-2-context-slot :is\([^}]+grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(CSS, /\.scrim\.open\[role="dialog"\]/);
  assert.match(CSS, /\.hv-balk:not\(\.hv-weg\)/);
  assert.match(CSS, /@media\(min-width:900px\)/);
  assert.match(CSS, /left:calc\(var\(--edge-side\) \+ 24px\);right:24px;width:auto;max-width:none/);
  assert.match(CSS, /grid-template-columns:minmax\(108px,1fr\) minmax\(128px,1\.1fr\) minmax\(300px,2\.25fr\)/);
  assert.match(VIEW, /rtg-adaptive-item-copy/);
  assert.match(VIEW, /Vraag of regel iets/);
});

test('swipe, hold, toetsenbord en haptiek delen dezelfde invoerlaag', () => {
  assert.match(INPUT, /pointerdown/);
  assert.match(INPUT, /pointermove/);
  assert.match(INPUT, /pointerup/);
  assert.match(INPUT, /dy < -36/);
  assert.match(INPUT, /dy > 36/);
  assert.match(INPUT, /620/);
  assert.match(INPUT, /handlers\.rahul\(\)/);
  assert.match(INPUT, /Alt|altKey/);
  assert.match(INPUT, /metaKey \|\| event\.ctrlKey/);
  assert.match(INPUT, /toLowerCase\(\) === 'k'/);
  assert.match(INPUT, /navigator\.vibrate\(8\)/);
  assert.match(INPUT, /addEventListener\('scroll'/);
  assert.match(INPUT, /handlers\.state\('peek', 'auto'\)/);
});

test('Adaptive Edge laadt fail-closed na de bestaande Edge en is offline aanwezig', () => {
  const bronnen = ['/shared/rtg-adaptive-edge-loader.js'];
  const adaptieveBronnen = ['/shared/rtg-adaptive-edge.css', '/shared/rtg-adaptive-edge-core.js',
    '/shared/rtg-adaptive-edge-controls.js', '/shared/rtg-adaptive-edge-input.js', '/shared/rtg-adaptive-edge.js', '/shared/rtg-adaptive-edge-signals.js'];
  for (const bron of bronnen) {
    assert.ok(LOADER.includes(bron), bron + ' ontbreekt in de loader');
    assert.ok(SW.includes(bron), bron + ' ontbreekt in de offline schil');
  }
  for (const bron of adaptieveBronnen) {
    assert.ok(ADAPTIVE_LOADER.includes(bron), bron + ' ontbreekt in de adaptieve loader');
    assert.ok(SW.includes(bron), bron + ' ontbreekt in de offline schil');
  }
  const edgeStart = LOADER.indexOf('w.RTGEdge2.start(d, w)');
  const adaptiveStart = LOADER.indexOf('RTGAdaptiveEdgeLoader.start(d, w)', edgeStart);
  assert.ok(edgeStart >= 0 && adaptiveStart > edgeStart);
  assert.match(ADAPTIVE_LOADER, /if \(!vorm\) return/);
  assert.match(ADAPTIVE_LOADER, /if \(!kern\) return/);
  assert.match(ADAPTIVE_LOADER, /if \(!invoer\) return/);
  assert.match(SIGNALS, /rtg-adaptive-project/);
  assert.match(SIGNALS, /rtg-adaptive-presence/);
  assert.match(SIGNALS, /rtg-adaptive-identity/);
  assert.match(SIGNALS, /rtg-adaptive-continuation/);
});

test('alle Adaptive Edge-browsermodules blijven onder de productlimiet', () => {
  for (const naam of ['rtg-adaptive-edge-loader.js', 'rtg-adaptive-edge-core.js', 'rtg-adaptive-edge-controls.js', 'rtg-adaptive-edge-input.js', 'rtg-adaptive-edge.js', 'rtg-adaptive-edge-signals.js']) {
    assert.ok(fs.statSync(path.join(ROOT, 'public/shared', naam)).size < 10 * 1024, naam + ' is te groot');
  }
});
