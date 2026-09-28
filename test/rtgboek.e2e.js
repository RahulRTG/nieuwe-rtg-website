/* Schermtoets op het boek van RTG in de kamer Financiën (kantoren.html,
   public/apps/kantoren-rtgboek.js, besluit C8).

   Vier beweringen, en alle vier kunnen ze zakken:
   1. het paneel staat in de kamer Financiën, en in geen andere kamer;
   2. een bedrag invullen en bewaren legt het echt vast: daarna geeft de API
      hetzelfde bedrag, op naam;
   3. een half ingevuld deel toont geen totaal maar zegt wat er nog leeg is;
   4. een campagne maken en haar uitgave boeken legt beide vast, en een kanaal
      zonder eigen post staat er als tegenspraak (C12).

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

    /* DE WEDLOOP DIE CI VOND: de scripts van dit paneel laden onderaan de pagina,
       terwijl de kamer al opengaat zodra de server antwoordt. Op een trage runner is
       de kamer open voordat ze er zijn, en dan bleef het paneel leeg. Ze hier
       tegenhouden tot de kamer Financien open op het scherm staat, maakt die volgorde
       vast in plaats van haar aan het toeval te laten -- op een toestand, niet op een klok. */
    await page.route(/\/apps\/kantoren-rtg(boek|campagne)\.js/, async (route) => {
      await page.waitForSelector('#vKamer:not([hidden]) #kRtgBoek:not([hidden])', { timeout: 20000 });
      await route.continue();
    });
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

    await t.test('een campagne maken en haar uitgave boeken, op naam (C12)', async () => {
      const dag = maand + '-01';
      await page.fill('#rbc-code', 'e2e-herfst');
      await page.fill('#rbc-naam', 'Herfst e2e');
      await page.selectOption('#rbc-kanaal', 'sociaal');
      await page.fill('#rbc-van', dag);
      await page.fill('#rbc-tot', dag);
      await page.click('[data-rbcmaak]');
      await page.waitForSelector('[data-rbccode="e2e-herfst"]', { timeout: 20000 });
      await page.fill('#rbc-b-e2e-herfst', '250');
      await page.fill('#rbc-s-e2e-herfst', 'factuur sociale media');
      const klaar = page.waitForResponse(r => r.url().endsWith('/api/office/rtgboek/campagne') && r.status() === 200);
      await page.click('[data-rbccode="e2e-herfst"]');
      await klaar;
      const api = (await post('/api/office/rtgboek', { maand }, persoon)).body.boek;
      const r = api.campagnes.rijen.find(x => x.code === 'e2e-herfst');
      assert.equal(r.centen, 25000);
      assert.ok(r.gezetDoor, 'op naam, gezet door de server');
      await page.waitForFunction(() => /Sociale media: De campagnes zijn geboekt/.test(document.querySelector('#kRbCampagnes').textContent));
    });

    assert.deepEqual(fouten, [], 'geen fouten in de console');
  } finally {
    if (browser) await browser.close();
    stop(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen */ }
  }
});
