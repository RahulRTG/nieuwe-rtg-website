/* Gerichte ontwikkelproef van de bestaande menu-owner op de drie echte PDA's.
   Geen APPWERKT- of EXPERIENCEWERKT-kwalificatie en geen API-stubs. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();
test('appmenu: bestaande PDA-acties zijn via de ene DS Edge bereikbaar op drie formaten', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { OFFICE_CODE: 'RTG-OFFICE', SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
  let browser;
  try {
    const r = await fetch(srv.base + '/api/office/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'RTG-OFFICE' }) });
    assert.equal(r.status, 200); const { token } = await r.json(); assert.ok(token);
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const bureau of ['studio', 'hardware', 'architect']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      try {
        await context.addInitScript(t => { localStorage.setItem('rtg_office_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
        const page = await context.newPage(), fouten = letOpFouten(page, []);
        await page.goto(srv.base + '/apps/' + bureau + '-pda.html', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.body.dataset.rtgDesktopState === 'ready' && !!window.RTGAppMenu && document.querySelectorAll('#pFilters button').length > 1);
        assert.equal(await page.locator('#amnCss').count(), 0, bureau + ': geen legacy-menu-injectie op DS');
        const knop = page.locator('#osMenuBtn'), actiesKnop = page.locator('.ds-edge__balk [data-ds-edge="acties"]');
        const menuKnop = page.locator('.ds-edge__balk [data-ds-edge="menu"]'), blad = page.locator('#dsEdgeBlad');
        assert.equal(await knop.count(), 1, 'de bestaande actie-owner blijft gemonteerd');
        assert.equal(await knop.isVisible(), false, 'de tweede hamburger is niet zichtbaar naast de DS Edge');
        for (const width of [390, 820, 1440]) {
          await page.setViewportSize({ width, height: 844 });
          for (const percentage of [100, 200]) {
            // Werkelijke tekstvergroting; geen claim over OS/browserzoom of alle apparaten.
            await page.evaluate(p => { document.documentElement.style.fontSize = p + '%'; }, percentage);
            await page.evaluate(() => scrollTo(0, 0));
            const kop = await page.locator('.ds-kop').evaluate(el => {
              const meet = n => { const s = getComputedStyle(n); return { naam: n.className, tekst: n.textContent.trim(), rect: n.getBoundingClientRect().toJSON(), display: s.display, width: s.width, minWidth: s.minWidth, maxWidth: s.maxWidth, grid: s.gridTemplateColumns, position: s.position, transform: s.transform, font: s.font, whiteSpace: s.whiteSpace, overflow: s.overflow }; };
              return { viewport: innerWidth, breed: document.documentElement.scrollWidth, kop: meet(el), parent: meet(el.parentElement), nodes: [...el.children].map(meet) };
            });
            assert.ok(kop.breed <= kop.viewport + 1, bureau + ' scherm op ' + width + '/' + percentage + ': ' + JSON.stringify(kop));
            for (const n of kop.nodes) assert.ok(n.rect.x >= -1 && n.rect.right <= width + 1, bureau + ': kop blijft binnen viewport op ' + width + '/' + percentage + ': ' + JSON.stringify(kop));
            const rect = await actiesKnop.boundingBox(); assert.ok(rect && rect.width >= 44 && rect.height >= 44, bureau + ': Edge-acties behouden aanraakruimte');
            await actiesKnop.click(); await blad.waitFor({ state: 'visible' });
            assert.equal(await blad.getAttribute('role'), 'dialog'); assert.equal(await blad.getAttribute('aria-modal'), 'false');
            const inhoud = await blad.evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, rect: el.getBoundingClientRect().toJSON(), viewport: { w: innerWidth, h: innerHeight },
              knoppen: [...el.querySelectorAll('button')].map(b => ({ width: b.getBoundingClientRect().width, height: b.getBoundingClientRect().height })) }));
            assert.ok(inhoud.scroll <= inhoud.width + 1, bureau + ': Edge-inhoud past op ' + width + '/' + percentage + ': ' + JSON.stringify(inhoud));
            assert.ok(inhoud.rect.x >= -1 && inhoud.rect.right <= inhoud.viewport.w + 1 && inhoud.rect.y >= -1 && inhoud.rect.bottom <= inhoud.viewport.h + 1);
            assert.ok(inhoud.knoppen.every(b => b.width >= 44 && b.height >= 44), 'alle zichtbare Edge-acties behouden 44px');
            await page.keyboard.press('Escape'); await blad.waitFor({ state: 'hidden' });
            await page.waitForFunction(() => document.activeElement === document.querySelector('[data-ds-edge="acties"]'));
          }
        }
        await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
        await page.setViewportSize({ width: 390, height: 844 });
        const filter = page.locator('#pFilters button').nth(1), label = (await filter.textContent()).trim();
        await actiesKnop.click(); await blad.getByRole('button', { name: label, exact: true }).click();
        await page.waitForFunction(tekst => [...document.querySelectorAll('#pFilters button')].some(b => b.textContent.trim() === tekst && b.getAttribute('aria-pressed') === 'true'), label);
        await blad.waitFor({ state: 'hidden' });
        await menuKnop.click(); await blad.getByRole('button', { name: 'Instellingen', exact: true }).click();
        const instellingen = page.locator('dialog.ds-instellingen');
        await instellingen.waitFor({ state: 'visible' }); await blad.waitFor({ state: 'hidden' });
        assert.equal(await page.locator('#bdnCss').count(), 0, bureau + ': DS-instellingen zonder legacy-injectie');
        await page.keyboard.press('Escape'); await instellingen.waitFor({ state: 'hidden' });
        await menuKnop.click(); await blad.waitFor({ state: 'visible' });
        await page.keyboard.press('Escape'); await blad.waitFor({ state: 'hidden' });
        assert.deepEqual(fouten, [], bureau + ': geen clientfouten');
      } finally { await context.close(); }
    }
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
