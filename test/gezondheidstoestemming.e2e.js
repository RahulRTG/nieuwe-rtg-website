/* Scherm-test voor de aparte toestemming voor gezondheidsgegevens
   (public/apps/foundation/gezondheidstoestemming.js op gezondheid.html; server:
   foundation/gezondheidstoestemming.js). Een ouder legt voor het eerst een
   medicijn vast: het scherm vraagt eerst de toestemming in een eigen venster.
   "Niet nu" bewaart niets; "Ja" geeft hem en bewaart het medicijn alsnog. Daarna
   staat de knop om in te trekken eronder.
   Draait alleen waar een browser beschikbaar is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('Gezondheid: de toestemming wordt apart gevraagd bij het eerste gebruik', { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gezondheidstoestemming-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const post = async (p, b) => (await fetch(base + p, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })).json();
  let browser;
  try {
    const g = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Fam Zorg', naam: 'Mam', pin: '1234' });
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/foundation/gezondheid.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((sessie) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(sessie));
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: g.code, token: g.token, profiel: { naam: 'Mam', groep: 'volw' } });
    fouten.length = 0; // het uitgelogde bezoek hierboven was alleen om de sessie te zetten
    await page.goto(base + '/apps/foundation/gezondheid.html', { waitUntil: 'domcontentloaded' });
        // het scherm staat in delen (shared/deelmenu.js): een mens tikt eerst het deel aan
    const deel = (naam) => page.evaluate((n) => [...document.querySelectorAll('.rtgdeel-balk button')].find(b => b.textContent.trim() === n).click(), naam);
    await page.waitForSelector('.rtgdeel-balk button', { timeout: 15000 });
    await deel('Toestemming');
    await page.waitForFunction(() => /nog geen toestemming/i.test(document.querySelector('#toestemStand').textContent), null, { timeout: 8000 });
    await deel('Per gezinslid');
    await page.waitForSelector('#mNaam', { timeout: 15000 }); // zichtbaar: de serverdeur gaat open (rtfappcatalogus-data.js)

    const voegToe = async () => {
      await page.fill('#mNaam', 'Paracetamol');
      await page.evaluate(() => document.querySelector('#mAdd').click());
      await page.waitForSelector('dialog[open]', { timeout: 8000 });
    };
    await voegToe();
    await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find(b => /Niet nu/.test(b.textContent)).click());
    await page.waitForFunction(() => /toestemming/i.test(document.querySelector('#mFout').textContent), null, { timeout: 8000 });
    const leeg = await (await fetch(base + '/api/foundation/gezin/' + g.code + '/gezondheid', { headers: { Authorization: 'Bearer ' + g.token } })).json();
    assert.equal(leeg.toestemming, false);
    assert.ok(!JSON.stringify(leeg).includes('Paracetamol'), '"Niet nu" bewaart niets');

    await voegToe();
    await page.evaluate(() => [...document.querySelectorAll('dialog[open] button')].find(b => /Ja/.test(b.textContent)).click());
    await page.waitForFunction(() => /U hebt toestemming gegeven/.test(document.querySelector('#toestemStand').textContent), null, { timeout: 8000 });
    await deel('Toestemming');
    assert.ok(await page.isVisible('#toestemIntrek'), 'en de weg om hem in te trekken staat er');
    const vol = await (await fetch(base + '/api/foundation/gezin/' + g.code + '/gezondheid', { headers: { Authorization: 'Bearer ' + g.token } })).json();
    assert.equal(vol.toestemming, true);
    assert.ok(JSON.stringify(vol).includes('Paracetamol'), 'na "Ja" is het medicijn alsnog bewaard');
    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
