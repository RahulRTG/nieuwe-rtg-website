/* Echte geo:-klik op een volledige DS-host en een bestaande host. Dit bewijst
   presentatie, focus en toegankelijkheid; parseGeo heeft zijn eigen unittests. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();

test('kaartuitwijk gebruikt op DS en legacy-host dezelfde toegankelijke dialoog', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const ds of [true, false]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        const page = await ctx.newPage(), fouten = letOpFouten(page, []);
        const pad = '/__kaart-' + (ds ? 'ds' : 'legacy');
        await page.route('**' + pad, route => route.fulfill({ contentType: 'text/html', body:
          '<!doctype html><html lang="nl"' + (ds ? ' data-ds="1"' : '') + '><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
          (ds ? '<link rel="stylesheet" href="/ds/rtg-ds.css">' : '') + '</head><body><main><a id="plek" href="geo:0,0?q=Herengracht+1+Amsterdam">Open locatie</a>' +
          '<input aria-label="Achtergrondconcept" value="blijft staan"></main><script src="/shared/kaart.js"></script></body></html>' }));
        await page.goto(srv.base + pad, { waitUntil: 'load' });
        const ingang = page.locator('#plek'); await ingang.click();
        const dialoog = page.getByRole('dialog', { name: 'Locatie', exact: true }); await dialoog.waitFor();
        if (ds) assert.equal(await page.locator('#rtgDsRuntimeCss').count(), 0);
        else assert.equal(await page.locator('#rtgDsRuntimeCss').getAttribute('href'), '/ds/rtg-ds.css');
        await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--ds-doel').trim() !== '');
        assert.equal(await dialoog.locator('.ds-kaartuitwijk__waarde').textContent(), 'Herengracht 1 Amsterdam');
        assert.equal(await page.getByLabel('Achtergrondconcept').inputValue(), 'blijft staan');
        for (const zoom of [100, 200]) {
          await page.evaluate(p => { document.documentElement.style.fontSize = p + '%'; }, zoom);
          const maten = await dialoog.evaluate(el => ({ r: el.getBoundingClientRect().toJSON(),
            knoppen: [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect().toJSON()), breed: document.documentElement.scrollWidth }));
          assert.ok(maten.r.left >= -1 && maten.r.right <= 391 && maten.r.top >= -1 && maten.r.bottom <= 845, JSON.stringify({ ds, zoom, maten }));
          assert.ok(maten.knoppen.every(r => r.width >= 44 && r.height >= 44));
          assert.ok(maten.breed <= 391);
        }
        assert.equal(await dialoog.getByRole('button', { name: 'Kopieer adres', exact: true }).evaluate(el => el === document.activeElement), true);
        await page.keyboard.press('Escape'); await dialoog.waitFor({ state: 'detached' });
        assert.equal(await ingang.evaluate(el => el === document.activeElement), true);
        assert.deepEqual(fouten, []);
      } finally { await ctx.close(); }
    }
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
