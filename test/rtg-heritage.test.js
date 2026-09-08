/* DE HERITAGE-DOCTRINE IS CODE, GEEN MOODBOARD.
   Deze toets borgt de vaste wereldpaletten, twee geometrieën, vier dieptelagen
   en de componentrollen waarmee routes gefaseerd worden opgebouwd. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
function lees(naam) { return fs.readFileSync(path.join(ROOT, naam), 'utf8'); }

const TOKENS = lees('public/shared/rtg-heritage.css');
const MATERIALEN = lees('public/shared/rtg-heritage-materials.css');
const ADAPTERS = lees('public/shared/rtg-heritage-adapters.css');
const COMPONENTEN = lees('public/shared/rtg-heritage-components.css');
const CHECK = lees('scripts/check.js');

test('de centrale laag blijft klein, gesplitst en laat alle delen één keer binnen', () => {
  for (const naam of ['rtg-heritage.css', 'rtg-heritage-materials.css', 'rtg-heritage-adapters.css',
    'rtg-heritage-experiences.css',
    'rtg-heritage-components.css']) {
    const bytes = fs.statSync(path.join(ROOT, 'public/shared', naam)).size;
    assert.ok(bytes < 10 * 1024, naam + ' hoort onder de 10 KB te blijven, is ' + bytes);
  }
  assert.equal((TOKENS.match(/rtg-heritage-materials\.css/g) || []).length, 1);
  assert.equal((TOKENS.match(/rtg-heritage-adapters\.css/g) || []).length, 1);
  assert.equal((TOKENS.match(/rtg-heritage-experiences\.css/g) || []).length, 1);
  assert.equal((TOKENS.match(/rtg-heritage-components\.css/g) || []).length, 1);
});

test('vier vaste werelden delen één volledige token- en dieptegrammatica', () => {
  for (const wereld of ['living', 'travel', 'work', 'foundation']) {
    const blok = new RegExp('data-rtg-world="' + wereld + '"\\]\\{([^]*?)\\n\\}').exec(TOKENS);
    assert.ok(blok, wereld + ' mist een vaste wereldidentiteit');
    for (const token of ['bg', 'card', 'card-strong', 'ink', 'muted', 'line', 'signature', 'metal']) {
      assert.match(blok[1], new RegExp('--rtg-world-' + token + ':'), wereld + ' mist ' + token);
    }
    assert.match(blok[1], /--rtg-world-photo:url\(/, wereld + ' mist wereldfotografie');
  }
  for (const token of ['--rtg-depth-content:', '--rtg-depth-focus:', '--rtg-depth-system:',
    '--rtg-radius-content:2px', '--rtg-radius-system:22px', '--rtg-target:44px']) {
    assert.ok(TOKENS.includes(token), token + ' ontbreekt');
  }
});

test('eigen donkere routevlakken dragen hun volledige Heritage-inktset', () => {
  assert.match(TOKENS, /\[data-rtg-world="living"\]\{[^}]*--rtg-world-muted:#51493f/s);
  for (const vlak of ['onyx', 'bordeaux']) {
    const blok = TOKENS.match(new RegExp(`body\\[data-rtg-skin="heritage"\\]\\[data-rtg-eigenvlak="${vlak}"\\]\\{([^}]+)\\}`));
    assert.ok(blok, `${vlak} heeft een eigen Heritage-contract`);
    for (const token of ['bg', 'ground', 'card', 'card-strong', 'ink', 'muted', 'line',
      'signature', 'signature-soft', 'metal', 'action', 'action-ink', 'schema', 'photo', 'photo-mask']) {
      assert.match(blok[1], new RegExp(`--rtg-world-${token}:`), `${vlak} zet ${token}`);
    }
  }
  assert.match(TOKENS, /--rtg-opgoud:var\(--rtg-world-action-ink\)/);
  assert.match(TOKENS, /--rtg-goud-hoog:var\(--rtg-world-action\)/);
  assert.match(TOKENS, /--rtg-oppervlak:linear-gradient\([^;]+var\(--rtg-world-card\)/s);
  assert.match(TOKENS, /--rtg-oppervlak-2:linear-gradient\([^;]+var\(--rtg-world-card-strong\)/s);
});

test('Bodoni blijft redactioneel en Inter blijft operationeel', () => {
  assert.match(MATERIALEN, /data-rtg-type="display"/);
  assert.match(MATERIALEN, /:where\(h1,h2,h3,h4\)[^}]*--rtg-interface/);
  assert.doesNotMatch(MATERIALEN, /body\[data-rtg-skin="heritage"\]\s*\{[^}]*font-family:[^;}]*Bodoni/i,
    'Bodoni mag nooit de lopende bodyletter worden');
  assert.match(COMPONENTEN, /\.rtg-operational-panel[^}]*font-family:Inter/);
  assert.match(COMPONENTEN, /font-variant-numeric:tabular-nums/);
});

test('rechte inhoud en afgeronde systeemlagen blijven betekenisvol verschillend', () => {
  assert.match(MATERIALEN, /\.rtg-groep,.kaart,.card,.paneel,.panel,.tegel,.box,.blok[^}]*border-radius:var\(--rtg-radius-content\)/);
  assert.match(MATERIALEN, /dialog,.modal,.sheet,\[role="dialog"\][^}]*border-radius:var\(--rtg-radius-system\)/);
  assert.match(MATERIALEN, /focus-visible/);
  assert.match(MATERIALEN, /prefers-reduced-motion:reduce/);
  assert.match(MATERIALEN, /forced-colors:active/);
  assert.match(CHECK, /rtg-heritage-materials\.css[^]*rtg-radius-content[^]*rtg-radius-system/,
    'de hoofdpoort hoort alleen de centrale Heritage-geometrie toe te laten');
  assert.match(CHECK, /ongeclassificeerde hoek/,
    'een route-eigen afronding hoort een harde bouwfout te blijven');
});

test('de vaste componentgrammatica bevat inhoud, focus, operatie en eerlijke staten', () => {
  for (const rol of ['rtg-world-portal', 'rtg-editorial-hero', 'rtg-context-strip',
    'rtg-moment-list', 'rtg-narrative-panel', 'rtg-operational-panel', 'rtg-side-sheet']) {
    assert.ok(COMPONENTEN.includes('.' + rol), rol + ' ontbreekt');
  }
  for (const toestand of ['loading', 'empty', 'error', 'offline', 'confirmed']) {
    assert.ok(COMPONENTEN.includes('data-state="' + toestand + '"'), toestand + ' ontbreekt');
  }
  assert.ok(COMPONENTEN.includes('.rtg-state__label'), 'een zichtbare, echte statusnaam ontbreekt');
  assert.doesNotMatch(COMPONENTEN, /\.rtg-state\[[^\]]+\]::before\s*\{\s*content:/,
    'statusbetekenis mag niet alleen uit CSS-generated content komen');
  assert.match(COMPONENTEN, /@media\(max-width:700px\)/);
  assert.match(COMPONENTEN, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(COMPONENTEN, /@media\(forced-colors:active\)/);
});

test('uitzonderingscanvassen krijgen geen decoratieve wereldachtergrond', () => {
  for (const grens of ['data-rtg-projectie', 'travel-os-map', 'rtg-edge-workspace',
    'rtg-edge-embed', 'media-werk', 'data-rtg-oppervlak', 'rtg-command-blad']) {
    assert.ok(MATERIALEN.includes(grens), grens + ' ontbreekt');
  }
  assert.doesNotMatch(MATERIALEN, /\.rtg-edge-embed,\[data-ios-uit\]/,
    'data-ios-uit betekent alleen geen iOS-chrome en is niet automatisch een canvas');
  assert.match(MATERIALEN, /video,canvas,#beeld,.zoeker,.speler,.media-studio[^}]*border-radius:0/);
});

test('bestaande echte DOM wordt geadapteerd zonder knoppen of data te kopiëren', () => {
  for (const rol of ['kantoor-intro', 'rtg-intro', 'litem', 'rtg-rij', 'leeg', 'melding', 'veld']) {
    assert.ok(ADAPTERS.includes('.' + rol), rol + ' mist de heritage-adapter');
  }
  assert.doesNotMatch(ADAPTERS, /display\s*:\s*none|visibility\s*:\s*hidden/,
    'een visuele adapter mag echte inhoud of bediening niet verbergen');
  assert.match(ADAPTERS, /@media\(pointer:coarse\)[\s\S]*min-height:var\(--rtg-target\)/);
  assert.match(ADAPTERS, /@media\(max-width:700px\)[\s\S]*min-height:var\(--rtg-target\)/);
  assert.match(ADAPTERS, /prefers-reduced-motion:reduce/);
});

test('Heritage overschrijft geen route-eigen tekstinkt op donkere eilanden', () => {
  assert.doesNotMatch(MATERIALEN, /:where\(h1,h2\)\{color:var\(--rtg-world-ink\)\}/);
  assert.doesNotMatch(MATERIALEN,
    /:where\(\.sub,\.soft,\.stil,\.meta,\.muted,\.uitleg,small\)\{color:var\(--rtg-world-muted\)\}/);
  assert.doesNotMatch(ADAPTERS,
    /:where\(\.kaart,\.card,\.paneel,\.panel,\.tegel,\.tile,\.vak,\.rtg-groep\)\s*:where\([^}]+\)\{color:/);
  assert.match(ADAPTERS, /\.rtg-groep :where\(h3,\.kop,\.naam,strong\)\{color:var\(--rtg-world-ink\)\}/);
  assert.match(MATERIALEN,
    /body\[data-rtg-skin="heritage"\]\.rtg-stijl :is\(\.knop\.vol,\.knop\.primair,\.knop\.prim,\.knop\.hoofd\)/);
  assert.match(MATERIALEN, /color:var\(--rtg-world-action-ink\)!important/);
  assert.match(MATERIALEN,
    /body\[data-rtg-skin="heritage"\]\.rtg-stijl \.skip\{\s*background:var\(--rtg-world-action\);color:var\(--rtg-world-action-ink\)/);
});

test('de volledige Heritage-laag reist mee in beide offline schillen', () => {
  const schillen = [lees('public/sw.js'), lees('public/apps/foundation/sw.js')];
  const verplicht = [
    '/shared/basis.js',
    '/shared/rtg-world-identity.js',
    '/shared/rtg-heritage.css',
    '/shared/rtg-heritage-materials.css',
    '/shared/rtg-heritage-adapters.css',
    '/shared/rtg-heritage-experiences.css',
    '/shared/rtg-heritage-components.css',
    '/shared/rtg-heritage-motion.css',
    '/shared/rtg-heritage-motion.js',
    '/shared/rtg-continue-key.css',
    '/shared/rtg-continue-key-core.js',
    '/shared/rtg-continue-key.js',
    '/shared/rtg-heritage-order.js',
    '/images/worlds/heritage/living-heritage-v2.jpg',
    '/images/worlds/heritage/travel-heritage-v2.jpg',
    '/images/worlds/heritage/work-heritage-v2.jpg',
    '/images/worlds/heritage/foundation-heritage-v2.jpg',
    '/fonts/aFTQ7PxzY382XsXX63LUYJSKSKjWXFBP.woff2',
    '/fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7W0Q5nw.woff2'
  ];
  for (const schil of schillen) {
    for (const pad of verplicht) {
      assert.equal((schil.match(new RegExp(pad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1,
        pad + ' hoort exact één keer in iedere offline schil');
    }
  }
});


test('routevarianten en canvaskeuzes zijn volledig herleidbaar tot het centrale register', () => {
  const identity = require('../public/shared/rtg-world-identity');
  const registry = require('../public/shared/rtg-heritage-registry');
  const seen = new Map();
  for (const [material, routes] of Object.entries(identity.MATERIALS)) for (const route of routes) {
    assert.equal(seen.has(route), false, route + ' heeft twee materiaalidentiteiten');
    seen.set(route, material);
    assert.ok(fs.existsSync(path.join(ROOT, 'public', route)), route + ' bestaat niet');
  }
  const variants = new Set([...Object.values(registry.profiles).flatMap(p => p.rules), ...registry.common].map(r => r.variant));
  for (const file of fs.readdirSync(path.join(ROOT, 'public/apps'), { recursive: true }).filter(f => f.endsWith('.html'))) {
    const html = lees('public/apps/' + file);
    const body = (html.match(/^<body\b[^>]*>/im) || [''])[0];
    const material = (body.match(/data-rtg-eigenvlak="([^"]+)"/) || [])[1];
    if (material) assert.equal(seen.get('/apps/' + file), material, file + ' kiest een ongeoorloofde materiaalvariant');
    for (const match of html.matchAll(/data-rtg-component-variant="([^"]+)"/g)) assert.ok(variants.has(match[1]), file + ': onbekende componentvariant ' + match[1]);
  }
  for (const route of Object.keys(registry.canvas)) {
    const body = lees('public' + route).match(/^<body\b[^>]*>/im)[0];
    assert.match(body, /data-rtg-edge-2-state="compact"/, route + ': canvas opent compact');
    assert.match(body, /data-rtg-edge-2-auto="false"/, route + ': bediening wacht op de gebruiker');
  }
});

test('beide offline shells bevatten de volledige gedeelde intelligentielaag', () => {
  const files = ['rtg-route-memory-core.js', 'rtg-route-memory.js', 'rtg-operation.js', 'rtg-side-sheet.js', 'rtg-edge-preferences.js', 'rtg-action-dock.js', 'rtg-heritage-registry.js', 'rtg-heritage-components.js', 'rtg-heritage-transition.js', 'rtg-intelligence.css', 'rtg-intelligence-shell.css', 'rtg-world-start.css', 'rtg-world-start.js'];
  for (const sw of ['public/sw.js','public/apps/foundation/sw.js']) for (const file of files)
    assert.ok(lees(sw).includes("'/shared/" + file + "'"), sw + ' mist offline asset ' + file);
});
