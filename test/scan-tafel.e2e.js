/* Scherm-test: de tafel-QR-stroom in de leden-app. We loggen als lid in (token
   in localStorage), openen de app, klikken op de scan-knop en voeren met de hand
   een tafel-QR-payload in (headless heeft geen camera). De app hoort dan het menu
   van die zaak te openen met de tafel voorgekozen: precies de "scan en bestel"-
   belofte. Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: node --test test/scan-tafel.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, volgVerzoeken } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scan-')); }
/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return (await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })).json();
}

test('leden-app: scan een tafel-QR -> het menu opent met de tafel voorgekozen',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    // 1) lid registreren -> token
    const reg = await api(base, '/api/auth/register', { name: 'Scan Lid', email: 'scan@x.nl', phone: '0612345688',
      password: 'geheim123', geboortedatum: '1992-05-05', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'lid-registratie geeft een token');

    // 2) de tafelnamen van een demozaak ophalen om een geldige payload te bouwen
    const kaart = await api(base, '/api/supplier/menu/get', { code: 'KIKUNOI' }, reg.token);
    assert.ok(kaart.supplier, 'de zaak KIKUNOI bestaat');
    const tafel = (kaart.supplier.tableNames || [])[0] || '1';
    const payload = 'rtg:tafel:KIKUNOI:' + tafel;

    // 3) browser: token in localStorage, app openen
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await volgVerzoeken(page);
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(([tok]) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, [reg.token]);
    /* DE ONBOARDINGPOORT PAS WEGHALEN ALS DE APP ZIJN BESLUIT HEEFT GENOMEN.

       checkOnboarding() (app-main-07.js) haalt /api/onboarding/status op en zet
       daarna zelf `#onbGate.hidden` -- op true als de intake rond is, op FALSE
       als hij dat niet is. Haalt deze toets de poort weg voordat dat antwoord
       binnen is, dan zet de app hem een tel later gewoon weer terug, en dan
       onderschept die poort elke klik in de scanstroom.

       Zolang de navigatie op `load` wachtte was dat antwoord altijd al binnen.
       Met `domcontentloaded` is het een race, en die is in de e2e-ronde van 20
       augustus ook echt geknapt. Vandaar: het antwoord AANMELDEN vóór de goto
       (daarna is het te laat, waitForResponse ziet alleen wat nog komt) en er
       hieronder op wachten. */
    const statusAntwoord = page.waitForResponse(
      r => r.url().includes('/api/onboarding/status'), { timeout: 30000 }).catch(() => null);
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await statusAntwoord;

    // 4) de eigen QR-onderdelen zijn geladen en scannen is bereikbaar. Sinds
    //    het OS-beginscherm staat scannen in het bedieningspaneel en niet meer
    //    als los knopje in de statusbalk; de knop zelf blijft het model.
    await page.waitForSelector('#scanBtn', { state: 'attached', timeout: 15000 });
    await page.waitForSelector('#osCcBtn', { state: 'attached', timeout: 15000 });
    // de verplichte onboarding-poort staat los van deze test; we sluiten hem zoals
    // de app dat doet zodra de intake rond is, om de scan-stroom te kunnen toetsen
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    const globals = await page.evaluate(() => ({
      qr: !!window.RTGQR, scan: !!window.RTGScanner, knop: !!window.RTGScanknop,
      code: !!window.RTGCode, teken: !!window.RTGQRteken
    }));
    assert.deepEqual(globals, { qr: true, scan: true, knop: true, code: true, teken: true }, 'alle eigen QR-onderdelen geladen');
    // en de codec doet het echt in de browser (round-trip)
    const rt = await page.evaluate(() => { const q = RTGQR.encode('RTG-tafel', { ecc: 'M' }); return RTGQR.decode(q).tekst; });
    assert.equal(rt, 'RTG-tafel', 'de QR-codec round-tript in de browser');

    // 5) bedieningspaneel -> Scannen -> overlay -> met de hand de tafel-QR invoeren
    /* HET BEDIENINGSPANEEL OPENEN ZOALS EEN GEBRUIKER DAT DOET.

       Hier ging eerst een klik op de knop in de bank vooraf, die de werktafel
       opvouwde naar het springboard. Dat springboard is als scherm weg
       (WERELD.md) en die knop dus ook -- maar de bovenrand luistert gewoon op
       document mee (shared/randen.js), dus die haal werkt boven de werktafel
       precies zoals hij boven de schil werkte. Eén stap minder.

       Hier stond `page.click('#osCcBtn')`. Die knop stond toen nog in de
       statusbalk van het beginscherm; die balk is leeggemaakt (mappen, klok,
       functies, de balk van Rahul, en verder niets) en de knop is nu een
       verborgen model dat het paneel zelf aanklikt. Klikken op iets dat niet in
       beeld staat kan een gebruiker niet, dus deze toets ook niet.

       De echte weg is de bovenrand omlaag halen (shared/randen.js). Dat is
       meteen de betere toets: hij meet de ingang die er nu is en niet de knop
       die er toevallig nog staat. */
    /* EERST WACHTEN TOT DIE RAND ER IS. shared/randen.js hangt zijn luisteraars
       pas 60 ms na DOMContentLoaded op, en alleen als er iets te openen valt;
       `window.RTGRanden` is het teken dat hij klaar is.

       Deze regel stond er niet, en dat viel niet op zolang de navigatie op
       `load` wachtte -- die tijd dekte het toe. In de e2e-ronde van 20 augustus
       zakte deze toets een keer op precies dat gat: de haal ging over een
       pagina die nog niet luisterde, en daarna wachtte hij acht seconden op een
       #osCcScan die verborgen bleef. Dat is dus geen bijwerking van de
       omzetting maar een race die er al zat. Zelfde reparatie als in
       test/vooruitscherm.e2e.js. */
    await page.waitForFunction(() => !!window.RTGRanden, null, { timeout: 20000 });
    await page.mouse.move(196, 4);
    await page.mouse.down();
    // een veeg is een reeks bewegingen, geen sprong: `steps` in plaats van pauzes
    for (const y of [20, 50, 90, 130]) await page.mouse.move(196, y, { steps: 4 });
    await page.mouse.up();
    await page.waitForSelector('#osCcScan', { state: 'visible', timeout: 8000 });
    await page.click('#osCcScan');
    await page.waitForSelector('.rtg-scan-ov', { timeout: 8000 });
    await page.click('[data-hand]');
    await page.waitForSelector('.rtg-scan-hand.aan', { timeout: 5000 });
    await page.fill('.rtg-scan-hand input', payload);
    await page.evaluate(() => { const f = document.querySelector('.rtg-scan-hand'); if (f) f.requestSubmit(); });

    // 6) het menu van KIKUNOI opent
    await page.waitForSelector('#menu-sheet.open', { timeout: 10000 });
    const naam = await page.textContent('#msName');
    assert.ok(naam && naam.trim().length > 0, 'de menukaart toont de naam van de zaak');
    // en de gescande tafel staat voorgekozen (als de zaak tafels heeft)
    const gekozen = await page.evaluate(() => { const s = document.getElementById('msTable'); return s ? s.value : null; });
    if (gekozen !== null) assert.equal(gekozen, tafel, 'de gescande tafel is voorgekozen');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens de scan-stroom');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
