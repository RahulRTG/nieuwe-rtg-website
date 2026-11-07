'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { laadBrowser, browserOpties, geenBrowser } = require('./browser');
const pw = laadBrowser();

test('Split opent, wisselt, deelt met toetsenbord en sluit in een echte browser', { skip: geenBrowser(pw) }, async () => {
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    await page.setContent('<!doctype html><html><head></head><body><button id="voor">Voor</button></body></html>');
    await page.addStyleTag({ path: path.join(__dirname, '../public/ds/tokens.css') });
    await page.addStyleTag({ path: path.join(__dirname, '../public/ds/componenten/split.css') });
    await page.evaluate(() => { window.RTGMedia = { kader() {} }; });
    await page.addScriptTag({ path: path.join(__dirname, '../public/shared/split.js') });
    await page.locator('#voor').focus();
    await page.evaluate(() => RTGSplit.open());
    await page.waitForSelector('#rtgSplit');
    assert.equal(await page.locator('#rtgSplit').getAttribute('class'), 'ds-split');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'spSluit');
    assert.equal(await page.locator('#rtgSplit iframe').count(), 2);
    const greep = page.locator('.sp-greep');
    assert.equal(await greep.getAttribute('aria-valuenow'), '50');
    await greep.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await greep.getAttribute('aria-valuenow'), '55');
    await page.locator('#spDraai').click();
    assert.equal(await page.locator('.sp-vlak').evaluate(el => el.classList.contains('boven')), true);
    assert.equal(await page.locator('.sp-greep').getAttribute('aria-orientation'), 'horizontal');
    await page.locator('#spSluit').click();
    assert.equal(await page.locator('#rtgSplit').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'voor');
  } finally {
    if (browser) await browser.close();
  }
});
