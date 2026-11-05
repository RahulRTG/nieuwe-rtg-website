/* De levende kleurmotor blijft rekenowner; DS presenteert hetzelfde vlak op
   een volledige DS-host en een bestaande host. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();

test('inlogkleur gebruikt op DS en bestaande hosts dezelfde centrale component', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const ds of [true, false]) {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
      try {
        const page = await ctx.newPage(), fouten = letOpFouten(page, []), pad = '/__inlogkleur-' + (ds ? 'ds' : 'bestaand');
        await page.route('**' + pad + '*', route => route.fulfill({ contentType: 'text/html', body:
          '<!doctype html><html lang="nl"' + (ds ? ' data-ds' : '') + '><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
          (ds ? '<link rel="stylesheet" href="/ds/rtg-ds.css">' : '<style>#gate{min-height:100vh;color:white}</style>') +
          '</head><body class="' + (ds ? 'ds-scherm' : '') + '"><main id="gate" data-inlogkleur><h1>Welkom</h1><input aria-label="Code" value="blijft staan"></main>' +
          '<script src="/shared/inlogkleur.js"></script></body></html>' }));
        await page.goto(srv.base + pad + '?uur=18.5&dag=200&seizoen=zomer', { waitUntil: 'load' });
        await page.waitForFunction(() => document.getElementById('gate').classList.contains('ds-inlogkleur') &&
          getComputedStyle(document.documentElement).getPropertyValue('--inlog-basis').trim() !== '' &&
          getComputedStyle(document.documentElement).getPropertyValue('--ds-doel').trim() !== '');
        assert.equal(await page.locator('#rtgDsRuntimeCss').count(), ds ? 0 : 1);
        const toestand = await page.locator('#gate').evaluate(el => ({ vlak: el.getAttribute('data-rtg-vlak'),
          achtergrond: getComputedStyle(el).backgroundImage, breed: document.documentElement.scrollWidth }));
        assert.equal(toestand.vlak, 'onyx');
        assert.match(toestand.achtergrond, /radial-gradient/);
        assert.ok(toestand.breed <= 390, JSON.stringify(toestand));
        assert.equal(await page.getByLabel('Code').inputValue(), 'blijft staan');
        assert.deepEqual(fouten, []);
      } finally { await ctx.close(); }
    }
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
