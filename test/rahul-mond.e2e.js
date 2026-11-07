'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const { laadBrowser, browserOpties, geenBrowser } = require('./browser');
const pw = laadBrowser();

test('Rahul-mond opent direct, geeft focus en sluit met toetsenbord', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer();
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    const fouten = letOpFouten(page, []);
    await page.addInitScript(() => localStorage.setItem('rtg_sup_token', 'browser-proef'));
    await page.goto(srv.base + '/apps/office.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('#rahulFab', { state: 'attached' });
    assert.equal(await page.locator('#rahulFab').isVisible(), false, 'Rahul begint rustig weggelegd');

    await page.evaluate(() => window.RTGRahul.open());
    assert.equal(await page.locator('#rahulFab').isVisible(), true, 'Rahul is onmiddellijk terug');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.className), 'rm-veld');
    const maten = await page.locator('#rahulFab canvas').evaluate(el => {
      const r = el.getBoundingClientRect(); return { width: r.width, height: r.height, role: el.getAttribute('role') };
    });
    assert.ok(maten.width >= 44 && maten.height >= 44, JSON.stringify(maten));
    assert.equal(maten.role, 'button');

    await page.locator('#rahulFab canvas').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#rahulFab').isVisible(), false, 'Enter legt Rahul weer weg');
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    stop(srv);
  }
});
