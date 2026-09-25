'use strict';
/* BETROUWBAARHEID.md par. 7, stap 1: van de knoppen die de proef niet kon
   aantikken, lag er bij 572 "iets overheen". Wat dat iets is -- een lade die een
   mens eerst dichttikt, of een balk die de knop voorgoed bedekt -- bepaalt of
   het een eigenschap van de proef is of een productdefect. appwerkt.js bewaart
   daarom het element uit de log van Playwright; deze toets houdt vast dat hij
   het juiste element leest. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { onderschepper } = require('../scripts/appwerkt');

test('het element dat de klik opving, als tag#id.klasse uit de log van Playwright', () => {
  assert.equal(onderschepper('  - <div class="edge-lade open" id="edgeLade">…</div> intercepts pointer events'),
    'div#edgeLade.edge-lade.open');
  assert.equal(onderschepper('<div role="dialog" class="modal"></div> intercepts pointer events'), 'div.modal');
});

test('bij een subtree telt de wortel die over de knop ligt, niet het kind', () => {
  assert.equal(onderschepper('<span class="label">Menu</span> from <nav id="schilbalk" class="rtg-balk vast">…</nav> subtree intercepts pointer events'),
    'nav#schilbalk.rtg-balk.vast');
});

test('geen element in de log is "onbekend", nooit een verzonnen naam', () => {
  assert.equal(onderschepper('Timeout 2500ms exceeded'), 'onbekend');
  assert.equal(onderschepper(''), 'onbekend');
});

/* Een weigering met een zin is pas een defect als het scherm die zin niet toont;
   daarvoor moet de zin eerst betrouwbaar uit het antwoord komen. */
test('de zin van een weigering komt uit {"error": ...}, en anders is er geen', () => {
  const { weigerZin } = require('../scripts/appwerkt');
  assert.equal(weigerZin('{"error":"Schrijf op wat er gebeurde."}'), 'Schrijf op wat er gebeurde.');
  assert.equal(weigerZin('{"error":"  "}'), null, 'een lege zin zegt de gebruiker niets');
  assert.equal(weigerZin('{"fout":"x"}'), null);
  assert.equal(weigerZin('<html>kapot</html>'), null, 'geen JSON is geen zin');
});

test('een lange weigering wordt als geheel gelezen, niet afgekapt', () => {
  const { weigerZin } = require('../scripts/appwerkt');
  const lang = JSON.stringify({ error: 'Hiervoor heb ik nog je paspoortgegevens nodig; dat vraag ik even.',
    soort: 'vlucht', ontbreekt: ['paspoortnummer', 'geldig tot', 'nationaliteit'], uitleg: 'x'.repeat(200) });
  assert.equal(weigerZin(lang), 'Hiervoor heb ik nog je paspoortgegevens nodig; dat vraag ik even.');
  assert.equal(weigerZin(lang.slice(0, 200)), null, 'zo zag de meter het vroeger: afgekapt is het geen JSON');
});
