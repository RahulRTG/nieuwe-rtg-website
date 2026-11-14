/* Echte tenantbinding + leveranciers-SSE: een geldige HTTP200 is niet genoeg
   om het oude zaakbereik te behouden. Geen vervangende serverantwoorden. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper'), { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
test('echte wijziging van tenantbinding wist oud reisconcept ook bij geautoriseerde HTTP200', async t => {
  const pw = h.laadPlaywright({ eigenDriver: false }); assert.ok(pw && pw.chromium, 'Chromium verplicht');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-livecontext-'));
  const srv = await h.startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  let browser, vrij = () => {};
  try {
    const x = await maakReisketenFixture(srv.base);
    const reis = goed(await x.api('/api/reisbureau/keten/start', { titel: 'Reis onder eerdere tenantbinding', bestemming: 'Ibiza',
      supplierCode: x.bureau.code, idem: 'livecontext-start' }, x.reiziger.token), 'aanvraag').reis;
    browser = await h.startBrowser(pw); t.diagnostic('Chromium ' + browser.version());
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await ctx.newPage(); page.setDefaultTimeout(20000); const fouten = h.letOpFouten(page, []);
    await page.goto(srv.base + '/manifest.webmanifest');
    await page.evaluate(token => {
      localStorage.setItem('rtg_sup_token', token); localStorage.setItem('rtg_sup_station', 'kantoor');
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, x.bureau.token);
    const stroom = page.waitForResponse(r => new URL(r.url()).pathname === '/api/supplier/stream');
    await page.goto(srv.base + '/apps/leverancier.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#station.on').waitFor(); assert.equal((await stroom).status(), 200);
    await page.locator('.poort-kaart [data-sluit]').waitFor({ state: 'attached' });
    const later = page.locator('.poort-waas:not([hidden]) [data-sluit]'); if (await later.isVisible()) await later.click();
    await page.locator('[data-ksec="reiscontracten"]').click();
    const host = page.locator('#zaakReisContracten');
    await host.getByRole('button', { name: 'Offerte opstellen', exact: true }).click();
    await host.locator('[name="voorwaarden"]').fill('Dit concept hoort alleen bij de eerdere tenant.');
    let aanbiedingen = 0; page.on('request', r => { if (r.url().endsWith('/keten/offerte')) aanbiedingen++; });
    let meld, gelezen = 0, terug;
    const oudEr = new Promise(r => { meld = r; }), wacht = new Promise(r => { vrij = r; }), los = new Promise(r => { terug = r; });
    await page.route('**/api/supplier/reisbureau/keten', async route => {
      const response = await route.fetch();
      if (++gelezen === 1) { assert.equal(response.status(), 200); meld(); await wacht; await route.fulfill({ response }); terug(); }
      else await route.fulfill({ response });
    });
    await host.getByRole('button', { name: 'Reiscontracten vernieuwen', exact: true }).click(); await oudEr;
    goed(await x.api('/api/techniek/tenant/bind', { org: x.bureau.org, soort: 'zaak', code: x.bureau.code, aan: false }, x.tech), 'oude binding los');
    goed(await x.api('/api/techniek/tenant/bind', { org: x.anderBureau.org, soort: 'zaak', code: x.bureau.code }, x.tech), 'nieuwe binding');
    const controle = page.waitForResponse(r => new URL(r.url()).pathname === '/api/supplier/reisbureau/keten');
    goed(await x.api('/api/supplier/service', { action: 'add', name: 'Echte sync na nieuwe tenantbinding', price: 12 }, x.bureau.token), 'sync');
    const response = await controle; assert.equal(response.status(), 200); assert.deepEqual((await response.json()).reizen, []);
    await host.getByText('De actuele werkruimte bevat niet meer alle getoonde reizen. Schermgegevens en concepten zijn verwijderd; controleer de bron opnieuw.', { exact: true }).waitFor();
    assert.equal(await host.locator('form').count(), 0);
    assert.equal((await host.innerText()).includes(reis.titel), false);
    vrij(); await los;
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal((await host.innerText()).includes(reis.titel), false, 'de oude vooraf toegelaten bronrespons mag het dossier niet terugtekenen');
    assert.equal(aanbiedingen, 0, 'concept wordt nooit onder de nieuwe tenant aangeboden');
    const bron = goed(await x.api('/api/reisbureau/keten', { ref: reis.ref }, x.reiziger.token), 'eigen bron').reizen[0];
    assert.equal(bron.versie, reis.versie); assert.equal(bron.offerte, null);
    assert.deepEqual(fouten, []); await ctx.close();
  } finally { vrij(); if (browser) await browser.close(); await h.stop(srv); fs.rmSync(map, { recursive: true, force: true }); }
});
