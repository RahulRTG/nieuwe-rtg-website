/* Magnaat na 1.0, SAMEN IN EEN OUDWIJK IN TWEE ECHTE BROWSERS, op telefoons.
   Speler A maakt onder Wereld een stad en krijgt een code; speler B doet mee
   met die code; A begint. Beiden zien de balk boven Vandaag. A sluit de dag af
   en wacht; B sluit af, en A ziet -- zonder zelf iets te doen, via het seintje
   van de server -- dat de stad op dag 2 staat. Geen horizontale scroll. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, wachtOpTekst } = require('./helper');

const pw = laadPlaywright();

test('op twee telefoons: een stad maken, meedoen met de code, en samen een dag verder', { timeout: 240000, skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-stad-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const lid = async (n) => (await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Stad Speler ' + n, email: 'stadb' + n + '@x.nl', phone: '061234568' + n, password: 'geheim12345', geboortedatum: '1984-04-04', tier: 'rtg' }) })).json()).token;
    browser = await pw.chromium.launch(browserOpties(pw));
    const fouten = [];
    const open = async (tok) => {
      const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();
      letOpFouten(page, fouten);
      await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate(t => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); }, tok);
      await page.goto(base + '/apps/magnaat.html', { waitUntil: 'domcontentloaded' });
      await page.click('[data-mv-diep="vandaag"]');
      await wachtOpTekst(page, '64,32', { in: '#vnKas' });
      await page.evaluate(() => window.go('wereld'));
      await wachtOpTekst(page, 'Samen in een Oudwijk', { in: '#vnSamen' });
      return page;
    };
    const a = await open(await lid(1)), b = await open(await lid(2));

    await a.click('[data-vn-stad="maak"]');
    await wachtOpTekst(a, 'Geef deze code', { in: '#vnSamen' });
    const code = (await a.textContent('.vn-stadcode')).trim();
    assert.match(code, /^[A-Z0-9]{6}$/);
    assert.ok(await a.$eval('[data-vn-stad="start"]', (k) => k.disabled), 'alleen is beginnen nog niet mogelijk');

    await b.fill('#vnStadCode', code);
    await b.click('[data-vn-stad="doe"]');
    await wachtOpTekst(b, 'Wie de stad maakte, zet hem in gang', { in: '#vnSamen' });
    await wachtOpTekst(a, '(jij)', { in: '#vnSamen' });
    await a.waitForFunction(() => !document.querySelector('[data-vn-stad="start"]').disabled);
    await a.click('[data-vn-stad="start"]');

    for (const p of [a, b]) {
      await p.evaluate(() => window.go('vandaag'));
      await wachtOpTekst(p, 'Samen in Oudwijk · dag 1', { in: '#vnStadBalk' });
    }
    assert.ok(await a.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'geen horizontale scroll');

    const sluit = async (p) => {
      const hoofd = p.locator('#vnHoofd');
      if ((await hoofd.textContent()).includes('Sluit de dag af')) return hoofd.click();
      return p.locator('#vnActies button', { hasText: 'Sluit de dag af' }).click();
    };
    await sluit(a);
    await wachtOpTekst(a, 'wacht op 1 speler', { in: '#vnStadBalk' });
    await sluit(b);
    await wachtOpTekst(b, 'dag 2', { in: '#vnStadBalk' });
    await wachtOpTekst(a, 'dag 2', { in: '#vnStadBalk' });
    await wachtOpTekst(a, 'dag 2', { in: '#vnDag' });
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    try { child.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
