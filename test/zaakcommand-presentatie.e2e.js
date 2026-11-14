'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { laadBrowser, browserOpties, geenBrowser } = require('./browser');
const pw = laadBrowser();

test('Zaak Command tekent dezelfde regie bruikbaar in een echte mobiele browser', { skip: geenBrowser(pw) }, async () => {
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent('<!doctype html><html><head></head><body><main id="regie"></main></body></html>');
    await page.addStyleTag({ path: path.join(__dirname, '../public/ds/tokens.css') });
    await page.addStyleTag({ path: path.join(__dirname, '../public/ds/componenten/zaakcommand.css') });
    await page.addScriptTag({ path: path.join(__dirname, '../public/shared/zaakcommand.js') });
    await page.evaluate(() => {
      const start = { puls: {
        stand: 'rustig', signalen: [], herstel: { kandidaten: 0, lijst: [] },
        uitzonderingen: { open: 0 }
      } };
      RTGZaakCommand.toon(document.getElementById('regie'), {
        compact: true,
        api: async pad => pad === 'start' ? start : { zaken: [], leerpunten: [] }
      });
    });

    await page.waitForSelector('.zc-tegels');
    assert.equal(await page.locator('.zc-rail button').count(), 3);
    assert.match(await page.locator('.zc-vak').textContent(), /Er wacht niets op u/);
    const maten = await page.locator('.zc-rail button').first().evaluate(el => {
      const r = el.getBoundingClientRect(); return { height: r.height, width: r.width };
    });
    assert.ok(maten.height >= 44, JSON.stringify(maten));
    assert.equal(await page.locator('#regie').evaluate(el => el.classList.contains('zc-klein')), true);
    assert.equal(await page.locator('#regie').evaluate(el => el.classList.contains('ds-zaakcommand')), true);
  } finally {
    if (browser) await browser.close();
  }
});
