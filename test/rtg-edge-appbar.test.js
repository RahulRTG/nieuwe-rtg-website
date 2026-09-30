'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(ROOT, bestand), 'utf8');
const LIBRARY = lees('public/shared/rtg-edge-library.js');
const LOADER = lees('public/shared/rtg-edge-2-loader.js');
const APPBAR = lees('public/shared/rtg-edge-appbar.js');
const SMART = lees('public/shared/rtg-edge-smart-menu.js');
const COMMAND = lees('public/shared/rtg-edge-command.js');
const CSS = lees('public/shared/rtg-edge-2.css');
const SIMPLE = lees('public/shared/rtg-simple.css');

test('Edge heeft één centraal slot voor functies van het huidige scherm', () => {
  assert.equal((LIBRARY.match(/class="rtg-edge-appslot"/g) || []).length, 1);
  assert.match(LIBRARY, /aria-label="Functies van dit scherm"/);
  assert.equal((LOADER.match(/\/shared\/rtg-edge-appbar\.js/g) || []).length, 1);
  assert.equal((LOADER.match(/\/shared\/rtg-edge-2-reveal\.js/g) || []).length, 1);
  assert.match(LOADER, /RTGEdge2Reveal\.start\(d, w\)/);
  assert.match(LOADER, /RTGEdgeAppBar\.start\(d\)/);
  assert.equal((LOADER.match(/\/shared\/rtg-edge-smart-menu\.js/g) || []).length, 1);
  assert.match(LOADER, /RTGEdgeSmartMenu\.start\(d\)/);
});

test('de hamburger heeft de twee toegankelijke gezichten Hier en Heel RTG', () => {
  assert.match(SMART, /role="tablist" aria-label="Menuweergave"/);
  assert.match(SMART, /data-edge-face="here">Hier</);
  assert.match(SMART, /data-edge-face="all">Heel RTG</);
  assert.match(SMART, /<h2>Dit scherm<\/h2>/);
  assert.match(SMART, /<h2>Uw vier werelden<\/h2>/);
  assert.match(SMART, /ArrowLeft/);
  assert.match(SMART, /ArrowRight/);
  assert.match(SMART, /wereldHome\(\) \? 'all' : 'here'/,
    'een wereldhome opent breed en een dieper scherm lokaal');
});

test('Heel RTG heeft echte deuren en Hier bedient de echte bronknoppen', () => {
  for (const tekst of ['Alle apps', 'Zoeken', 'Profiel &amp; veiligheid']) assert.ok(SMART.includes(tekst), tekst);
  for (const route of ['/apps/app.html', '/apps/mijn-gegevens.html']) assert.ok(SMART.includes(route), route);
  assert.match(SMART, /bron\.click\(\)/);
  assert.doesNotMatch(SMART, /cloneNode/);
  assert.match(SMART, /setAttention/);
  assert.match(CSS, /\.rtg-edge-index:has\(\.rtg-edge-faces\)\[aria-hidden="false"\]/);
  assert.match(CSS, /\.rtg-edge-menu\[aria-expanded="true"\]::before/);
  assert.match(COMMAND, /function slimMenu\(\)/,
    'de Command-brug herkent het slimme menu');
  assert.match(COMMAND, /slimMenu\(\) \|\| !media\.matches/,
    'ook op mobiel blijft de ene hamburger eigenaar van het slimme menu');
});

test('vaste appbediening verhuist intact en wordt niet gekloond', () => {
  assert.match(APPBAR, /rt\.slot\.appendChild\(el\)/);
  assert.doesNotMatch(APPBAR, /cloneNode|outerHTML|innerHTML/);
  assert.match(APPBAR, /querySelectorAll\('\[data-rtg-edge-bar\],nav,footer'\)/);
  assert.match(APPBAR, /stijl\.position === 'fixed'/);
  assert.match(APPBAR, /\.wos-dock,\.cmd-balk,nav\.balk/,
    'bestaande gespecialiseerde Edge-bruggen blijven één eigenaar houden');
});

test('zelfstandige apps houden de normale vijf Edge-ankers', () => {
  assert.match(APPBAR, /setAttribute\('data-rtg-edge-appbar', 'actions'\)/);
  assert.doesNotMatch(APPBAR, /setAttribute\('data-rtg-edge-appbar', 'true'\)/);
  assert.match(CSS, /\.rtg-edge-appslot\{display:none/,
    'de oorspronkelijke appbalk blijft alleen als verborgen handelingsbron bestaan');
  assert.match(SIMPLE, /grid-template-columns:minmax\(44px,.85fr\) minmax\(44px,.85fr\) 64px minmax\(72px,1.4fr\) minmax\(44px,.85fr\)/);
  assert.match(SIMPLE, /not\(\[data-rtg-edge-appbar="true"\]\)/,
    'de nieuwe actions-stand valt onder de normale Edge en niet onder de oude vervangingsstand');
});

test('ervaringsschermen openen weer met de herkenbare Edge', () => {
  for (const bestand of [
    'public/apps/muziek.html', 'public/apps/geld.html',
    'public/apps/magnaat.html', 'public/apps/foundation/school.html'
  ]) {
    const html = lees(bestand);
    assert.match(html, /data-rtg-edge-2-state="overview"/, bestand);
    assert.doesNotMatch(html, /data-rtg-edge-2-state="focus"/, bestand);
  }
});
