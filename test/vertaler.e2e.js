/* Scherm-test voor RTG Vertaler: inloggen, typen, de live-vertaling (met de
   halve-seconde-rustpauze), een reiszin aantikken en bewaren op het toestel.
   Draait alleen waar een browser beschikbaar is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

test('Vertaler: live vertalen, een reiszin aantikken en bewaren op het toestel',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vertaler-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, ANTHROPIC_API_KEY: '' } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Taallid', email: 've' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1991-05-05', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    if (page.on) page.on('pageerror', e => fouten.push(e.message));
    await page.goto(base + '/apps/vertaler.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/vertaler.html', { waitUntil: 'domcontentloaded' });

    /* de talen staan klaar en nl->en is de standaard */
    await page.waitForFunction(() => document.querySelectorAll('#taalVan option').length >= 10, null, { timeout: 8000 });
    assert.equal(await page.evaluate(() => document.querySelector('#taalVan').value), 'nl');

    /* typen -> na de rustpauze staat de vertaling er (huiswoordenboek: hallo -> hello) */
    await page.evaluate(() => {
      const inp = document.querySelector('#invoer');
      inp.value = 'hallo';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForFunction(() => /hello/i.test(document.querySelector('#uitPaneel').textContent), null, { timeout: 8000 });

    /* bewaren blijft op het toestel */
    await page.evaluate(() => { document.querySelector('#bewaarZin').click(); });
    await page.waitForFunction(() => !document.querySelector('#bewaardKop').style.display &&
      /hallo/.test(document.querySelector('#bewaard').textContent), null, { timeout: 8000 });
    assert.ok(await page.evaluate(() => (localStorage.getItem('rtg_vertaal_vast') || '').includes('hallo')),
      'de bewaarde zin staat in localStorage, niet op de server');

    /* een reiszin aantikken vult de invoer en vertaalt */
    await page.evaluate(() => { document.querySelector('#reisZinnen .zin').click(); });
    await page.waitForFunction(() => document.querySelector('#invoer').value.length > 0, null, { timeout: 8000 });

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
