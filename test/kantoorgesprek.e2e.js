/* Scherm-test voor de kantoor-inlog via het gewone RTG-account.

   De gedeelde kantoorcode is geen zichtbare terugvalroute meer. Zonder gewone
   RTG-sessie vraagt de deur dus om aanmelden; hij toont geen codeveld en maakt
   geen kantoorsessie. De algemene pin/passkey komt pas aan bod nadat een account
   met een kantoorrol is herkend.

   Draai los: node --test test/kantoorgesprek.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

const pw = laadPlaywright();

test('de kantoor-inlog verwijst alleen naar het gewone RTG-account',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kg-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'LEGACY-NIET-ZICHTBAAR' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/rtgkantoor.html', { waitUntil: 'domcontentloaded' });

    // Zonder gewoon account is er geen tweede deur.
    await page.waitForFunction(() => {
      const z = document.querySelector('.kg-zegt');
      return z && /gewone RTG-account/i.test(z.textContent);
    }, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => document.querySelector('.kg-in').disabled), true,
      'zonder account hoort geen invoer actief te zijn');
    assert.equal(await page.evaluate(() => localStorage.getItem('rtg_office_token')), null,
      'en je bent niet binnen');
    const scherm = await page.evaluate(() => document.body.innerText);
    assert.doesNotMatch(scherm, /kantoorcode/i, 'de gedeelde code is geen zichtbare terugvalroute');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
