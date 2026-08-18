/* Het horecascherm in een echte browser: /apps/horeca.html.

   Twee dingen worden hier bewezen, en het zijn allebei dingen die van buiten
   niet te zien zijn aan een groene API-toets:

   1. UITGELOGD STAAT ER EEN DEUR, geen leeg scherm en geen omleiding die
      kwijtraakt waar je heen wilde (dezelfde regel als TAKEN 5.5).
   2. INGELOGD DRAAIT DE DIENST ECHT: een rekening openen, een gerecht met een
      ALLERGIE erop, de gang vrijgeven, en dan verschijnt diezelfde bon op het
      keukenscherm MET die allergie in beeld. Dat laatste is de bewering die er
      het meest toe doet -- een allergie die het scherm niet haalt, is precies
      de fout die een horecasysteem niet mag maken.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, geenBrowser, browserOpties } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-horecascherm-'));

async function zaakToken(base) {
  const post = (pad, body) => fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const roster = await post('/api/supplier/roster', { code: 'KIKUNOI' });
  const mgr = (roster.staff || []).find(x => x.role === 'manager') || (roster.staff || [])[0];
  assert.ok(mgr, 'de demozaak heeft personeel');
  const inlog = await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' });
  assert.ok(inlog.token, 'de zaak-inlog werkt: ' + JSON.stringify(inlog).slice(0, 120));
  return inlog.token;
}

test('het horecascherm toont uitgelogd een deur en ingelogd de zaal en de keuken',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const browserApi = pw.chromium ? pw : null;
    assert.ok(browserApi, 'er is een browser-API');
    browser = await browserApi.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* ---- uitgelogd: een deur, geen leeg scherm ---- */
    await page.goto(base + '/apps/horeca.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_sup_token');
    });
    await page.goto(base + '/apps/horeca.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);
    const uit = await page.evaluate(() => ({ pad: location.pathname,
      deur: !!document.querySelector('.rtgdeur'), tekst: document.body.innerText.replace(/\s+/g, ' ') }));
    assert.equal(uit.pad, '/apps/horeca.html', 'de pagina stuurt niemand weg');
    assert.ok(uit.deur || /personeel|inlog|zaak/i.test(uit.tekst),
      'uitgelogd staat er een deur met een weg vooruit: ' + uit.tekst.slice(0, 160));

    /* ---- ingelogd: de dienst draait ---- */
    const token = await zaakToken(base);
    await page.evaluate(t => { localStorage.setItem('rtg_sup_token', t); }, token);
    await page.goto(base + '/apps/horeca.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);

    await page.fill('#zTafel', 'Tafel 24');
    await page.fill('#zGasten', '2');
    await page.click('#zOpen');
    await page.waitForTimeout(500);
    let tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Tafel 24/, 'de open rekening staat in de lijst');

    await page.click('[data-open]');
    await page.waitForTimeout(400);
    await page.fill('#zNaam', 'Tournedos');
    await page.fill('#zPrijs', '34.50');
    await page.fill('#zAantal', '2');
    await page.fill('#zGang', '2');
    await page.fill('#zStation', 'grill');
    await page.fill('#zAllergie', 'noten');
    await page.click('#zRegel');
    await page.waitForTimeout(500);
    tekst = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(tekst, /Tournedos/, 'de regel staat op de rekening');
    assert.match(tekst, /noten/, 'de allergie staat op het zaalscherm');
    assert.match(tekst, /69[.,]00/, 'het bedrag telt op (2 x 34,50)');

    // de keuken ziet nog niets: de gang is niet vrijgegeven
    await page.click('#tabKeuken');
    await page.waitForTimeout(600);
    let keuken = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.ok(!/Tournedos/.test(keuken), 'zonder vrijgave staat er niets op het keukenscherm');
    assert.match(keuken, /alleen wat de zaal heeft vrijgegeven/i, 'en het scherm zegt waarom');

    // gang vrijgeven in de zaal, daarna staat hij er wel -- met de allergie
    await page.click('#tabZaal');
    await page.waitForTimeout(400);
    await page.fill('#zVrijGang', '2');
    await page.fill('#zServeerOm', '19:42');
    await page.click('#zVrij');
    await page.waitForTimeout(500);
    await page.click('#tabKeuken');
    await page.waitForTimeout(700);
    keuken = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
    assert.match(keuken, /Tournedos/, 'na vrijgave staat de bon op het keukenscherm');
    assert.match(keuken, /Allergie: noten/, 'met de allergie in een eigen label');
    assert.match(keuken, /serveren 19:42/i, 'en met de gewenste serveertijd');
    assert.match(keuken, /van \d+ min/, 'de looptijd staat naast de norm, niet alleen een kleur');

    // een stand doorzetten werkt vanaf het keukenscherm
    await page.click('[data-stand="gestart"]');
    await page.waitForTimeout(600);
    const regie = await page.evaluate(() => document.getElementById('kRegie').innerText.replace(/\s+/g, ' '));
    assert.match(regie, /Tafel 24/, 'de tafel staat op het regiescherm');

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
