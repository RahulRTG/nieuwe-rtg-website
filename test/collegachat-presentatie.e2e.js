'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { laadBrowser, browserOpties, geenBrowser } = require('./browser');
const pw = laadBrowser();

test('CollegaChat opent, focust, toont status en herstelt focus in een echte browser', { skip: geenBrowser(pw) }, async () => {
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    await page.setContent('<!doctype html><html><head></head><body><button id="start">Chat</button><button class="ds-collegachat-badge" aria-label="Ongelezen berichten"><i class="cc-badge" data-dmbadge="42" hidden></i></button></body></html>');
    await page.addStyleTag({ path: path.join(__dirname, '../public/ds/tokens.css') });
    await page.addStyleTag({ path: path.join(__dirname, '../public/ds/componenten/collegachat.css') });
    await page.addScriptTag({ path: path.join(__dirname, '../public/shared/collegachat.js') });
    await page.evaluate(() => {
      const API = { call: async pad => {
        if (pad === '/staff/dm/history') return { messages: [] };
        if (pad === '/staff/dm/lijst') return { collegas: [{ id: 42, ongelezen: 3 }] };
        if (pad === '/staff/dm/send') return { messages: [{ van: 7, text: 'Goedemorgen', at: new Date().toISOString() }] };
        return {};
      } };
      CollegaChat.init({ API, mij: () => ({ staffId: 7 }) });
      document.getElementById('start').focus();
    });

    await page.evaluate(() => CollegaChat.badges());
    assert.equal(await page.locator('[data-dmbadge="42"]').textContent(), '3');
    assert.equal(await page.locator('[data-dmbadge="42"]').getAttribute('hidden'), null);

    await page.evaluate(() => CollegaChat.open(42, 'Ana'));
    await page.waitForSelector('#ccPaneel');
    assert.equal(await page.locator('#ccKaart').getAttribute('role'), 'dialog');
    assert.equal(await page.locator('#ccPaneel').getAttribute('class'), 'ds-collegachat');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'ccInput');
    const maten = await page.locator('#ccDicht').evaluate(el => {
      const r = el.getBoundingClientRect(); return { width: r.width, height: r.height };
    });
    assert.ok(maten.width >= 44 && maten.height >= 44, JSON.stringify(maten));

    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#ccPaneel').count(), 0);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'start');
  } finally {
    if (browser) await browser.close();
  }
});
