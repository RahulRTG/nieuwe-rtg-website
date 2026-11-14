'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();

test('scanner houdt zonder cameramodule een toegankelijke handmatige uitweg', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    try {
      const page = await ctx.newPage(), fouten = letOpFouten(page, []), pad = '/__scanknop-ds';
      await page.route('**' + pad, route => route.fulfill({ contentType: 'text/html', body:
        '<!doctype html><html lang="nl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ds/rtg-ds.css"></head>' +
        '<body><button id="open">Open scanner</button><script src="/shared/scanknop.js"></script><script>document.getElementById("open").onclick=()=>RTGScanknop.open({titel:"Code scannen",onCode:x=>{window.uit=x.tekst}})</script></body></html>' }));
      await page.goto(srv.base + pad, { waitUntil: 'domcontentloaded' }); await page.locator('#open').click();
      const dialoog = page.getByRole('dialog', { name: 'Code scannen', exact: true }); await dialoog.waitFor();
      assert.equal(await dialoog.getAttribute('aria-modal'), 'true');
      const hand = dialoog.locator('.rtg-scan-hand'); await hand.waitFor({ state: 'visible' });
      const maten = await dialoog.evaluate(el => ({ breed: document.documentElement.scrollWidth,
        knoppen: [...el.querySelectorAll('button')].map(b => b.getBoundingClientRect().toJSON()) }));
      assert.ok(maten.breed <= 390 && maten.knoppen.every(r => r.width >= 44 && r.height >= 44), JSON.stringify(maten));
      await hand.locator('input').fill('RTG-123'); await hand.locator('button').click();
      assert.equal(await page.evaluate(() => window.uit), 'RTG-123');
      assert.equal(await dialoog.count(), 0); assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
