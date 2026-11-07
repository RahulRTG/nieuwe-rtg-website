'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { laadBrowser, browserOpties, geenBrowser } = require('./browser');
const pw = laadBrowser();

test('ondernemer-poort opent en sluit beheerst in een echte mobiele browser', { skip: geenBrowser(pw) }, async () => {
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('http://rtg.test/apps/leverancier.html', route => route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: '<!doctype html><html><head></head><body><button id="voor">Voor</button></body></html>'
    }));
    await page.route('http://rtg.test/api/supplier/poort', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ online: false, klaar: false, stappen: [], rondleidingen: [] })
    }));
    await page.goto('http://rtg.test/apps/leverancier.html');
    await page.evaluate(() => {
      localStorage.setItem('rtg_sup_token', 'presentatieproef');
      document.getElementById('voor').focus();
    });
    await page.addStyleTag({ path: path.join(__dirname, '../public/ds/tokens.css') });
    await page.addStyleTag({ path: path.join(__dirname, '../public/ds/componenten/ondernemerpoort.css') });
    await page.addScriptTag({ path: path.join(__dirname, '../public/shared/ondernemerpoort.js') });

    await page.waitForSelector('.poort-waas:not([hidden])');
    assert.equal(await page.locator('.poort-kaart').getAttribute('aria-modal'), 'true');
    assert.equal(await page.locator('.poort-waas').evaluate(el => el.classList.contains('ds-ondernemerpoort')), true);
    assert.match(await page.locator('.poort-kaart').textContent(), /ondernemer-poort/i);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-sluit')), true);
    const maten = await page.locator('[data-sluit]').evaluate(el => {
      const r = el.getBoundingClientRect(); return { width: r.width, height: r.height };
    });
    assert.ok(maten.height >= 44, JSON.stringify(maten));

    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.poort-waas').getAttribute('hidden'), '');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'voor');
  } finally {
    if (browser) await browser.close();
  }
});
