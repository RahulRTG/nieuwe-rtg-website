/* Scherm-test voor de RTMAIL-teams. De unit-toetsen (test/rtmail-team.test.js)
   bewijzen de server-kant; deze bewijst dat het scherm het doet: een team
   oprichten, iemand erbij zetten, een bericht oppakken en afhandelen, en dat
   je codenaam onder een bericht namens het team komt te staan.
   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();
const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('RTMAIL-teams: oprichten, iemand erbij, oppakken en afhandelen op het scherm',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-team-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const maak = (naam, staart) => api(base, '/api/auth/register', { name: naam, email: naam + t + '@e.test',
      phone: '06' + String(t).slice(-7) + staart, password: 'geheim123', geboortedatum: '1988-08-08', tier: 'rtg' });
    const baas = await maak('Baas', '1');
    const maat = await maak('Maat', '2');
    const maatCode = (await api(base, '/api/state', {}, maat.token)).state.user.codename;

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, baas.token);
    await page.goto(base + '/apps/rtmail.html', { waitUntil: 'domcontentloaded' });

    // het teams-blok verschijnt onder je eigen postvak
    await page.waitForFunction(() => /Teams/.test(document.body.textContent), null, { timeout: 15000 });

    // een team oprichten
    await page.click('#tNieuw');
    await page.waitForSelector('#tNaam', { timeout: 8000 });
    await page.fill('#tNaam', 'De Receptie');
    await page.fill('#tAdres', 'receptie');
    await page.click('#tMaak');
    await page.waitForFunction(() => /receptie@/.test(document.body.textContent), null, { timeout: 8000 });

    // iemand erbij, op codenaam
    await page.click('#tErbij');
    await page.waitForSelector('#tWie', { timeout: 8000 });
    await page.fill('#tWie', maatCode);
    await page.click('#tWieOk');
    await page.waitForFunction((cn) => document.body.textContent.includes(cn), maatCode, { timeout: 8000 });

    // namens het team schrijven -- naar het eigen teamadres, zodat er post ligt
    await page.click('#tSchrijf');
    await page.waitForSelector('#sTekst', { timeout: 8000 });
    await page.fill('#sNaar', 'receptie');
    await page.fill('#sOnd', 'Late check-out?');
    await page.fill('#sTekst', 'Kan de gast later uitchecken?');
    await page.click('#sStuur');
    await page.waitForFunction(() => /Late check-out/.test(document.body.textContent), null, { timeout: 8000 });

    // het bericht openen, oppakken en afhandelen
    await page.click('[data-tb="0"]');
    await page.waitForSelector('#bPak', { timeout: 8000 });
    const namens = await page.evaluate(() => document.querySelector('#body').textContent);
    assert.match(namens, /namens De Receptie/, 'de hand staat onder het bericht: ' + namens);

    await page.click('#bPak');
    await page.waitForFunction(() => /bericht open|berichten open/.test(document.body.textContent), null, { timeout: 8000 });
    const naPak = await page.evaluate(() => document.body.textContent);
    assert.match(naPak, /· jij/, 'je ziet dat jij het oppakte');

    await page.click('[data-tb="0"]');
    await page.waitForSelector('#bAf', { timeout: 8000 });
    await page.click('#bAf');
    await page.waitForFunction(() => /Niets meer open/.test(document.body.textContent), null, { timeout: 8000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
