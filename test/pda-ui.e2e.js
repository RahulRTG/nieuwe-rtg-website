/* Scherm-test: de PDA draait in een echte browser (Playwright). Zo valt de
   frontend-logica ook onder de suite, en is een refactor van een scherm net zo
   veilig als de backend. We slaan de login-UI over door een staf-token via de
   API te halen en in localStorage te zetten; de PDA herstelt dan de sessie zelf.
   Draait alleen waar Playwright beschikbaar is (net als de a11y-keuring); anders
   wordt de test netjes overgeslagen.
   Draai: npm run e2e  (of node --test test/pda-ui.e2e.js) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Elke browsertest krijgt een verse, eigen datamap, zodat runs elkaar niet in de
// weg zitten (anders botst bijv. een tweede registratie op "account bestaat al").
function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-e2e-')); }

// Playwright staat globaal geinstalleerd (zoals scripts/a11y.js hem vindt).
/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

async function api(base, pad, body) {
  return (await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })).json();
}

test('PDA in de browser: trainingskaart rendert, tips klappen uit, gelezen-voortgang werkt',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    // 1) staf-token via de API (login-UI overslaan)
    const roster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const staff = roster.staff.find(x => x.role !== 'manager');
    const login = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: staff.id, pin: '5678' });
    assert.ok(login.token, 'staf-login geeft een token');

    // 2) browser openen, token in localStorage, PDA herstelt de sessie
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript(([tok, code]) => {
      localStorage.setItem('rtg_pda_token', tok);
      localStorage.setItem('rtg_pda_code', code);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); // taalkeuze-modal overslaan
    }, [login.token, 'KIKUNOI']);
    await page.goto(base + '/apps/personeel.html', { waitUntil: 'domcontentloaded' });

    // 3) naar de Hulp-tab; de trainingskaart moet verschijnen
    // het Werk-OS verbergt de tabbar; de Hulp-app opent via het dock
    await page.waitForSelector('.wos-dock button[data-tab="hulp"]', { state: 'visible', timeout: 10000 });
    await page.click('.wos-dock button[data-tab="hulp"]');
    await page.waitForSelector('#trainKaart .card', { timeout: 10000 });
    const kop = await page.textContent('#trainKaart .k');
    assert.match(kop, /Training/i, 'de kaart toont de kop Training & tips');

    // 4) tips uitklappen -> er verschijnen tip-rijen
    await page.click('#trainKaart >> text=Alle tips');
    await page.waitForSelector('#trainKaart .task', { timeout: 5000 });
    const aantalTips = await page.locator('#trainKaart .task').count();
    assert.ok(aantalTips > 0, 'de tip-lijst is uitgeklapt met tips');

    // 5) eerste tip als gelezen markeren -> de voortgang loopt op naar "1 / N".
    //    Wacht op de uitkomst (niet op een vaste tijd), zodat de test ook onder
    //    parallelle belasting betrouwbaar is.
    await page.locator('#trainKaart .task button.ic').first().click();
    // wacht tot de voortgang "N / M gelezen" op minstens 1 staat (het derde
    // argument zijn de opties; het tweede is het functie-argument)
    await page.waitForFunction(() => {
      const el = document.getElementById('trainKaart');
      const m = el && el.textContent.match(/(\d+) \/ \d+ gelezen/);
      return !!(m && Number(m[1]) >= 1);
    }, undefined, { timeout: 20000 });

    // 6) geen onopgevangen JS-fouten in de pagina
    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* De pauzeknop hoort op het scherm te staan waar hij gebruikt wordt: op de PDA,
   naast de klok. De route /api/staff/pauze bestond al en werd afgerekend in
   test/werkbeleid-dienst.test.js; een route zonder knop is voor de medewerker
   nog steeds geen pauze. Wat deze test ook vastlegt: op dat scherm staat een
   MINUTENteller en geen woord over wat er in die minuten gebeurde. */
