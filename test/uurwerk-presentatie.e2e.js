'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();

test('Uurwerk laadt één statisch blad en houdt de decoratieve ganglijn rustig', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1' } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  const page = await context.newPage(), fouten = letOpFouten(page, []);
  try {
    await page.goto(srv.base + '/apps/leven.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#rtgUurwerkCss').waitFor({ state: 'attached', timeout: 15000 });
    await page.locator('#rtgGanglijn').waitFor({ timeout: 15000 });
    assert.equal(await page.locator('#rtgUurwerkCss').count(), 1);
    assert.equal(await page.locator('#rtg-horlogetaal,#rtg-uurwerk-stijl').count(), 0);
    const stand = await page.locator('#rtgGanglijn').evaluate(el => ({ hidden: el.getAttribute('aria-hidden'),
      pointer: getComputedStyle(el).pointerEvents, animatie: getComputedStyle(el.querySelector('i')).animationName }));
    assert.deepEqual(stand, { hidden: 'true', pointer: 'none', animatie: 'none' });
    assert.deepEqual(fouten, []);
  } finally { await context.close(); await browser.close(); await stop(srv.child); }
});
