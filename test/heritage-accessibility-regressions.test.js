/* De drie concrete mobiele/structurele regressies uit de volledige Heritage-
   browserkeuring. De echte a11y-ronde meet de pixels; deze toets houdt de
   onderliggende contracten dicht zodat een latere stijllaag ze niet opnieuw
   stil kan openbreken. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const lees = (pad) => fs.readFileSync(path.join(ROOT, pad), 'utf8');

test('een Edge-hoofdactie zonder doel blijft werkelijk verborgen', () => {
  const css = lees('public/shared/rtg-edge-system.css');
  assert.match(css, /\[data-rtg-edge-primary\]\[hidden\]\{display:none!important\}/);
});

test('een mobiel Command-werkblad begint onder Edge en de echte toesteluitsparing', () => {
  const css = lees('public/shared/rtg-edge-system.css');
  assert.match(css,
    /inset:calc\(var\(--edge-top\) \+ var\(--rtg-command-safe-top,env\(safe-area-inset-top,0px\)\)\)/);
});

test('het chauffeursmerk blijft een volledig mobiel raakvlak', () => {
  const css = lees('public/apps/chauffeur.css');
  assert.match(css, /\.rtg-merk\{[^}]*min-width:44px;min-height:44px;[^}]*display:grid/);
});

test('de knop van de zuinige-verbindingsmelding meet 44 bij 44', () => {
  const js = lees('public/shared/verbinding/verbinding-02.js');
  assert.match(js, /flex:0 0 44px;min-width:44px;min-height:44px;display:grid/);
});

test('eigen donkere routevlakken dragen hun volledige Heritage-inktset', () => {
  const css = lees('public/shared/rtg-heritage.css');
  assert.match(css, /\[data-rtg-world="living"\]\{[^}]*--rtg-world-muted:#5f574d/s);
  for (const vlak of ['onyx', 'bordeaux']) {
    const blok = css.match(new RegExp(`body\\[data-rtg-skin="heritage"\\]\\[data-rtg-eigenvlak="${vlak}"\\]\\{([^}]+)\\}`));
    assert.ok(blok, `${vlak} heeft een eigen Heritage-contract`);
    for (const token of ['bg', 'ground', 'card', 'card-strong', 'ink', 'muted', 'line',
      'signature', 'signature-soft', 'metal', 'action', 'action-ink', 'schema', 'photo', 'photo-mask']) {
      assert.match(blok[1], new RegExp(`--rtg-world-${token}:`), `${vlak} zet ${token}`);
    }
  }
  assert.match(css, /--rtg-opgoud:var\(--rtg-world-action-ink\)/);
  assert.match(css, /--rtg-goud-hoog:var\(--rtg-world-action\)/);
  assert.match(css, /--rtg-oppervlak:linear-gradient\([^;]+var\(--rtg-world-card\)/s);
  assert.match(css, /--rtg-oppervlak-2:linear-gradient\([^;]+var\(--rtg-world-card-strong\)/s);
});

test('Heritage overschrijft geen route-eigen tekstinkt op donkere eilanden', () => {
  const materialen = lees('public/shared/rtg-heritage-materials.css');
  const adapters = lees('public/shared/rtg-heritage-adapters.css');
  assert.doesNotMatch(materialen, /:where\(h1,h2\)\{color:var\(--rtg-world-ink\)\}/);
  assert.doesNotMatch(materialen,
    /:where\(\.sub,\.soft,\.stil,\.meta,\.muted,\.uitleg,small\)\{color:var\(--rtg-world-muted\)\}/);
  assert.doesNotMatch(adapters,
    /:where\(\.kaart,\.card,\.paneel,\.panel,\.tegel,\.tile,\.vak,\.rtg-groep\)\s*:where\([^}]+\)\{color:/);
  assert.match(adapters, /\.rtg-groep :where\(h3,\.kop,\.naam,strong\)\{color:var\(--rtg-world-ink\)\}/);
  assert.match(materialen,
    /body\[data-rtg-skin="heritage"\]\.rtg-stijl :is\(\.knop\.vol,\.knop\.primair,\.knop\.prim,\.knop\.hoofd\)/);
  assert.match(materialen, /color:var\(--rtg-world-action-ink\)!important/);
  assert.match(materialen,
    /body\[data-rtg-skin="heritage"\]\.rtg-stijl \.skip\{\s*background:var\(--rtg-world-action\);color:var\(--rtg-world-action-ink\)/);
});
