/* DE METER OP EEN SYNTHETISCH SCHERM -- de regressiefixture voor bedienbaar.

   Op 24 september 2026 bleek `bedienbaar` vier fouten in de METER te hebben:
   een navigerende tik liet de lus stoppen, panelen die de proef zelf opende
   groeiden de noemer aan, de gedeelde schil zat in de noemer van elke app, en
   het budget kon de drempel niet halen. Dit scherm bevat ze alle vier met opzet:

     APP     7 knoppen die te raken zijn (pas na 800 ms zichtbaar); A6 opent een paneel met 20 nieuwe
             knoppen, A5 navigeert weg naar een pagina zonder knoppen, A7 vervangt de
             inhoud zonder te navigeren (een standwissel, gevonden op 24 september)
     SCHIL   30 knoppen in `div.rtg-edge-chrome`, waarvan 15 onder een laag;
             S1 navigeert weg

   De waarheid die hier vastligt, ongeacht die vijftig schil- en paneelknoppen:
     - de app-noemer is 7, en de proef raakt alle 7 (ook na de navigatie van A5
       en de standwissel van A7);
     - de schil-noemer is 15, en de navigatie van S1 laat die meting niet stoppen.

   Verandert iemand de selectie en springt de noemer naar 56, of stopt de lus
   weer op een lege vreemde pagina, dan zakt deze toets. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const knoppen = (voor, n, extra) => Array.from({ length: n }, (_, i) =>
  '<button type="button" ' + (extra ? extra(i + 1) : '') + '>' + voor + (i + 1) + '</button>').join('');

const SCHERM = '<!doctype html><html><head><meta charset="utf-8"><style>' +
  'body{margin:0;font:14px sans-serif} button{margin:2px;padding:4px 6px}' +
  '.rtg-edge-chrome{position:fixed;left:0;top:0;width:1200px;height:80px;background:#eee}' +
  '.rij{height:40px;white-space:nowrap}' +
  '.dek{position:fixed;left:0;top:40px;width:1200px;height:40px;background:rgba(0,0,0,.3);z-index:10}' +
  'main{margin-top:120px}' +
  '</style></head><body>' +
  '<div class="rtg-edge-chrome"><div class="rij">' +
  knoppen('S', 15, (i) => (i === 1 ? 'onclick="location.href=\'/weg.html\'"' : '')) +
  '</div><div class="rij">' + knoppen('T', 15) + '</div></div>' +
  '<div class="dek"></div>' +
  /* De app-knoppen BESTAAN pas na 800 ms, zoals op een echt scherm dat zijn
     inhoud na het laden opbouwt. Eerst stonden ze verborgen in de DOM, en toen
     kon een terugkeer zonder te wachten niet zakken: Playwright wacht bij een tik
     zelf tot een verborgen knop zichtbaar wordt, en maskeerde zo de wachttijd.
     Een fixture die sneller is dan de werkelijkheid, bewijst niets over wachten. */
  '<main id="app"></main><script>setTimeout(function(){document.getElementById(\'app\').innerHTML=' +
  JSON.stringify(knoppen('A', 4) +
    '<button type="button" onclick="location.href=\'/weg.html\'">A5</button>' +
    /* A7 vervangt de hele inhoud ZONDER te navigeren, zoals een scherm dat na een
       tik een andere stand neerzet (Mijn leven, Reizen & Veilig). De knoppen
       erna bestaan dan niet meer tot de proef terugkeert naar de landing. */
    '<button type="button" onclick="document.getElementById(\'app\').innerHTML=\'<p>Andere stand</p>\'">A7</button>' +
    /* A6 opent een paneel met 20 knoppen, en die horen NIET in de noemer. Met een
       lus en niet met een HTML-tekenreeks: de eerste versie brak op de
       aanhalingstekens en zette de paneelknoppen al bij het laden neer. */
    '<button type="button" onclick="for(var i=1;i<=20;i++){var b=document.createElement(\'button\');' +
    'b.type=\'button\';b.textContent=\'P\'+i;document.getElementById(\'app\').appendChild(b);}">A6</button>')
    .replace(/</g, '\\u003c') +
  ';},800);</script></body></html>';

function serveer() {
  return new Promise((klaar) => {
    const srv = http.createServer((req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(req.url.startsWith('/weg.html') ? '<!doctype html><html><body><p>Ergens anders.</p></body></html>' : SCHERM);
    });
    srv.listen(0, '127.0.0.1', () => klaar(srv));
  });
}

test('de meter telt de app en niet de schil, bevriest zijn noemer, en overleeft navigatie',
  { skip: geenBrowser(pw) }, async () => {
    const { bedien } = require('../scripts/appwerkt');
    const srv = await serveer();
    const base = 'http://127.0.0.1:' + srv.address().port;
    const browser = await pw.chromium.launch(browserOpties(pw));
    try {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

      const app = await bedien(ctx, base, '/scherm.html', 'app');
      assert.equal(app.trechter.noemer, 7, 'de app-noemer is 7: niet de 30 schilknoppen en niet de 20 paneelknoppen');
      assert.equal(app.plan.drempel, 4);
      assert.equal(app.uitslag.gelukt, 7, 'alle zeven app-knoppen geraakt, ook na de navigatie van A5 en de standwissel van A7');
      assert.equal(app.uitslag.nietMeerGevonden, 0);
      assert.ok(app.uitslag.teruggekeerd >= 1, 'A5 navigeerde weg; de proef had terug moeten keren');
      assert.equal(app.trechter.stadia.schil.dom, 30);
      assert.equal(app.trechter.stadia.schil.raakbaar, 15, 'de 15 schilknoppen onder de laag zijn niet te raken');

      const schil = await bedien(ctx, base, '/scherm.html', 'schil');
      assert.equal(schil.trechter.noemer, 15, 'de schil-noemer is de 15 knoppen die te raken zijn');
      assert.equal(schil.uitslag.gelukt, 15, 'de navigatie van S1 laat de schilmeting niet stoppen');
      assert.ok(schil.uitslag.teruggekeerd >= 1);
      await ctx.close();
    } finally {
      await browser.close();
      srv.close();
    }
  });
