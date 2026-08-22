/* Scherm-test voor de kantoor-inlog als gesprek.

   De server-kant staat in test/kantoorgesprek.test.js; dit gaat over wat een
   mens ziet. Twee dingen die alleen hier te toetsen zijn:

   - de invoer wordt GEMASKEERD zodra Rahul om een code vraagt. Een chatvenster
     toont normaal wat je typt, en een kantoorcode hoort niet leesbaar in beeld
     te staan;
   - wat je typte staat na het versturen niet meer in het veld, en er blijft geen
     bellenrij met je code op het scherm achter.

   Draai los: node --test test/kantoorgesprek.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

const pw = laadPlaywright();

test('de kantoor-inlog is een gesprek, en je code staat niet in beeld',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kg-e2e-'));
  const CODE = 'SCHERMCODE77';
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: CODE } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/rtgkantoor.html', { waitUntil: 'domcontentloaded' });

    // 1) Rahul vraagt het, en het veld is gemaskeerd
    await page.waitForFunction(() => {
      const z = document.querySelector('.kg-zegt');
      return z && /kantoorcode/i.test(z.textContent);
    }, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => document.querySelector('.kg-in').type), 'password',
      'een kantoorcode hoort niet leesbaar in beeld te staan');
    assert.equal(await page.evaluate(() => document.querySelector('.kg-in').getAttribute('autocomplete')), 'off',
      'en de browser hoort hem niet te onthouden');

    // 2) een foute code laat je niet binnen en verklapt niets
    await page.fill('.kg-in', 'ONZINONZIN');
    await page.click('.kg-rij button');
    await page.waitForFunction(() => {
      const f = document.querySelector('.kg-fout');
      return f && f.textContent.trim().length > 0;
    }, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => document.querySelector('.kg-in').value), '',
      'wat je typte blijft niet in het veld staan');
    assert.equal(await page.evaluate(() => localStorage.getItem('rtg_office_token')), null,
      'en je bent niet binnen');

    // 3) met de goede code gaat het kantoor open
    await page.waitForFunction(() => !document.querySelector('.kg-in').disabled, null, { timeout: 8000 });
    await page.fill('.kg-in', CODE);
    await page.click('.kg-rij button');
    await page.waitForFunction(() => !!localStorage.getItem('rtg_office_token'), null, { timeout: 10000 });

    // 4) en de code staat nergens meer op het scherm
    const scherm = await page.evaluate(() => document.body.innerText);
    assert.ok(!scherm.includes(CODE.slice(0, 8)), 'de code hoort nergens meer in beeld te staan');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) { try { await browser.close(); } catch (e) {} }
    stop(child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
