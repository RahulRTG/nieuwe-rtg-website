/* DE TOEGANKELIJKHEIDSADAPTER IN EEN ECHTE BROWSER.

   test/rtg-a11y.test.js toetst het VERTAALSTUK met de echte uitvoervorm van de
   keuring. Dit bestand toetst de keten eromheen, en dat kan alleen hier: de
   bundel wordt in de cel gerenderd -- met de echte CSP, in een sandbox-iframe --
   en de keuring wordt via `evaluate` binnen dat kader gedraaid.

   Precies daar zit een aanname die de moeite van het narekenen waard is: de cel
   staat op `default-src 'none'`, en een keuring die via `addScriptTag` zou
   binnenkomen, zou daar door de CSP worden tegengehouden. `evaluate` loopt daar
   buitenom. Dat werd overgenomen uit scripts/a11y.js; hier wordt het gemeten.

   Geen browser? Dan slaat deze toets over (test/browser.js).

   Draai los: node --test test/rtg-a11y.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { laadBrowser } = require('./browser');
const rtg = require('../scripts/rtg');
const a11y = require('../scripts/rtg-a11y');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-a11y-e2e-'));

/* Een app met zes structurele fouten, een contrastfout en drie te kleine
   raakvlakken -- allemaal met opzet, en allemaal dingen die de bestaande
   keuring op onze eigen schermen ook zou vinden. */
const KAPOT = {
  'index.html': `<!doctype html>
<html>
<head><meta charset="utf-8"><link rel="stylesheet" href="app.css"></head>
<body>
  <main>
    <img src="beeld.svg">
    <button id="knop"></button>
    <input type="text">
    <p class="flets">Deze tekst staat op te weinig contrast.</p>
    <a href="#ergens"><span></span></a>
  </main>
  <script src="app.js"></script>
</body>
</html>`,
  'app.css': `body { background: #ffffff; font-family: system-ui, sans-serif; }
.flets { color: #cfcfcf; font-size: 14px; }
#knop { width: 16px; height: 16px; padding: 0; }`,
  'app.js': `'use strict';\ndocument.getElementById('knop').addEventListener('click', () => {});`,
  'beeld.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'
};

const stil = (fn) => {
  const oudLog = console.log, oudFout = console.error;
  const regels = [];
  console.log = (...a) => regels.push(a.join(' '));
  console.error = (...a) => regels.push(a.join(' '));
  try { return { uit: fn(), tekst: regels.join('\n') }; }
  finally { console.log = oudLog; console.error = oudFout; }
};
const stilAsync = async (fn) => {
  const oudLog = console.log, oudFout = console.error;
  const regels = [];
  console.log = (...a) => regels.push(a.join(' '));
  console.error = (...a) => regels.push(a.join(' '));
  try { const uit = await fn(); return { uit, tekst: regels.join('\n').replace(/\x1b\[[0-9;]*m/g, '') }; }
  finally { console.log = oudLog; console.error = oudFout; }
};

test('rtg a11y vindt in een echte cel wat er in zit', async (t) => {
  if (!laadBrowser()) { t.skip('geen browser beschikbaar'); return; }
  const map = path.join(TMP, 'kapot');
  stil(() => rtg.opdrachtNew([map]));
  for (const [naam, inhoud] of Object.entries(KAPOT)) fs.writeFileSync(path.join(map, naam), inhoud);

  const r = await stilAsync(() => a11y([map], { leesBundel: rtg.leesBundel, kleur: false }));

  assert.equal(r.uit, 1, 'een app met structurele fouten hoort een uitgangscode 1 te geven');
  assert.match(r.tekst, /1 pagina\(s\) gemeten, in de cel/);

  /* De zes structurele controles EN de contrastcontrole, elk apart. Dit is de
     bewering die de eerste versie stilzwijgend niet waarmaakte. */
  for (const stuk of [
    'Afbeelding zonder alt-tekst',
    'Knop zonder toegankelijke naam',
    'Link zonder toegankelijke naam',
    'Formulierveld zonder label',
    '<html> zonder lang-attribuut',
    'Document zonder <title>',
    'Te laag kleurcontrast'
  ]) {
    assert.ok(r.tekst.includes(stuk), stuk + ' hoort gevonden te worden in de echte cel');
  }
  assert.match(r.tekst, /structuur en contrast\s+7 overtreding/);

  // en de raakvlakken, gemeten op telefoonformaat
  assert.match(r.tekst, /raakvlak\(ken\) kleiner dan 24x24/);
  assert.match(r.tekst, /16x16/, 'met het gemeten formaat erbij');

  // het is bewijs en geen poort, en dat staat er
  assert.match(r.tekst, /blokkeert niets/);
});

test('een schone app komt er schoon uit', async (t) => {
  if (!laadBrowser()) { t.skip('geen browser beschikbaar'); return; }
  const map = path.join(TMP, 'schoon');
  stil(() => rtg.opdrachtNew([map]));
  const r = await stilAsync(() => a11y([map], { leesBundel: rtg.leesBundel, kleur: false }));
  assert.equal(r.uit, 0, 'het sjabloon van rtg new hoort toegankelijk te zijn');
  assert.match(r.tekst, /structuur en contrast\s+in orde/);
  assert.match(r.tekst, /raakvlakken\s+in orde/);
});

test.after(() => { fs.rmSync(TMP, { recursive: true, force: true }); });
