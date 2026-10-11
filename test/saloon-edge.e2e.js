/* De goedgekeurde mobiele Saloon gebruikt één echte Edge, ook in de lezer.
   Publiceer bij de bron: geen onderschepte succesantwoorden of nepkaarten.
   De vertraagde lezing bewijst dat teruggaan een oud antwoord ongeldig maakt. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const pw = require('playwright');
const { startServer, stop, browserOpties, geenBrowser, letOpFouten, edgeActies } = require('./helper');

test('Saloon houdt Edge bereikbaar bij lezen, bewaren, teruggaan en bronuitval', { skip: geenBrowser(pw) }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-saloon-edge-'));
  let srv, browser;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '' } });
    const api = async (pad, body, token) => {
      const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
        Authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body || {}) });
      assert.ok(r.ok, pad + ': ' + r.status); return r.json();
    };
    const lid = await api('/api/auth/register', { name: 'Saloon Lezer', email: 'edgelezer@example.test', phone: '0612345678',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
    const rooster = await api('/api/supplier/roster', { code: 'BODE' });
    const zaak = await api('/api/supplier/login', { code: 'BODE', staffId: rooster.staff.find(x => x.role === 'manager').id, pin: '1234' });
    const nieuw = await api('/api/supplier/redactie/artikel/bewaar', { titel: 'Een nieuwe blik op de buurt',
      chapo: 'Een verhaal over de plekken die mensen samenbrengen.', rubriek: 'Stad',
      beeld: '/images/editorial/living-nearby.webp', inhoud: 'In deze proefpublicatie ontmoeten bewoners elkaar aan het water.\nDit is de volledige tekst uit de redactie.' }, zaak.token);
    await api('/api/supplier/redactie/artikel/publiceer', { id: nieuw.artikel.id }, zaak.token);
    await api('/api/wereld/modus', { modus: 'alles', saloon: { bronnen: ['nieuws'] } }, lid.token);
    browser = await pw.chromium.launch(browserOpties(pw, { headless: true }));
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(12000);
    const fouten = []; letOpFouten(page, fouten);
    await page.addInitScript(token => { localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_lang', 'nl'); }, lid.token);
    await page.goto(srv.base + '/apps/wereld.html');
    await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
    if (await page.locator('#rtg-cookie button').isVisible()) await page.locator('#rtg-cookie button').click();
    const kaart = page.locator('[data-saloon-id="nieuws:BODE:' + nieuw.artikel.id + '"]');
    const lezer = page.locator('#saloonArtikel');
    await kaart.waitFor(); await page.evaluate(() => document.fonts.ready);
    const foto = async naam => {
      if (process.env.SALOON_DESIGN_OUTPUT) await page.screenshot({ path: path.join(process.env.SALOON_DESIGN_OUTPUT, naam + '.png'), fullPage: false });
    };
    async function meet() {
      // Wacht op de bestaande Edge-resizeanimatie, niet op een vaste vertraging.
      await page.waitForFunction(() => {
        const r = document.querySelector('.rtg-adaptive-bar').getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= 0;
      }).catch(async error => {
        const detail = '\nEdge-geometrie: ' + JSON.stringify(await page.evaluate(() => ({
          breedte: innerWidth, body: document.body.className, scroll: document.documentElement.scrollWidth,
          nodes: ['.rtg-adaptive-bar','.rtg-adaptive-edge','.rtg-edge-chrome'].map(s => {
            const n = document.querySelector(s), c = getComputedStyle(n), r = n.getBoundingClientRect();
            return {s, x:r.x, y:r.y, width:r.width, height:r.height, display:c.display, transform:c.transform};
          })
        })));
        throw new Error(error.message + detail, { cause: error });
      });
      assert.equal(await page.locator('.rtg-edge-chrome').count(), 1);
      assert.equal(await page.locator('.rtg-adaptive-bar:visible').count(), 1);
      const maat = await page.locator('.rtg-adaptive-bar').evaluate(n => {
        const r = n.getBoundingClientRect();
        return { past: r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.top >= 0,
          acties: [...n.querySelectorAll('button')].map(b => ({ id: b.dataset.rtgAdaptiveAction, w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height })) };
      });
      assert.ok(maat.past, 'Edge past binnen het scherm');
      assert.deepEqual(maat.acties.map(x => x.id), ['home', 'worlds', 'ai', 'context', 'menu']);
      assert.ok(maat.acties.every(x => x.w >= 44 && x.h >= 44));
      const overloop = await page.evaluate(() => ({ breedte: innerWidth, document: document.documentElement.scrollWidth,
        elementen: [...document.querySelectorAll('main *')].filter(n => n.getBoundingClientRect().right > innerWidth + 1).map(n => n.tagName + '.' + n.className) }));
      assert.ok(overloop.document <= overloop.breedte + 1, JSON.stringify(overloop));
      assert.equal(await page.locator('body > nav.balk').isVisible(), false);
    }
    for (const width of [320, 390, 834, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => scrollTo(0, 0));
      if (width >= 1000) {
        const openen = page.locator('.wp-domain:not([open]) > summary');
        if (await openen.isVisible()) await openen.click();
      }
      await foto('saloon-gebouwd-' + width); await meet();
      if (width === 390 || width === 1440) await foto('saloon-gebouwd-' + width);
      await kaart.getByRole('button', { name: 'Lees artikel' }).click();
      await lezer.getByText('Dit is de volledige tekst uit de redactie.', { exact: true }).waitFor();
      assert.equal(await page.locator('dialog[open]').count(), 0, 'de lezer sluit Edge niet op in een modal');
      await meet();
      assert.equal(await page.locator('.rtg-edge-top').isVisible(), true);
      assert.equal(await lezer.locator('img').getAttribute('src'), '/images/editorial/living-nearby.webp');
      if (width === 390) await foto('saloon-verhaal-gebouwd');
      await lezer.locator('[data-terug]').click(); await lezer.waitFor({ state: 'hidden' });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await kaart.getByRole('button', { name: 'Lees artikel' }).click();
    await lezer.locator('h1').waitFor();
    await edgeActies(page);
    await page.locator('[data-rtg-adaptive-source="saloonEdgeBewaren"]').click();
    await lezer.locator('[data-lezer-bewaar][aria-pressed="true"]').waitFor();
    assert.ok((await api('/api/wereld/state', {}, lid.token)).saloon.voorkeuren.bewaard.includes('nieuws:BODE:' + nieuw.artikel.id));
    await page.goBack(); await lezer.waitFor({ state: 'hidden' });
    await page.goForward(); await lezer.locator('h1').waitFor();
    // Vooruit haalt de editie weer op en houdt de actuele bewaarstand.
    assert.equal(await lezer.locator('[data-lezer-bewaar]').getAttribute('aria-pressed'), 'true');
    await page.reload(); await lezer.locator('h1').waitFor();
    assert.equal(await lezer.locator('[data-lezer-bewaar]').getAttribute('aria-pressed'), 'true');
    await lezer.locator('[data-terug]').click(); await lezer.waitFor({ state: 'hidden' });
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
    await page.getByRole('tab', { name: 'Heel RTG', exact: true }).click();
    await page.locator('.rtg-edge-face-all:not([hidden])').waitFor();
    assert.equal(await page.locator('.rtg-edge-smart-worlds a').count(), 4);
    const menu = await page.locator('.rtg-adaptive-sheet').evaluate(n => ({
      material: getComputedStyle(n).getPropertyValue('--edge-bar-bg').trim(),
      glass: getComputedStyle(n).backdropFilter
    }));
    assert.equal(menu.material, '#201912', 'het menu volgt het warme LivingOS-materiaal');
    assert.notEqual(menu.glass, 'none', 'dezelfde transparante Edge blijft de bedieningslaag');
    assert.equal(await page.locator('.rtg-adaptive-bar:visible').count(), 1, 'het werkvlak groeit uit de ene bereikbare Edge-balk');
    assert.equal(await page.locator('.rtg-edge-top').isVisible(), true, 'de gedeelde bovenrand blijft bereikbaar');
    await foto('saloon-menu-gebouwd'); await page.keyboard.press('Escape');
    await page.locator('[data-dichtbij]').click();
    assert.equal(await page.locator('#saloonKeuzes').getAttribute('open'), '');
    await page.locator('#saloonFilters [name="plaats"]').fill('PlaatsZonderPublicaties');
    await page.getByRole('button', { name: 'Keuzes toepassen' }).click();
    await page.waitForFunction(() => document.querySelector('#saloonStatus').textContent.startsWith('0 resultaten'));
    assert.equal(await page.locator('[data-saloon-id]').count(), 0);
    await page.reload();
    await page.locator('[data-dichtbij][aria-pressed="true"]').waitFor();
    await page.locator('[data-vorm="overzicht"]').click(); await kaart.waitFor();
    assert.equal((await api('/api/wereld/state', {}, lid.token)).saloon.voorkeuren.plaats, '');
    // Een fout bij de bron krijgt een herstelpad; er verschijnt geen oude tekst.
    await page.route('**/api/krant/artikel', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"De krant is tijdelijk niet beschikbaar."}' }));
    await kaart.getByRole('button', { name: 'Lees artikel' }).click();
    await lezer.getByText('De krant is tijdelijk niet beschikbaar.', { exact: true }).waitFor();
    assert.equal(await lezer.locator('h1').count(), 0);
    await page.unroute('**/api/krant/artikel'); await lezer.getByRole('button', { name: 'Opnieuw proberen' }).click();
    await lezer.locator('h1').waitFor(); await lezer.locator('[data-terug]').click(); await lezer.waitFor({ state: 'hidden' });
    let vrij, begonnen;
    const gestart = new Promise(r => { begonnen = r; }), wachten = new Promise(r => { vrij = r; });
    await page.route('**/api/krant/artikel', async route => { begonnen(); await wachten; await route.continue(); });
    await kaart.getByRole('button', { name: 'Lees artikel' }).click(); await gestart;
    await lezer.locator('[data-terug]').click(); await lezer.waitFor({ state: 'hidden' });
    const antwoord = page.waitForResponse('**/api/krant/artikel'); vrij(); await antwoord;
    await page.waitForLoadState('networkidle');
    assert.equal(await lezer.isVisible(), false, 'een laat antwoord mag de gesloten lezer niet heropenen');
    assert.equal(await lezer.textContent(), '');
    assert.deepEqual(fouten.filter(x => !String(x).includes('503')), []);
  } finally { if (browser) await browser.close(); stop(srv && srv.child); fs.rmSync(tmp, { recursive: true, force: true }); }
});
