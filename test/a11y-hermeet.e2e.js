/* DE TWEEDE METING VAN DE A11Y-POORT (scripts/a11y-hermeet.js).

   Een poort die af en toe zomaar rood wordt, leert mensen om hem te negeren --
   en dan is hij erger dan geen poort. De a11y-scan had die eigenschap: twee
   volledige scans op dezelfde code gaven twee verschillende uitkomsten, met
   dezelfde bevinding op een ander scherm in een andere ronde. De oorzaak staat
   in a11y-hermeet.js; de reparatie is dat een bevinding zich twee keer moet
   melden voordat hij telt.

   Precies daar zit het gevaar van deze reparatie, en daarom deze toets: een
   tweede meting die bevindingen laat verdwijnen kan óók een ECHTE fout laten
   verdwijnen. Twee gevallen, naast elkaar, op hetzelfde scherm:

   1. EEN BLIJVEND TE BLEKE REGEL blijft in de tweede meting gewoon staan. Als
      dit ooit 0 wordt, is de poort stil opengezet.
   2. EEN REGEL DIE ZIJN GROND ALSNOG KRIJGT verdwijnt. Dat is het geval dat de
      scan onbetrouwbaar maakte.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const { BRON } = require('../scripts/a11ykeuring');
const hermeet = require('../scripts/a11y-hermeet');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hermeet-'));
const KEUR = '(function(){' + BRON + '\nreturn window.__a11yKeur()})()';
const vondIets = (r) => r.overtredingen.length || r.contrast.length;
const telContrast = (r) => r.contrast.reduce((n, v) => n + v.aantal, 0);

test('de tweede meting laat een echte contrastfout staan en een voorbijgaande vallen',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} });
    const page = await ctx.newPage();

    /* Een scherm dat zelf schoon is, zodat wat er gemeten wordt van deze toets
       komt en niet van de pagina. Blijkt het scherm zelf iets te melden, dan
       zegt de toets dat en meet hij niet stil iets anders. */
    await page.goto(base + '/site/404.html', { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const schoon = await page.evaluate(KEUR);
    assert.equal(telContrast(schoon), 0, 'het meetscherm is zelf schoon');

    const zet = (blijvend) => page.evaluate((b) => {
      const oud = document.getElementById('meetregel');
      if (oud) oud.remove();
      const d = document.createElement('p');
      d.id = 'meetregel';
      d.textContent = 'Een regel om aan te meten';
      d.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:#ffffff;color:#c9c9c9;font-size:12px';
      document.body.appendChild(d);
      // niet blijvend: hij krijgt na 200ms alsnog een grond waar hij op leesbaar is
      if (!b) setTimeout(() => { d.style.background = '#111111'; d.style.color = '#ffffff'; }, 200);
    }, blijvend);

    /* 1. blijvend -- moet blijven staan, anders is de poort stil opengezet */
    await zet(true);
    const eerst = await page.evaluate(KEUR);
    assert.equal(telContrast(eerst), 1, 'de eerste meting ziet de bleke regel');
    const echt = await hermeet(page, KEUR, vondIets);
    assert.equal(telContrast(echt), 1, 'en de tweede meting ziet hem nog steeds');

    /* 2. voorbijgaand -- moet vallen, want dat is waar deze routine voor is */
    await page.goto(base + '/site/404.html', { waitUntil: 'load' });
    await page.waitForTimeout(600);
    await zet(false);
    const vluchtig = await hermeet(page, KEUR, vondIets);
    assert.equal(telContrast(vluchtig), 0, 'een grond die er een tel later niet meer is, telt niet');

    /* 3. en zonder bevinding wordt er niet twee keer gemeten: de routine geeft
       de eerste uitkomst ongewijzigd terug. */
    await page.goto(base + '/site/404.html', { waitUntil: 'load' });
    await page.waitForTimeout(600);
    let metingen = 0;
    const tellend = { evaluate: (b) => { metingen++; return page.evaluate(b); },
      waitForFunction: page.waitForFunction.bind(page), waitForTimeout: page.waitForTimeout.bind(page) };
    await hermeet(tellend, KEUR, vondIets);
    assert.equal(metingen, 1, 'een schoon scherm kost een meting en geen twee');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
