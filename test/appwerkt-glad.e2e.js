/* DE BEDEKT-METING MAG NIET OP EEN ANIMATIE WACHTEN (scripts/appwerkt.js
   bedektDoorSchil, 6 oktober 2026).

   Een scherm met `scroll-behavior: smooth` laat scrollIntoView animeren. De
   meting keek meteen daarna en zag de knop nog op zijn oude plek, onder de
   balk: zo stond os-portaal.html als GEBLOKKEERD_DOOR_DEFECT terwijl een mens er
   na het scrollen gewoon bij kon. Twee knoppen op een synthetische pagina:
     - een onder de vouw die vrijkomt als je scrolt: NIET bedekt;
     - een tegenproef die vast onder de balk zit (fixed, geen scroll helpt):
       WEL bedekt, anders bewijst de eerste niets. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const PAGINA = '<!doctype html><html style="scroll-behavior:smooth"><body style="margin:0">' +
  /* de knop staat bij het laden IN beeld en ONDER de balk (530-570 bij een
     balk vanaf 520), zoals de tegels op os-portaal.html; er is ruimte genoeg
     om hem naar het midden te scrollen */
  '<div style="height:530px"></div>' +
  '<button id="vrij" style="display:block;height:40px">Onder de vouw</button>' +
  '<div style="height:1000px"></div>' +
  '<button id="vast" style="position:fixed;bottom:10px;left:10px;height:40px">Vast onder de balk</button>' +
  '<div class="rtg-edge-chrome" style="position:fixed;left:0;right:0;bottom:0;height:80px;background:#000"></div>' +
  '</body></html>';

test('de bedekt-meting scrolt direct: wat vrijkomt is niet bedekt, wat vastzit wel', { skip: geenBrowser(pw) }, async () => {
  const { bedektDoorSchil } = require('../scripts/appwerkt');
  const srv = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(PAGINA); });
  await new Promise((k) => srv.listen(0, '127.0.0.1', k));
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await page.goto('http://127.0.0.1:' + srv.address().port + '/');
    const uit = await bedektDoorSchil(page);
    assert.ok(!uit.some((r) => /Onder de vouw/.test(r)), 'een knop die bij het scrollen vrijkomt, is niet bedekt: ' + JSON.stringify(uit));
    assert.ok(uit.some((r) => /Vast onder de balk/.test(r)), 'de tegenproef: een knop die echt vastzit, wordt gemeld: ' + JSON.stringify(uit));
  } finally {
    await browser.close();
    srv.close();
  }
});
