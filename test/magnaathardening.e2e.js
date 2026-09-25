/* MAGNAAT V5 IN EEN ECHTE BROWSER: het antwoord gaat verloren nadat de server
   de handeling al had uitgevoerd. Dat is het lastige geval van een verbroken
   verbinding: de speler ziet een fout, maar de dag is wel afgesloten. De client
   verstuurt dezelfde handeling met dezelfde sleutel nog een keer, en de server
   voert hem niet twee keer uit -- de dag gaat een keer vooruit, niet twee. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, wachtOpNetstilte } = require('./helper');

const pw = laadPlaywright();

test('V5: een verloren antwoord wordt opnieuw gevraagd, en de dag gaat maar een keer vooruit', { timeout: 240000, skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-hardening-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const r = await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Vijf Speler', email: 'vijf@x.nl', phone: '0612345671', password: 'geheim12345', geboortedatum: '1984-04-04', tier: 'rtg' }) })).json();
    assert.ok(r.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1400, height: 950 } });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); }, r.token);
    await page.goto(base + '/apps/magnaat.html', { waitUntil: 'domcontentloaded' });
    await page.click('[data-mv-diep="vandaag"]');
    await page.waitForFunction(() => /dag 1\b/.test(document.getElementById('vnDag').textContent), null, { timeout: 20000 });

    /* Het eerste verzoek bereikt de server en wordt uitgevoerd, maar het antwoord komt nooit aan. */
    const verzoeken = [];
    let eerste = true;
    await page.route('**/api/member/magnaat/leven/actie', async (route) => {
      verzoeken.push(JSON.parse(route.request().postData()));
      if (eerste) { eerste = false; await route.fetch(); return route.abort('connectionreset'); }
      return route.continue();
    });
    await page.locator('.vn-acties button', { hasText: 'Sluit de dag af' }).click();
    await page.waitForFunction(() => /dinsdag, dag 2/.test(document.getElementById('vnDag').textContent), null, { timeout: 15000 });
    await wachtOpNetstilte(page);                // geen derde verzoek meer onderweg
    assert.equal(verzoeken.length, 2, 'een keer verstuurd, een keer opnieuw');
    assert.equal(verzoeken[0].verzoek, verzoeken[1].verzoek, 'met dezelfde sleutel');
    const s = await (await fetch(base + '/api/member/magnaat/leven/staat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + r.token }, body: '{}' })).json();
    assert.equal(s.dag, 2, 'de dag ging een keer vooruit, niet twee');
    assert.equal(await page.textContent('#vnFout'), '');
    assert.deepEqual(fouten.filter(f => !/ERR_CONNECTION_RESET|Failed to fetch|net::/.test(f)), []);
  } finally {
    if (browser) await browser.close();
    try { child.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
