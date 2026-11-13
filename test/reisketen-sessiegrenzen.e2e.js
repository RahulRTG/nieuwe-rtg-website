/* Echte browser/HTTP-sessiegrenzen. Opslaguitval is expliciete browser-
   faultinjectie, geen bron- of bevoegdheidsmock. Een tabwissel is werkelijk
   een tweede tabblad met dezelfde origin en een ander bestaand account. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const h = require('./helper'), { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
let srv, browser, x, eigen, partner;
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-sessiegrens-'));
test.before(async () => {
  const pw = h.laadPlaywright({ eigenDriver: false }); assert.ok(pw && pw.chromium, 'Chromium verplicht');
  srv = await h.startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
  x = await maakReisketenFixture(srv.base); browser = await h.startBrowser(pw);
  async function begin(titel, supplierCode) {
    return goed(await x.api('/api/reisbureau/keten/start', { titel, bestemming: 'Ibiza', supplierCode,
      idem: titel.replaceAll(' ', '-') }, x.reiziger.token), 'aanvraag').reis;
  }
  eigen = await begin('Eigen sessiegrensreis'); partner = await begin('Vertrouwelijke partnersessiegrensreis', x.bureau.code);
  console.log('Sessiegaten Chromium ' + browser.version());
});
test.after(async () => { if (browser) await browser.close(); if (srv) await h.stop(srv); fs.rmSync(map, { recursive: true, force: true }); });
async function open(rol, installeer) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  const page = await ctx.newPage(); page.setDefaultTimeout(20000); const fouten = h.letOpFouten(page, []);
  if (installeer) await installeer(page);
  await page.goto(srv.base + '/manifest.webmanifest');
  await page.evaluate(({ lid, kantoor, zaak }) => {
    localStorage.setItem('rtg_member_token', lid); localStorage.setItem('rtg_office_token', kantoor);
    localStorage.setItem('rtg_sup_token', zaak); localStorage.setItem('rtg_sup_station', 'kantoor');
    localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, { lid: x.reiziger.token, kantoor: x.office, zaak: x.bureau.token });
  const pad = rol === 'lid' ? '/apps/reisbureau.html' : rol === 'kantoor' ? '/apps/kantoren.html?kamer=reisbureau' : '/apps/leverancier.html';
  await page.goto(srv.base + pad, { waitUntil: 'domcontentloaded' });
  if (rol === 'zaak') {
    await page.locator('#station.on').waitFor();
    await page.locator('.poort-kaart [data-sluit]').waitFor({ state: 'attached' });
    const later = page.locator('.poort-waas:not([hidden]) [data-sluit]'); if (await later.isVisible()) await later.click();
    await page.locator('[data-ksec="reiscontracten"]').click();
  }
  const host = page.locator(rol === 'lid' ? '#reisKeten' : rol === 'kantoor' ? '#kReisContracten' : '#zaakReisContracten');
  await host.getByRole('heading', { name: rol === 'zaak' ? partner.titel : eigen.titel, exact: true }).waitFor();
  return { ctx, page, host, fouten };
}
test('leverancier wist bestaande dossiers en concepten meteen bij echte andere-tab-sessiewissel, zonder nieuwe API-actie', async () => {
  const o = await open('zaak');
  try {
    await o.host.getByRole('button', { name: 'Offerte opstellen', exact: true }).click();
    await o.host.locator('[name="voorwaarden"]').fill('Vertrouwelijk nog niet opgeslagen partnerconcept');
    let reishandelingen = 0;
    o.page.on('request', r => { if (r.url().includes('/api/supplier/reisbureau/')) reishandelingen++; });
    const tab = await o.ctx.newPage(); await tab.goto(srv.base + '/manifest.webmanifest');
    await tab.evaluate(token => localStorage.setItem('rtg_sup_token', token), x.anderBureau.token);
    await o.host.getByText('Uw reissessie is niet meer bevoegd. Open uw werkplek opnieuw.', { exact: true }).waitFor();
    assert.equal((await o.host.innerText()).includes(partner.titel), false);
    assert.equal(await o.host.locator('form').count(), 0);
    assert.equal(reishandelingen, 0, 'wissen wacht niet op een volgend verzoek');
    assert.equal(await tab.evaluate(() => localStorage.getItem('rtg_sup_token')), x.anderBureau.token, 'de oude pagina wist niet de nieuwe sessie');
    assert.deepEqual(o.fouten, []);
  } finally { await o.ctx.close(); }
});
for (const rol of ['lid', 'kantoor']) test(rol + ': onleesbare sessieopslag blokkeert vóór transport en wist oud dossier', async () => {
  const uitgesteld = [];
  let alleGevraagd;
  const onderweg = new Promise(r => { alleGevraagd = r; });
  const o = await open(rol, rol !== 'kantoor' ? null : async page => {
    for (const pad of ['afdelingshotel', 'reisbureau/uitnodigingen']) await page.route('**/api/office/' + pad, async route => {
      const response = await route.fetch();
      let klaar;
      const afgehandeld = new Promise(r => { klaar = r; });
      await new Promise(vrij => {
        uitgesteld.push({ pad, vrij, afgehandeld });
        if (uitgesteld.some(r => r.pad === 'afdelingshotel') && uitgesteld.filter(r => r.pad === 'reisbureau/uitnodigingen').length === 2) alleGevraagd();
      });
      await route.fulfill({ response }); klaar();
    });
  });
  try {
    if (rol === 'kantoor') await onderweg;
    const api = rol === 'lid' ? '/api/reisbureau/keten' : '/api/office/reisbureau/keten';
    let verzoeken = 0; o.page.on('request', r => { if (r.url().endsWith(api)) verzoeken++; });
    await o.page.evaluate(sleutel => {
      const origineel = Storage.prototype.getItem;
      Storage.prototype.getItem = function (naam) {
        if (naam === sleutel) throw new DOMException('Geïnjecteerde opslaguitval', 'SecurityError');
        return origineel.call(this, naam);
      };
    }, rol === 'lid' ? 'rtg_member_token' : 'rtg_office_token');
    // Een al onderweg zijnd echt kantoorantwoord kan dezelfde opslagfout
    // eerder constateren en de volledige inlogdeur openen. Ook dat sluit
    // vóór deze volgende actie; een verdwenen knop mag niet worden nagebouwd.
    if (await o.host.count()) {
      await o.host.getByRole('button', { name: rol === 'lid' ? 'Controleer mijn reiscontracten' : 'Reiscontracten vernieuwen', exact: true })
        .click({ timeout: 2000 }).catch(async e => { if (await o.host.count()) throw e; });
    }
    await o.page.waitForFunction(selector => {
      const el = document.querySelector(selector); return !el || !el.textContent.includes('Eigen sessiegrensreis');
    }, rol === 'lid' ? '#reisKeten' : '#kReisContracten');
    if (rol === 'kantoor') {
      // Deze echte antwoorden zijn al onderweg bij het wissen. Eerst opent
      // één antwoord de sessiedeur; daarna komt de andere tekenaar te laat.
      const hotel = uitgesteld.find(r => r.pad === 'afdelingshotel'); assert.ok(hotel);
      hotel.vrij(); await o.page.locator('#kReisContracten').waitFor({ state: 'detached' });
      uitgesteld.forEach(r => r.vrij());
      await Promise.all(uitgesteld.map(r => r.afgehandeld));
      await o.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    }
    assert.equal(verzoeken, 0, 'een oncontroleerbare sessie mag geen beschermd verzoek versturen');
    assert.deepEqual(o.fouten, []);
  } finally { uitgesteld.forEach(r => r.vrij()); await o.ctx.close(); }
});
