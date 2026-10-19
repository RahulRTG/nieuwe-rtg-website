/* TravelOS Reisboek op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.

   Wat deze toets eist, en waarom elk punt:
     1. er is geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de
        stijlbundel; de ds-poort van de basis klopt en de Edge staat;
     2. de deur: een RTG-lid zonder Lifestyle Pass ziet waarom het boek dicht
        is en dat mensen bij RTG beslissen, zonder knop die toegang geeft;
     3. de kernhandeling slaagt tegen de echte kern: een Lifestyle-lid (na
        het menselijke besluit, helper elevateTier) legt via het beheerblad
        een reis vast en voegt een document toe; Vandaag toont de reis als
        Detail met groot beeld, Documenten toont het document zonder nummer;
     4. het doel van het gedeelde element draagt zijn naam (de overgang van
        de reiskaart, test/gedeeld-element.e2e.js);
     5. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, elevateTier } = require('./helper');
const { decodeer, PAD } = require('../server/middleware/stijlbundel-rij');

const pw = laadPlaywright(), skip = geenBrowser(pw);
const BEELDEN = process.env.RTG_DS_BEELDEN || '';
let srv, browser, token, gewoon;

async function post(url, data, auth = token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl', lid = token) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [lid, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/reisboek.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForSelector('#main .ds-kaart, #main .ds-status__titel');
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, fouten };
}
async function beeld(page, naam) {
  if (!BEELDEN) return;
  fs.mkdirSync(BEELDEN, { recursive: true });
  await page.screenshot({ path: path.join(BEELDEN, 'reisboek-' + naam + '.png') });
}
async function bladen(page) {
  const hrefs = await page.evaluate(() => [...document.styleSheets].map(s => s.href).filter(Boolean));
  const uit = [];
  for (const h of hrefs) {
    const u = new URL(h);
    if (u.pathname === PAD) uit.push(...decodeer(u.searchParams.get('f')));
    else uit.push(u.pathname);
  }
  return uit;
}

async function lid(naam) {
  const now = Date.now() + Math.floor(Math.random() * 1000);
  return (await post('/api/auth/register', { name: naam, email: 'reisboek-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
}
test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', OFFICE_CODE: 'KANTOOR-REISBOEK' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  gewoon = await lid('Reisboek Gast');
  token = await lid('Reisboek Lid');
  const kantoor = (await post('/api/office/login', { code: 'KANTOOR-REISBOEK' }, null)).token;
  await elevateTier(srv.base, token, 'lifestyle', kantoor);
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  const lijst = await bladen(page);
  assert.ok(lijst.includes('/ds/rtg-ds.css'), 'het Design System is geladen');
  for (const b of lijst) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad actief op een gemigreerd scherm: ' + b);
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'ds', 'contract.json'), 'utf8'));
  const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src && new URL(s.src).pathname).filter(Boolean));
  for (const dicht of contract.dsPoort['public/shared/basis.js']) {
    assert.ok(!scripts.includes(dicht) && !lijst.includes(dicht), dicht + ' laadt op een ds-scherm terwijl de ds-poort hem dicht noemt');
  }
  assert.ok(!scripts.includes('/shared/deur.js'), 'de deur van shared/ zet zelf stijl en laadt hier niet');
  const edge = await page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
  assert.deepEqual(edge, ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  const naam = await page.locator('[data-rtg-gedeeld-doel="reisboek"]').evaluate(e => getComputedStyle(e).viewTransitionName);
  assert.equal(naam, 'none', 'met minder beweging draagt het doel geen overgangsnaam');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('de deur: zonder Lifestyle Pass zegt het boek waarom, en belooft niets', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', gewoon);
  await page.waitForSelector('#main [aria-label="Deze app is nog niet voor u geopend"]');
  const tekst = await page.locator('#main').textContent();
  assert.match(tekst, /uitsluitend op uitnodiging of na goedkeuring/);
  assert.match(tekst, /niet deze app en niet Rahul/);
  assert.equal(await page.locator('#main button').count(), 0, 'geen knop die zelf toegang verleent');
  await beeld(page, '390-deur');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een reis vastleggen en een document toevoegen loopt over de echte kern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.locator('#inhoud [data-beheer]').first().click();
  assert.equal(await page.locator('#rbBeheer').evaluate(d => d.open), true, 'het beheerblad opent');
  const van = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10), tot = new Date(Date.now() + 27 * 86400000).toISOString().slice(0, 10);
  await page.locator('#nieuweReis [name="naam"]').fill('Lissabon in de herfst');
  await page.locator('#nieuweReis [name="bestemming"]').fill('Lissabon');
  await page.locator('#nieuweReis [name="van"]').fill(van);
  await page.locator('#nieuweReis [name="tot"]').fill(tot);
  await page.locator('#nieuweReis [type="submit"]').click();
  await page.waitForSelector('form[data-lijst="documenten"]');
  await beeld(page, '390-beheer');
  await page.locator('form[data-lijst="documenten"] [name="soort"]').fill('Paspoort');
  await page.locator('form[data-lijst="documenten"] [name="geldigTot"]').fill('2031-05-01');
  await page.locator('form[data-lijst="documenten"] [type="submit"]').click();
  await page.waitForFunction(() => /Paspoort/.test(document.querySelector('form[data-lijst="documenten"]').textContent));
  const boek = await post('/api/member/rechterhand/reisboek', {});
  assert.equal(boek.reizen.length, 1, 'de server heeft de reis');
  assert.equal(boek.reizen[0].documenten[0].soort, 'Paspoort');
  await page.locator('[data-beheer-sluit]').click();
  await page.waitForSelector('#inhoud .ds-detail__beeld');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  assert.match(await page.locator('#inhoud').textContent(), /Lissabon/);
  await beeld(page, '390');
  await page.locator('[data-rb-tabknop="documenten"]').click();
  await page.waitForSelector('#inhoud .ds-lijst__rij');
  assert.match(await page.locator('#inhoud .ds-lijst').textContent(), /Paspoort.*Lissabon in de herfst/);
  assert.match(await page.locator('#inhoud').textContent(), /Nummers en bewijsstukken worden hier niet getoond/);
  assert.equal(new URL(page.url()).searchParams.get('view'), 'documenten');
  await beeld(page, '390-documenten');
  await page.locator('[data-rb-tabknop="wijzigingen"]').click();
  await page.waitForFunction(() => /Niets wordt aangepast zonder uw akkoord/.test(document.querySelector('#inhoud').textContent));
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('met beweging draagt het doel van het gedeelde element zijn naam', { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(srv.base + '/apps/reisboek.html', { waitUntil: 'domcontentloaded' });
  const naam = await page.locator('[data-rtg-gedeeld-doel="reisboek"]').evaluate(e => getComputedStyle(e).viewTransitionName);
  assert.equal(naam, 'rtg-gedeeld-reisboek');
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    const maat = await page.evaluate(() => ({ breed: document.documentElement.scrollWidth, venster: innerWidth }));
    assert.ok(maat.breed <= maat.venster, 'scrollWidth ' + maat.breed + ' > ' + maat.venster);
    await beeld(page, naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
