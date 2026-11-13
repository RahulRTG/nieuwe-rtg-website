/* Reiziger en drie zelfstandige aanbieders gebruiken hun bestaande schermen
   tegen echte routes/SQLite/Pay. Alleen transportverlies wordt uitgelokt.
   Leveranciers en bronreferenties zijn proefdata, geen externe acceptatie. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
const pw = h.laadPlaywright({ eigenDriver: false });
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reisketen-browser-'));
let srv, browser, x;
test.before(async () => {
  assert.ok(pw && pw.chromium, 'de echte Playwright Chromium-installatie is verplicht; geen skip of vervangende driver');
  srv = await h.startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE', RTG_AI_UIT: '1' } });
  x = await maakReisketenFixture(srv.base); browser = await h.startBrowser(pw);
  const pakket = JSON.parse(fs.readFileSync(path.join(__dirname, '../node_modules/playwright/package.json'), 'utf8'));
  console.log('Reisketen Chromium: ' + browser.version() + '; Playwright: ' + pakket.version);
});
test.after(async () => { if (browser) await browser.close(); if (srv) await h.stop(srv); fs.rmSync(map, { recursive: true, force: true }); });
async function open(token, soort, width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(({ token: t, soort: s }) => {
    localStorage.setItem(s === 'lid' ? 'rtg_member_token' : 'rtg_sup_token', t);
    localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (s !== 'lid') localStorage.setItem('rtg_sup_station', 'kantoor');
  }, { token, soort });
  const page = await ctx.newPage(), fouten = h.letOpFouten(page, []); page.setDefaultTimeout(20000);
  await page.goto(srv.base + (soort === 'lid' ? '/apps/reisbureau.html' : '/apps/leverancier.html'), { waitUntil: 'domcontentloaded' });
  if (soort !== 'lid') {
    await page.locator('#station.on').waitFor();
    await page.locator('.poort-kaart [data-sluit]').waitFor({ state: 'attached' });
    const later = page.locator('.poort-waas:not([hidden]) [data-sluit]');
    // Softwarewerk blijft mogelijk terwijl de zaak haar openbare Salon-/online
    // onboarding uitstelt. Bedien de bestaande deur; maak haar niet kunstmatig groen.
    if (await later.isVisible()) await later.click();
    await page.locator('[data-ksec="reiscontracten"]').click();
  }
  return { ctx, page, fouten };
}
const lees = async ref => goed(await x.api('/api/reisbureau/keten', { ref }, x.reiziger.token), 'reiziger leest').reizen[0];
async function vernieuw(page) {
  await page.locator('[data-keten-actie="ververs"]').click();
  await page.waitForFunction(() => !document.querySelector('[data-keten-actie="ververs"]').disabled);
}
async function aanbieder(actor, id, ref, besluit) {
  const o = await open(actor.token, 'zaak', 1440);
  try {
    const rij = o.page.locator('[data-reisref="' + ref + '"][data-reisopdracht="' + id + '"]');
    await rij.waitFor(); assert.equal(await o.page.locator('[data-reisopdracht]').count(), 1, 'alleen eigen opdracht');
    await rij.locator('[name="bewijsRef"]').fill('BROWSER-TEST-' + besluit + '-' + id);
    await rij.locator('[data-opdracht-besluit="' + besluit + '"]').click();
    const verwacht = besluit === 'lever' ? 'geleverd' : 'bevestigd';
    await o.page.waitForFunction(({ ref: r, id: i, verwacht: v }) => {
      const el = document.querySelector('[data-reisref="' + r + '"][data-reisopdracht="' + i + '"] [data-opdracht-status]');
      return el && el.textContent === v;
    }, { ref, id, verwacht });
    assert.deepEqual(o.fouten, []);
  } finally { await o.ctx.close(); }
}
test('390px: reiswens, antwoordverlies, offerteakkoord, drie eigen aanbieders en één betaling via bestaande werktafels', async () => {
  const o = await open(x.reiziger.token, 'lid');
  try {
    const p = o.page, host = p.locator('#reisKeten');
    await host.locator('form:not([hidden])').waitFor();
    await host.locator('[name="titel"]').fill('Persoonlijke browserreis');
    await host.locator('[name="bestemming"]').fill('Ibiza');
    await host.locator('[name="supplierCode"]').fill(x.bureau.code);
    let aanvragen = 0;
    await p.route('**/api/reisbureau/keten/start', async route => { aanvragen++; await route.fetch(); await route.abort('failed'); });
    await host.locator('[data-keten-actie="start"]').click();
    await p.waitForFunction(() => document.querySelector('#reisKeten [role="status"]').textContent.includes('uitkomst is onbekend'));
    assert.equal(await host.locator('[data-keten-actie="start"]').isDisabled(), true);
    await p.unroute('**/api/reisbureau/keten/start'); await vernieuw(p);
    assert.equal(aanvragen, 1);
    const reizen = goed(await x.api('/api/reisbureau/keten', {}, x.reiziger.token), 'één aanvraag').reizen;
    assert.equal(reizen.length, 1); let reis = reizen[0];
    await host.locator('[data-reiscontract="' + reis.ref + '"]').waitFor();
    goed(await x.api('/api/supplier/reisbureau/keten/offerte', x.offerte(reis), x.bureau.token), 'bureau biedt aan');
    await vernieuw(p);
    let kaart = host.locator('[data-reiscontract="' + reis.ref + '"]');
    assert.match(await kaart.innerText(), /800,00/);
    assert.match(await kaart.innerText(), /Lokale contractproef/);
    await kaart.locator('[data-keten-actie="akkoord"]').click();
    assert.equal((await lees(reis.ref)).status, 'aangeboden', 'geen akkoord zonder bewuste keuze');
    await kaart.locator('[data-keten-akkoord]').check();
    await kaart.locator('[data-keten-actie="akkoord"]').click();
    await p.waitForFunction(ref => document.querySelector('[data-reiscontract="' + ref + '"] [data-keten-status]').textContent === 'geaccepteerd', reis.ref);
    assert.equal(await kaart.locator('[data-keten-actie="betaal"]').count(), 0);
    for (const [id, actor] of [['hotel', x.hotel], ['transfer', x.transfer], ['fiets', x.fiets]]) await aanbieder(actor, id, reis.ref, 'accepteer');
    await vernieuw(p); kaart = host.locator('[data-reiscontract="' + reis.ref + '"]');
    let betalingen = 0;
    await p.route('**/api/reisbureau/keten/betaal', async route => { betalingen++; await route.fetch(); await route.abort('failed'); });
    await kaart.locator('[data-keten-actie="betaal"]').click();
    await p.waitForFunction(() => document.querySelector('#reisKeten [role="status"]').textContent.includes('uitkomst is onbekend'));
    assert.equal(await kaart.locator('[data-keten-actie="betaal"]').isDisabled(), true);
    await p.unroute('**/api/reisbureau/keten/betaal'); await vernieuw(p);
    assert.equal(betalingen, 1); assert.equal(await kaart.locator('[data-keten-actie="betaal"]').count(), 0);
    assert.match(await kaart.innerText(), /Betaling: betaald/);
    const ledger = goed(await x.api('/api/pay/overzicht', {}, x.reiziger.token), 'Pay bewijs');
    assert.equal(ledger.geschiedenis.filter(r => r.soort === 'reisbetaling').length, 1);
    for (const [id, actor] of [['hotel', x.hotel], ['transfer', x.transfer], ['fiets', x.fiets]]) await aanbieder(actor, id, reis.ref, 'lever');
    await vernieuw(p); assert.equal((await lees(reis.ref)).status, 'geleverd');
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'mobiel geen horizontale overloop');
    const out = path.join(__dirname, '../artifacts/experience'); fs.mkdirSync(out, { recursive: true });
    await host.scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(out, 'reisketen-reiziger-390.png'), fullPage: true });
    await p.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await p.screenshot({ path: path.join(out, 'reisketen-reiziger-390-viewport.png') });
    const knopvlak = await host.locator('[data-keten-actie="ververs"]').boundingBox();
    assert.ok(knopvlak && knopvlak.height >= 44, 'actie heeft een volledig mobiel raakvlak');
    assert.equal(await p.evaluate(r => [0.1, 0.5, 0.9].every(y => [0.1, 0.5, 0.9].every(x =>
      document.elementsFromPoint(r.x + r.width * x, r.y + r.height * y)[0]?.closest('[data-keten-actie="ververs"]'))), knopvlak), true,
    'het hele raakvlak blijft boven Meenemen en Edge bereikbaar bij de onderste scrollstand');
    assert.deepEqual(o.fouten, []);
  } finally { await o.ctx.close(); }
});
