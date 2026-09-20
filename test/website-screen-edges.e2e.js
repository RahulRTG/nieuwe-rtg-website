'use strict';
/* DE PUBLIEKE SCHERMRAND IS EEN CONTRACT, GEEN LOSSE MOBIELE MARGE.

   De fout die deze proef bewaakt was zichtbaar op een echte telefoon maar niet
   in document.scrollWidth: een flexkind nam de breedte van het lange woord
   "Vertrouwensarchitectuur" aan, waarna de hero met overflow:hidden de rechter-
   helft afknipte. Tegelijk hield de zwevende Edge alleen rekening met 100vw en
   de onderste safe area; ongelijke linker- en rechterinzetten konden hem uit het
   optische midden trekken en het geopende wereldpaneel kon tegen de bovenrand
   lopen.

   Daarom meet deze proef de UITKOMST op de startpagina en alle vier publieke
   wereldpagina's, op vijf maten van 320px telefoon tot 1440px desktop:
   - geen documentoverloop;
   - hoofdteksten en inhoudskaders blijven werkelijk binnen de viewport;
   - een lange Nederlandse samenstelling blijft binnen iedere wereldhero;
   - de Adaptive Edge houdt aan beide kanten een rand;
   - het geopende wereldpaneel blijft tussen de bovenrand en zijn eigen balk.

   De lange kop wordt in de toets bewust in de bestaande hero gezet. Zo zakt de
   proef weer als iemand alleen overflow:hidden terugzet: afknippen is geen
   geldige oplossing voor een breedtefout. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop } = require('./helper');
const pw = laadPlaywright();

const ROUTES = [
  '/',
  '/site/werelden/livingos.html',
  '/site/werelden/travelos.html',
  '/site/werelden/workos.html',
  '/site/werelden/foundationos.html',
  '/site/passen/community.html',
  '/site/passen/rtg-pass.html',
  '/site/passen/business-lite.html',
  '/site/passen/business-pass.html',
  '/site/passen/lifestyle-pass.html'
];
const VIEWPORTS = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 834, height: 1112 },
  { width: 1440, height: 900 }
];

async function randmeting(page) {
  return page.evaluate(() => {
    const zichtbaar = el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 &&
        r.width > 0 && r.height > 0;
    };
    const begrensd = [...document.querySelectorAll('h1,h2,h3,.story-inner,.scene-heading,.simulation,.world-room>div,.foundation-copy')]
      .filter(zichtbaar).map(el => {
        const r = el.getBoundingClientRect();
        return { naam: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\s+/)[0] : ''),
          links: r.left, rechts: r.right };
      }).filter(r => r.links < -1 || r.rechts > innerWidth + 1);
    return {
      breedte: innerWidth,
      overloop: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - innerWidth,
      begrensd
    };
  });
}

test('publieke website houdt tekst, inhoud en Edge binnen alle schermranden',
  { skip: geenBrowser(pw), timeout: 180000 }, async () => {
    const { child, base } = await startServer({ env: { SMTP_URL: '' } });
    let browser;
    try {
      browser = await pw.chromium.launch(browserOpties(pw));
      const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' });
      const page = await context.newPage();
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        for (const route of ROUTES) {
          await page.goto(base + route, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => document.documentElement.dataset.websiteTruth);
          assert.equal(await page.evaluate(() => document.documentElement.dataset.websiteTruth), 'actueel',
            route + ' kon de actuele appwaarheid niet laden');
          if (route === '/') await page.waitForFunction(() => document.body.dataset.rtgAdaptiveReady === 'true');
          const gemeten = await randmeting(page);
          assert.ok(gemeten.overloop <= 1, route + ' loopt ' + gemeten.overloop + 'px buiten ' + viewport.width);
          assert.deepEqual(gemeten.begrensd, [], route + ' knipt inhoud af: ' + JSON.stringify(gemeten.begrensd));

          if (route !== '/') {
            await page.locator('.world-hero h1').evaluate(el => { el.textContent = 'Vertrouwensarchitectuur'; });
            const langWoord = await page.locator('.world-hero h1').boundingBox();
            assert.ok(langWoord.x >= -1 && langWoord.x + langWoord.width <= viewport.width + 1,
              route + ' houdt een lange Nederlandse samenstelling binnen de hero');
            continue;
          }

          const rand = page.locator('.rtg-adaptive-edge');
          const bar = page.locator('.rtg-adaptive-bar');
          let vak = await rand.boundingBox();
          assert.ok(vak.x >= 5 && vak.x + vak.width <= viewport.width - 5,
            'Edge houdt een tastbare zijmarge op ' + viewport.width);
          await bar.getByRole('button', { name: 'Werelden', exact: true }).click();
          const paneel = await page.locator('.rtg-adaptive-sheet').boundingBox();
          const balk = await bar.boundingBox();
          assert.ok(paneel.x >= vak.x - 1 && paneel.x + paneel.width <= vak.x + vak.width + 1,
            'wereldpaneel blijft binnen de Edge op ' + viewport.width);
          assert.ok(paneel.y >= -1 && paneel.y + paneel.height <= balk.y + 17,
            'wereldpaneel blijft tussen bovenrand en navigatie op ' + viewport.width);
          await page.keyboard.press('Escape');
        }
      }
      await context.close();
    } finally {
      if (browser) await browser.close();
      await stop(child);
    }
  });
