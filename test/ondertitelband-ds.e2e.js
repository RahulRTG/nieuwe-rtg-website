'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();

test('ondertitelband volgt tijd en blijft leesbaar op DS en bestaande mediahosts', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const ds of [true, false]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        const page = await ctx.newPage(), fouten = letOpFouten(page, []), pad = '/__ondertitel-' + (ds ? 'ds' : 'bestaand');
        await page.route('**' + pad, route => route.fulfill({ contentType: 'text/html', body:
          '<!doctype html><html lang="nl"' + (ds ? ' data-ds' : '') + '><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
          (ds ? '<link rel="stylesheet" href="/ds/rtg-ds.css">' : '<style>#vlak{position:relative;width:100%;height:320px;background:black}</style>') +
          '</head><body class="' + (ds ? 'ds-scherm' : '') + '"><main><div id="vlak" style="position:relative;height:320px"><video id="video"></video></div></main>' +
          '<script src="/shared/ondertitelband.js"></script><script>RTGOndertitelband.zet(vlak,video,[{van:1,tot:3,tekst:"Welkom bij RTG"}]);video.currentTime=2;video.dispatchEvent(new Event("timeupdate"));</script></body></html>' }));
        await page.goto(srv.base + pad, { waitUntil: 'load' });
        const band = page.locator('.ds-ondertitelband'); await band.waitFor();
        await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--ds-doel').trim() !== '');
        assert.equal(await page.locator('#rtgDsRuntimeCss').count(), ds ? 0 : 1);
        assert.equal(await band.textContent(), 'Welkom bij RTG');
        const staat = await band.locator('span').evaluate(el => ({ kleur: getComputedStyle(el).color,
          bg: getComputedStyle(el).backgroundColor, r: el.getBoundingClientRect().toJSON(), breed: document.documentElement.scrollWidth }));
        assert.notEqual(staat.kleur, staat.bg); assert.ok(staat.r.left >= -1 && staat.r.right <= 391 && staat.breed <= 390, JSON.stringify(staat));
        await page.evaluate(() => { video.dispatchEvent(new Event('ended')); });
        assert.equal(await band.textContent(), '');
        assert.deepEqual(fouten, []);
      } finally { await ctx.close(); }
    }
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
