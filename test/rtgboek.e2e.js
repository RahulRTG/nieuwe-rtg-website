/* Schermtoets op het boek van RTG in de kamer Financiën (kantoren.html,
   public/apps/kantoren-rtgboek.js, besluit C8).

   Drie beweringen, en alle drie kunnen ze zakken:
   1. het paneel staat in de kamer Financiën, en in geen andere kamer;
   2. een bedrag invullen en bewaren legt het echt vast: daarna geeft de API
      hetzelfde bedrag, op naam;
   3. een half ingevuld deel toont geen totaal maar zegt wat er nog leeg is.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('Financien vult het boek van RTG, en het scherm liegt niet over een half boek',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rtgboek-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const persoon = await kantoorAlsPersoon(srv.base);
    assert.ok(persoon, 'de eigenaar staat als persoon in de backoffice');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
    await ctx.addInitScript((tok) => { try { localStorage.setItem('rtg_office_token', tok); } catch (e) {} }, persoon);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(srv.base + '/apps/kantoren.html?kamer=inkoop', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#vKamer:not([hidden])', { timeout: 20000 });
    assert.equal(await page.locator('#kRtgBoek').isHidden(), true, 'Inkoop heeft het boek niet');

    await page.goto(srv.base + '/apps/kantoren.html?kamer=financien', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#kRtgBoek:not([hidden]) [data-rbdeel="vast"][data-rbpost="huisvesting"]', { timeout: 20000 });
    const maand = await page.locator('#kRbMaand').inputValue();

    await t.test('bewaren legt het bedrag echt vast, op naam', async () => {
      await page.fill('#rb-b-vast-huisvesting', '1.234,56');
      await page.fill('#rb-s-vast-huisvesting', 'huurfactuur september');
      const klaar = page.waitForResponse(r => r.url().endsWith('/api/office/rtgboek/zet') && r.status() === 200);
      await page.click('[data-rbdeel="vast"][data-rbpost="huisvesting"]');
      await klaar;
      const api = (await post('/api/office/rtgboek', { maand }, persoon)).body.boek;
      const p = api.vast.posten.find(x => x.post === 'huisvesting');
      assert.equal(p.centen, 123456);
      assert.equal(p.bron, 'huurfactuur september');
      assert.ok(p.gezetDoor, 'op naam, gezet door de server');
    });

    await t.test('een half deel toont geen totaal maar wat er leeg is', async () => {
      await page.waitForFunction(() => /Nog leeg/.test(document.querySelector('#kRbDelen').textContent));
      const tekst = await page.locator('#kRbDelen .rb-deel').first().textContent();
      assert.match(tekst, /Nog leeg: Personeel \(totaal\), Diensten en abonnementen, Overig/);
      assert.doesNotMatch(tekst, /Totaal/);
    });

    assert.deepEqual(fouten, [], 'geen fouten in de console');
  } finally {
    if (browser) await browser.close();
    stop(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ }
  }
});
