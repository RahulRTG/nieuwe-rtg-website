/* Een echte oude bronlezing komt na de eigen offertewijziging terug.
   Alleen de aflevering wordt vertraagd: route.fetch leest de echte API en
   route.fulfill levert dat ongewijzigde antwoord af. Geen vervangende body. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, letOpFouten } = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');

test('oude werktafellezing kan een succesvol aangeboden nieuwe offerteversie niet terugzetten', async t => {
  const pw = laadPlaywright({ eigenDriver: false });
  assert.ok(pw && pw.chromium, 'echte Chromium is verplicht; geen skip of vervangende driver');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-werktafel-race-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  let browser, laatDoor = () => {};
  try {
    const x = await maakReisketenFixture(srv.base);
    const reis = goed(await x.api('/api/reisbureau/keten/start', {
      titel: 'Werktafel concurrentieproef', bestemming: 'Ibiza', idem: 'werktafel-race-start'
    }, x.reiziger.token), 'reisaanvraag').reis;
    const eerste = goed(await x.api('/api/office/reisbureau/keten/offerte', x.offerte(reis), x.office), 'eerste offerte').reis;
    browser = await pw.chromium.launch(browserOpties(pw));
    t.diagnostic('Chromium ' + browser.version());
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await ctx.addInitScript(({ lid, kantoor }) => {
      localStorage.setItem('rtg_member_token', lid); localStorage.setItem('rtg_office_token', kantoor);
      localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl');
    }, { lid: x.reiziger.token, kantoor: x.office });
    const page = await ctx.newPage(), fouten = letOpFouten(page, []); page.setDefaultTimeout(20000);
    await page.goto(srv.base + '/apps/kantoren.html?kamer=reisbureau', { waitUntil: 'domcontentloaded' });
    const werktafel = page.locator('#kReisContracten');
    await werktafel.getByRole('heading', { name: reis.titel, exact: true }).waitFor();
    const vak = werktafel.locator('section').filter({ has: page.getByRole('heading', { name: reis.titel, exact: true }) });
    await vak.getByRole('button', { name: 'Nieuwe offerteversie opstellen', exact: true }).click();
    const form = vak.locator('form');
    await form.locator('[name="geldigTot"]').fill(new Date(Date.now() + 86400000).toISOString().slice(0, 16));
    await form.locator('[name="voorwaarden"]').fill('Tweede echte lokale proefversie; geen externe reservering.');
    await form.locator('fieldset').first().locator('[name="centen"]').fill('51000');

    let meldGevangen, meldAfgeleverd, oudAntwoord, onderschep = true;
    const gevangen = new Promise(resolve => { meldGevangen = resolve; });
    const afgeleverd = new Promise(resolve => { meldAfgeleverd = resolve; });
    const vasthouden = new Promise(resolve => { laatDoor = resolve; });
    await page.route('**/api/office/reisbureau/keten', async route => {
      if (!onderschep) { await route.continue(); return; }
      onderschep = false;
      const response = await route.fetch();
      oudAntwoord = await response.json(); meldGevangen();
      await vasthouden;
      await route.fulfill({ response }); meldAfgeleverd();
    });
    const vernieuw = werktafel.getByRole('button', { name: 'Reiscontracten vernieuwen', exact: true });
    await vernieuw.click(); await gevangen;
    assert.equal(oudAntwoord.reizen[0].offerte.hash, eerste.offerte.hash, 'de vastgehouden echte bronlezing is de oude offerte');
    assert.equal(await vernieuw.isDisabled(), true, 'de bronlezing is nog onderweg');
    const ontvangen = page.waitForResponse(r => r.url().endsWith('/api/office/reisbureau/keten/offerte') && r.request().method() === 'POST');
    await form.getByRole('button', { name: 'Offerte ter beoordeling aanbieden', exact: true }).click();
    const response = await ontvangen, nieuwe = (await response.json()).reis;
    assert.equal(response.status(), 200); assert.equal(nieuwe.offerte.versie, eerste.offerte.versie + 1);
    assert.equal(nieuwe.offerte.totaalCenten, 81000);
    await page.waitForFunction(versie => document.querySelector('#kReisContracten').textContent.includes('Offerte ' + versie + ':'), nieuwe.offerte.versie);
    assert.equal(await vernieuw.isDisabled(), false, 'de opvolglezing is klaar terwijl het oude antwoord nog wordt vastgehouden');

    const lateRespons = page.waitForResponse(r => r.url().endsWith('/api/office/reisbureau/keten') && r.request().method() === 'POST');
    laatDoor(); await afgeleverd;
    const oud = await lateRespons; await oud.finished();
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.match(await vak.innerText(), new RegExp('Offerte ' + nieuwe.offerte.versie + ':'), 'een oude lezing mag het nieuwe beeld niet terugzetten');
    assert.match(await vak.innerText(), new RegExp('versie ' + nieuwe.versie));
    assert.match(await vak.innerText(), /810,00/);
    assert.equal(await vernieuw.isDisabled(), false, 'een oud finally-blok verandert het actuele slot niet');
    const bron = goed(await x.api('/api/office/reisbureau/keten', {}, x.office), 'actuele bron').reizen[0];
    assert.equal(bron.offerte.hash, nieuwe.offerte.hash); assert.equal(bron.offerte.totaalCenten, 81000);
    await vernieuw.click();
    await page.waitForFunction(() => ![...document.querySelectorAll('#kReisContracten button')].find(b => b.textContent === 'Reiscontracten vernieuwen').disabled);
    assert.match(await vak.innerText(), /Offerte 2:/, 'de gewone volgende verversing blijft bruikbaar');
    assert.deepEqual(fouten, []);
    await ctx.close();
  } finally {
    laatDoor(); if (browser) await browser.close(); await stop(srv);
    fs.rmSync(map, { recursive: true, force: true });
  }
});
