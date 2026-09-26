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
const WERELDSCHERMEN = lees('public/shared/rtg-world-screen.css');
const IDENTITEIT = require('../public/shared/rtg-world-identity.js');

function htmlBestanden(map, uit = []) {
  for (const naam of fs.readdirSync(map).sort()) {
    const volledig = path.join(map, naam);
    const stat = fs.statSync(volledig);
    if (stat.isDirectory()) htmlBestanden(volledig, uit);
    else if (naam.endsWith('.html')) uit.push(volledig);
  }
  return uit;
}

test('alle echte appschermen lopen door dezelfde gedeelde schermlaag', () => {
  let echt = 0;
  for (const bestand of htmlBestanden(path.join(ROOT, 'public', 'apps'))) {
    const route = '/' + path.relative(path.join(ROOT, 'public'), bestand).split(path.sep).join('/');
    if (IDENTITEIT.classify(route) === 'redirect') continue;
    echt += 1;
    const html = fs.readFileSync(bestand, 'utf8');
    assert.match(html, /<script\b[^>]*src=["'][^"']*\/shared\/basis\.js["'][^>]*>/i,
      route + ' mist de gedeelde schermruntime');
    assert.match(html, /<link\b[^>]*href=["']\/shared\/rtg-heritage\.css["'][^>]*>/i,
      route + ' mist de gedeelde schermstijl');
  }
  assert.equal(echt, 292);
});

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

test('ieder gemarkeerd wereldscherm krijgt dezelfde buitenmaat en veilige Edge-ruimte', () => {
  assert.match(WERELDSCHERMEN, /\[data-rtg-screen-root="content"\][^{]*\{[^}]*width:min\(100%,1440px\)!important/s);
  assert.match(WERELDSCHERMEN, /padding-top:max\([^}]*var\(--edge-top,44px\)/s);
  assert.match(WERELDSCHERMEN, /padding-bottom:calc\(var\(--edge-bottom,72px\)/);
  assert.match(WERELDSCHERMEN, /@media\(max-width:767px\)/);
  assert.doesNotMatch(WERELDSCHERMEN, /display\s*:\s*none|visibility\s*:\s*hidden/,
    'de gedeelde layout mag bestaande inhoud nooit verbergen');
});

test('de gedeelde schermlaag overschrijft geen lokaal bewezen achtergrondparen', () => {
  const hoofdregel = WERELDSCHERMEN.match(
    /body\[data-rtg-skin="heritage"\]\[data-rtg-world\]\[data-rtg-screen\]:not\(\[data-rtg-screen="world-home"\]\)\{([^}]*)\}/
  );
  assert.ok(hoofdregel, 'de centrale schermgrens ontbreekt');
  assert.doesNotMatch(hoofdregel[1], /background(?:-color|-image|-attachment)?\s*:/,
    'de centrale laag mag de lokaal toegankelijke achtergrond niet overschilderen');

  const inhoudsregel = WERELDSCHERMEN.match(/\[data-rtg-screen-root="content"\][^{]*\{([^}]*)\}/);
  assert.ok(inhoudsregel, 'de centrale inhoudsmaat ontbreekt');
  assert.doesNotMatch(inhoudsregel[1], /(?:^|;)\s*color\s*:/,
    'de centrale laag mag de lokaal toegankelijke tekstkleur niet overschrijven');
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
