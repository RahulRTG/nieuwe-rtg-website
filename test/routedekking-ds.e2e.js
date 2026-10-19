/* De routedekking op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server
   (stroom F, kantoorschermen op de werklaag).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat met Rahul in het midden en
        toont de tabbladen van dit scherm onder Acties;
     2. de kantoordeur blijft: zonder kantoortoken stuurt het scherm naar de
        ene kantoorinlog in de personeels-app;
     3. de kernhandeling slaagt tegen de echte dekkingskern: de stand draagt
        zijn teken in TEKST, de domeinen en de routes staan achter hun
        tabblad en verschijnen na een klik, en "alleen zonder toets" vraagt de
        server opnieuw;
     4. op 390, 820 en 1440 px loopt niets horizontaal over, ook niet met de
        routelijst open, en in het Arabisch staat dir="rtl" zonder overloop.
   Het cijfer zelf (scherm = server) bewaakt test/routedekking.e2e.js.
   Zet RTG_DS_BEELDEN=<map> om schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, kantoorAlsPersoon } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, kantoor;

async function open(breedte, hoogte, taal = 'nl', token = kantoor) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_office_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/routedekking.html', { waitUntil: 'domcontentloaded' });
  if (token) {
    await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
    await page.waitForFunction(() => /\d/.test(document.querySelector('#cTotaal').textContent), null, { timeout: 30000 });
  }
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  kantoor = await kantoorAlsPersoon(srv.base);
  assert.ok(kantoor, 'het kantoor logt in');
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.match(await edgeActies(page), /Alle routes/, 'Acties toont de handelingen van dit scherm');
  assert.equal(await page.locator('#dsEdgeBlad').isHidden(), true, 'Escape sluit het blad');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder kantoortoken stuurt het scherm naar de ene kantoordeur', { skip }, async () => {
  const { ctx, page } = await open(390, 844, 'nl', null);
  await page.waitForURL(/\/apps\/personeel\.html\?kantoor=1&terug=%2Fapps%2Froutedekking\.html/);
  await ctx.close();
});

test('de stand, de domeinen en de routes komen van de echte dekkingskern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  const vraag = body => fetch(srv.base + '/api/office/routedekking', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor },
    body: JSON.stringify(body) }).then(r => r.json());
  const api = await vraag({ limiet: 50 });

  /* De stand: het teken staat in de zichtbare tekst, niet alleen in een attribuut. */
  const stand = await page.locator('#stand').evaluate(e => ({ teken: e.dataset.teken, tekst: e.textContent.trim() }));
  assert.ok(stand.teken && stand.tekst.startsWith(stand.teken + ' '), 'het teken staat voor het woord: ' + JSON.stringify(stand));
  assert.ok((await page.textContent('#melding')).length > 20, 'een stand zonder uitleg is een cijfer');
  await beeld(page, 'routedekking-390');

  /* Per domein: verborgen tot het tabblad, dan een rij per domein. */
  assert.equal(await page.locator('#paneelDomein').isHidden(), true);
  await page.locator('[data-tab="domein"]').click();
  assert.equal(await page.locator('#tabDomein').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#domeinen .ds-veld').count(), api.perDomein.length);
  await beeld(page, 'routedekking-390-domein');

  /* Alle routes: na de klik in beeld, evenveel rijen als in het antwoord. */
  await page.locator('[data-tab="routes"]').click();
  await page.waitForSelector('#lijst .ds-lijst__rij', { state: 'visible' });
  assert.equal(await page.locator('#paneelStand').isHidden(), true, 'een tabblad tegelijk');
  assert.equal(await page.locator('#lijst .ds-lijst__rij').count(), api.lijst.resultaten.length);
  const eerste = (await page.locator('#lijst .ds-lijst__rij').first().textContent()).replace(/\s+/g, ' ');
  assert.ok(eerste.includes(api.lijst.resultaten[0].methode) && eerste.includes(api.lijst.resultaten[0].pad), eerste);
  assert.match(eerste, /✓ beproefd|× geen toets/, 'de dekking per route draagt een teken in tekst');

  /* "alleen zonder toets" vraagt de server opnieuw met alleenGaten. */
  const gaten = await vraag({ limiet: 50, alleenGaten: true });
  await page.locator('#gaten').check();
  await page.waitForFunction(n => {
    const t = document.querySelector('#paginatel').textContent;
    return n ? / van /.test(t) && document.querySelectorAll('#lijst [data-gedekt="ja"]').length === 0 : t === 'geen resultaten';
  }, gaten.lijst.totaal);
  await geenOverloop(page);
  await beeld(page, 'routedekking-390-routes');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await page.locator('[data-tab="routes"]').click();
    await page.waitForSelector('#lijst .ds-lijst__rij', { state: 'visible' });
    await geenOverloop(page);
    await beeld(page, 'routedekking-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
