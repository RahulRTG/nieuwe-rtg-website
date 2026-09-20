'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();
test('world stories explain consequences locally, retain choices across language changes and use one Edge',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const srv = await startServer({ env: { RTG_AI_UIT: '1', SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await ctx.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
    const page = await ctx.newPage(), errors = [], writes = [];
    letOpFouten(page, errors);
    page.on('request', r => {
      const url = new URL(r.url());
      // These two existing routes only read the language catalogue and translate fixed UI copy.
      if (r.method() === 'POST' && !['/api/talen', '/api/vertaal/ui'].includes(url.pathname)) writes.push(url.pathname);
    });
    for (const [world, option, expected] of [
      ['living', 'vegetarian', 'acht vegetarische couverts'], ['travel', 'late', 'Avondvertrek past'],
      ['work', 'covered', 'vervanger beschikbaar'], ['foundation', 'evening', 'na de werkdag']
    ]) {
      await page.goto(srv.base + '/site/werelden/' + world + 'os.html');
      await page.waitForSelector('[data-story-stage="ready"]');
      await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
      assert.equal(await page.locator('.rtg-adaptive-bar').count(), 1);
      assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(), true);
      await page.locator('.demo-choice select').selectOption(option);
      assert.equal(await page.locator('.rtg-adaptive-bar').evaluate(el => {
        const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
      }), true, 'Edge remains available while reading a world story');
      assert.match(await page.locator('.connection-steps').innerText(), new RegExp(expected, 'i'));
      await page.locator('.connection-steps summary').first().click();
      assert.equal(await page.locator('.connection-steps details[open]').count(), 1);
      await page.locator('.story-permission input').uncheck();
      assert.match(await page.locator('.connection-steps').innerText(), /[Gg]een.*agenda|Agenda niet|geen gezinsagenda/);
      assert.equal(await page.locator('.connection-steps details[open]').count(), 1, 'expanded widget stays open after a choice');
      await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
      await page.getByRole('button', { name: 'Begin het voorbeeld opnieuw', exact: true }).click();
      assert.equal(await page.locator('.story-permission input').isChecked(), true);
      await page.locator('.demo-choice select').selectOption(option);
      await page.evaluate(() => window.RTGi18n.set('ar', false));
      await page.waitForFunction(() => document.documentElement.dir === 'rtl');
      assert.equal(await page.locator('.demo-choice select').inputValue(), option);
      for (const width of [320, 390, 834, 1440]) {
        await page.setViewportSize({ width, height: 1050 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, world + ' RTL ' + width);
      }
      await page.evaluate(() => window.RTGi18n.set('nl', false));
      if (world === 'foundation') assert.match(await page.locator('[data-story-demo]').innerText(), /altijd 100% gratis/);
    }
    assert.deepEqual(writes, [], 'a public story never submits a booking, message, mandate or personal record');
    assert.deepEqual(errors, []);
    await ctx.close();
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
