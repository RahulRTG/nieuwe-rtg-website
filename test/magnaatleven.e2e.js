/* MAGNAAT FROM ZERO IN EEN ECHTE BROWSER: van de voorzijde naar Vandaag, en de
   eerste dag met de Edge als bediening -- kiezen wat je maakt, tijd plannen in
   je agenda, een blok schrappen, en de dag afsluiten.

   Wat deze toets vasthoudt en wat geen unittoets kon zien: de handeling die nu
   het meest zin heeft is de hoofdactie van de Edge, en de Edge neemt die knop
   OVER. Een eerdere versie tekende per beurt een nieuwe knop, en dan bleven de
   oude in de Edge-voet staan. Daarom: precies een hoofdactie, en die noemt de
   actuele stap. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, edgeBediening, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('FROM ZERO: voorzijde, Vandaag, kiezen, plannen, schrappen en de dag afsluiten via de Edge', { timeout: 240000, skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-fromzero-'));
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
    await page.waitForFunction(() => /64,32/.test(document.getElementById('vnKas').textContent), null, { timeout: 20000 });
    assert.match(await page.textContent('#vnDag'), /maandag, dag 1/);
    assert.match(await page.textContent('#vnAgenda'), /Telefoon en zorgverzekering/, 'de betaling van woensdag staat in je week');
    assert.equal(await page.$eval('#vnNavBedrijf', e => getComputedStyle(e).display), 'none', 'Mijn bedrijf bestaat pas met een onderneming');

    const hoofdacties = () => page.$$eval('[data-hoofdactie]', bs => bs.map(b => b.textContent.trim()));
    const waarom = (re) => page.waitForFunction(r => new RegExp(r).test(document.getElementById('vnWaarom').textContent), re.source, { timeout: 10000 });

    await edgeBediening(page, 'Kies wat je gaat maken');
    await page.selectOption('#vnF-aanbod', 'websites');
    await page.click('[data-vn-doe]');
    await waarom(/Werk aan je eigen portfolio-site/);
    assert.deepEqual(await hoofdacties(), ['Werk aan je eigen portfolio-site'], 'precies een hoofdactie, en het is de actuele');

    await edgeBediening(page, 'Werk aan je eigen portfolio-site');
    await page.selectOption('#vnF-minuten', '240');
    await page.click('[data-vn-doe]');
    await page.waitForFunction(() => /eigen project/.test(document.getElementById('vnAgenda').textContent), null, { timeout: 10000 });
    assert.match(await page.textContent('#vnKlok'), /nog 20m vrij vandaag/);

    await page.click('[data-vn-schrap="1:0"]');
    await page.waitForFunction(() => /nog 4u 20m vrij/.test(document.getElementById('vnKlok').textContent), null, { timeout: 10000 });

    await page.locator('.vn-acties button', { hasText: 'Sluit de dag af' }).click();
    await page.waitForFunction(() => /dinsdag, dag 2/.test(document.getElementById('vnDag').textContent), null, { timeout: 10000 });
    assert.match(await page.textContent('#vnKas'), /57,32/, 'boodschappen door het grootboek');

    await page.click('[data-screen="geld"]');
    const geld = await page.textContent('#vnGeld');
    assert.match(geld, /Op je rekening.*Nog te ontvangen.*Resultaat van je werk/);
    assert.match(geld, /Een factuur is omzet, geen geld/);
    assert.match(geld, /-€\s?7,00/, 'een uitgave draagt een minteken');
    assert.match(geld, /gelijk aan je rekening in het grootboek/);
    await page.click('[data-screen="werkplek"]');
    assert.match(await page.textContent('#vnWerk'), /Keukenmedewerker bij Brasserie De Haven/);
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    try { child.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
