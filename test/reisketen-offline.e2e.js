/* Bestaande reiziger-/leveranciersschermen, echte shellworker, HTTP en SQLite.
   Offline zet Chromium werkelijk zonder netwerk. Alleen de aflevering na
   een echte providercommit wordt eenmaal afgebroken; geen vervangende data. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper'), { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
test('offline akkoord, oude offerte op tweede apparaat en onbekende leverancieruitkomst herstellen uit de bron', async t => {
  const pw = h.laadPlaywright({ eigenDriver: false }); assert.ok(pw && pw.chromium, 'echte Chromium verplicht');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-offline-'));
  const srv = await h.startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  let browser;
  try {
    const x = await maakReisketenFixture(srv.base); browser = await h.startBrowser(pw);
    t.diagnostic('Chromium ' + browser.version());
    let reis = goed(await x.api('/api/reisbureau/keten/start', { titel: 'Beschermde offline reis', bestemming: 'Ibiza',
      idem: 'offline-lid-start', supplierCode: x.bureau.code }, x.reiziger.token), 'aanvraag').reis;
    reis = goed(await x.api('/api/supplier/reisbureau/keten/offerte', x.offerte(reis), x.bureau.token), 'aanbod').reis;
    const bron = async () => goed(await x.api('/api/supplier/reisbureau/keten', { ref: reis.ref }, x.bureau.token), 'bron').reizen[0];
    async function open(token, supplier) {
      const ctx = await browser.newContext({ viewport: { width: supplier ? 1440 : 390, height: 900 }, serviceWorkers: 'allow', reducedMotion: 'reduce' });
      const page = await ctx.newPage(); page.setDefaultTimeout(20000); const fouten = h.letOpFouten(page, []);
      await page.goto(srv.base + '/manifest.webmanifest');
      await page.evaluate(({ token: tk, zaak }) => {
        localStorage.setItem(zaak ? 'rtg_sup_token' : 'rtg_member_token', tk);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
        if (zaak) localStorage.setItem('rtg_sup_station', 'kantoor');
      }, { token, zaak: !!supplier });
      await page.goto(srv.base + (supplier ? '/apps/leverancier.html' : '/apps/reisbureau.html'), { waitUntil: 'domcontentloaded' });
      if (supplier) {
        await page.locator('#station.on').waitFor();
        await page.locator('.poort-kaart [data-sluit]').waitFor({ state: 'attached' });
        const later = page.locator('.poort-waas:not([hidden]) [data-sluit]'); if (await later.isVisible()) await later.click();
        await page.locator('[data-ksec="reiscontracten"]').click();
      }
      await page.waitForFunction(() => !!navigator.serviceWorker.controller);
      return { ctx, page, fouten, host: page.locator(supplier ? '#zaakReisOpdrachten' : '#reisKeten') };
    }
    const a = await open(x.reiziger.token), b = await open(x.reiziger.token);
    const kaart = o => o.host.locator('[data-reiscontract="' + reis.ref + '"]');
    const refresh = async o => {
      await o.host.locator('[data-keten-actie="ververs"]').click();
      await o.page.waitForFunction(() => !document.querySelector('[data-keten-actie="ververs"]').disabled);
    };
    await kaart(a).locator('[data-keten-akkoord]').check();
    await a.ctx.setOffline(true); await kaart(a).locator('[data-keten-actie="akkoord"]').click();
    await a.host.getByRole('status').filter({ hasText: 'uitkomst is onbekend' }).waitFor();
    assert.equal((await bron()).status, 'aangeboden');
    assert.equal(await kaart(a).locator('[data-keten-actie="akkoord"]').isDisabled(), true);
    await refresh(a); assert.equal(await kaart(a).locator('[data-keten-actie="akkoord"]').isDisabled(), true);
    await a.ctx.setOffline(false); await refresh(a);
    assert.equal((await bron()).status, 'aangeboden', 'geen achtergrondakkoord wanneer netwerk terugkeert');
    const vorige = await bron();
    const tweede = goed(await x.api('/api/supplier/reisbureau/keten/offerte', x.offerte(vorige, {
      idem: 'offline-lid-offerte-twee', voorwaarden: 'Nieuwe prijs en voorwaarden; opnieuw beoordelen.'
    }), x.bureau.token), 'nieuwe bronofferte').reis;
    await refresh(a); await kaart(a).locator('[data-keten-akkoord]').check();
    await kaart(a).locator('[data-keten-actie="akkoord"]').click();
    await a.page.waitForFunction(ref => document.querySelector('[data-reiscontract="' + ref + '"] [data-keten-status]').textContent === 'geaccepteerd', reis.ref);
    await kaart(b).locator('[data-keten-akkoord]').check();
    const conflict = b.page.waitForResponse(r => r.url().endsWith('/keten/akkoord'));
    await kaart(b).locator('[data-keten-actie="akkoord"]').click(); assert.equal((await conflict).status(), 409);
    await b.host.getByRole('status').filter({ hasText: 'gewijzigd' }).waitFor();
    assert.equal(await kaart(b).locator('[data-keten-actie="akkoord"]').isDisabled(), true, 'een stale offerte blijft geblokkeerd tot bronherstel');
    await refresh(b); assert.equal(await kaart(b).locator('[data-keten-actie="akkoord"]').count(), 0);
    const aangenomen = await bron();
    assert.equal(aangenomen.akkoord.offerteHash, tweede.offerte.hash);
    assert.equal(aangenomen.gebeurtenissen.filter(e => e.soort === 'akkoord').length, 1);

    const p = await open(x.hotel.token, true), opdracht = p.host.locator('[data-reisopdracht="hotel"]');
    await opdracht.locator('[name="bewijsRef"]').fill('OFFLINE-TEST-HOTEL-BRON');
    let handelingen = 0;
    await p.page.route('**/api/supplier/reisbureau/opdracht/besluit', async route => {
      handelingen++; const response = await route.fetch(); assert.equal(response.status(), 200);
      await p.ctx.setOffline(true); await route.abort('failed');
    });
    await opdracht.locator('[data-opdracht-besluit="accepteer"]').click();
    await p.host.getByRole('status').filter({ hasText: 'Uitkomst onbekend' }).waitFor();
    assert.equal(await p.host.locator('[data-opdracht-status]').count(), 0, 'geen bevestiging afgeleid uit een verzonden besluit');
    await p.host.getByRole('button', { name: 'Reisopdrachten controleren' }).click();
    await p.page.waitForFunction(() => ![...document.querySelectorAll('#zaakReisOpdrachten button')].find(el => el.textContent === 'Reisopdrachten controleren').disabled);
    assert.equal(await p.host.locator('[data-opdracht-status]').count(), 0);
    await p.ctx.setOffline(false);
    await p.host.getByRole('button', { name: 'Reisopdrachten controleren' }).click();
    await opdracht.locator('[data-opdracht-status]').filter({ hasText: 'bevestigd' }).waitFor();
    assert.equal(handelingen, 1);
    assert.equal((await bron()).gebeurtenissen.filter(e => e.soort === 'opdracht-accepteer').length, 1);
    for (const o of [a, b, p]) {
      const cache = await o.page.evaluate(async () => {
        const keys = await caches.keys(); return { keys, urls: (await Promise.all(keys.map(async k =>
          (await (await caches.open(k)).keys()).map(r => r.url)))).flat(), opslag: JSON.stringify({ ...localStorage, ...sessionStorage }) };
      });
      assert.ok(cache.keys.some(k => k.startsWith('rtg-app-')), 'werkelijk bestaande shellcache actief');
      assert.equal(cache.urls.some(u => new URL(u).pathname.startsWith('/api/')), false);
      assert.equal(cache.opslag.includes('Beschermde offline reis'), false);
      assert.equal(cache.opslag.includes('OFFLINE-TEST-HOTEL-BRON'), false);
      assert.deepEqual(o.fouten, []); await o.ctx.close();
    }
  } finally {
    if (browser) await browser.close(); await h.stop(srv); fs.rmSync(map, { recursive: true, force: true });
  }
});
