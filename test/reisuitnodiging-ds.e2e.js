/* De reisuitnodiging op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server
   (stroom D). Dit is een OPENBARE gastdeur, geopend via een eenmalige link.

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel, en
        de ds-poort klopt; maar ANDERS dan een ledenscherm: er staat geen Edge
        (data-ds-geen-edge) en de basis blijft buiten de deur
        (data-public-platform="travel-guest"), want een gast heeft geen
        account en geen persoonlijke context;
     2. de kernhandeling slaagt tegen de echte uitnodigingskern: de gast ziet
        waar en wanneer (Detail), niet wat er geboekt is, meldt zich aan en
        neemt de reis over (Taak), en heeft hem daarna in zijn overzicht
        (Status);
     3. een onvolledige link zegt dat eerlijk;
     4. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   Het reisprogramma (de gedeelde tijdlijn) bewijst test/reisprogramma.e2e.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, kantoorAlsPersoon } = require('./helper');
const { alleenDs, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
const dag = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
let srv, browser, kantoor;

async function post(url, data, auth, idem) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}), ...(idem ? { 'Idempotency-Key': idem } : {}) }, body: JSON.stringify(data || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function link() {
  const zet = await post('/api/office/reisbureau/klaarzetten', { naam: 'Gast', email: 'gast@voorbeeld.nl', telefoon: '0612345678',
    onderdelen: [{ soort: 'verblijf', titel: 'Casa Ibiza', bestemming: 'Ibiza', van: dag(40), tot: dag(45), kenmerk: 'QQ1234', herkomst: 'document' }] },
  kantoor, 'ds-gast-' + Date.now() + Math.random());
  assert.equal(zet.status, 200, JSON.stringify(zet.body));
  return zet.body.link;
}
async function open(breedte, hoogte, taal, adres) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript((l) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, taal);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(new URL(adres, srv.base).href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !/Even kijken/.test(document.querySelector('#vak').textContent));
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  kantoor = await kantoorAlsPersoon(srv.base);
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System, en als gastdeur zonder Edge en zonder accountschil', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', '/apps/reisuitnodiging.html');
  await alleenDs(page, { basis: false });
  assert.match(await page.textContent('#vak'), /Deze link is niet compleet\./);
  assert.equal(await page.locator('body').getAttribute('data-public-platform'), 'travel-guest');
  assert.equal(await page.locator('body').getAttribute('data-rtg-world'), 'travel');
  assert.equal(await page.locator('.ds-edge').count(), 0, 'een gastdeur draagt geen persoonlijke Edge');
  assert.equal(await page.evaluate(() => window.__rtgBasis === true), false, 'de basis laat een gastprogramma met rust');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een gast ziet waar en wanneer, meldt zich aan en heeft de reis', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', await link());
  await page.waitForSelector('#rGo');
  assert.equal(new URL(page.url()).hash, '', 'de code is uit de adresbalk gewist');
  const tekst = await page.locator('#vak').innerText();
  assert.match(tekst, /Ibiza/);
  assert.match(tekst, new RegExp(dag(40)));
  assert.doesNotMatch(tekst, /Casa Ibiza|QQ1234/, 'voor de overname geen titels of kenmerken');
  assert.equal(await page.locator('.ds-detail__beeld').count(), 1, 'het Detail draagt zijn beeld');
  await beeld(page, 'reisuitnodiging-390');
  const u = Date.now().toString().slice(-8);
  await page.fill('#rNaam', 'Nieuwe Gast');
  await page.fill('#rMail', 'ng' + u + '@x.nl');
  await page.fill('#rTel', '06' + u);
  await page.fill('#rGeb', '1990-01-01');
  await page.fill('#rWw', 'geheim123');
  await page.locator('#rGo').click();
  await page.waitForFunction(() => /Welkom bij RTG/.test(document.querySelector('#vak').textContent), null, { timeout: 30000 });
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'status');
  await beeld(page, 'reisuitnodiging-390-klaar');
  const tok = await page.evaluate(() => localStorage.getItem('rtg_member_token'));
  const r = await post('/api/reis/reizen', {}, tok);
  assert.equal(r.body.reizen.length, 1, 'de reis staat in zijn eigen overzicht');
  assert.equal(r.body.reizen[0].bestemming, 'Ibiza');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal, await link());
    await page.waitForSelector('#rGo');
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'reisuitnodiging-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
