/* Scherm-test: "Toon je Zegel" in de leden-app. Het lid opent de Zegel-knop,
   kiest een feit (18+ staat standaard aan) en toont het. De app hoort dan via
   /api/zegel/maak een token te halen en er met onze eigen codec een QR van te
   tekenen, met de badge "RTG-geverifieerd" en de bewezen claim. Zo is de hele
   ID-check-kant (lid toont) in een echte browser getoetst. Overgeslagen zonder
   browser. Draai: node --experimental-sqlite --test test/zegel-ui.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function verseDataDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-zguI-')); }
function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) {}
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) {}
  return null;
}
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
    page.on('pageerror', e => fouten.push(e.message));
    await page.addInitScript(([tok]) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, [reg.token]);
    await page.goto(base + '/apps/app.html', { waitUntil: 'load' });
    await page.waitForSelector('#zegelBtn', { timeout: 15000 });
    await page.evaluate(() => { const g = document.getElementById('onbGate'); if (g) g.hidden = true; });

    await page.click('#zegelBtn');
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
