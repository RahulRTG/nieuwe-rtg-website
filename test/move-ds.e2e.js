/* RTG Move op het RTG Design System: het bewijs van batch 4 uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.
   Naar het model van test/hotels-ds.e2e.js.

   Wat deze toets eist:
     1. geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de bundel;
        de ds-poort klopt en de Edge staat;
     2. de kernhandeling slaagt tegen de echte weging: twee echte boekingen
        worden een oordeel met de dekking ernaast en een kaart per overgang,
        en de verderknop staat er pas met een echte plek. Hij is ook een
        handeling van de Edge en brengt het lid naar Navigatie, met de plek;
     3. zonder reis toont het scherm een rustige status, geen oordeel;
     4. op 390, 820 en 1440 px loopt niets over, en in het Arabisch staat
        dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { decodeer, PAD } = require('../server/middleware/stijlbundel-rij');

const pw = laadPlaywright(), skip = geenBrowser(pw);
const BEELDEN = process.env.RTG_DS_BEELDEN || '';
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);
let srv, browser, reiziger, leeg;

async function post(url, data, auth) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function lid(naam) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  return (await post('/api/auth/register', { name: naam, email: 'mvds' + u + '@e.test', phone: '06' + u.slice(0, 8),
    password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' })).token;
}
async function open(token, breedte, hoogte, taal = 'nl') {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/move.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForSelector('[data-naad], #naden .ds-status__titel');
  return { ctx, page, fouten };
}
async function beeld(page, naam) {
  if (!BEELDEN) return;
  fs.mkdirSync(BEELDEN, { recursive: true });
  await page.screenshot({ path: path.join(BEELDEN, 'move-' + naam + '.png') });
}
async function bladen(page) {
  const hrefs = await page.evaluate(() => [...document.styleSheets].map(s => s.href).filter(Boolean));
  const uit = [];
  for (const h of hrefs) { const u = new URL(h); if (u.pathname === PAD) uit.push(...decodeer(u.searchParams.get('f'))); else uit.push(u.pathname); }
  return uit;
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', NODE_ENV: 'test', RTG_DEMO: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  reiziger = await lid('Move Lid'); leeg = await lid('Move Leeg');
  /* Een afspraak om 08:00 en een charter om 09:30: twee plekken, en de tweede
     is een vlucht, dus de volgende plek is een luchthaven. */
  const d = morgen();
  const bk = await post('/api/booking/request', { supplierCode: 'KAITO', serviceId: 's1', date: d, time: '08:00' }, reiziger);
  await post('/api/booking/pay', { ref: bk.boeking.ref }, reiziger);
  await post('/api/member/vluchten/charter', { soort: 'privejet', bestemming: 'Parijs Le Bourget', datum: d, tijd: '09:30' }, reiziger);
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(reiziger, 390, 844);
  const lijst = await bladen(page);
  for (const b of lijst) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad actief op een gemigreerd scherm: ' + b);
  assert.ok(lijst.includes('/ds/rtg-ds.css'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'ds', 'contract.json'), 'utf8'));
  const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src && new URL(s.src).pathname).filter(Boolean));
  for (const dicht of contract.dsPoort['public/shared/basis.js']) assert.ok(!scripts.includes(dicht) && !lijst.includes(dicht), dicht + ' laadt toch');
  const edge = await page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
  assert.deepEqual(edge, ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('de echte weging wordt een oordeel, en de Edge brengt het lid naar de volgende plek', { skip }, async () => {
  const { ctx, page, fouten } = await open(reiziger, 390, 844);
  assert.match(await page.locator('#oordeel').innerText(), /betrouwbaar|lucht|lukken/i, 'het oordeel gaat over de overgang');
  assert.match(await page.locator('#mDekking').innerText(), /%/, 'de dekking staat ernaast');
  assert.ok(await page.locator('#naden [data-naad]').count() >= 1, 'een kaart per overgang');
  assert.match(await page.locator('[data-naad] [data-cijfers]').first().innerText(), /min/);
  await page.waitForFunction(() => !document.querySelector('#verderVak').hidden);
  const label = (await page.locator('#verder').innerText()).trim();
  assert.match(label, /airport|luchthaven/i, 'de verderknop noemt de luchthaven: ' + label);
  await beeld(page, '390');
  await page.locator('[data-naad]').first().evaluate(e => e.scrollIntoView());
  await beeld(page, '390-overgang');
  await page.locator('[data-ds-edge="acties"]').click();
  await page.locator('#dsEdgeBlad button', { hasText: label }).click();
  await page.waitForURL(/navigatie\.html/);
  const naar = String(new URL(page.url()).searchParams.get('naar') || '').split(',').map(Number);
  assert.ok(naar.length === 2 && naar.every(Number.isFinite), 'Navigatie krijgt een opgeloste plek mee: ' + page.url());
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder reis een rustige status, geen oordeel en geen verderknop', { skip }, async () => {
  const { ctx, page, fouten } = await open(leeg, 390, 844);
  assert.match(await page.locator('#naden .ds-status__titel').innerText(), /Nog geen reis om te wegen/);
  assert.doesNotMatch(await page.locator('#oordeel').innerText(), /lucht|betrouwbaar/i);
  assert.equal(await page.locator('#verderVak').evaluate(e => e.hidden), true);
  await beeld(page, '390-status');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(reiziger, w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    const maat = await page.evaluate(() => ({ breed: document.documentElement.scrollWidth, venster: innerWidth }));
    assert.ok(maat.breed <= maat.venster, 'scrollWidth ' + maat.breed + ' > ' + maat.venster);
    await beeld(page, naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
