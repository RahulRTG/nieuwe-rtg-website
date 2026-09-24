/* MAGNAAT VAN NUL IN EEN ECHTE BROWSER: van de voorzijde naar Vandaag, en de
   eerste stappen van de keten met de Edge als bediening.

   Wat deze toets vasthoudt en wat geen unittoets kon zien: de handeling die nu
   het meest zin heeft is de hoofdactie van de Edge, en de Edge neemt die knop
   OVER. De eerste versie tekende per beurt een nieuwe knop, en dan bleven de
   oude in de Edge-voet staan -- na drie stappen stonden er drie hoofdacties,
   waarvan twee niet meer bestonden. Daarom: precies een hoofdactie, en die
   noemt de actuele stap. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, edgeBediening, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('Van Nul: voorzijde, Vandaag, project, netwerk en offerte via de Edge', { timeout: 240000, skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vannul-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const r = await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Nul Speler', email: 'nul@x.nl', phone: '0612345678', password: 'geheim12345', geboortedatum: '1984-04-04', tier: 'rtg' }) })).json();
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
    await page.waitForFunction(() => /63,00/.test(document.getElementById('vnKas').textContent), null, { timeout: 20000 });
    assert.equal(await page.$eval('#vnNavBedrijf', e => getComputedStyle(e).display), 'none', 'Mijn bedrijf bestaat pas met een onderneming');

    const hoofdacties = () => page.$$eval('[data-hoofdactie]', bs => bs.map(b => b.textContent.trim()));
    const waarom = (re) => page.waitForFunction(r => new RegExp(r).test(document.getElementById('vnWaarom').textContent), re.source, { timeout: 10000 });

    await edgeBediening(page, 'Begin een eigen project');
    await page.selectOption('#vnAanbod', 'websites');
    await page.click('[data-vn-doe]');
    await waarom(/Netwerken/);
    assert.match(await page.textContent('#vnKas'), /44,00/, 'de software is afgeschreven, door het grootboek');
    assert.deepEqual(await hoofdacties(), ['Netwerken'], 'precies een hoofdactie, en het is de actuele');

    await edgeBediening(page, 'Netwerken');
    await waarom(/Offerte aan/);
    assert.deepEqual(await hoofdacties(), ['Offerte aan Bakkerij Van Dam']);

    await edgeBediening(page, 'Offerte aan Bakkerij Van Dam');
    await page.fill('#vnBedrag', '1100');
    await page.click('[data-vn-doe]');
    await page.waitForFunction(() => /Offertes/.test(document.getElementById('vnRtg').textContent), null, { timeout: 10000 });
    assert.equal(await page.$eval('#vnFout', e => e.hidden), true);

    await page.click('[data-screen="netwerk"]');
    assert.match(await page.textContent('#vnNetwerk'), /Bakkerij Van Dam.*offerte verstuurd/);
    await page.click('[data-screen="geld"]');
    assert.match(await page.textContent('#vnGeld'), /-€\s?19,00/, 'een uitgave draagt een minteken');
    assert.match(await page.textContent('#vnGeld'), /gelijk aan je rekening in het grootboek/);
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    try { child.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
