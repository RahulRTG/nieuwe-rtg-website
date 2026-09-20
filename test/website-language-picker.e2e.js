'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop } = require('./helper');
const pw = laadPlaywright();

test('de nieuwe taalkeuze volgt de RTG-stijl en blijft binnen elke schermrand',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
    const { child, base } = await startServer({ env: { SMTP_URL: '' } });
    let browser;
    try {
      browser = await pw.chromium.launch(browserOpties(pw));
      for (const viewport of [{ width: 320, height: 700 }, { width: 390, height: 844 }, { width: 1440, height: 900 }]) {
        const context = await browser.newContext({ viewport, reducedMotion: 'reduce', serviceWorkers: 'block' });
        const page = await context.newPage();
        await page.goto(base + '/site/werelden/livingos.html', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.RTGi18n && Array.isArray(window.RTGi18n._alleTalen) && window.RTGi18n._alleTalen.length === 114);

        await page.locator('[data-language-picker]').click();
        const kaart = page.locator('.rtg-lang-card');
        const vak = await kaart.boundingBox();
        assert.ok(vak.x >= 0 && vak.x + vak.width <= viewport.width,
          'taalkaart blijft horizontaal binnen ' + viewport.width + 'px');
        assert.ok(vak.y >= 0 && vak.y + vak.height <= viewport.height,
          'taalkaart blijft verticaal binnen ' + viewport.height + 'px');
        assert.ok(parseFloat(await kaart.evaluate(el => getComputedStyle(el).borderRadius)) >= 20,
          'taalkaart gebruikt de afgeronde RTG-systeemvorm');
        assert.equal(await page.locator('.rtg-lang-quick').count(), 4, 'vier directe taalkeuzes zijn zichtbaar');
        assert.equal(await page.locator('#rtg-lang-modal canvas').count(), 0, 'geen losse sterrenlaag achter de taalkeuze');

        await page.locator('#rtg-lang-zoek').fill('Spaans');
        await page.locator('#rtg-lang-hint[data-lang="es"]').waitFor({ state: 'visible' });
        await page.locator('#rtg-lang-zoek').fill('Arabisch');
        const voorstel = page.locator('#rtg-lang-hint[data-lang="ar"]');
        await voorstel.waitFor({ state: 'visible' });
        await voorstel.click();
        await page.waitForFunction(() => document.documentElement.lang === 'ar' && document.documentElement.dir === 'rtl');

        await page.locator('[data-language-picker]').click();
        await page.getByRole('heading', { name: 'Choose your language', exact: true }).waitFor();
        const rtlVak = await kaart.boundingBox();
        assert.ok(rtlVak.x >= 0 && rtlVak.x + rtlVak.width <= viewport.width,
          'taalkaart blijft ook in RTL binnen ' + viewport.width + 'px');
        await page.getByRole('button', { name: 'Close language chooser', exact: true }).click();
        await context.close();
      }
    } finally {
      if (browser) await browser.close();
      await stop(child);
    }
  });
