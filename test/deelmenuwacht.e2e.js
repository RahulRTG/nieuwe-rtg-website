/* ============================================================================
   DE WACHT VAN HET DEELMENU, OP EEN PAGINA DIE VERDER NIETS DOET.

   WAAROM DEZE TOETS ER IS -- eerlijkheidspunt 6.2

   `shared/deelmenu.js` kijkt met een MutationObserver of een app zijn schermen
   alsnog neerzet. Die observer stond eerst op alleen de DIRECTE kinderen van
   <main>, en dat was te krap: de meeste apps renderen niet in main zelf maar in
   een laag daarbinnen (main > wrap > kaarten). De reparatie was `subtree: true`.

   Alleen: de mutatie die dat moest BEWIJZEN sloeg af. Zet je `subtree` terug op
   false, dan bleef de bestaande toets groen -- niet omdat de reparatie er niet
   toe deed, maar omdat `shared/desktopframe.js` op elke app-pagina toevallig
   main zelf aanraakt en de wacht zo alsnog wekt. De toets bewees dus iets
   anders dan hij zei, en dat stond als eerlijkheidspunt 6.2 open.

   HOE HET HIER WEL KAN. Deze toets zet de wacht neer op een pagina waar verder
   NIETS gebeurt: geen desktopframe, geen metgezel, geen app. Alleen een <main>
   met een lege laag erin, en `shared/deelmenu.js`. Daarna komen er drie kaarten
   in die LAAG -- dus niet als direct kind van main. Wekt de wacht dan niet, dan
   komt er geen menu, en dat is precies de bewering.

   WAAROM DIE PAGINA NIET IN public/ STAAT. Een proefpagina op schijf is een
   scherm erbij in scripts/schermen.js, en dan zou een toetshulpstuk de
   schermdekking vertroebelen. Playwright vangt daarom het verzoek af en levert
   de pagina zelf, op dezelfde herkomst -- zo laadt /shared/deelmenu.js gewoon
   van de server en klopt de opstelling verder helemaal.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-deelwacht-'));

/* De kale pagina. main > #laag, en #laag is bij het laden LEEG -- dan telt
   deelmenu.js nul delen en bouwt hij niets. Dat is de beginstand die de toets
   nodig heeft: alles wat daarna verschijnt, komt van de wacht. */
const PAGINA = '<!doctype html><html lang="nl"><head><meta charset="utf-8">' +
  '<title>proef deelmenu-wacht</title></head><body>' +
  '<main id="main"><div id="laag"></div></main>' +
  '<script src="/shared/deelmenu.js"></script>' +
  '</body></html>';

const PROEFPAD = '/apps/zz-deelmenu-wacht-proef.html';

/* Drie kaarten met elk een eigen kop: dat is wat bouw() als drie delen ziet, en
   drie is het minimum waaronder het menu bewust niets doet. */
const DRIE_KAARTEN =
  '<div class="kaart"><h2>Eerste deel</h2><p>een</p></div>' +
  '<div class="kaart"><h2>Tweede deel</h2><p>twee</p></div>' +
  '<div class="kaart"><h2>Derde deel</h2><p>drie</p></div>';

test('de wacht wordt wakker van een verandering DIEP in main, niet alleen op zijn kinderen',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.route('**' + PROEFPAD, route =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGINA }));

    await page.goto(base + PROEFPAD, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.RTGDeel, null, { timeout: 8000 });

    /* EERST DE BEGINSTAND. Zonder deze regel zou de toets ook slagen als het
       menu er altijd al stond, en dan bewijst hij niets over de wacht. */
    const voor = await page.evaluate(() => document.querySelectorAll('.rtgdeel-balk').length);
    assert.equal(voor, 0, 'bij het laden staat er nog geen menu (de laag is leeg)');

    /* En nu de mutatie waar het om gaat: de kaarten komen in #laag, dus NIET
       als direct kind van main. Op `subtree: false` ziet de observer dit niet. */
    await page.evaluate(html => { document.getElementById('laag').innerHTML = html; }, DRIE_KAARTEN);
    await page.waitForTimeout(700);   // de wacht kijkt 120 ms na de laatste rust

    const balken = await page.evaluate(() => document.querySelectorAll('.rtgdeel-balk').length);
    assert.equal(balken, 1, 'de wacht is wakker geworden en heeft het menu gebouwd');

    /* En het menu klopt ook echt: drie knoppen met de drie koppen, en er staat
       er precies EEN deel open. Anders zou een lege balk al slagen. */
    const menu = await page.evaluate(() => ({
      knoppen: Array.from(document.querySelectorAll('.rtgdeel-balk button')).map(b => b.textContent.trim()),
      zichtbaar: Array.from(document.querySelectorAll('#laag .kaart'))
        .filter(k => !k.classList.contains('rtgdeel-weg')).length
    }));
    assert.deepEqual(menu.knoppen, ['Eerste deel', 'Tweede deel', 'Derde deel'],
      'de drie koppen staan als knop in de balk');
    assert.equal(menu.zichtbaar, 1, 'en er staat precies een deel open');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('een pagina met minder dan drie delen krijgt bewust GEEN menu',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  /* De andere kant van dezelfde belofte. Zonder deze helft zou de toets
     hierboven ook slagen als de wacht bij ELKE verandering een balk plakt, en
     dan is "een menu bij drie delen" geen regel maar toeval. De kop van
     deelmenu.js zegt het met zoveel woorden: bij minder dan drie delen is een
     menu alleen maar drukte. */
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.route('**' + PROEFPAD, route =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGINA }));
    await page.goto(base + PROEFPAD, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.RTGDeel, null, { timeout: 8000 });

    await page.evaluate(() => {
      document.getElementById('laag').innerHTML =
        '<div class="kaart"><h2>Enig deel</h2><p>een</p></div>' +
        '<div class="kaart"><h2>Tweede deel</h2><p>twee</p></div>';
    });
    await page.waitForTimeout(700);

    const balken = await page.evaluate(() => document.querySelectorAll('.rtgdeel-balk').length);
    assert.equal(balken, 0, 'bij twee delen blijft de pagina een gewone rol');
    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
