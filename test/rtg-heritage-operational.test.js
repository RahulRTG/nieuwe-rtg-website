/* Operationele Heritage-borging: een laat stijlblad mag echte formulieren,
   tabellen, modalen en canvassen verfijnen, maar hun werking niet veranderen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const lees = (naam) => fs.readFileSync(path.join(ROOT, naam), 'utf8');
const ADAPTERS = lees('public/shared/rtg-heritage-adapters.css');
const COMPONENTEN = lees('public/shared/rtg-heritage-components.css');
const MATERIALEN = lees('public/shared/rtg-heritage-materials.css');
const IDENTITEIT = require('../public/shared/rtg-world-identity.js');

test('representatieve operationele schermen houden een vaste wereld en echte bediening', () => {
  const schermen = [
    ['/apps/agenda.html', 'living', ['<input', 'role="dialog"']],
    ['/apps/routedossier.html', 'travel', ['<main']],
    ['/apps/bestanden.html', 'work', ['<select', 'role="dialog"']],
    ['/apps/foundation/agenda.html', 'foundation', ['<input', 'role="dialog"']],
    ['/apps/mijn-gegevens.html', 'living', ['<main', "maak('article'"]]
  ];
  for (const [route, wereld, bewijs] of schermen) {
    assert.equal(IDENTITEIT.classify(route), wereld, route + ' heeft de verkeerde kamer');
    const html = lees('public' + route);
    for (const fragment of bewijs) assert.ok(html.includes(fragment), route + ' mist ' + fragment);
    assert.match(html, /\/shared\/basis\.js/, route + ' mist de gedeelde Heritage-ingang');
  }
});

test('een backdrop blijft schermvullend en alleen het dialoogvlak wordt afgerond', () => {
  assert.match(ADAPTERS,
    /:where\(\.scrim,\.backdrop,\[data-backdrop\]\)\{[^}]*border-radius:0[^}]*box-shadow:none/s);
  assert.match(ADAPTERS,
    /:where\(\.scrim,\.backdrop,\[data-backdrop\]\)>\.paneel\{[^}]*border-radius:var\(--rtg-radius-system\)[^}]*box-shadow:var\(--rtg-depth-system\)/s);
  assert.match(ADAPTERS, /safe-area-inset-top/);
  assert.match(ADAPTERS, /safe-area-inset-bottom/);
});

test('mobiele native bediening haalt 44px zonder desktoplijsten op te blazen', () => {
  assert.match(ADAPTERS, /@media\(max-width:700px\)[\s\S]*summary,a\.terug,\.terug\[href\][\s\S]*min-height:var\(--rtg-target\)/);
  assert.match(ADAPTERS, /@media\(pointer:coarse\)[\s\S]*label:has\(>input\[type="checkbox"\]\)/);
  const desktopDoel = /body\[data-rtg-skin="heritage"\] :where\(button,[^}]*\)\{min-height:36px\}/;
  assert.match(ADAPTERS, desktopDoel);
});

test('operationele tabellen blijven op mobiel binnen hun paneel', () => {
  assert.match(COMPONENTEN,
    /\.rtg-operational-panel\{[^}]*max-width:100%[^}]*overflow-x:auto[^}]*overscroll-behavior-inline:contain/s);
  assert.match(COMPONENTEN, /\.rtg-operational-panel table\{[^}]*width:100%/s);
});

test('kaart-, camera- en werkruimtecanvassen blijven expliciet uitgezonderd', () => {
  const canvassen = [
    ['public/apps/navigatie.html', 'travel-os-map'],
    ['public/apps/camera.html', '<canvas'],
    ['public/apps/werkruimte.html', 'rtg-edge-workspace']
  ];
  for (const [bestand, grens] of canvassen) assert.ok(lees(bestand).includes(grens), bestand + ' mist canvasgrens');
  for (const grens of ['data-rtg-projectie', 'travel-os-map', 'rtg-edge-workspace', 'rtg-edge-embed']) {
    assert.ok(MATERIALEN.includes(grens), grens + ' mist uit de gedeelde uitzondering');
  }
  assert.match(MATERIALEN, /video,canvas,#beeld,.zoeker,.speler,.media-studio[^}]*border-radius:0/);
});

test('adapters wijzigen geen zichtbaarheid, documentstructuur of interactie', () => {
  assert.doesNotMatch(ADAPTERS, /display\s*:\s*none|visibility\s*:\s*hidden/);
  assert.doesNotMatch(ADAPTERS, /position\s*:\s*fixed/);
  const geblokkeerd = [...ADAPTERS.matchAll(/([^{}]+)\{([^{}]+)\}/g)]
    .filter(([, selector, regels]) => /pointer-events\s*:\s*none/.test(regels) && !selector.includes('::after'));
  assert.deepEqual(geblokkeerd, [], 'alleen een decoratieve pseudolaag mag pointer-events uitzetten');
});
