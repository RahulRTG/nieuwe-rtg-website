/* Scherm-test: "Toon je Zegel" in de leden-app. Het lid opent de Zegel-knop,
   kiest een feit (18+ staat standaard aan) en toont het. De app hoort dan via
   /api/zegel/maak een token te halen en er met onze eigen codec een QR van te
   tekenen, met de badge "RTG-geverifieerd" en de bewezen claim. Zo is de hele
   ID-check-kant (lid toont) in een echte browser getoetst. Overgeslagen zonder
   browser. Draai: node --test test/zegel-ui.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, bankDeur } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zguI-')); }
/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
  return (await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })).json();
}

test('leden-app: Toon je Zegel -> QR met RTG-geverifieerd en de bewezen claim',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await api(base, '/api/auth/register', { name: 'Zegel Toon', email: 'zt@x.nl', phone: '0612345677',
      password: 'geheim123', geboortedatum: '1990-03-03', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'lid geregistreerd');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(([tok]) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, [reg.token]);
    /* HIER BLIJFT `load` STAAN, en dat is gemeten en geen verzuim.

       In de ronde van TAKEN.md 4.39 is dit bestand omgezet naar
       `domcontentloaded`, zoals de dertig andere. Daar zakte hij op vier van de
       vijf rondes: de bank van de werktafel (`#rtgCommand .cmd-bank`) was er dan
       binnen de tien seconden van openBank() nog niet. Die bank hangt aan een
       script achteraan een keten (de taalrail laadt zichzelf bij), en met `load`
       gaat die tijd VOOR de eerste bewering zitten in plaats van erin.

       Het alternatief -- omzetten en er een ruimere wacht naast leggen -- is een
       groter venster om een race mee toe te dekken, en dat is precies wat deze
       ronde overal juist weghaalt. Liever een navigatie-eis die hier klopt. */
    await page.goto(base + '/apps/app.html', { waitUntil: 'load' });
    // Sinds het OS-beginscherm zit "Toon je Zegel" in het bedieningspaneel en
    // niet meer als los knopje in de statusbalk; de knop zelf blijft het model.
    await page.waitForSelector('#zegelBtn', { state: 'attached', timeout: 15000 });
    await page.waitForFunction(() => document.getElementById('app')?.classList.contains('active'),
      null, { timeout: 60000 });
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });
    /* HET BEDIENINGSPANEEL OPENEN ZOALS EEN LID DAT DOET.

       Hier stonden twee stappen: eerst de knop in de bank naar het springboard,
       daarna de knop in de statusbalk daar. Dat springboard is als scherm weg
       (WERELD.md) en het paneel hangt nu aan de voet van de bank -- dezelfde
       deur die een lid ziet, één stap in plaats van twee.

       Via openBank() en niet via .cmd-lade: deze pagina draait op de
       standaardbreedte van Playwright, en daar is de bank een vaste rail
       zonder greep. Zie test/helper.js. */
    await bankDeur(page, 'Instellingen');
    await page.waitForSelector('#osCcScrim.open', { timeout: 8000 });
    await page.waitForSelector('#osCcZegel', { state: 'visible', timeout: 8000 });
    await page.click('#osCcZegel');
    await page.waitForSelector('.zg-ov', { timeout: 8000 });
    // 18+ staat standaard aangevinkt; toon de Zegel
    await page.click('#zgMaak');
    await page.waitForSelector('#zgQr canvas', { timeout: 10000 });
    const badge = await page.textContent('.zg-badge');
    assert.match(badge, /geverifieerd/i, 'de badge toont RTG-geverifieerd');
    const claimCount = await page.evaluate(() => document.querySelectorAll('.zg-claim').length);
    assert.ok(claimCount >= 1, 'minstens een bewezen claim getoond');
    // de getekende QR is een echte canvas met inhoud
    const groot = await page.evaluate(() => { const c = document.querySelector('#zgQr canvas'); return c ? c.width : 0; });
    assert.ok(groot > 0, 'de QR-canvas is getekend');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens de Zegel-stroom');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
