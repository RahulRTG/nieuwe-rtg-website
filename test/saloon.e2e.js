'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const pw = require('playwright');
const { startServer, stop, browserOpties, geenBrowser, letOpFouten } = require('./helper');

test('Saloon: publiceren, reageren, bewaren, filters en mobiele bediening', { skip: geenBrowser(pw) }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-saloon-ui-'));
  let srv, browser;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '' } });
    const post = async (pad, body, token) => (await fetch(srv.base + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body) })).json();
    const reg = await post('/api/auth/register', { name: 'Saloon Scherm', email: 'scherm@example.test',
      phone: '0612345678', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
    assert.ok(reg.token);
    await post('/api/wereld/modus', { modus: 'alles', saloon: { bronnen: ['sociaal'] } }, reg.token);
    browser = await pw.chromium.launch(browserOpties(pw, { headless: true }));
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const fouten = []; letOpFouten(page, fouten);
    await page.addInitScript(token => { localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_lang', 'nl'); }, reg.token);
    await page.goto(srv.base + '/apps/wereld.html');
    await page.locator('#saloon:not([hidden])').waitFor();
    await page.locator('[data-saloon-maken]').click();
    await page.locator('dialog textarea[name="tekst"]').fill('Samen de buurt ontdekken. #saloonproef');
    await page.locator('dialog input[name="plaats"]').fill('Amsterdam');
    await page.getByRole('button', { name: 'Bericht plaatsen', exact: true }).click();
    const kaart = page.locator('[data-saloon-id]').filter({ hasText: '#saloonproef' });
    await kaart.waitFor();
    await kaart.getByRole('button', { name: 'Reacties', exact: true }).click();
    await page.locator('dialog textarea').fill('Een eigen aanvulling.');
    await page.getByRole('button', { name: 'Reactie plaatsen' }).click();
    await page.getByText('Een eigen aanvulling.', { exact: false }).first().waitFor();
    await page.getByRole('button', { name: 'Sluiten', exact: true }).click();
    await kaart.getByRole('button', { name: 'Bewaren', exact: true }).click();
    await kaart.locator('[data-bewaar][aria-pressed="true"]').waitFor();
    await page.locator('[data-vorm="bewaard"]').click();
    await page.locator('[data-vorm="bewaard"][aria-pressed="true"]').waitFor();
    await page.waitForFunction(() => document.querySelectorAll('[data-saloon-id]').length === 1);
    assert.equal(await page.locator('[data-saloon-id]').count(), 1);
    await page.reload(); await kaart.waitFor();
    assert.equal(await page.locator('[data-vorm="bewaard"]').getAttribute('aria-pressed'), 'true');
    await page.locator('[data-keuzes]').click();
    await page.locator('#saloonFilters input[name="plaats"]').fill('Rotterdam');
    await page.getByRole('button', { name: 'Keuzes toepassen' }).click();
    await page.waitForFunction(() => document.getElementById('saloonStatus').textContent.startsWith('0 resultaten'));
    assert.equal(await page.locator('[data-saloon-id]').count(), 0);
    await page.locator('#saloonFilters input[name="plaats"]').fill('Amsterdam');
    await page.getByRole('button', { name: 'Keuzes toepassen' }).click(); await kaart.waitFor();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'geen horizontale overloop op ' + width);
    }
    const rooster = await post('/api/supplier/roster', { code: 'BODE' });
    const zaak = await post('/api/supplier/login', { code: 'BODE', staffId: rooster.staff.find(x => x.role === 'manager').id, pin: '1234' });
    const bericht = await post('/api/supplier/redactie/artikel/bewaar', { titel: 'Demonstratie: de buurt in beweging',
      chapo: 'Een artikel om de publicatielus te beproeven.', inhoud: 'Dit is het volledige testverslag uit de bronredactie.', rubriek: 'Stad' }, zaak.token);
    await post('/api/supplier/redactie/artikel/publiceer', { id: bericht.artikel.id }, zaak.token);
    await post('/api/supplier/redactie/snel', { titel: 'Een tweede blik op de buurt', inhoud: 'Een tweede verslag.', rubriek: 'Stad' }, zaak.token);
    await post('/api/wereld/modus', { modus: 'alles', saloon: { bronnen: ['sociaal', 'nieuws'], plaats: '', vorm: 'overzicht' } }, reg.token);
    await page.goto(srv.base + '/apps/wereld.html?embed=1');
    const nieuws = page.locator('[data-saloon-id="nieuws:BODE:' + bericht.artikel.id + '"]');
    await nieuws.waitFor();
    await nieuws.getByRole('button', { name: 'Lees artikel' }).click();
    await page.locator('#saloonArtikel').getByText('Dit is het volledige testverslag uit de bronredactie.').waitFor();
    await page.getByRole('button', { name: '‹ Saloon', exact: true }).click();
    await page.keyboard.press('Escape');
    // Verbanden zijn zelfstandige links en moeten ook op telefoon te raken zijn.
    for (const width of [390, 834]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator('.saloon-herkomst').evaluateAll(nodes => nodes.forEach(n => { n.open = true; }));
      const maten = await page.locator('.saloon-herkomst a').evaluateAll(nodes => nodes.map(n => n.getBoundingClientRect().height));
      assert.ok(maten.length > 0, 'er zijn echte verbandlinks om te meten');
      assert.ok(maten.every(h => h >= 24), 'verbandlinks zijn minstens 24px hoog');
    }
    const maker = await post('/api/auth/register', { name: 'Maker Saloon', email: 'maker-scherm@example.test',
      phone: '0612345678', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
    const clip = await post('/api/clips/maak', { titel: 'Een creator aan het werk', duurS: 20, mbGeschat: 4 }, maker.token);
    assert.ok(clip.id);
    await post('/api/wereld/modus', { modus: 'alles', saloon: { bronnen: ['makers'], plaats: '', vorm: 'overzicht' } }, reg.token);
    await page.reload();
    const werk = page.locator('[data-saloon-id="makers:clip:' + clip.id + '"]');
    await werk.getByRole('button', { name: 'Maker gratis volgen', exact: true }).click();
    await werk.getByRole('button', { name: 'Maker ontvolgen', exact: true }).waitFor();
    assert.equal((await post('/api/mediaos/bord', {}, maker.token)).relatie.clipVolgers, 1);
    await werk.getByRole('button', { name: 'Maker ontvolgen', exact: true }).click();
    await werk.getByRole('button', { name: 'Maker gratis volgen', exact: true }).waitFor();
    assert.equal((await post('/api/mediaos/bord', {}, maker.token)).relatie.clipVolgers, 0);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.mouse.move(1200, 100);
    await page.locator('.saloon-kop h2').click();
    await page.evaluate(() => window.scrollTo(0, 0));
    if (process.env.SALOON_SCREENSHOT) await page.screenshot({ path: process.env.SALOON_SCREENSHOT, fullPage: true });
    assert.deepEqual(fouten, []);
  } finally { if (browser) await browser.close(); stop(srv && srv.child); fs.rmSync(tmp, { recursive: true, force: true }); }
});
