/* De zichtbare nazorg loopt via echte routes/SQLite en Pay. Verzonden vragen
   en verklaringen zijn nadrukkelijk geen uitvoering, annulering of refund.
   Transportverlies levert geen nieuwe bodies of verzonnen autoriteit op. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper'), { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
test('reiziger en eigen partner wisselen nazorg uit zonder reis/geldwijziging, ook bij antwoordverlies en mislukte opvolglezing', async t => {
  const pw = h.laadPlaywright({ eigenDriver: false }); assert.ok(pw && pw.chromium, 'echte Chromium verplicht');
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-nazorg-browser-'));
  const srv = await h.startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  let browser;
  try {
    const x = await maakReisketenFixture(srv.base);
    let reis = goed(await x.api('/api/reisbureau/keten/start', { titel: 'Browsernazorg zonder uitvoering',
      bestemming: 'Ibiza', supplierCode: x.bureau.code, idem: 'nazorg-browser-start' }, x.reiziger.token), 'aanvraag').reis;
    const bron = async () => goed(await x.api('/api/supplier/reisbureau/keten', { ref: reis.ref }, x.bureau.token), 'bron').reizen[0];
    reis = goed(await x.api('/api/supplier/reisbureau/keten/offerte', x.offerte(reis), x.bureau.token), 'aanbod').reis;
    reis = goed(await x.api('/api/reisbureau/keten/akkoord', { ref: reis.ref, versie: reis.versie,
      offerteHash: reis.offerte.hash, idem: 'nazorg-browser-akkoord' }, x.reiziger.token), 'akkoord').reis;
    for (const [id, actor] of [['hotel', x.hotel], ['transfer', x.transfer], ['fiets', x.fiets]]) {
      goed(await x.api('/api/supplier/reisbureau/opdracht/besluit', { ref: reis.ref, versie: reis.versie,
        onderdeel: id, besluit: 'accepteer', bewijsRef: 'NAZORG-TEST-' + id, idem: 'nazorg-browser-' + id }, actor.token), 'acceptatie');
      reis = await bron();
    }
    goed(await x.api('/api/reisbureau/keten/betaal', { ref: reis.ref, versie: reis.versie, idem: 'nazorg-browser-pay' }, x.reiziger.token), 'testbetaling');
    const vooraf = await bron(), geldVoor = goed(await x.api('/api/pay/overzicht', {}, x.reiziger.token), 'geld vóór');
    browser = await h.startBrowser(pw); t.diagnostic('Chromium ' + browser.version());
    async function open(zaak) {
      const ctx = await browser.newContext({ viewport: { width: zaak ? 1440 : 390, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      const page = await ctx.newPage(); page.setDefaultTimeout(20000); const fouten = h.letOpFouten(page, []);
      await page.goto(srv.base + '/manifest.webmanifest');
      await page.evaluate(({ token, supplier }) => {
        localStorage.setItem(supplier ? 'rtg_sup_token' : 'rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
        if (supplier) localStorage.setItem('rtg_sup_station', 'kantoor');
      }, { token: zaak ? x.bureau.token : x.reiziger.token, supplier: zaak });
      await page.goto(srv.base + (zaak ? '/apps/leverancier.html' : '/apps/reisbureau.html'), { waitUntil: 'domcontentloaded' });
      if (zaak) {
        await page.locator('#station.on').waitFor();
        await page.locator('.poort-kaart [data-sluit]').waitFor({ state: 'attached' });
        const later = page.locator('.poort-waas:not([hidden]) [data-sluit]'); if (await later.isVisible()) await later.click();
        await page.locator('[data-ksec="reiscontracten"]').click();
      }
      const host = page.locator(zaak ? '#zaakReisContracten' : '#reisKeten');
      await host.locator('[data-nazorg-reis="' + reis.ref + '"]').waitFor();
      const vernieuw = host.getByRole('button', { name: zaak ? 'Reiscontracten vernieuwen' : 'Controleer mijn reiscontracten', exact: true });
      return { ctx, page, host, vernieuw, fouten };
    }
    const lid = await open(false), vak = lid.host.locator('[data-nazorg-reis]');
    let vragen = 0, antwoorden = 0;
    await lid.page.route('**/api/reisbureau/keten/nazorg', async route => {
      vragen++; const r = await route.fetch(); assert.equal(r.status(), 200); await route.abort('failed');
    });
    const vraag = vak.locator('[data-nazorg-vraag]');
    await vraag.locator('[name="soort"]').selectOption('annulering');
    await vraag.locator('[name="toelichting"]').fill('Wilt u de mogelijkheden voor mijn hotel toelichten? Nog niets annuleren.');
    await vraag.locator('[data-nazorg-verstuur]').click();
    await vraag.getByRole('status').filter({ hasText: 'Kies minstens' }).waitFor(); assert.equal(vragen, 0);
    await vraag.locator('[name="onderdelen"][value="hotel"]').check();
    await vraag.locator('[data-nazorg-verstuur]').click();
    await lid.host.locator(':scope > [role="status"]').filter({ hasText: 'uitkomst is onbekend' }).waitFor();
    assert.equal(await vraag.locator('[data-nazorg-verstuur]').isDisabled(), true);
    await lid.page.unroute('**/api/reisbureau/keten/nazorg'); await lid.vernieuw.click();
    const gevraagd = await bron(); assert.equal(gevraagd.nazorg.length, 1); const id = gevraagd.nazorg[0].id;
    await vak.locator('[data-nazorg-id="' + id + '"]').waitFor();
    assert.equal(await vraag.locator('[name="onderdelen"][value="hotel"]').count(), 0, 'geen dubbele open vraag voor hetzelfde onderdeel');
    const partner = await open(true), antwoord = partner.host.locator('[data-nazorg-antwoord="' + id + '"]');
    await antwoord.locator('[name="soort"]').selectOption('voorstel');
    await antwoord.locator('[name="bronRef"]').fill('TEST-ONGEVERIFIEERDE-VERKOPERSVERKLARING');
    await antwoord.locator('[name="toelichting"]').fill('Voorstel: samen de voorwaarden bespreken. Er is niets gewijzigd of terugbetaald.');
    await partner.page.route('**/api/supplier/reisbureau/keten/nazorg/antwoord', async route => {
      antwoorden++; const r = await route.fetch(); assert.equal(r.status(), 200); await route.abort('failed');
    });
    await antwoord.locator('[data-nazorg-verstuur]').click();
    await partner.host.locator(':scope > [role="status"]').filter({ hasText: 'Uitkomst onbekend' }).waitFor();
    assert.equal(await antwoord.locator('[data-nazorg-verstuur]').isDisabled(), true);
    await partner.page.unroute('**/api/supplier/reisbureau/keten/nazorg/antwoord'); await partner.vernieuw.click();
    await partner.host.getByText('voorstel: Voorstel: samen de voorwaarden bespreken. Er is niets gewijzigd of terugbetaald.', { exact: true }).waitFor();
    assert.equal(await antwoord.count(), 0);
    await lid.vernieuw.click();
    await vak.getByText('voorstel: Voorstel: samen de voorwaarden bespreken. Er is niets gewijzigd of terugbetaald.', { exact: true }).waitFor();
    assert.match(await vak.innerText(), /geen geverifieerde contractgoedkeuring/);

    // Ook een succesvolle mutatie mag oude knoppen niet ontsluiten wanneer
    // juist de opvolgende bronlezing wegvalt.
    await vraag.locator('[name="onderdelen"][value="transfer"]').check();
    await vraag.locator('[name="toelichting"]').fill('Tweede vraag over het tijdstip van de transfer; geen uitvoering.');
    await lid.page.route('**/api/reisbureau/keten', route => route.abort('failed'));
    const ontvangst = lid.page.waitForResponse(r => r.url().endsWith('/keten/nazorg'));
    await vraag.locator('[data-nazorg-verstuur]').click(); assert.equal((await ontvangst).status(), 200);
    await lid.host.locator(':scope > [role="status"]').filter({ hasText: /fetch|verbinding/i }).waitFor();
    assert.equal(await vraag.locator('[data-nazorg-verstuur]').isDisabled(), true, 'geen nieuwe actie zonder geslaagde opvolglezing');
    await lid.page.unroute('**/api/reisbureau/keten'); await lid.vernieuw.click();
    await vak.getByText('Tweede vraag over het tijdstip van de transfer; geen uitvoering.', { exact: true }).waitFor();
    const na = await bron(); assert.equal(na.status, vooraf.status); assert.deepEqual(na.betaling, vooraf.betaling);
    assert.equal(na.offerte.hash, vooraf.offerte.hash); assert.deepEqual(na.leveringen, vooraf.leveringen);
    assert.equal(na.gebeurtenissen.filter(e => e.soort === 'nazorg-vraag').length, 2);
    assert.equal(na.gebeurtenissen.filter(e => e.soort === 'nazorg-antwoord').length, 1);
    const geldNa = goed(await x.api('/api/pay/overzicht', {}, x.reiziger.token), 'geld na');
    assert.deepEqual(geldNa.geschiedenis, geldVoor.geschiedenis);
    assert.equal(vragen, 1); assert.equal(antwoorden, 1);
    assert.equal(await lid.page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'nazorg past op 390 px');
    const knop = vraag.locator('[data-nazorg-verstuur]'); await knop.scrollIntoViewIfNeeded();
    const raakvlak = await knop.boundingBox(); assert.ok(raakvlak.height >= 44 && raakvlak.width >= 44);
    assert.equal(await lid.page.evaluate(r => [0.1, 0.5, 0.9].every(y => [0.1, 0.5, 0.9].every(z =>
      document.elementsFromPoint(r.x + r.width * z, r.y + r.height * y)[0]?.closest('[data-nazorg-verstuur]'))), raakvlak), true);
    const uit = path.join(__dirname, '../artifacts/experience'); fs.mkdirSync(uit, { recursive: true });
    await lid.page.screenshot({ path: path.join(uit, 'reisketen-nazorg-390.png') });
    assert.deepEqual([...lid.fouten, ...partner.fouten], []);
    await lid.ctx.close(); await partner.ctx.close();
  } finally { if (browser) await browser.close(); await h.stop(srv); fs.rmSync(map, { recursive: true, force: true }); }
});
