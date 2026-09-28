/* WAT HET SCHERM ZELF OVER ZIJN KNOPPEN LEGT -- in een echte browser.

   APPWERKT vond op 27 september 2026 twee knoppen die een eigen laag van het
   scherm volledig bedekte, op een vers geladen pagina:
     - navigatie.html: het statuspaneel (#intelligenceDock) stond op 5rem en lag
       over de knop Kaarten in de vaste kop;
     - camera.html: zonder camera staat "Camera opnieuw openen" in beeld, maar
       de onderbalk (die boven de Edge staat) lag eroverheen -- de enige weg uit
       die stand.
   Een gewone muisklik struikelt op een dekkende laag ("intercepts pointer
   events"); een klik uit de DOM gaat erdoorheen en had dit nooit gezien. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop } = require('./helper');

const pw = laadPlaywright();

test('eigen knoppen liggen niet onder een eigen laag van het scherm', { skip: geenBrowser(pw) }, async (t) => {
  const server = await startServer();
  let browser;
  try {
    const lid = await fetch(server.base + '/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier: 'rtg' })
    }).then((r) => r.json());
    assert.ok(lid.token, 'een echt testlid');
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const maat of [{ width: 1280, height: 900 }, { width: 1024, height: 768 }]) {
      const context = await browser.newContext({ viewport: maat, serviceWorkers: 'block' });
      await context.addInitScript((sleutel) => {
        localStorage.setItem('rtg_member_token', sleutel);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        localStorage.setItem('rtg_lang', 'nl');
      }, lid.token);
      const page = await context.newPage();
      page.on('dialog', (d) => d.dismiss().catch(() => {}));
      const edgeKlaar = () => page.waitForFunction(() => document.body &&
        document.body.getAttribute('data-rtg-adaptive-ready') === 'true', null, { timeout: 15000 });

      await t.test(maat.width + ': navigatie, de knop Kaarten', async () => {
        await page.goto(server.base + '/apps/navigatie.html', { waitUntil: 'domcontentloaded' });
        await edgeKlaar();
        await page.locator('#kaartenKnop').click({ timeout: 5000 });
        await page.waitForFunction(() => document.querySelector('#kaartenKnop').getAttribute('aria-expanded') === 'true');
      });

      await t.test(maat.width + ': camera, "Camera opnieuw openen"', async () => {
        await page.goto(server.base + '/apps/camera.html', { waitUntil: 'domcontentloaded' });
        await edgeKlaar();
        await page.locator('#probeerCamera').waitFor({ state: 'visible', timeout: 15000 });
        await page.locator('#probeerCamera').click({ timeout: 5000 });
      });
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await stop(server);
  }
});