test('PDA in de browser: pauze staat naast de klok, en telt minuten en niets anders',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const roster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const staff = roster.staff.find(x => x.role !== 'manager');
    const login = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: staff.id, pin: '5678' });

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript(([tok, code]) => {
      localStorage.setItem('rtg_pda_token', tok);
      localStorage.setItem('rtg_pda_code', code);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, [login.token, 'KIKUNOI']);
    await page.goto(base + '/apps/personeel.html', { waitUntil: 'domcontentloaded' });

    // uitgeklokt is er geen pauze te nemen: de knop hoort er dan niet te staan
    await page.waitForSelector('#klokBtn', { timeout: 12000 });
    assert.equal(await page.locator('#pauzeBtn').count(), 0, 'zonder dienst geen pauzeknop');

    await page.click('#klokBtn');
    await page.waitForSelector('#pauzeBtn', { timeout: 15000 });
    const voor = await page.textContent('#todayWrap');
    assert.match(voor, /45\/45 min/, 'het hele budget staat er nog');

    await page.click('#pauzeBtn');
    await page.waitForFunction(() => {
      const b = document.getElementById('pauzeBtn');
      return b && /klaar/i.test(b.textContent);
    }, undefined, { timeout: 20000 });

    /* Wat er op het scherm staat gaat over TIJD. Zou hier staan wat er in de
       pauze gebeurde, dan hield dit scherm bij hoeveel minuten iemand op De
       Salon zat -- precies de meting waar het werkbeleid tegen beschermt. */
    const tijdens = await page.textContent('#todayWrap');
    assert.match(tijdens, /min/, 'de teller loopt op minuten');
    assert.doesNotMatch(tijdens, /Salon|bekeken|schermtijd/i, 'en zegt niets over wat er in die minuten gebeurde');

    await page.click('#pauzeBtn');
    await page.waitForFunction(() => {
      const b = document.getElementById('pauzeBtn');
      return b && !/klaar/i.test(b.textContent);
    }, undefined, { timeout: 20000 });

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

test('PDA in de browser: een gast vraagt aandacht, het personeel ziet het op Vandaag en handelt het af',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = verseDataDir();
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    // 1) staf-token
    const roster = await api(base, '/api/supplier/roster', { code: 'KIKUNOI' });
    const staff = roster.staff.find(x => x.role !== 'manager');
    const login = await api(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: staff.id, pin: '5678' });
    assert.ok(login.token, 'staf-login geeft een token');

    // 2) een lid (gast) registreert en vraagt aandacht aan tafel 5
    const reg = await api(base, '/api/auth/register', { name: 'Gast Lid', email: 'attn@x.nl', phone: '0612345799',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' });
    assert.ok(reg.token, 'lid-registratie geeft een token');
    const aandacht = await fetch(base + '/api/aandacht', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: JSON.stringify({ supplierCode: 'KIKUNOI', table: 'Tafel 5', reden: 'rekening' }) });
    assert.equal(aandacht.status, 200, 'het aandacht-verzoek is geplaatst');

    // 3) personeel opent de PDA; het Vandaag-scherm toont het verzoek
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript(([tok, code]) => {
      localStorage.setItem('rtg_pda_token', tok);
      localStorage.setItem('rtg_pda_code', code);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, [login.token, 'KIKUNOI']);
    await page.goto(base + '/apps/personeel.html', { waitUntil: 'domcontentloaded' });

    await page.waitForSelector('#todayWrap [data-aankl]', { timeout: 12000 });
    const tekst = await page.textContent('#todayWrap');
    assert.match(tekst, /Tafel 5/, 'de tafel staat op het scherm');
    assert.match(tekst, /rekening/i, 'de reden (om de rekening) staat op het scherm');

    // 4) afhandelen met de Help-knop; daarna is het verzoek van het scherm af
    await page.locator('#todayWrap [data-aankl]').first().click();
    await page.waitForFunction(() => document.querySelectorAll('#todayWrap [data-aankl]').length === 0,
      undefined, { timeout: 20000 });

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
