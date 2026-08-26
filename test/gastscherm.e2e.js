/* Het gastscherm is de publieke QR-ingang aan tafel en op de kamer. Zonder
   code hoort het niet leeg of technisch te ogen: het legt uit wat iemand moet
   doen, zonder alsnog een leden- of leveranciersdeur te tonen.

   Draai: node --experimental-sqlite --test test/gastscherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');

const pw = laadBrowser();

test('de publieke gastingang legt zonder QR-code de volgende stap uit',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);

    await page.goto(base + '/apps/gast.html', { waitUntil: 'load' });
    await page.waitForSelector('#melding:not([hidden])', { timeout: 10000 });

    assert.match(await page.locator('#zaakNaam').textContent(), /Aan tafel/);
    assert.match(await page.locator('#melding').textContent(), /Scan de QR-code op je tafel of op je kamer/);
    assert.equal(await page.locator('#vAanschuif').isVisible(), false,
      'zonder geldige QR vraagt het scherm nog geen persoonsgegevens');
    assert.deepEqual(fouten, [], 'het gastscherm opent zonder browserfouten');
  } finally {
    if (browser) await browser.close();
    stop(child);
  }
});
