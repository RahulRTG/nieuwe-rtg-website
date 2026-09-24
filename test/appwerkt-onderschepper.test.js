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
