/* MAGNAAT V4 OP EEN TELEFOON, in een echte browser. Wat hier vastligt en geen
   servertoets kan zien: geen horizontale scroll op de FROM ZERO-schermen bij
   390 pixels, de gids staat erboven, de moeilijkheid kies je via de Edge, de
   nieuwste melding gaat naar een aria-live-regio, en geluid staat uit tot je
   het zelf aanzet -- en blijft dan aan na herladen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, edgeBediening, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('V4 op een telefoon: gids, moeilijkheid, live regio, geluid en geen horizontale scroll', { timeout: 240000, skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-afwerking-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const r = await (await fetch(base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Vier Speler', email: 'vier@x.nl', phone: '0612345670', password: 'geheim12345', geboortedatum: '1984-04-04', tier: 'rtg' }) })).json();
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
    await page.waitForFunction(() => /64,32/.test(document.getElementById('vnKas').textContent), null, { timeout: 20000 });

    assert.match(await page.textContent('#vnGids'), /Je eerste stappen · 0 van 9.*Kies wat je gaat maken/);

    await page.locator('#vnActies button', { hasText: 'Kies hoe zwaar het is' }).click();
    await page.selectOption('#vnF-stand', 'zwaar');
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollWidth <= innerWidth), 'ook met een open invulveld met lange keuzes geen horizontale scroll');
    await page.click('[data-vn-doe]');
    await page.waitForFunction(() => /15,00/.test(document.getElementById('vnKas').textContent), null, { timeout: 10000 });

    /* Op een telefoon neemt de Edge de hoofdactie over: je bedient hem daar. */
    await edgeBediening(page, 'Kies wat je gaat maken');
    await page.selectOption('#vnF-aanbod', 'foto');
    await page.click('[data-vn-doe]');
    await page.waitForFunction(() => /Je begint aan een eigen fotoserie/.test(document.getElementById('vnLive').textContent), null, { timeout: 10000 });
    assert.equal(await page.getAttribute('#vnLive', 'aria-live'), 'polite');
    assert.match(await page.textContent('#vnGids'), /1 van 9/);

    for (const scherm of ['vandaag', 'wereld', 'geld', 'netwerk']) {
      await page.evaluate(x => window.go(x), scherm);
      const m = await page.evaluate(() => ({ breed: document.scrollingElement.scrollWidth, scherm: innerWidth }));
      assert.ok(m.breed <= m.scherm, scherm + ': geen horizontale scroll (' + m.breed + ' > ' + m.scherm + ')');
    }

    await page.evaluate(() => window.go('wereld'));
    assert.match(await page.textContent('#vnWereld'), /Jouw verhaal/);
    const knop = page.locator('[data-vn-geluid]');
    assert.equal(await knop.getAttribute('aria-pressed'), 'false', 'geluid staat uit tot je het aanzet');
    await knop.click();
    assert.equal(await knop.getAttribute('aria-pressed'), 'true');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.click('[data-mv-diep="vandaag"]');
    await page.waitForFunction(() => /15,00|8,00/.test(document.getElementById('vnKas').textContent), null, { timeout: 20000 });
    await page.evaluate(() => window.go('wereld'));
    assert.equal(await page.locator('[data-vn-geluid]').getAttribute('aria-pressed'), 'true', 'de keuze blijft in deze browser');
    assert.deepEqual(fouten, []);
  } finally {
    if (browser) await browser.close();
    try { child.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
