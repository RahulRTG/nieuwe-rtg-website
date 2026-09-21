/* DE WEBSITE VERTELT DE APPWAARHEID. Deze toets bewaakt de hele verbinding:
   de gegenereerde momentopname moet exact uit de wereld- en pasbronnen komen,
   iedere openbare pagina moet haar laden en alle pagina's moeten dezelfde
   Heritage-wereldstijl gebruiken. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const waarheid = require('../scripts/websitewaarheid');

const ROOT = path.join(__dirname, '..');
const lees = (bestand) => fs.readFileSync(path.join(ROOT, bestand), 'utf8');
const WERELDEN = ['living', 'travel', 'work', 'foundation'];
const PAGINAS = [
  ...fs.readdirSync(path.join(ROOT, 'public/site/werelden')).filter((naam) => naam.endsWith('.html')).map((naam) => 'public/site/werelden/' + naam),
  ...fs.readdirSync(path.join(ROOT, 'public/site/passen')).filter((naam) => naam.endsWith('.html')).map((naam) => 'public/site/passen/' + naam)
];

test('de openbare momentopname is exact uit de huidige appbronnen opgebouwd', () => {
  assert.deepEqual(JSON.parse(lees('public/site/website-truth.json')), waarheid.maak());
  assert.doesNotThrow(() => waarheid.controle());
});

test('alle vier wereldkaarten krijgen actuele namen, onderdelen en app-routes', () => {
  const html = lees('index.html');
  const runtime = lees('public/site/website-truth.js');
  assert.match(html, /public\/site\/website-truth\.js/);
  for (const wereld of WERELDEN) {
    assert.match(html, new RegExp('data-app-truth-world="' + wereld + '"'));
  }
  assert.match(runtime, /website-truth\.json/);
  assert.match(runtime, /featureCount/);
  assert.match(runtime, /publicRoute/);
  assert.match(runtime, /textContent/);
  assert.doesNotMatch(runtime, /innerHTML/);
});

test('de B2B2C-schermen komen uit bestaande app-routes en een gecontroleerd echt beeld', () => {
  const data = waarheid.maak();
  const html = lees('index.html');
  assert.deepEqual(data.platform.map((scherm) => scherm.id), ['organisatie', 'partner', 'gebruiker']);
  assert.deepEqual(data.platform.map((scherm) => scherm.route),
    ['/apps/werk.html', '/apps/leverancier.html', '/apps/app.html']);
  assert.doesNotMatch(JSON.stringify(data.platform), /\bAI\b/i,
    'de openbare productuitleg gebruikt geen AI-labels');
  for (const scherm of data.platform) {
    assert.match(html, new RegExp('data-app-truth-screen="' + scherm.id + '"'));
    assert.ok(fs.existsSync(path.join(ROOT, 'public', scherm.image)), scherm.image + ' bestaat');
    assert.equal(scherm.sourceHash, waarheid.schermBronHash(scherm.route));
    assert.ok(scherm.summary && scherm.actions.length && scherm.note,
      scherm.id + ' neemt zijn uitleg uit de app-gids over');
  }
  assert.match(lees('public/site/website-truth.js'), /bindPlatformScreen/);
});

test('alle openbare verhaalpagina’s gebruiken dezelfde wereldstijl', () => {
  for (const bestand of PAGINAS) {
    const html = lees(bestand);
    assert.match(html, /rtg-heritage\.css/, bestand + ' mist de vaste Heritage-stijl');
    assert.match(html, /rtg-world-home\.css/, bestand + ' mist de gedeelde wereldstijl');
    assert.match(html, /website-truth\.css/, bestand + ' mist de websitewaarheid-stijl');
    assert.match(html, /data-rtg-skin="heritage"/, bestand + ' activeert de vaste stijl niet');
  }
});

test('wereld- en paspagina’s lezen de actuele appwaarheid bij het openen', () => {
  for (const bestand of PAGINAS) {
    assert.match(lees(bestand), /src="\.\.\/website-truth\.js"/, bestand + ' mist de actuele appbron');
  }
  for (const wereld of WERELDEN) {
    const bestand = 'public/site/werelden/' + (wereld === 'foundation' ? 'foundationos' : wereld + 'os') + '.html';
    const html = lees(bestand);
    assert.match(html, new RegExp('data-world="' + wereld + '"'));
    assert.match(html, new RegExp('data-rtg-world="' + wereld + '"'));
  }
});

test('de prijstabel is gebonden aan de centrale pasladder', () => {
  const html = lees('index.html');
  for (const pas of ['community', 'rtg', 'business-lite', 'business', 'lifestyle']) {
    assert.match(html, new RegExp('data-app-truth-pass="' + pas + '"'));
  }
  for (const bestand of PAGINAS.filter((naam) => naam.includes('/passen/'))) {
    assert.match(lees(bestand), /data-app-truth-price/, bestand + ' mist de prijsbinding');
  }
});
