/* ============================================================================
   WANNEER MAG EEN GEWICHT ZONDER MODUS WEG?

   `onbekend` is de bak voor metingen van voor de modi: echt gemeten, maar
   niemand weet meer onder welke omstandigheden. Hij is nuttig zolang hij de
   enige is die een bestand kent -- de terugval in scripts/lib/delen.js leunt
   erop -- en hij hoort niet eeuwig te groeien naast modi die datzelfde bestand
   wel gelabeld kennen.

   De beweringen hieronder gaan over de twee kanten waarop dat mis kan gaan:
   te vroeg opruimen (een bestand verliest zijn enige gewicht) en nooit
   opruimen (een register dat alleen maar groeit).
   ========================================================================== */
'use strict';
require('./toetsnaam');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const WORTEL = path.join(__dirname, '..');
const SCRIPT = path.join(WORTEL, 'scripts', 'toetsduur.js');

/* Het echte script draaien op een tijdelijke meting, zonder het register in de
   repo aan te raken. `--schrijf` blijft er met opzet af. */
function bouwUit(regels) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'toetsduur-'));
  const meting = path.join(map, '.toetsduur');
  fs.writeFileSync(meting, regels.map((r) => r.join('\t')).join('\n') + '\n');
  try {
    const uit = execFileSync(process.execPath, [SCRIPT, '--lees', meting],
      { cwd: WORTEL, encoding: 'utf8' });
    return uit;
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
}

const { bouw } = require('../scripts/toetsduur');

/* Rechtstreeks op bouw(), want de opruiming is een eigenschap van het REGISTER
   en niet van de afdruk. */
function metModi(modi) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'toetsduur-'));
  const meting = path.join(map, '.toetsduur');
  fs.writeFileSync(meting, '');
  try { return bouw([meting], { versie: 2, modi }); }
  finally { fs.rmSync(map, { recursive: true, force: true }); }
}

/* Een bestandsnaam die echt op schijf staat, want bouw() gooit alles weg wat
   niet meer bestaat -- terecht, maar dan toetst dit blok dat in plaats van de
   opruiming. */
const A = 'delen.test.js';
const B = 'pasladder.test.js';
const vorm = (ms) => ({ duur: { [A]: ms }, spreiding: { [A]: { n: 1, min: ms, max: ms } } });

test('met maar EEN gedeclareerde modus wordt er niets opgeruimd', () => {
  /* Dit is de stand van vandaag: `dekking` is gemeten, `normaal` nog niet.
     Zou hij nu al opruimen, dan verliezen de schermtoetsen hun enige weging. */
  const uit = metModi({ dekking: vorm(5000), onbekend: vorm(1000) });
  assert.equal(uit.gelezen.opgeruimd.weg, 0);
  assert.ok(uit.modi.onbekend, 'onbekend hoort te blijven staan');
  assert.equal(uit.modi.onbekend.duur[A], 1000);
});

test('kennen ALLE modi het bestand, dan mag het gewicht zonder modus weg', () => {
  const uit = metModi({
    normaal: vorm(1000), dekking: vorm(5000), onbekend: vorm(900)
  });
  assert.equal(uit.gelezen.opgeruimd.weg, 1);
  assert.ok(!uit.modi.onbekend, 'een lege modus verdwijnt helemaal');
  assert.equal(uit.modi.normaal.duur[A], 1000, 'de gelabelde gewichten blijven');
  assert.equal(uit.modi.dekking.duur[A], 5000);
});

test('kent maar EEN van de modi het bestand, dan blijft het staan', () => {
  /* De gevaarlijkste versie van deze opruiming: weggooien omdat er ergens een
     gewicht is, terwijl er een vraag bestaat waarop dan geen antwoord meer is. */
  const uit = metModi({
    normaal: { duur: { [A]: 1000 }, spreiding: {} },
    dekking: { duur: { [B]: 5000 }, spreiding: {} },
    onbekend: { duur: { [A]: 900, [B]: 800 }, spreiding: {} }
  });
  assert.equal(uit.gelezen.opgeruimd.weg, 0, 'geen van beide is door ALLE modi gedekt');
  assert.equal(uit.modi.onbekend.duur[A], 900);
  assert.equal(uit.modi.onbekend.duur[B], 800);
});

test('de opruiming laat nooit een bestand zonder enig gewicht achter', () => {
  const uit = metModi({
    normaal: vorm(1000), dekking: vorm(5000),
    onbekend: { duur: { [A]: 900, [B]: 800 }, spreiding: {} }
  });
  /* A is door beide gedekt en mag weg; B door geen van beide en blijft. */
  assert.equal(uit.modi.onbekend.duur[B], 800, 'B kent niemand anders');
  assert.ok(uit.modi.onbekend.duur[A] === undefined, 'A is elders gedekt');
  const alle = new Set();
  for (const m of Object.values(uit.modi)) for (const n of Object.keys(m.duur)) alle.add(n);
  assert.ok(alle.has(A) && alle.has(B), 'elk bestand houdt ergens een gewicht');
});

test('zonder een modus zonder modus valt er niets op te ruimen', () => {
  const uit = metModi({ dekking: vorm(5000) });
  assert.equal(uit.gelezen.opgeruimd, null);
});

test('de afdruk van het echte script blijft leesbaar', () => {
  const uit = bouwUit([[A, '1234', 'dekking', 'ci|v26|4|abc']]);
  assert.match(uit, /modus dekking/);
  assert.match(uit, /de verdeling over 4 scherven/);
});
