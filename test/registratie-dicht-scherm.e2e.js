/* SCHERM-TEST: de rij "Registratiebesluit" op de techniekpagina (PR #589).

   Die rij draagt lange woorden zonder spatie -- RTG_REGISTRATIE_DICHT en de
   paden /api/sso/terug en /api/scim/v2/Users -- en de eerste versie duwde de
   pagina op 390 px breed naar een scrollWidth van 424-428, terwijl de basis op
   390 stond. Een flexkind krijgt standaard min-width:auto en krimpt dan niet
   onder zijn langste woord; `.zeker .mid` kreeg daarom min-width:0 en
   overflow-wrap:anywhere.

   Wat hier vastligt: met RTG_REGISTRATIE_DICHT=1 staat de rij er, zegt DICHT
   en heeft geen knop, en op telefoonformaat is er geen horizontale scroll.
   Mutatie, met de hand: de twee eigenschappen weer weg uit techniek.html ->
   deze toets zakt op de scrollbreedte.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('de techniekpagina toont het registratiebesluit zonder horizontale scroll op 390 px',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-regdicht-scherm-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_REGISTRATIE_DICHT: '1' } });
  let browser;
  try {
    const inlog = await fetch(srv.base + '/api/techniek/inloggen', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'roellie.i@gmail.com', wachtwoord: 'Imran' }) }).then(r => r.json());
    assert.ok(inlog.token, 'de toets moet als eigenaar binnenkomen, anders meet zij een dichte deur');

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/techniek.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((t) => {
      sessionStorage.setItem('techToken', t);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, inlog.token);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => /Registratiebesluit/.test((document.querySelector('#zekeringen') || {}).innerText || ''),
      null, { timeout: 15000 });
    const rij = page.locator('#zekeringen .zeker', { hasText: 'Registratiebesluit' });
    assert.match(await rij.innerText(), /DICHT/);
    assert.equal(await rij.locator('button').count(), 0, 'het besluit heeft geen knop op deze pagina');

    const maat = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, breed: document.documentElement.clientWidth }));
    assert.ok(maat.scroll <= maat.breed, 'horizontale scroll op 390 px: scrollWidth ' + maat.scroll + ' > ' + maat.breed);
    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    stop(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
