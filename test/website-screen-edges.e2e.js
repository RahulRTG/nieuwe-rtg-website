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
    const reading = window.RTGPublicApp?.shell.context?.() || window.RTGPublicDetail?.context?.();
    const zichtbaar = el => {
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      const leaf = el.closest('[data-issue-page],[data-reel-page]');
      if (leaf && leaf !== reading?.node) return false; // de andere bladen worden afzonderlijk bezocht
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 &&
        el.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}) && r.width > 0 && r.height > 0;
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
      const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'nl-NL' });
      await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
      const page = await context.newPage();
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        for (const route of ROUTES) {
          await page.goto(base + route, { waitUntil: 'domcontentloaded' });
          await page.waitForFunction(() => document.documentElement.dataset.websiteTruth);
          assert.equal(await page.evaluate(() => document.documentElement.dataset.websiteTruth), 'actueel',
            route + ' kon de actuele appwaarheid niet laden');
          if (route === '/') await page.waitForFunction(() => document.body.dataset.rtgAdaptiveReady === 'true');
          else await page.waitForFunction(() => document.body.dataset.publicEdgeReady === 'true');
          await page.evaluate(() => document.fonts.ready);
          const track = page.locator('[data-magazine-carousel],[data-reel-track]');
          const ids = await track.count() ? await track.locator('[data-issue-page],[data-reel-page]').evaluateAll(nodes => nodes.map(n=>n.id)) : [];
          if (ids.length) { await track.focus(); await page.keyboard.press('Home'); }
          for (let index=0;index<Math.max(1,ids.length);index++) {
            if (ids.length) await page.waitForFunction(i => (window.RTGPublicApp?.shell.context?.() || window.RTGPublicDetail?.context?.()).index === i,index);
            const gemeten = await randmeting(page);
            assert.ok(gemeten.overloop <= 1, route + ' loopt ' + gemeten.overloop + 'px buiten ' + viewport.width);
            assert.deepEqual(gemeten.begrensd, [], route + ' blad ' + (index+1) + ' knipt inhoud af: ' + JSON.stringify(gemeten.begrensd));
            if (ids.length) {
              const active = track.locator('[data-issue-page],[data-reel-page]').nth(index);
              const bounds = await active.boundingBox();
              assert.ok(bounds.x>=-1&&bounds.x+bounds.width<=viewport.width+1,route+' actief blad is bereikbaar: '+index);
              const preview = active.locator('[data-read-leaf]');
              if (await active.evaluate(el=>el.classList.contains('ds-issue-condensed'))) {
                assert.equal(await preview.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'volledige inhoud blijft via de leesingang bereikbaar');
              }
              if(index<ids.length-1)await page.keyboard.press('ArrowRight');
            }
          }
          if(ids.length){await page.keyboard.press('Home');await page.waitForFunction(()=>(window.RTGPublicApp?.shell.context?.()||window.RTGPublicDetail?.context?.()).index===0);}

          if (route !== '/') {
            await page.locator('.world-hero h1').evaluate(el => { el.textContent = 'Vertrouwensarchitectuur'; });
            const langWoord = await page.locator('.world-hero h1').boundingBox();
            assert.ok(langWoord.x >= -1 && langWoord.x + langWoord.width <= viewport.width + 1,
              route + ' houdt een lange Nederlandse samenstelling binnen de hero');
          }

          const rand = page.locator('.rtg-adaptive-edge');
          const bar = page.locator('.rtg-adaptive-bar');
          assert.equal(await bar.isVisible(),false,'de publieke Edge begint gesloten');
          await page.locator('.ds-public-edge-toggle').click();
          let vak = await rand.boundingBox();
          assert.ok(vak.x >= 5 && vak.x + vak.width <= viewport.width - 5,
            'Edge houdt een tastbare zijmarge op ' + viewport.width);
          await bar.locator('[data-rtg-adaptive-action="worlds"]').click();
          const paneel = await page.locator('.rtg-adaptive-sheet').boundingBox();
          assert.equal(await bar.isVisible(),true,'the expanded screen grows from the still-reachable Edge bar');
          assert.ok(paneel.x >= vak.x - 1 && paneel.x + paneel.width <= vak.x + vak.width + 1,
            'wereldpaneel blijft binnen de Edge op ' + viewport.width);
          assert.ok(paneel.y >= -1 && paneel.y + paneel.height <= viewport.height - 5,
            'het ene wereldpaneel blijft binnen de schermranden op ' + viewport.width);
          await page.keyboard.press('Escape');
        }
      }
      await context.close();
    } finally {
      if (browser) await browser.close();
      await stop(child);
    }
  });
