/* Magnaat na 1.0, GROEIEN IN EEN ECHTE BROWSER, op een telefoon. Een leven dat
   van zijn bedrijf leeft, speelt de toets in de kern (de automatische speler);
   de browser krijgt die staat als antwoord op /staat. Mijn bedrijf toont het blok
   "Groeien", op Vandaag staan krediet en overname tussen de handelingen, en een
   overname gaat naar de ECHTE server -- die hem weigert, want het leven op de
   server leeft nog niet van zijn bedrijf, en die reden staat op het scherm. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, wachtOpTekst } = require('./helper');
const { maakSpeler } = require('./lib-magnaatspeler');

const pw = laadPlaywright();

test('op een telefoon: groeien in Mijn bedrijf, en een overname die de server met reden weigert', { timeout: 240000, skip: geenBrowser(pw) }, async () => {
  const p = maakSpeler({});
  for (let i = 0; i < 200 && !p.st().zelfstandig; i++) p.dag();
  const staat = JSON.parse(JSON.stringify(p.L.staat(p.key)));
  assert.ok(staat.bedrijf.groei.open);

  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-groei-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const r = await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Groei Speler', email: 'groei@x.nl', phone: '0612345674', password: 'geheim12345', geboortedatum: '1984-04-04', tier: 'rtg' }) })).json();
    assert.ok(r.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.route('**/api/member/magnaat/leven/staat', (route) => route.fulfill({ json: staat }));
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_member_token', t); }, r.token);
    await page.goto(base + '/apps/magnaat.html', { waitUntil: 'domcontentloaded' });
    await page.click('[data-mv-diep="vandaag"]');
    await wachtOpTekst(page, 'Neem een concurrent over', { in: '#vnActies' });
    assert.ok(await page.locator('#vnActies button', { hasText: 'Vraag een krediet bij de bank' }).count());

    await page.evaluate(() => window.go('bedrijf'));
    await wachtOpTekst(page, 'Groeien', { in: '#vnBedrijf' });
    await wachtOpTekst(page, 'de bank leent je nu tot', { in: '#vnBedrijf' });

    await page.evaluate(() => window.go('vandaag'));
    await page.locator('#vnActies button', { hasText: 'Neem een concurrent over' }).click();
    await page.selectOption('#vnF-bedrijf', 'noord');
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'geen horizontale scroll met het keuzeveld open');
    await page.click('[data-vn-doe]');
    await wachtOpTekst(page, 'zeg eerst je baan op', { in: '#vnFout' });
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    try { child.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
