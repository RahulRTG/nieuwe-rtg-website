/* ============================================================================
   DE OCHTENDKAART IN DE BROWSER (PERSONEEL.md par. 4).

   De serverkant staat in test/ochtendkaart.test.js; dit is wat een medewerker
   op het scherm Vandaag ziet: een groet met zijn naam, een kop die zegt of alles
   klaarstaat of wat niet na te kijken was, de regels met hun graad eronder, en
   één knop -- de bestaande inklokknop. En er staat geen voorstel op (B4).
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser, edgeActies } = require('./helper');

const pw = laadPlaywright();
const post = (base, pad, body, tok) => fetch(base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
  body: JSON.stringify(body || {}) }).then(r => r.json());

test('Vandaag: de ochtendkaart staat bovenaan, met naam, kop, regels en een knop', { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ochtend-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const roster = await post(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const man = roster.staff.find(x => x.role === 'manager');
    const login = await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: man.id, pin: '1234' });
    /* een vastgesteld rooster, zodat de dienst gemeten is en er een knop staat */
    await post(base, '/api/supplier/rooster/voorstel', {}, login.token);
    await post(base, '/api/supplier/rooster/beslis', { actie: 'akkoord' }, login.token);

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(([tok, code]) => {
      localStorage.setItem('rtg_pda_token', tok);
      localStorage.setItem('rtg_pda_code', code);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, [login.token, 'KIKUNOI']);
    await page.goto(base + '/apps/personeel.html', { waitUntil: 'domcontentloaded' });
    await edgeActies(page);
    await page.locator('.rtg-adaptive-controls [data-rtg-adaptive-source="trmMeer"]').click();
    await edgeActies(page);
    await page.click('.rtg-adaptive-controls [data-rtg-adaptive-tab="vandaag"]');

    await page.waitForSelector('#klokBtn', { timeout: 15000 });
    const eerste = await page.textContent('#todayWrap .card');
    assert.match(eerste, new RegExp('(Goedemorgen|Goedemiddag|Goedenavond), ' + man.name), 'de groet draagt de eigen naam');
    assert.match(eerste, /Alles staat voor je klaar\.|vraagt je aandacht|Ik kon niet nakijken/, 'de kop van de kaart');
    assert.match(eerste, /vastgesteld rooster/, 'de regels dragen hun bron');
    assert.match(await page.textContent('#klokBtn'), /Begin mijn dag/, 'de knop van de kaart is de inklokknop');
    assert.doesNotMatch(eerste, /stel voor|zou je|wil je misschien/i, 'de kaart stelt niets voor (B4)');

    await page.click('#klokBtn');
    await page.waitForFunction(() => /Klok uit/.test((document.getElementById('klokBtn') || {}).textContent || ''), undefined, { timeout: 15000 });
    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch (e) {}
  }
});
