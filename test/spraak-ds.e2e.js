'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();

test('spraakbediening gebruikt op DS en legacy dezelfde bereikbare centrale presentatie', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      class Herkenner {
        constructor() { this.events = {}; window.rtgHerkenner = this; }
        addEventListener(name, fn) { this.events[name] = fn; }
        start() { this.started = true; }
      }
      window.SpeechRecognition = Herkenner;
    });
    try {
      for (const variant of ['ds', 'legacy']) {
        const page = await ctx.newPage(), fouten = letOpFouten(page, []), pad = '/__spraak-' + variant;
        await page.route('**' + pad, route => route.fulfill({ contentType: 'text/html', body:
          '<!doctype html><html lang="nl"' + (variant === 'ds' ? ' data-ds' : '') + '><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
          (variant === 'ds' ? '<link rel="stylesheet" href="/ds/rtg-ds.css">' : '') + '</head><body><button id="spraak" aria-label="Spreek opdracht"></button>' +
          '<output id="uit"></output><script src="/shared/spraak.js"></script><script>Spraak.koppel(document.getElementById("spraak"),{opTekst:t=>document.getElementById("uit").textContent=t})</script></body></html>' }));
        await page.goto(srv.base + pad, { waitUntil: 'networkidle' });
        const knop = page.getByRole('button', { name: 'Spreek opdracht' });
        await knop.focus();
        const rust = await knop.evaluate(el => ({ className:el.className, width:el.getBoundingClientRect().width,
          height:el.getBoundingClientRect().height, focus:getComputedStyle(el).outlineStyle,
          dsLinks:document.querySelectorAll('link[href="/ds/rtg-ds.css"]').length, icon:el.innerHTML }));
        assert.match(rust.className,/ds-spraakknop/); assert.ok(rust.width >= 44 && rust.height >= 44, JSON.stringify(rust));
        assert.notEqual(rust.focus,'none'); assert.match(rust.icon,/<rect/);
        assert.equal(rust.dsLinks,1,variant+' heeft precies één DS-root');
        await knop.click(); assert.equal(await page.evaluate(() => window.rtgHerkenner.started),true);
        assert.match(await knop.innerHTML(),/<circle/);
        await page.evaluate(() => {
          window.rtgHerkenner.events.result({results:[[{transcript:'  open agenda  '}]]});
          window.rtgHerkenner.events.end();
          document.documentElement.style.fontSize='200%';
        });
        assert.equal(await page.locator('#uit').textContent(),'open agenda'); assert.match(await knop.innerHTML(),/<rect/);
        const groot = await knop.boundingBox(); assert.ok(groot.width >= 44 && groot.height >= 44, JSON.stringify(groot));
        assert.deepEqual(fouten,[]); await page.close();
      }
    } finally { await ctx.close(); }
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
