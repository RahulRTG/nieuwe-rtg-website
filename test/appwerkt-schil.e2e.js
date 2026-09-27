/* BEDIENBAAR MEET HET SCHERM, NIET DE SCHIL -- in een echte browser.

   Een synthetisch scherm met de gedeelde schil erop (30 knoppen onder
   .rtg-edge-chrome, plus de toetsknop van het veeggebaar die met opzet buiten
   beeld staat) en drie eigen knoppen, waarvan een op vier kaarten staat. De
   proef hoort:
     1. alleen de eigen knoppen te tellen, en elke knop een keer (noemer 3);
     2. de schil apart te melden, en er niets van aan te tikken;
     3. de toetsknop niet als "niet aan te tikken" te melden.
   Voor 27 september 2026 telde de noemer 30 + 1 + 6 = 37 en tikte de proef de
   eerste 14 aan, allemaal schil: 111 van 112 rijen bleven NIET_GETEST. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const schil = '<div class="rtg-edge-chrome">' +
  Array.from({ length: 30 }, (_, i) => '<button type="button" onclick="window.schilGetikt=(window.schilGetikt||0)+1">Schil ' + i + '</button>').join('') +
  '</div><button type="button" class="rnd-toets" style="position:absolute;left:-9999px">Instellingen openen</button>';
const kaart = '<div class="kaart"><button type="button" onclick="window.eigen=(window.eigen||0)+1">Bekijken</button></div>';
const SCHERM = '<!doctype html><html><body><main>' +
  '<button type="button" onclick="window.eigen=(window.eigen||0)+1">Vernieuwen</button>' +
  '<button type="button" onclick="window.eigen=(window.eigen||0)+1">Filter</button>' +
  kaart + kaart + kaart + kaart + '</main>' + schil + '</body></html>';

test('bedienbaar telt de eigen knoppen, een keer elk, en laat de schil liggen', { skip: geenBrowser(pw) }, async () => {
  const { bedien } = require('../scripts/appwerkt');
  const srv = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(SCHERM); });
  await new Promise((k) => srv.listen(0, '127.0.0.1', k));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const b = await bedien(ctx, base, '/apps/x.html');
    assert.equal(b.gevonden, 3, 'drie eigen knoppen; vier keer "Bekijken" is een handeling');
    assert.equal(b.geklikt, 3, 'en alle drie zijn aangetikt');
    assert.equal(b.schil, 31, 'de schil wordt gemeld, met de toetsknop erbij');
    assert.deepEqual(b.nietKlikbaar, [], 'de toetsknop buiten beeld is geen bevinding over dit scherm');
    assert.ok(b.geklikt * 2 >= b.gevonden, 'met deze noemer is BEWEZEN haalbaar');
    await ctx.close();
  } finally {
    await browser.close(); srv.close();
  }
});
