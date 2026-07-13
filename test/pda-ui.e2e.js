/* Scherm-test: de PDA draait in een echte browser (Playwright). Zo valt de
   frontend-logica ook onder de suite, en is een refactor van een scherm net zo
   veilig als de backend. We slaan de login-UI over door een staf-token via de
   API te halen en in localStorage te zetten; de PDA herstelt dan de sessie zelf.
   Draait alleen waar Playwright beschikbaar is (net als de a11y-keuring); anders
   wordt de test netjes overgeslagen.
   Draai: node --experimental-sqlite --test test/pda-ui.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

// Playwright staat globaal geinstalleerd (zoals scripts/a11y.js hem vindt).
function laadPlaywright() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende pad */ }
  }
  return null;
}
const pw = laadPlaywright();

async function api(base, pad, body) {
  return (await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) })).json();
}

test('PDA in de browser: trainingskaart rendert, tips klappen uit, gelezen-voortgang werkt',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
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
    page.on('pageerror', e => paginaFouten.push(e.message));
    await page.addInitScript(([tok, code]) => {
      localStorage.setItem('rtg_pda_token', tok);
      localStorage.setItem('rtg_pda_code', code);
      localStorage.setItem('rtg_lang', 'nl'); // taalkeuze-modal overslaan
    }, [login.token, 'KIKUNOI']);
    await page.goto(base + '/apps/personeel.html', { waitUntil: 'load' });

    // 3) naar de Hulp-tab; de trainingskaart moet verschijnen
    await page.waitForSelector('[data-tab="hulp"]', { state: 'visible', timeout: 10000 });
    await page.click('[data-tab="hulp"]');
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
  }
});
