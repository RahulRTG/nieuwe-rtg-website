/* De eerste acht Vandaag-routes sluiten declaratief aan op Edge 2, terwijl
   het bestaande Edge-casco de enige eigenaar van top, side en bottom blijft.
   Deze toets bewaakt de routecontexten, de centrale loaderhandshake en de
   twee dynamische surface-deuren zonder auth- of datalogica na te bootsen. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const edge = require('../public/shared/rtg-edge-2.js');

const ROOT = path.join(__dirname, '..');
const lees = bestand => fs.readFileSync(path.join(ROOT, bestand), 'utf8');
const SYSTEM = lees('public/shared/rtg-edge-system.js');
const SYSTEM_CSS = lees('public/shared/rtg-edge-system.css');
const LIBRARY = lees('public/shared/rtg-edge-library.js');
const LOADER = lees('public/shared/rtg-edge-2-loader.js');
const CSS = lees('public/shared/rtg-edge-2.css');
const RANDEN = lees('public/shared/randen.js');
const BLADHAAK = lees('public/shared/command/bladhaak.js');
const WORK_ENTRY = lees('public/apps/werk/command-entry.js');
const FOUNDATION = lees('public/apps/foundation/os-publiek.html');

const PAGINAS = [
  { bestand: 'public/apps/rtg.html', context: 'living-bank,living-top', stand: 'overview', auto: 'true' },
  { bestand: 'public/apps/kantoor.html', context: 'wereldtabs,wereldapps', stand: 'overview', auto: 'true' },
  { bestand: 'public/apps/reizen.html', context: 'travel-header,hoofdtabs', stand: 'overview', auto: 'true' },
  { bestand: 'public/apps/foundation/os-publiek.html', context: 'world-shell', stand: 'overview', auto: 'true' },
  { bestand: 'public/apps/agenda.html', context: 'native-header,duimbalk', stand: 'compact', auto: 'false' },
  { bestand: 'public/apps/reisboek.html', context: 'native-header', stand: 'compact', auto: 'false' },
  { bestand: 'public/apps/werk.html', context: 'work-bank,work-top', stand: 'overview', auto: 'true' }
];

const ROUTES = [
  '/apps/rtg.html', '/apps/kantoor.html', '/apps/reizen.html',
  '/apps/foundation/os-publiek.html', '/apps/agenda.html', '/apps/reisboek.html',
  '/apps/werk.html#projecten', '/apps/foundation/os-publiek.html?stad=amsterdam'
];

function bodyVan(html) {
  const match = html.match(/<body\b[^>]*>/i);
  assert.ok(match, 'body ontbreekt');
  return match[0];
}

test('acht pilots gebruiken zeven route-entrypagina\'s met de gesloten contextmatrix', () => {
  assert.equal(ROUTES.length, 8);
  for (const pagina of PAGINAS) {
    const html = lees(pagina.bestand);
    const body = bodyVan(html);
    assert.ok(body.includes('data-rtg-edge-2-context="' + pagina.context + '"'), pagina.bestand);
    assert.ok(body.includes('data-rtg-edge-2-state="' + pagina.stand + '"'), pagina.bestand);
    assert.ok(body.includes('data-rtg-edge-2-auto="' + pagina.auto + '"'), pagina.bestand);
    assert.equal((html.match(/(?:\.\.\/|\/)shared\/randen\.js/g) || []).length, 1,
      pagina.bestand + ' houdt één bestaande Edge-ingang');
    assert.doesNotMatch(html, /rtg-edge-2-(?:loader|context)\.js|rtg-edge-2\.js|rtg-edge-2\.css/,
      pagina.bestand + ' mag de centrale Edge2-loader niet dupliceren');
  }
});

test('de bestaande Vandaag-contracten blijven op alle zeven pagina’s intact', () => {
  for (const bestand of ['public/apps/rtg.html', 'public/apps/kantoor.html', 'public/apps/reizen.html']) {
    assert.match(bodyVan(lees(bestand)), /data-rtg-vandaag-luxe(?:\s|>)/, bestand);
  }
  assert.match(bodyVan(FOUNDATION), /data-rtg-vandaag-luxe[\s>][^>]*data-rtg-vandaag-surface="public-city"/);
  assert.match(bodyVan(lees('public/apps/agenda.html')),
    /data-rtg-vandaag-luxe="surface"[^>]*data-rtg-vandaag-surface="agenda"/);
  assert.match(bodyVan(lees('public/apps/reisboek.html')),
    /data-rtg-vandaag-luxe="surface"[^>]*data-rtg-vandaag-surface="reisboek"/);
  assert.match(bodyVan(lees('public/apps/werk.html')), /data-rtg-vandaag-surface="projecten"/);
});

test('alle Edge2-assets komen één keer en in volgorde uit de centrale loader', () => {
  assert.equal((SYSTEM.match(/\/shared\/rtg-edge-2-loader\.js/g) || []).length, 1);
  assert.ok(SYSTEM.indexOf("data-rtg-edge-ready', 'true") < SYSTEM.indexOf('/shared/rtg-edge-2-loader.js'),
    'de loader mag pas na het commitpunt van de bestaande Edge starten');
  for (const direct of ['/shared/rtg-edge-2.css', '/shared/rtg-edge-2-context.js', '/shared/rtg-edge-2.js']) {
    assert.ok(!SYSTEM.includes(direct), 'rtg-edge-system laadt alleen de loader, niet ' + direct);
    assert.equal((LOADER.split(direct).length - 1), 1, direct + ' wordt centraal exact één keer genoemd');
  }
  assert.match(LOADER, /getElementById\('rtg-edge-2-css'\)/);
  assert.ok(LOADER.indexOf('/shared/rtg-edge-2.css') < LOADER.indexOf('/shared/rtg-edge-2-context.js'));
  assert.ok(LOADER.indexOf('/shared/rtg-edge-2-context.js') < LOADER.indexOf('/shared/rtg-edge-2.js'));
});

test('de onderrand gebruikt per pilot een expliciete veilige hoofdactie', () => {
  const contracten = [
    ["'/apps/rtg.html'", "'Bekijk uw dag'", "klik('.rtg-vandaag-luxe__cta')"],
    ["'/apps/kantoor.html'", "'Open werkbank'", "klik('.wereldtab-plus')"],
    ["'/apps/reizen.html'", "'Open reizen'", "klik('[data-tab=\"reizen\"]')"],
    ["'/apps/foundation/os-publiek.html'", "'Bekijk uw stad'", "focus('#steden')"],
    ["'/apps/agenda.html'", "'Nieuwe afspraak'", "klik('#nieuwBtn')"],
    ["'/apps/reisboek.html'", "'Naar reisinhoud'", "focus('#main')"],
    ["'/apps/werk.html'", "'Nieuw project'", "focus('#a_h0_naam, #mKeuze, #main')"]
  ];
  for (const [route, label, actie] of contracten) {
    assert.ok(LOADER.includes(route), route);
    assert.ok(LOADER.includes(label), label);
    assert.ok(LOADER.includes(actie), actie);
  }
  assert.doesNotMatch(LOADER, /main\s+\.knop|\.click\(\).*reisWeg|fetch\s*\(/,
    'de Edge-hoofdactie mag geen willekeurige of destructieve actie kiezen');
  assert.ok(Buffer.byteLength(LOADER) < 10 * 1024, 'de centrale loader blijft onder 10 KiB');
});

test('Edge2 verbetert exact één bestaand casco en maakt zelf geen tweede rand', () => {
  for (const klas of ['rtg-edge-top', 'rtg-edge-side', 'rtg-edge-bottom']) {
    assert.equal((LIBRARY.match(new RegExp('class="' + klas + '"', 'g')) || []).length, 1, klas);
  }
  assert.equal((SYSTEM.match(/className\s*=\s*['"]rtg-edge-chrome['"]/g) || []).length, 1);
  assert.match(SYSTEM, /if\s*\(A\)\s*return api/);
  assert.doesNotMatch(LOADER, /createElement\(['"](?:header|aside|footer)['"]\)/);
  assert.match(CSS, /@media\(max-width:767px\)[\s\S]*\.rtg-edge-side\{display:none!important\}/);
});

test('de gereedverklaring van Edge 1 verwijdert meteen de oude tweede menudeur', () => {
  assert.match(SYSTEM_CSS, /body\.rtg-edge-host #osMenuBtn\{display:none!important\}/);
  assert.match(SYSTEM, /classList\.add\('rtg-edge-host'\)/);
  assert.ok(SYSTEM.indexOf("classList.add('rtg-edge-host')") > SYSTEM.indexOf('teken(); bind();'),
    'de oude deur verdwijnt pas nadat tekenen en binden zijn geslaagd');
});

test('een zichtbaar appvenster laat hetzelfde Edge-casco tijdelijk wijken', () => {
  assert.match(LOADER, /data-rtg-edge-venster-open/);
  assert.match(LOADER, /dialog\[open\],\[role="dialog"\]\[aria-modal="true"\]/);
  assert.match(LOADER, /getClientRects\(\)\.length/,
    'een gesloten dialoog in de DOM mag de rand niet laten wijken');
  assert.match(LOADER, /MutationObserver\(stemVensterAf\)/,
    'openen en sluiten worden zonder app-specifieke koppeling gevolgd');
  for (const rand of ['top', 'side', 'bottom']) {
    assert.match(CSS, new RegExp('data-rtg-edge-venster-open="true"\\] \\.rtg-edge-' + rand +
      '\\{[^}]*visibility:hidden!important[^}]*pointer-events:none!important'));
  }
  assert.doesNotMatch(LOADER, /createElement\(['"](?:header|aside|footer)['"]\)/,
    'wijken mag geen tweede casco bouwen');
});

test('Clips draagt zijn hoofdhandeling over zonder een tweede duimbalk', () => {
  assert.match(LOADER, /pad === '\/apps\/clips\.html'\) neemHoofdactie\('Maak een clip', '#studioOpen'\)/);
  assert.match(LOADER, /data-rtg-edge-2-hoofdactie/);
  assert.match(CSS, /\[data-rtg-edge-2-hoofdactie="edge"\]>\.rtg-duimbalk\{display:none!important\}/);
});

test('TravelOS heeft per Command-maat precies één eigenaar van zijn reisbladen', () => {
  assert.ok(BLADHAAK.includes('html.rtg-command-mobiel body[data-rtg-world="travel"] .hoofdtabs'),
    'mobiel moeten de lokale tabs wijken voor de Command-balk');
  assert.ok(BLADHAAK.includes('html.rtg-command-blad:not(.rtg-command-mobiel) body[data-rtg-world="travel"] .hoofdtabs'),
    'op bureau moeten de lokale tabs terugkeren wanneer de mobiele Command-balk weg is');
  assert.equal((BLADHAAK.match(/body\[data-rtg-world="travel"\] \.hoofdtabs/g) || []).length, 2,
    'alleen de exclusieve mobiele en bureaucontracten mogen de tabs bezitten');
});

test('opt-in zonder ready-commit kan geen legacy bediening onderdrukken', () => {
  const attrs = new Map([['data-rtg-edge-2', '']]);
  const body = {
    hasAttribute: naam => attrs.has(naam),
    getAttribute: naam => attrs.has(naam) ? attrs.get(naam) : null,
    setAttribute: (naam, waarde) => attrs.set(naam, waarde),
    removeAttribute: naam => attrs.delete(naam),
    classList: { contains: () => false }
  };
  const root = { contains: () => true };
  const doc = {
    body,
    documentElement: null,
    querySelectorAll: selector => selector === '.rtg-edge-chrome' ? [root] : [{}]
  };
  const win = { location: { search: '' } };
  win.self = win;
  win.top = win;
  assert.equal(edge.inspectChrome(doc), null, 'zonder data-rtg-edge-ready is het casco niet committed');
  assert.equal(edge.start(doc, win), null);
  assert.equal(attrs.has('data-rtg-edge-2-rendered'), false);
  edge.destroy();
  for (const token of ['wereldtabs', 'wereldapps', 'hoofdtabs', 'world-shell', 'native-header',
    'travel-header', 'duimbalk', 'living-bank', 'work-bank']) {
    assert.ok(CSS.includes('data-rtg-edge-2-rendered="true"][data-rtg-edge-2-context*="' + token + '"]'),
      token + ' wordt alleen na de rendermarker onderdrukt');
  }
});

test('een iframe zonder embed-query krijgt evenmin een geneste Edge of Edge2', () => {
  const win = { location: { search: '' }, self: {}, top: {} };
  const element = {
    classList: { contains: () => false },
    getAttribute: () => null,
    hasAttribute: () => false
  };
  const doc = { body: element, documentElement: element };
  assert.equal(edge.isEmbedded(doc, win), true);
  assert.equal(edge.start(doc, win), null);
  assert.match(RANDEN, /w\.self\s*!==\s*w\.top/);
  assert.match(SYSTEM, /w\.self\s*!==\s*w\.top/);
  assert.ok(SYSTEM.indexOf('if(inKader ||') < SYSTEM.indexOf("className = 'rtg-edge-chrome'"));
});

function werkRoute(hash) {
  const attrs = new Map([
    ['data-rtg-vandaag-surface', 'projecten'],
    ['data-rtg-edge-2-state', 'overview'],
    ['data-rtg-edge-2-auto', 'true']
  ]);
  let geklikt = null;
  const document = {
    body: {
      getAttribute: naam => attrs.has(naam) ? attrs.get(naam) : null,
      setAttribute: (naam, waarde) => attrs.set(naam, waarde),
      removeAttribute: naam => attrs.delete(naam)
    },
    getElementById: id => id === 'inhoud' ? { hidden: false } : null,
    querySelector: selector => ({ click: () => { geklikt = selector; } })
  };
  vm.runInNewContext(WORK_ENTRY, {
    document, location: { hash }, window: { addEventListener: () => {} },
    decodeURIComponent, Object, String
  });
  return { attrs, geklikt };
}

test('alleen de whitelisted Work-projectenroute wordt een vaste compacte surface', () => {
  const project = werkRoute('#projecten');
  assert.equal(project.attrs.get('data-rtg-edge-2-state'), 'compact');
  assert.equal(project.attrs.get('data-rtg-edge-2-auto'), 'false');
  assert.equal(project.attrs.get('data-rtg-vandaag-luxe'), 'surface');
  assert.equal(project.geklikt, '[data-wk="projecten"]');

  for (const hash of ['#people', '#onbekend', '#projecten%22%5D%5Bautofocus']) {
    const ander = werkRoute(hash);
    assert.equal(ander.attrs.get('data-rtg-edge-2-state'), 'overview', hash);
    assert.equal(ander.attrs.get('data-rtg-edge-2-auto'), 'true', hash);
  }
});

function foundationModus(modus) {
  const attrs = new Map([
    ['data-rtg-vandaag-luxe', ''],
    ['data-rtg-edge-2-state', 'overview'],
    ['data-rtg-edge-2-auto', 'true']
  ]);
  const document = { body: {
    setAttribute: (naam, waarde) => attrs.set(naam, waarde),
    removeAttribute: naam => attrs.delete(naam)
  } };
  const begin = FOUNDATION.indexOf('function zetVandaagModus');
  const einde = FOUNDATION.indexOf('\n}\n\nfunction meldStad', begin) + 2;
  assert.ok(begin >= 0 && einde > begin, 'Foundation-modusfunctie ontbreekt');
  const functie = FOUNDATION.slice(begin, einde);
  vm.runInNewContext("const VANDAAG_ATTR='data-rtg-vandaag-luxe';\n" + functie +
    '\nzetVandaagModus(' + JSON.stringify(modus) + ", 'RTF Amsterdam');", { document });
  return attrs;
}

test('alleen een veilig opgeloste Foundation-stad schakelt naar compact zonder auto', () => {
  const stad = foundationModus('surface');
  assert.equal(stad.get('data-rtg-vandaag-luxe'), 'surface');
  assert.equal(stad.get('data-rtg-edge-2-state'), 'compact');
  assert.equal(stad.get('data-rtg-edge-2-auto'), 'false');

  const home = foundationModus('home');
  assert.equal(home.get('data-rtg-vandaag-luxe'), 'home');
  assert.equal(home.get('data-rtg-edge-2-state'), 'overview');
  assert.equal(home.get('data-rtg-edge-2-auto'), 'true');
  assert.match(FOUNDATION, /r\.steden\.find\(s => stadSlug\(s\.naam\) === STADSAANVRAAG\)/);
});
