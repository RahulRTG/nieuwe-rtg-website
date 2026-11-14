'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');

const pw = laadPlaywright();

test('Schermrust gebruikt het centrale venster en blijft volledig bedienbaar',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer();
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = letOpFouten(page, []);
    await page.goto(base + '/apps/vonk.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.Schermrust), null, { timeout: 10000 });
    await page.evaluate(() => window.Schermrust.forceer());
    await page.waitForSelector('.ds-schermrust[role="dialog"]');
    const vorm = await page.evaluate(() => {
      const venster = document.querySelector('.ds-schermrust');
      const knop = venster.querySelector('.ds-schermrust__doe');
      return {
        venster: getComputedStyle(venster).position,
        knop: getComputedStyle(knop).display,
        doel: Math.round(knop.getBoundingClientRect().height),
        inline: venster.getAttribute('style')
      };
    });
    assert.equal(vorm.venster, 'fixed');
    assert.equal(vorm.knop, 'block');
    assert.ok(vorm.doel >= 44, 'de primaire rustactie houdt een toegankelijk raakvlak');
    assert.equal(vorm.inline, null, 'het venster draagt geen inline presentatie');
    await page.click('.ds-schermrust__doe');
    await page.waitForSelector('.ds-schermrust', { state: 'detached' });
    await page.waitForSelector('.ds-schermrust__status');
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});
