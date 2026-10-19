/* De Hangar op het RTG Design System: het bewijs uit TRAVELOS-MIGRATIE.md
   par. 3, in een echte browser tegen een echte server (stroom D).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat met Rahul in het midden;
     2. de kernhandeling slaagt tegen de echte rechterhandkern: een Lifestyle-
        lid zet een toestel in zijn hangar (Collectie), opent het (Detail) en
        logt een vlucht (Taak); de server heeft beide;
     3. een lid zonder Lifestyle Pass ziet de deur, en die belooft geen
        toegang: een mens beslist;
     4. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, elevateTier } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, lid, gewoon;

async function post(url, data, auth) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function registreer(naam) {
  const n = String(Date.now()) + Math.floor(Math.random() * 90 + 10);
  return (await post('/api/auth/register', { name: naam, email: naam.toLowerCase().replace(/\W/g, '') + n + '@e.test',
    phone: '06' + n.slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' })).token;
}
async function open(breedte, hoogte, taal = 'nl', token = lid) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/hangar.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForSelector('#inhoud .ds-velden, #inhoud .ds-status__titel');
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  lid = await registreer('Hangar Lid');
  await elevateTier(srv.base, lid, 'lifestyle');
  gewoon = await registreer('Gewoon Lid');
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.match(await edgeActies(page), /Toestel toevoegen/, 'Acties toont de handelingen van dit scherm');
  assert.equal(await page.locator('#dsEdgeBlad').isHidden(), true, 'Escape sluit het blad');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een toestel toevoegen, openen en een vlucht loggen loopt over de echte hangar', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.fill('#tN', 'Falcon Een');
  await page.fill('#tR', 'PH-RTG');
  await page.fill('#tB', 'Rotterdam');
  await page.locator('#tAdd').click();
  await page.waitForSelector('#inhoud .ds-kaart--beeld[data-id]');
  assert.match(await page.locator('.ds-kaart--beeld .ds-kaart__titel').first().textContent(), /Falcon Een/, 'de naam staat op de foto');
  await beeld(page, 'hangar-390');
  await page.locator('[data-id]').first().click();
  await page.waitForSelector('#inhoud .ds-detail');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  assert.match(await page.locator('.ds-detail__status').textContent(), /Rotterdam/, 'de positie is de thuishaven zolang er niet gevlogen is');
  await page.fill('#vV', 'Rotterdam');
  await page.fill('#vN', 'Ibiza');
  await page.fill('#vD', '2026-01-10');
  await page.fill('#vU', '2.5');
  await page.locator('#vAdd').click();
  await page.waitForSelector('#logboek .ds-lijst__rij');
  assert.match(await page.locator('#logboek').textContent(), /Rotterdam → Ibiza/);
  await beeld(page, 'hangar-390-detail');
  const stand = await post('/api/member/rechterhand/hangar', {}, lid);
  assert.equal(stand.toestellen.length, 1, 'de server heeft het toestel');
  assert.equal(stand.vluchten.length, 1, 'en de vlucht');
  assert.equal(stand.toestellen[0].positie, 'Ibiza', 'na een gevlogen vlucht staat het toestel op de aankomst');
  await page.locator('#terug').click();
  await page.waitForSelector('#aiK');
  await page.fill('#aiV', 'Waar staat de jet nu?');
  await page.locator('#aiK').click();
  await page.waitForFunction(() => { const b = document.querySelectorAll('#aiA .ds-gesprek__bericht');
    return b.length === 2 && b[1].textContent !== 'Een ogenblik…'; });
  assert.equal(await page.locator('#aiA .ds-gesprek__bericht--eigen').textContent(), 'Waar staat de jet nu?');
  await beeld(page, 'hangar-390-gesprek');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder Lifestyle Pass staat de deur dicht, en belooft hij geen toegang', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', gewoon);
  const tekst = await page.locator('#inhoud').textContent();
  assert.match(tekst, /uitsluitend op uitnodiging of na goedkeuring/);
  assert.match(tekst, /mensen bij RTG/);
  assert.equal(await page.locator('#tAdd').count(), 0, 'geen hangar zonder pas');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'hangar-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
