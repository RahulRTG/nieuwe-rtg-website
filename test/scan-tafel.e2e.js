/* Scherm-test: de tafel-QR-stroom in de leden-app. We loggen als lid in (token
   in localStorage), openen de app, klikken op de scan-knop en voeren met de hand
   een tafel-QR-payload in (headless heeft geen camera). De app hoort dan het menu
   van die zaak te openen met de tafel voorgekozen: precies de "scan en bestel"-
   belofte. Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: node --experimental-sqlite --test test/scan-tafel.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scan-')); }
function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) {}
  return null;
}
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
    const fouten = [];
    page.on('pageerror', e => fouten.push(e.message));
    await page.addInitScript(([tok]) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, [reg.token]);
    await page.goto(base + '/apps/app.html', { waitUntil: 'load' });

    // 4) de eigen QR-onderdelen zijn geladen en de scan-knop staat er
    await page.waitForSelector('#scanBtn', { timeout: 15000 });
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

    // 5) scan-knop -> overlay -> met de hand de tafel-QR invoeren
    await page.click('#scanBtn');
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
