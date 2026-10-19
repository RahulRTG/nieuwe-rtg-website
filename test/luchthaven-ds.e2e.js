/* RTG Airport op het RTG Design System: het bewijs uit TRAVELOS-MIGRATIE.md
   par. 3, in een echte browser tegen een echte server (stroom E, de
   werklaag uit par. 1b).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat, en de operatienavigatie
        van Travel OS (vroeger .tos-opsnav) staat als chips met deze plek
        als huidige;
     2. de kernhandeling slaagt tegen de echte luchthavenkern: een medewerker
        kiest zichzelf uit het rooster, tikt zijn pincode, ziet de cockpit,
        zet een vlucht op het bord en zet hem een stap verder; de server
        heeft beide;
     3. zonder werkinlog blijft de operatie dicht (alleen de inlog), en
        "Wissel" brengt een ingelogde dienst terug naar de inlog;
     4. ingebed (?embed=1) draagt de ouder de navigatie: geen kop, geen Edge,
        geen operatienavigatie;
     5. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, baas, baasId;

async function post(url, data, auth) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, { taal = 'nl', token = baas, zoek = '' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => {
    if (sessionStorage.getItem('rtg_toets_opslag')) return;
    sessionStorage.setItem('rtg_toets_opslag', '1');
    localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_werk_lucht', t); else localStorage.removeItem('rtg_werk_lucht');
  }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/luchthaven.html' + zoek, { waitUntil: 'domcontentloaded' });
  if (!zoek) await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  return { ctx, page, fouten };
}
const cockpit = page => page.waitForFunction(() => /Vluchten vandaag/.test(document.querySelector('#app').textContent));

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'LUCHT' });
  baasId = roster.staff.find(x => x.role === 'manager').id;
  baas = (await post('/api/supplier/login', { code: 'LUCHT', staffId: baasId, pin: '1234' })).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge en de operatienavigatie staan', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, { token: null });
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.match(await edgeActies(page), /Inloggen/, 'Acties toont de inlog van dit scherm');
  const ops = await page.locator('[data-ds-opsnav] .ds-chip').evaluateAll(x => x.map(a => [a.textContent, a.getAttribute('aria-current')]));
  assert.deepEqual(ops.map(o => o[0]), ['Reiziger', 'Chauffeur', 'Luchthaven', 'Regie']);
  assert.deepEqual(ops.find(o => o[1] === 'page'), ['Luchthaven', 'page']);
  assert.equal(await page.locator('body').getAttribute('data-rtg-context-bron'), 'luchthaven', 'het scherm zegt nog zelf waar je bent');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('inloggen met de pincode, de cockpit en een vlucht op het bord lopen over de echte luchthavenkern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, { token: null });
  assert.equal(await page.locator('#app').isHidden(), true, 'zonder werkinlog is de operatie dicht');
  await page.waitForFunction(id => !!document.querySelector('#wie option[value="' + id + '"]'), baasId);
  await page.selectOption('#wie', String(baasId));
  await page.fill('#pin', '1234');
  await beeld(page, 'luchthaven-390-inlog');
  await page.locator('#loginGo').click();
  await cockpit(page);
  assert.equal(await page.locator('#login').isHidden(), true);
  assert.equal(await page.locator('#wissel').isVisible(), true, 'een ingelogde dienst kan wisselen');
  assert.equal(await page.evaluate(() => localStorage.getItem('rtg_werk_lucht') !== null), true, 'de dienst blijft op dit toestel staan');
  await beeld(page, 'luchthaven-390');

  await page.locator('[data-rol="vluchtleiding"]').click();
  await page.waitForSelector('#nMaak');
  const nr = 'RT' + String(Date.now()).slice(-3);
  await page.fill('#nNr', nr);
  await page.fill('#nBest', 'Formentera');
  await page.locator('#nMaak').click();
  await page.waitForFunction(n => document.querySelector('#vlLijst').textContent.includes(n), nr);
  assert.match(await edgeActies(page), /Op het bord/, 'de handeling van de werkplek staat onder Acties');
  const rij = page.locator('#vlLijst .ds-lijst__rij', { hasText: nr });
  await rij.locator('[data-stap]').click();
  await page.waitForFunction(n => [...document.querySelectorAll('#vlLijst .ds-lijst__rij')]
    .some(r => r.textContent.includes(n) && /inchecken/.test(r.querySelector('.ds-lijst__tijd').textContent)), nr);
  const bord = await post('/api/lucht/bord', {}, baas);
  const v = bord.vluchten.find(x => x.nummer === nr);
  assert.ok(v, 'de vlucht staat op het bord van de server');
  assert.equal(v.status, 'inchecken', 'en de stap is op de server gezet');
  await beeld(page, 'luchthaven-390-bord');

  await page.locator('#terug').click();
  await cockpit(page);
  await page.locator('#wissel').click();
  await page.waitForFunction(() => !document.querySelector('#login').hidden && document.querySelector('#app').hidden);
  assert.equal(await page.evaluate(() => localStorage.getItem('rtg_werk_lucht')), null, 'wisselen meldt de dienst af');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('ingebed draagt de ouder de navigatie: geen kop, geen Edge, geen operatienavigatie', { skip }, async () => {
  const { ctx, page, fouten } = await open(1300, 900, { zoek: '?embed=1' });
  await cockpit(page);
  await page.waitForFunction(() => document.documentElement.hasAttribute('data-ds-ingebed'));
  assert.equal(await page.locator('.ds-kop').count(), 0);
  assert.equal(await page.locator('.ds-edge').count(), 0);
  assert.equal(await page.locator('[data-ds-opsnav]').isHidden(), true);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, b, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(b, h, { taal });
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await cockpit(page);
    await geenOverloop(page);
    for (const rol of ['vluchtleiding', 'vip']) {
      await page.locator('[data-rol="' + rol + '"]').click();
      await page.waitForSelector('#terug');
      await page.waitForFunction(() => document.querySelector('.ds-lijst .ds-lijst__rij, .ds-lijst .ds-meta'));
      await geenOverloop(page);
      await page.locator('#terug').click();
      await cockpit(page);
    }
    await beeld(page, 'luchthaven-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
