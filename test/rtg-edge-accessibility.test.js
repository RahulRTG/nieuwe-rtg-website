/* De luxe Edge-rand blijft alleen premium wanneer haar echte bediening ook
   leesbaar en raakbaar is. Deze toets borgt de 44px-doelen, inclusief 320px,
   en meet de Living-statuskleuren als tekst in plaats van als moodboard. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const lees = naam => fs.readFileSync(path.join(ROOT, naam), 'utf8');
const EDGE = lees('public/shared/rtg-edge-system.css');
const EDGE2 = lees('public/shared/rtg-edge-2.css');
const HERITAGE = lees('public/shared/rtg-heritage.css');
const COMPONENTEN = lees('public/shared/rtg-heritage-components.css');
const CHAUFFEUR = lees('public/apps/chauffeur.css');
const VERBINDING = lees('public/shared/verbinding/verbinding-02.js');

function variabele(blok, naam) {
  const raak = blok.match(new RegExp('--' + naam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ':\\s*(#[0-9a-f]{6})', 'i'));
  assert.ok(raak, naam + ' ontbreekt');
  return raak[1];
}

function luminantie(hex) {
  const kanalen = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255)
    .map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return .2126 * kanalen[0] + .7152 * kanalen[1] + .0722 * kanalen[2];
}

function contrast(a, b) {
  const x = luminantie(a), y = luminantie(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

test('zichtbare Edge-bediening gebruikt minstens 44 bij 44 pixels', () => {
  assert.match(EDGE, /--edge-top:44px/);
  for (const contract of [
    /\.rtg-edge-crumbs button\{[^}]*min-width:44px;min-height:44px/,
    /\.rtg-edge-worldbar a\{[^}]*min-width:44px;min-height:44px/,
    /\.rtg-edge-state\{[^}]*min-width:44px;height:var\(--edge-top\)/,
    /\.rtg-edge-tool\{[^}]*min-width:44px;min-height:44px/,
    /\.rtg-edge-history button\{[^}]*min-width:44px;min-height:44px/,
    /\.rtg-edge-action button\{[^}]*min-width:44px;min-height:44px/,
    /\.rtg-edge-index a\{[^}]*min-height:44px/,
    /\.rtg-edge-worlds a\{[^}]*min-height:44px/,
    /\.rtg-edge-workspaces button\{[^}]*min-width:44px;min-height:44px/
  ]) assert.match(EDGE, contract);

  for (const contract of [
    /\.rtg-edge-2-mode\{[^}]*min-width:44px!important;min-height:44px!important/,
    /\.rtg-edge-2-context-button\{[^}]*min-width:44px!important;min-height:44px!important/,
    /\.rtg-edge-2-context-close\{[^}]*min-width:44px;min-height:44px/,
    />\.wos-dock button\{[^}]*min-width:44px;min-height:44px/,
    />nav\.balk\[aria-label="Hoofdnavigatie"\] a\{[^}]*min-width:44px;min-height:44px/
  ]) assert.match(EDGE2, contract);
});

test('route-eigen mobiele bediening houdt hetzelfde volledige raakvlak', () => {
  assert.match(CHAUFFEUR, /\.rtg-merk\{[^}]*min-width:44px;min-height:44px;[^}]*display:grid/);
  assert.match(VERBINDING, /flex:0 0 44px;min-width:44px;min-height:44px;display:grid/);
});

test('Edge verbergt een hoofdactie zonder doel en respecteert de toesteluitsparing', () => {
  assert.match(EDGE, /\[data-rtg-edge-primary\]\[hidden\]\{display:none!important\}/);
  assert.match(EDGE,
    /inset:calc\(var\(--edge-top\) \+ var\(--rtg-command-safe-top,env\(safe-area-inset-top,0px\)\)\)/);
});

test('de enkele onderrand blijft op 320px bruikbaar zonder kleinere noodknoppen', () => {
  assert.match(EDGE, /grid-template-columns:var\(--edge-side\) 44px 88px minmax\(0,1fr\) 44px/);
  assert.match(EDGE2, /@media\(max-width:340px\)[\s\S]*grid-template-columns:var\(--edge-side\) 88px minmax\(0,1fr\) 44px!important/);
  assert.match(EDGE2, /grid-template-columns:repeat\(5,minmax\(44px,1fr\)\)[\s\S]*overflow-x:auto!important/);
  assert.doesNotMatch(EDGE2, /(?:width|min-width|height|min-height):(?:24|28|30|32|36)px!important/);

  const vrijeActieruimte = 320 - 44 - 88 - 44;
  assert.equal(vrijeActieruimte, 3 * 44 + 2 * 6,
    'drie Living-acties en twee tussenruimtes passen exact naast de vaste bediening');
});

test('mobiele LivingOS-panelen volgen de bestaande data-view en worden niet leeg verborgen', () => {
  const mobiel = EDGE.match(/@media\(max-width:767px\)\{([\s\S]*?)\n\}/);
  assert.ok(mobiel, 'mobiele Edge-regels ontbreken');
  assert.match(mobiel[1], /body\.rtg-edge-host \.lo-worlds\{display:block!important;height:100%\}/);
  assert.match(mobiel[1], /data-view="intent"\] \.lo-intent/);
  assert.match(mobiel[1], /data-view="decisions"\] \.lo-decisions/);
  assert.match(mobiel[1], /data-view="evidence"\] \.lo-decisions/);
  assert.doesNotMatch(mobiel[1], /\.lo-panel\[data-edge-active\]/,
    'Edge mag niet wachten op een actiefkenmerk dat LivingOS nooit zet');
});

test('een 100dvh-werkschil blijft binnen de zichtbare Edge-werkhoogte', () => {
  assert.match(EDGE, /body\.rtg-edge-host \.pn-shell\{height:calc\(100dvh - var\(--edge-top\) - var\(--edge-bottom\) - env\(safe-area-inset-top,0px\) - env\(safe-area-inset-bottom,0px\)\)\}/);
  assert.match(EDGE2, /data-rtg-edge-2-state="compact"\] \.pn-shell\{height:calc\(100dvh - var\(--edge-bottom\)/);
  assert.match(EDGE2, /data-rtg-edge-2-state="focus"\] \.pn-shell\{height:100dvh\}/);
});

test('functionele Edge-labels zakken niet terug naar 6-9 pixels', () => {
  assert.doesNotMatch(EDGE + '\n' + EDGE2, /font-size:\s*[5-9](?:\.\d+)?px/);
  assert.match(EDGE, /\.rtg-edge-find input\{[^}]*font-size:14px/);
  assert.match(EDGE, /\.rtg-edge-status-inner dl div\{[^}]*font-size:11px/);
  assert.match(EDGE2, /\.rtg-edge-2-context-button\{[^}]*font-size:10px!important/);
});

test('Living-statuswoorden halen WCAG AA op alle centrale ivoorvlakken', () => {
  const living = HERITAGE.match(/data-rtg-world="living"\]\{([\s\S]*?)\n\}/);
  assert.ok(living, 'Living-tokens ontbreken');
  const voorgronden = ['rtg-status-ok', 'rtg-status-warn', 'rtg-status-danger']
    .map(token => [token, variabele(living[1], token)]);
  const achtergronden = ['rtg-world-bg', 'rtg-world-card', 'rtg-world-card-strong']
    .map(token => [token, variabele(living[1], token)]);
  for (const [voorNaam, voor] of voorgronden) {
    for (const [achterNaam, achter] of achtergronden) {
      assert.ok(contrast(voor, achter) >= 4.5,
        voorNaam + ' heeft onvoldoende contrast op ' + achterNaam);
    }
  }
  assert.match(COMPONENTEN, /\.rtg-state__label\{[^}]*font-size:\.75rem/);
  assert.match(EDGE2, /--edge-ok:var\(--rtg-status-ok/);
  assert.match(EDGE2, /--edge-warn:var\(--rtg-status-warn/);
  assert.match(EDGE2, /--edge-danger:var\(--rtg-status-danger/);
});
