/* De echte FocusUI-owner op een DS- en bestaande host. De proef bewaakt dat
   sluiten nooit inhoud of domein-hidden wijzigt, dat een oude display:grid-
   regel de toestand niet doorbreekt en dat vergrote tekst bedienbaar blijft. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();

test('FocusUI gebruikt op DS en bestaande hosts dezelfde toegankelijke kaarttoestand', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const ds of [true, false]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        const page = await ctx.newPage(), fouten = letOpFouten(page, []);
        const pad = '/__focus-' + (ds ? 'ds' : 'bestaand');
        await page.route('**' + pad, route => route.fulfill({ contentType: 'text/html', body:
          '<!doctype html><html lang="nl"' + (ds ? ' data-ds' : '') + '><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
          (ds ? '<link rel="stylesheet" href="/ds/rtg-ds.css">' : '<style>.kaart{display:grid}.kaart>p{display:block}</style>') +
          '</head><body class="' + (ds ? 'ds-scherm' : '') + '"><main><section class="kaart"><h2>Reservering</h2>' +
          '<label>Concept<input id="concept" value="blijft staan"></label><p id="status" data-fxtel>2</p><p id="privaat" hidden>Niet bevoegd</p></section>' +
          '<section class="kaart"><h2>Reisplan</h2><p>Plan</p></section><section class="kaart"><h2>Betaling</h2><p>Betaal</p></section>' +
          '</main><script src="/shared/focus.js" data-app="focus-proef-' + (ds ? 'ds' : 'oud') + '" data-kaart=".kaart" data-kop="h2"></script></body></html>' }));
        await page.goto(srv.base + pad, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.ds-focus-kop');
        await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--ds-doel').trim() !== '');
        assert.equal(await page.locator('#rtgDsRuntimeCss').count(), ds ? 0 : 1);
        const kop = page.getByRole('button', { name: 'Reservering in- of uitklappen', exact: true });
        assert.equal(await kop.getAttribute('aria-expanded'), 'true');
        await kop.focus();
        assert.equal(await kop.evaluate(el => el === document.activeElement && el.matches(':focus-visible') && parseFloat(getComputedStyle(el).outlineWidth) >= 2), true);
        const doel = await kop.evaluate(el => el.getBoundingClientRect().height);
        assert.ok(doel >= 44, String(doel));
        await page.keyboard.press('Enter');
        assert.equal(await kop.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('#concept').evaluate(el => !el.checkVisibility()), true);
        assert.equal(await page.locator('#privaat').evaluate(el => el.hidden && !el.checkVisibility()), true);
        assert.equal(await kop.locator('.ds-focus-badge').textContent(), '2');
        await page.evaluate(() => {
          const extra = document.createElement('p'); extra.id = 'later'; extra.textContent = 'Later toegevoegd';
          document.querySelector('.kaart').appendChild(extra);
        });
        await page.waitForFunction(() => !document.getElementById('later').checkVisibility());
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('#concept').inputValue(), 'blijft staan');
        assert.equal(await page.locator('#later').evaluate(el => el.checkVisibility()), true);
        assert.equal(await page.locator('#privaat').evaluate(el => el.hidden && !el.checkVisibility()), true);
        await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
        const maat = await kop.evaluate(el => ({ r: el.getBoundingClientRect().toJSON(), breed: document.documentElement.scrollWidth,
          over: [...document.querySelectorAll('*')].map(n => ({ n: n.tagName + '.' + n.className, r: n.getBoundingClientRect().toJSON(), sw: n.scrollWidth, cw: n.clientWidth }))
            .filter(x => x.r.right > innerWidth + 1 || x.sw > x.cw + 1).slice(0, 8) }));
        assert.ok(maat.r.left >= -1 && maat.r.right <= 391 && maat.r.height >= 44 && maat.breed <= 390, JSON.stringify(maat));
        assert.deepEqual(fouten, []);
      } finally { await ctx.close(); }
    }
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
