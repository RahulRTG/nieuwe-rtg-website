/* ESCAPE SLUIT EEN LAAG -- in een echte browser.

   APPWERKT vond op 27 september 2026 drie schermen waar een laag over de
   pagina bleef liggen die alleen met zijn eigen sluitknop dicht ging: de gids
   van Residentie, het reserveerblad van Food Court en de documentwerkstroom
   van Office (role="dialog"). Een toetsenbordgebruiker zat erachter vast.
   Per scherm: open de laag, druk Escape, en de laag is dicht.

   Bij Office wordt de laag direct opengezet: hij opent pas bij een geopend
   document, en wat hier wordt beproefd is het sluiten. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadPlaywright, letOpFouten, startServer, stop } = require('./helper');

const pw = laadPlaywright();

test('Escape sluit de laag op Residentie, Food Court en Office', { skip: geenBrowser(pw) }, async (t) => {
  const server = await startServer();
  let browser;
  try {
    const lid = await fetch(server.base + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' })
    }).then((r) => r.json());
    assert.ok(lid.token, 'een echt testlid');
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript((sleutel) => {
      localStorage.setItem('rtg_member_token', sleutel);
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_lang', 'nl');
    }, lid.token);
    const page = await context.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const isOpen = (sel) => page.evaluate((s) => document.querySelector(s).classList.contains('open'), sel);

    await t.test('Residentie: de gids', async () => {
      await page.goto(server.base + '/apps/residentie.html', { waitUntil: 'domcontentloaded' });
      await page.locator('#knopGids').click({ timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('#gidsLaag').classList.contains('open'));
      await page.keyboard.press('Escape');
      assert.equal(await isOpen('#gidsLaag'), false, 'de gids ging niet dicht met Escape');
    });

    await t.test('Food Court: het reserveerblad', async () => {
      await page.goto(server.base + '/apps/foodcourt.html', { waitUntil: 'domcontentloaded' });
      await page.locator('#lijst .resto').first().click({ timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('#blad').classList.contains('open'));
      await page.keyboard.press('Escape');
      assert.equal(await isOpen('#blad'), false, 'het reserveerblad ging niet dicht met Escape');
    });

    await t.test('Office: de documentwerkstroom', async () => {
      await page.goto(server.base + '/apps/office.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#faseScrim', { state: 'attached', timeout: 15000 });
      await page.waitForFunction(() => !!document.querySelector('#faseDicht'));
      await page.evaluate(() => document.querySelector('#faseScrim').classList.add('open'));
      await page.keyboard.press('Escape');
      assert.equal(await isOpen('#faseScrim'), false, 'de werkstroom ging niet dicht met Escape');
    });

    assert.deepEqual(fouten, [], 'geen JS-fouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    await stop(server);
  }
});
