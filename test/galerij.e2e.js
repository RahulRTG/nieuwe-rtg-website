/* Scherm-test voor RTG Galerij: de tijdlijn met beelden uit twee bronnen
   (De Salon en RTG Bestanden), de kijker met favoriet, en een album
   bouwen. Draait alleen waar een browser beschikbaar is. */
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
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==';

test('Galerij: tijdlijn uit twee bronnen, favoriet in de kijker en een album',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-galerij-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await api(base, '/api/auth/register', { name: 'Galerie Echt', email: 'ge' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1987-05-05', tier: 'rtg' });
    await api(base, '/api/bestanden/upload', { naam: 'wijngaard.png', dataUrl: PNG }, reg.token);
    await api(base, '/api/salon/plaats', { tekst: 'Avondlicht aan zee.',
      media: [{ beeld: PNG, alt: 'De zee bij avond' }] }, reg.token);

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/galerij.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/galerij.html', { waitUntil: 'domcontentloaded' });

    /* ---- de tijdlijn: twee beelden, en het kluis-beeld laadt lui bij ---- */
    await page.waitForFunction(() => document.querySelectorAll('#tijdlijn .thumb').length === 2,
      null, { timeout: 10000 });
    await page.waitForFunction(() => {
      const v = document.querySelectorAll('#tijdlijn .thumb img');
      return v.length === 2 && [...v].every(x => x.src && x.src.length > 10);
    }, null, { timeout: 10000 });

    /* ---- de kijker: openen, favoriet zetten ---- */
    await page.evaluate(() => { document.querySelector('#tijdlijn [data-open]').click(); });
    await page.waitForSelector('#kkScrim.open', { timeout: 5000 });
    await page.waitForFunction(() => /1 van 2|2 van 2/.test(document.querySelector('#kkMeta').textContent),
      null, { timeout: 5000 });
    await page.click('#kkFav');
    await page.waitForFunction(() => document.querySelector('#kkFav').textContent === 'Favoriet eraf',
      null, { timeout: 8000 });

    /* ---- een album maken en het beeld erin zetten ---- */
    await page.evaluate(() => { window.prompt = function () { return 'Zomer'; }; });
    await page.click('#kkDicht');
    await page.click('#nieuwAlbum');
    await page.waitForFunction(() => /Zomer/.test(document.querySelector('#albums').textContent),
      null, { timeout: 8000 });
    await page.click('#toonAlbums'); // terug naar de tijdlijn
    await page.evaluate(() => { document.querySelector('#tijdlijn [data-open]').click(); });
    await page.waitForSelector('#kkScrim.open', { timeout: 5000 });
    await page.click('#kkZet');
    await page.waitForFunction(() => /In het album gezet/.test(document.querySelector('#melding').textContent),
      null, { timeout: 8000 });
    await page.click('#kkDicht');
    await page.click('#toonAlbums');
    await page.waitForFunction(() => /Zomer/.test(document.querySelector('#albums').textContent) &&
      /1 beeld/.test(document.querySelector('#albums').textContent), null, { timeout: 8000 });

    /* ---- favorieten-weergave toont het gemarkeerde beeld ---- */
    await page.click('#toonFav');
    await page.waitForFunction(() => document.querySelectorAll('#tijdlijn .thumb').length === 1,
      null, { timeout: 8000 });

    const heleTekst = await page.evaluate(() => document.body.textContent);
    assert.ok(!/Galerie Echt/.test(heleTekst), 'geen echte naam op het scherm');
    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
