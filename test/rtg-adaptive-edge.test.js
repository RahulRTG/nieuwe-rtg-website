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
});

/* HET TWEEDE REGISTER KENT ALLEEN LICHT (EDGE.md par. 10, ronde 1). Het had een
   eigen uitvoerweg: een eigen `confirm` via window.confirm, langs de
   gewichtsgrammatica heen. Wat een bevestiging vraagt, hoort in RTGAdaptief.
   DE MUTATIES, elk nagetrokken: haal de weigering uit register() (de eerste twee
   toetsen zakken), versmal hem tot `item.gewicht === 'zwaar'` (alleen de tweede
   zakt), laat voer() bij een gewichtlaag zelf run() aanroepen (de derde zakt), en
   zet de oude execute met window.confirm terug (de vierde zakt). */
test('het tweede register weigert een eigen bevestiging, en laat niets achter', () => {
  const model = kern.model();
  assert.equal(kern.register(model, { id: 'boeken', label: 'Boeken', confirm: 'Boeking bevestigen?', allowed: true, run() {} }), false);
  assert.equal(model.registry.boeken, undefined, 'een geweigerde handeling hoort niet in het register te staan');
});

test('het tweede register kent alleen licht: elk ander gewicht wordt geweigerd', () => {
  const model = kern.model();
  for (const gewicht of ['terug', 'bewust', 'zwaar', 'plechtig', 'onbekend']) {
    assert.equal(kern.register(model, { id: 'h-' + gewicht, label: gewicht, gewicht, run() {} }), false, gewicht);
    assert.equal(model.registry['h-' + gewicht], undefined, gewicht + ' liet een regel achter');
  }
  assert.equal(kern.register(model, { id: 'h-licht', label: 'licht', gewicht: 'licht', run() {} }), true);
  assert.equal(kern.register(model, { id: 'h-zonder', label: 'zonder gewicht', run() {} }), true);
});

test('een tik gaat langs de gewichtlaag, als licht; zonder laag draait alleen wat mag', () => {
  let gedraaid = 0;
  const run = () => { gedraaid++; };
  const aanroepen = [];
  const w = { RTGGewicht: { voer(it) { aanroepen.push(it); return it.doe() !== false; } } };
  assert.equal(kern.voer({ id: 'proef', label: 'Proef', allowed: true, run }, w), true);
  assert.equal(aanroepen.length, 1, 'de gewichtlaag hoort precies een keer te worden aangeroepen');
  assert.equal(aanroepen[0].gewicht, 'licht');
  assert.equal(aanroepen[0].id, 'proef');
  assert.equal(gedraaid, 1, 'de handeling draait via de gewichtlaag, en maar een keer');
  assert.equal(kern.voer({ id: 'proef', label: 'Proef', allowed: false, run }, w), false);
  assert.equal(aanroepen.length, 1, 'een handeling die niet mag, bereikt de gewichtlaag niet');
  assert.equal(kern.voer({ id: 'proef', label: 'Proef', allowed: true, run }, {}), true);
  assert.equal(gedraaid, 2, 'zonder gewichtlaag draait licht direct');
  assert.equal(kern.voer({ id: 'proef', label: 'Proef', allowed: () => false, run }, {}), false);
  assert.equal(gedraaid, 2);
  assert.equal(kern.voer({ id: 'zonder', label: 'Zonder run' }, w), false);
});

test('de uitvoerder van de Edge kent geen window.confirm meer (vorm; het gedrag bewijst edgeblikveld.e2e.js)', () => {
  assert.doesNotMatch(VIEW, /confirm\(/);
  assert.match(VIEW, /if \(custom && custom\.run\) return K\.voer\(custom, w\);/);
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
  assert.match(CSS, /width:min\(720px,calc\(100% - var\(--edge-side\) - var\(--rtg-safe-left\) - var\(--rtg-safe-right\) - 28px\)\)/);
  assert.match(CSS, /max-height:min\(620px,calc\(100dvh - var\(--rtg-adaptive-inset\) - var\(--rtg-safe-top\) - 16px\)\)/);
  assert.match(CSS, /grid-template-columns:repeat\(5,minmax\(44px,1fr\)\)/);
  assert.match(CSS, /\.rtg-adaptive-item\{[^}]*min-width:44px;min-height:54px/);
  assert.match(CSS, /backdrop-filter:blur\(24px\) saturate\(1\.3\)/);
  assert.match(CSS, /linear-gradient\(135deg,rgba\(255,255,255,\.09\),transparent 31%\),rgba\(10,8,5,\.86\)/);
  assert.match(CSS, /--edge-bar-accent:#ebcc94/);
  assert.match(VIEW, /class="rtg-adaptive-lips"/);
  assert.doesNotMatch(VIEW, /rtg-adaptive-lips[^\n]+(?:circle|ellipse)/);
  assert.doesNotMatch(VIEW, /rtg-adaptive-caption/);
  assert.match(CSS, /data-rtg-adaptive-state="peek"[^}]*width:136px;height:50px/);
  assert.doesNotMatch(VIEW, /Mandaat gecontroleerd/);
  assert.match(VIEW, /Controle bij uitvoering/);
  assert.match(CSS, /\.rtg-adaptive-sheet \.rtg-edge-2-context-slot :is\([^}]+grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
  assert.match(CSS, /\.scrim\.open\[role="dialog"\]/);
  assert.match(CSS, /\.hv-balk:not\(\.hv-weg\)/);
  assert.doesNotMatch(CSS, /grid-template-columns:minmax\(108px,1fr\)/,
    'desktop krijgt geen tweede Edge-geometrie');
  assert.match(VIEW, /rtg-adaptive-item-copy/);
  assert.match(VIEW, /Vraag of regel iets/);
});

test('swipe, hold, toetsenbord en haptiek delen dezelfde invoerlaag', () => {
  assert.match(INPUT, /pointerdown/);
  assert.match(INPUT, /pointermove/);
  assert.match(INPUT, /pointerup/);
  assert.match(INPUT, /lastX = event\.clientX; lastY = event\.clientY/);
  assert.match(INPUT, /event \? event\.clientY : lastY/);
  /* De drempels zelf staan in de grammatica (test/drempels.test.js); hier alleen
     dat de invoerlaag ze leest en geen eigen getal draagt. */
  assert.match(INPUT, /-dy >= D\.omhoog/);
  assert.match(INPUT, /dy > D\.veeg/);
  assert.match(INPUT, /\}, D\.lang\);/);
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
    '/shared/rtg-adaptive-edge-controls.js', '/shared/rtg-adaptive-edge-input.js', '/shared/rtg-adaptive-edge.js', '/shared/rtg-adaptive-edge-signals.js',
    '/shared/adaptief/grammatica.js'];
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
  /* De signaallaag luistert naar niets: vijf luisteraars zonder zender zijn in
     ronde 1 weggehaald (EDGE.md par. 10). Wie een scherm iets laat melden,
     gebruikt de directe API (setIdentity, setPresence, continueWith). */
  assert.doesNotMatch(SIGNALS, /addEventListener\(/);
});

test('alle Adaptive Edge-browsermodules blijven onder de productlimiet', () => {
  for (const naam of ['rtg-adaptive-edge-loader.js', 'rtg-adaptive-edge-core.js', 'rtg-adaptive-edge-controls.js', 'rtg-adaptive-edge-input.js', 'rtg-adaptive-edge.js', 'rtg-adaptive-edge-signals.js']) {
    assert.ok(fs.statSync(path.join(ROOT, 'public/shared', naam)).size < 10 * 1024, naam + ' is te groot');
  }
});
