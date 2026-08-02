/* Scherm-test voor rust.html: de box-ademhaling met zachte teller en het
   stiltemoment. Alles op deze pagina blijft lokaal (er gaat niets naar de
   server); de test kijkt alleen naar het scherm zelf.
   Draait alleen waar een browser beschikbaar is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

test('Even rust: de ademteller loopt, de fasen wisselen en het stiltemoment vult de ring',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtfrust-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/foundation/rust.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); });

    /* de ademhaling: fase + teller, en de fase wisselt na vier tellen */
    await page.evaluate(() => { document.querySelector('#ademStart').click(); });
    await page.waitForFunction(() => document.querySelector('#fase').textContent === 'Adem in' &&
      /^[1-4]$/.test(document.querySelector('#tel').textContent), null, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('#fase').textContent === 'Houd vast',
      null, { timeout: 8000 });
    await page.evaluate(() => { document.querySelector('#ademStart').click(); });
    assert.equal(await page.evaluate(() => document.querySelector('#fase').textContent), 'Klaar?',
      'stoppen zet alles netjes terug');

    /* het stiltemoment: de ring loopt vol, en stoppen mag altijd */
    await page.evaluate(() => { document.querySelector('[data-t="stil"]').click(); });
    const vol = await page.evaluate(() => parseFloat(document.querySelector('#stilLoop').style.strokeDashoffset));
    await page.evaluate(() => { document.querySelector('#stilStart').click(); });
    await page.waitForFunction(v => parseFloat(document.querySelector('#stilLoop').style.strokeDashoffset) < v - 1,
      vol, { timeout: 8000 });
    assert.equal(await page.evaluate(() => document.querySelector('#stilTekst').textContent), '',
      'tijdens de minuut is het scherm stil -- geen tekst, geen druk');
    await page.evaluate(() => { document.querySelector('#stilStart').click(); });
    assert.ok(await page.evaluate(() => /Durf je\?/.test(document.querySelector('#stilTekst').textContent)),
      'stoppen mag altijd, zonder gedoe');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
