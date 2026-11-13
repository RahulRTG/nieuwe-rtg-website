/* Echte kantoor-HTTP-antwoorden + opslagwisseling. Alleen de aflevering
   wordt vertraagd; 401 ontstaat via de bestaande echte uitlogroute. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper'), { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
let srv, browser, x, reis;
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoor-tokengrens-'));
test.before(async () => {
  const pw = h.laadPlaywright({ eigenDriver: false }); assert.ok(pw && pw.chromium, 'Chromium verplicht');
  srv = await h.startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  x = await maakReisketenFixture(srv.base); browser = await h.startBrowser(pw);
  reis = goed(await x.api('/api/reisbureau/keten/start', { titel: 'Vertrouwelijke oude kantoorweergave', bestemming: 'Ibiza',
    idem: 'kantoor-token-start' }, x.reiziger.token), 'reis').reis;
  console.log('Kantoortokengrens Chromium ' + browser.version());
});
test.after(async () => { if (browser) await browser.close(); if (srv) await h.stop(srv); fs.rmSync(map, { recursive: true, force: true }); });
for (const status of [200, 401]) test('laat kantoorantwoord ' + status + ' wist nieuwe opgeslagen sessie niet', async () => {
  // Een echte persoonlijke eigenaarslogin mag via de bestaande kantoordeur.
  // Hij kan afzonderlijk worden ingetrokken zonder de nieuwe B-sessie te raken.
  const oud = goed(await x.api('/api/auth/login', { login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business' }), 'A-login').token;
  const nieuw = await h.kantoorAlsPersoon(srv.base); assert.ok(nieuw); assert.notEqual(oud, nieuw);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000); const fouten = h.letOpFouten(page, []);
  let vrij = () => {};
  try {
    await page.goto(srv.base + '/manifest.webmanifest');
    await page.evaluate(token => { localStorage.setItem('rtg_office_token', token);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, oud);
    await page.goto(srv.base + '/apps/kantoren.html?kamer=reisbureau', { waitUntil: 'domcontentloaded' });
    const host = page.locator('#kReisContracten');
    await host.getByRole('heading', { name: reis.titel, exact: true }).waitFor();
    await host.getByRole('button', { name: 'Offerte opstellen', exact: true }).click();
    await host.locator('[name="voorwaarden"]').fill('Geheim nog niet opgeslagen kantoorconcept');
    let meld, klaar, verzoeken = 0;
    const ontvangen = new Promise(r => { meld = r; }), afgeleverd = new Promise(r => { klaar = r; }), wacht = new Promise(r => { vrij = r; });
    await page.route('**/api/office/reisbureau/keten', async route => {
      verzoeken++; const response = await route.fetch(); assert.equal(response.status(), status);
      meld(); await wacht; await route.fulfill({ response }); klaar();
    });
    if (status === 401) goed(await x.api('/api/logout', {}, oud), 'echte intrekking A');
    await host.getByRole('button', { name: 'Reiscontracten vernieuwen', exact: true }).click(); await ontvangen;
    // Dezelfde-tab-opslagwisseling geeft geen storage-event. Juist dan moet
    // de antwoordgrens zelf A sluiten zonder het werkelijk opgeslagen B te wissen.
    await page.evaluate(token => localStorage.setItem('rtg_office_token', token), nieuw);
    vrij(); await afgeleverd;
    await host.waitFor({ state: 'detached' });
    assert.ok(await page.evaluate(token => localStorage.getItem('rtg_office_token') === token, nieuw), 'de exacte nieuwe B-sessie blijft opgeslagen');
    assert.equal((await page.locator('body').innerText()).includes(reis.titel), false);
    assert.equal(await page.locator('[name="voorwaarden"]').count(), 0);
    assert.equal(verzoeken, 1, 'geen herhaling onder oude autoriteit');
    goed(await x.api('/api/office/reisbureau/keten', {}, nieuw), 'B blijft server-side geldig');
    assert.deepEqual(fouten, []);
  } finally { vrij(); await ctx.close(); }
});
