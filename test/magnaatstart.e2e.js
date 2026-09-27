/* Magnaat na 1.0, WAAR JE BEGINT IN EEN ECHTE BROWSER, op een telefoon. Op dag 1
   kies je via de handelingen een kleine erfenis en staat het geld van je tante op
   de bank; daarna begin je onder Wereld opnieuw als student, en de stad noemt
   je nieuwe werkgever. Geen horizontale scroll met het keuzeveld open. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, wachtOpTekst } = require('./helper');

const pw = laadPlaywright();

test('op een telefoon: een erfenis op dag 1, en opnieuw beginnen als student', { timeout: 240000, skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-start-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const r = await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Start Speler', email: 'start@x.nl', phone: '0612345673', password: 'geheim12345', geboortedatum: '1984-04-04', tier: 'rtg' }) })).json();
    assert.ok(r.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); }, r.token);
    await page.goto(base + '/apps/magnaat.html', { waitUntil: 'domcontentloaded' });
    await page.click('[data-mv-diep="vandaag"]');
    await wachtOpTekst(page, '64,32', { in: '#vnKas' });

    await page.locator('#vnActies button', { hasText: 'Kies waar je begint' }).click();
    await page.selectOption('#vnF-begin', 'erfenis');
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'geen horizontale scroll met het keuzeveld open');
    await page.click('[data-vn-doe]');
    await wachtOpTekst(page, '8.064,32', { in: '#vnKas' });

    await page.evaluate(() => window.go('wereld'));
    await wachtOpTekst(page, 'Bakkerij Van Dam', { in: '#vnWereld' });
    assert.equal(await page.inputValue('#vnStart'), 'erfenis');
    await page.selectOption('#vnStart', 'student');
    await page.click('[data-vn-opnieuw]');
    await page.click('[data-vn-opnieuw]');
    await wachtOpTekst(page, 'Supermarkt De Linde', { in: '#vnWereld' });
    assert.equal(await page.inputValue('#vnStart'), 'student');
    await page.evaluate(() => window.go('vandaag'));
    await wachtOpTekst(page, '64,32', { in: '#vnKas' });
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    try { child.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
