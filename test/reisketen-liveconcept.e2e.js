/* Een echte bestaande leveranciersmutatie levert een echte SSE-sync op.
   Geen synthetisch event, vervangen serverantwoord of directe renderaanroep. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper'), { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
test('echte leveranciers-sync behoudt concept en mutatieslot, maar wist bij ingetrokken tenant', async t => {
  const pw = h.laadPlaywright({ eigenDriver: false }); assert.ok(pw && pw.chromium, 'Chromium verplicht');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-liveconcept-'));
  const srv = await h.startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  let browser, vrij = () => {}, staatVrij = () => {};
  try {
    const x = await maakReisketenFixture(srv.base);
    let reis = goed(await x.api('/api/reisbureau/keten/start', { titel: 'Onopgeslagen liveconcept', bestemming: 'Ibiza',
      supplierCode: x.bureau.code, idem: 'liveconcept-start' }, x.reiziger.token), 'reis').reis;
    reis = goed(await x.api('/api/supplier/reisbureau/keten/offerte', x.offerte(reis), x.bureau.token), 'offerte').reis;
    browser = await h.startBrowser(pw); t.diagnostic('Chromium ' + browser.version());
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await ctx.newPage(); page.setDefaultTimeout(20000); const fouten = h.letOpFouten(page, []);
    await page.goto(srv.base + '/manifest.webmanifest');
    await page.evaluate(token => {
      localStorage.setItem('rtg_sup_token', token); localStorage.setItem('rtg_sup_station', 'kantoor');
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, x.bureau.token);
    const stream = page.waitForResponse(r => new URL(r.url()).pathname === '/api/supplier/stream');
    await page.goto(srv.base + '/apps/leverancier.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#station.on').waitFor(); assert.equal((await stream).status(), 200);
    await page.locator('.poort-kaart [data-sluit]').waitFor({ state: 'attached' });
    const later = page.locator('.poort-waas:not([hidden]) [data-sluit]'); if (await later.isVisible()) await later.click();
    await page.locator('[data-ksec="reiscontracten"]').click();
    const host = page.locator('#zaakReisContracten'), form = host.locator('form');
    await host.getByRole('button', { name: 'Nieuwe offerteversie opstellen', exact: true }).click();
    await form.locator('[name="voorwaarden"]').fill('Dit is mijn nog niet opgeslagen liveconcept.');
    await form.locator('fieldset').first().locator('[name="centen"]').fill('59123');
    const vernieuwd = page.waitForResponse(r => new URL(r.url()).pathname === '/api/supplier/state');
    const bevoegd = page.waitForResponse(r => new URL(r.url()).pathname === '/api/supplier/reisbureau/keten');
    goed(await x.api('/api/supplier/service', { action: 'add', name: 'Losse proefdienst voor SSE', price: 12 }, x.bureau.token), 'echte update naast reiscontract');
    const update = await vernieuwd; await update.finished();
    assert.equal((await bevoegd).status(), 200, 'conceptbehoud slaat de actuele reisautorisatie niet over');
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await form.count(), 1, 'een niet-gerelateerde leverancierssync mag het reisconcept niet wissen');
    assert.equal(await form.locator('[name="voorwaarden"]').inputValue(), 'Dit is mijn nog niet opgeslagen liveconcept.');
    assert.equal(await form.locator('fieldset').first().locator('[name="centen"]').inputValue(), '59123');
    const bron = goed(await x.api('/api/supplier/reisbureau/keten', { ref: reis.ref }, x.bureau.token), 'bron').reizen[0];
    assert.equal(bron.offerte.hash, reis.offerte.hash, 'de sync biedt niets namens de gebruiker aan');
    await form.locator('[name="geldigTot"]').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    let meld, opdrachten = 0;
    const ontvangen = new Promise(r => { meld = r; }), wacht = new Promise(r => { vrij = r; });
    await page.route('**/api/supplier/reisbureau/keten/offerte', async route => {
      opdrachten++; const response = await route.fetch(); assert.equal(response.status(), 200);
      meld(); await wacht; await route.fulfill({ response });
    });
    const bied = form.getByRole('button', { name: 'Offerte ter beoordeling aanbieden', exact: true });
    await bied.click(); await ontvangen;
    const tweedeSync = page.waitForResponse(r => new URL(r.url()).pathname === '/api/supplier/state');
    goed(await x.api('/api/supplier/service', { action: 'add', name: 'Tweede SSE tijdens pending antwoord', price: 13 }, x.bureau.token), 'tweede echte sync');
    await (await tweedeSync).finished();
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await form.count(), 1, 'sync vervangt geen actieve handeling door een nieuwe mount');
    assert.equal(await bied.isDisabled(), true, 'het oorspronkelijke mutatieslot blijft behouden');
    vrij(); await host.getByText('Offerte 2:', { exact: false }).waitFor();
    assert.equal(opdrachten, 1);
    await host.getByRole('button', { name: 'Nieuwe offerteversie opstellen', exact: true }).click();
    await form.locator('[name="voorwaarden"]').fill('Dit gevoelige concept moet na intrekking verdwijnen.');
    let staatOntvangen;
    const staatEr = new Promise(r => { staatOntvangen = r; }), houdStaat = new Promise(r => { staatVrij = r; });
    await page.route('**/api/supplier/state', async route => {
      const response = await route.fetch(); assert.equal(response.status(), 200);
      staatOntvangen(); await houdStaat; await route.fulfill({ response });
    });
    goed(await x.api('/api/supplier/service', { action: 'add', name: 'SSE net voor tenantintrekking', price: 14 }, x.bureau.token), 'derde echte sync');
    await staatEr;
    goed(await x.api('/api/techniek/tenant', { org: x.bureau.org, actief: false }, x.tech), 'echte tenantintrekking');
    const geweigerd = page.waitForResponse(r => new URL(r.url()).pathname === '/api/supplier/reisbureau/keten' && r.status() === 403);
    staatVrij(); await geweigerd;
    await host.getByText('Uw reissessie is niet meer bevoegd. Open uw werkplek opnieuw.', { exact: true }).waitFor();
    assert.equal(await form.count(), 0, 'het echte 403 verwijdert ook het open concept');
    assert.equal((await host.innerText()).includes(reis.titel), false, 'geen dossier blijft zichtbaar');
    assert.equal(opdrachten, 1, 'herautorisatie doet geen extra aanbieding');
    // Tweede negatieve deur: de algemene staatlezing zelf faalt nu, zodat
    // renderStation niet bereikt wordt. Het refresh-catchpad moet ook sluiten.
    await page.unroute('**/api/supplier/state');
    goed(await x.api('/api/techniek/tenant', { org: x.bureau.org, actief: true }, x.tech), 'tenant opnieuw actief');
    const herstroom = page.waitForResponse(r => new URL(r.url()).pathname === '/api/supplier/stream');
    await page.reload({ waitUntil: 'domcontentloaded' }); await herstroom;
    await page.locator('.poort-kaart [data-sluit]').waitFor({ state: 'attached' });
    if (await later.isVisible()) await later.click();
    await page.locator('[data-ksec="reiscontracten"]').click();
    await host.getByRole('button', { name: 'Nieuwe offerteversie opstellen', exact: true }).click();
    await form.locator('[name="voorwaarden"]').fill('Dit concept mag niet blijven staan na vertrek uit het team.');
    const manager = goed(await x.api('/api/supplier/state', {}, x.bureau.token), 'actuele mens').state.actor;
    assert.ok(manager.staffId);
    const staatGevraagd = new Promise(r => { staatOntvangen = r; }), voorStaat = new Promise(r => { staatVrij = r; });
    await page.route('**/api/supplier/state', async route => {
      staatOntvangen(); await voorStaat;
      const response = await route.fetch(); assert.equal(response.status(), 401);
      await route.fulfill({ response });
    });
    goed(await x.api('/api/supplier/service', { action: 'add', name: 'SSE voor intrekking personeelsplek', price: 15 }, x.bureau.token), 'vierde echte sync');
    await staatGevraagd;
    goed(await x.api('/api/supplier/staff/remove', { staffId: manager.staffId }, x.bureau.token), 'echt uit team');
    const staatGeweigerd = page.waitForResponse(r => new URL(r.url()).pathname === '/api/supplier/state' && r.status() === 401);
    const reisGeweigerd = page.waitForResponse(r => new URL(r.url()).pathname === '/api/supplier/reisbureau/keten' && r.status() === 401);
    staatVrij(); await staatGeweigerd; await reisGeweigerd;
    await host.getByText('Uw reissessie is niet meer bevoegd. Open uw werkplek opnieuw.', { exact: true }).waitFor();
    assert.equal(await form.count(), 0, 'ook zonder renderStation verdwijnt het concept');
    assert.equal((await host.innerText()).includes(reis.titel), false);
    assert.deepEqual(fouten, []); await ctx.close();
  } finally { vrij(); staatVrij(); if (browser) await browser.close(); await h.stop(srv); fs.rmSync(map, { recursive: true, force: true }); }
});
