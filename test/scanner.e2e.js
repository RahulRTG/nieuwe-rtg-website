/* Scherm-test voor RTG Scanner: foto's kiezen (de weg die ook zonder camera
   werkt), de paginastrook, en bewaren als PDF die als gewoon bestand in de
   Bestanden-kluis belandt (map Scans). De camera zelf valt buiten headless
   bereik. Draait alleen waar een browser beschikbaar is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==', 'base64');

test('Scanner: foto\'s kiezen, de strook vult zich en de PDF landt in de kluis',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scanner-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Scanlid', email: 'sc' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1987-01-01', geslacht: 'm', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/scanner.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_member_token', t);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/scanner.html', { waitUntil: 'domcontentloaded' });

    /* twee foto's kiezen -> twee pagina's in de strook, bewaarknoppen zichtbaar */
    await page.setInputFiles('#kies', [
      { name: 'blz1.jpg', mimeType: 'image/jpeg', buffer: JPEG },
      { name: 'blz2.jpg', mimeType: 'image/jpeg', buffer: JPEG }
    ]);
    await page.waitForFunction(() => document.querySelectorAll('#strook .pag').length === 2, null, { timeout: 8000 });

    /* een pagina weghalen kan gewoon */
    await page.evaluate(() => { document.querySelector('[data-weg]').click(); });
    await page.waitForFunction(() => document.querySelectorAll('#strook .pag').length === 1, null, { timeout: 8000 });

    /* bewaren als PDF -> de kluis heeft een scan-*.pdf in de map Scans */
    await page.evaluate(() => { document.querySelector('#bewaarPdf').click(); });
    await page.waitForFunction(() => /bewaard in je kluis/.test(document.querySelector('#melding').textContent), null, { timeout: 8000 });
    const kluis = await fetch(base + '/api/bestanden/mijn', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: '{}' }).then(r => r.json());
    const map = kluis.mappen.find(m => m.naam === 'Scans');
    const pdf = kluis.items.find(x => /^scan-.*\.pdf$/.test(x.naam));
    assert.ok(map && pdf && pdf.map === map.id, 'de PDF staat als gewoon bestand in de map Scans');
    assert.equal(pdf.mime, 'application/pdf');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de pagina');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
