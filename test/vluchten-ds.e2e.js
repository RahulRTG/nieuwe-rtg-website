/* RTG Vluchten op het RTG Design System: het bewijs uit TRAVELOS-MIGRATIE.md
   par. 3, in een echte browser tegen een echte server.

   Wat deze toets eist, en waarom elk punt:
     1. er is geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de
        stijlbundel; de ds-poort van de basis klopt en de Edge staat;
     2. de kernhandeling slaagt tegen de echte luchthavenkern: een lid met de
        paspoortstrook (de echte preconditie, test/reisagenda.test.js) kiest
        een vlucht van het bord, checkt in met een koffer en ziet de
        instapkaart als Detail met de eenmalige code; de server heeft de
        boeking ingecheckt;
     3. persoonlijk vliegen is een aanvraag: Operations bevestigt persoonlijk,
        dus de charter staat er niet als bevestigd;
     4. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
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
let srv, browser, token, lucht, vluchtId;

async function post(url, data, auth = token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl', pad = '') {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/vluchten.html' + pad, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForSelector('#inhoud .ds-kaart, #inhoud .ds-status');
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, fouten };
}
async function beeld(page, naam) {
  if (!BEELDEN) return;
  fs.mkdirSync(BEELDEN, { recursive: true });
  await page.screenshot({ path: path.join(BEELDEN, 'vluchten-' + naam + '.png') });
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

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now();
  token = (await post('/api/auth/register', { name: 'Vlucht Lid', email: 'vlucht-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
  /* Een vlucht boeken eist de paspoortstrook (gegevenspoort, soort 'vlucht'). */
  await post('/api/onboarding/paspoort', { nummer: 'NX7654321', vervaldatum: '2033-01-01', nationaliteit: 'Nederlandse', geboortedatum: '1980-01-01' });
  const rooster = await post('/api/supplier/roster', { code: 'LUCHT' }, null);
  const manager = (rooster.staff || []).find(s => s.role === 'manager');
  lucht = (await post('/api/supplier/login', { code: 'LUCHT', staffId: manager && manager.id, pin: '1234' }, null)).token;
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  vluchtId = (await post('/api/lucht/vlucht/maak', { nummer: 'RT977', bestemming: 'Lissabon', datum: morgen, tijd: '10:40' }, lucht)).vlucht.id;
  await post('/api/lucht/vlucht/status', { id: vluchtId, status: 'inchecken' }, lucht);
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
  assert.equal(await page.locator('html[data-ds]').count(), 1);
  const edge = await page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
  assert.deepEqual(edge, ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  await page.locator('[data-ds-edge="acties"]').click();
  assert.match(await page.locator('#dsEdgeBlad').textContent(), /Mijn reizen/, 'Acties toont de handelingen van dit scherm');
  await page.keyboard.press('Escape');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een vlucht kiezen, inchecken en de instapkaart zien, tegen de echte luchthavenkern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  /* Het datumveld staat op de eerste dag van het bord; leeg is: elke dag. */
  await page.locator('#vliegDatum').fill('');
  await page.locator('#vliegDatum').dispatchEvent('change');
  await page.locator('#vliegNaar').fill('rt977');
  await page.waitForFunction(() => document.querySelector('#vluchtAantal').textContent === '1 vlucht');
  await beeld(page, '390');
  await page.locator('[data-boek="' + vluchtId + '"]').click();
  await page.waitForFunction(() => /Inchecken kan zodra/.test(document.querySelector('#melding').textContent));
  const mijn = await fetch(srv.base + '/api/member/vluchten/mijn', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' }).then(r => r.json());
  assert.equal(mijn.boekingen.length, 1, 'de server heeft de boeking');
  await page.locator('[data-t="mijn"]').click();
  await page.waitForSelector('[data-in]');
  await page.locator('[data-kof]').selectOption('1');
  await page.locator('[data-in]').click();
  await page.waitForSelector('[data-instapkaart] [data-pass-code]');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail', 'de instapkaart is een Detail');
  assert.equal(await page.locator('[data-instapkaart] .ds-detail__beeld').count(), 1, 'met groot beeld');
  assert.match(await page.locator('[data-instapkaart]').textContent(), /alleen in dit browsertabblad/);
  assert.ok(await page.locator('[data-intrek]').isVisible(), 'de code is in te trekken');
  await beeld(page, '390-instapkaart');
  const na = await fetch(srv.base + '/api/member/vluchten/mijn', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' }).then(r => r.json());
  assert.equal(na.boekingen[0].status, 'ingecheckt');
  assert.equal(na.boekingen[0].koffers.length, 1);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('persoonlijk vliegen is een aanvraag die Operations bevestigt', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', '?view=charter');
  await page.waitForSelector('#chVraag');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'taak');
  await page.locator('[name="chSoort"][value="helikopter"]').check();
  await page.locator('#chBest').fill('Texel');
  await beeld(page, '390-charter');
  await page.locator('#chVraag').click();
  await page.waitForFunction(() => /Operations bevestigt persoonlijk/.test(document.querySelector('#melding').textContent));
  await page.waitForSelector('#inhoud .ds-lijst__rij');
  assert.doesNotMatch(await page.locator('#inhoud .ds-lijst').textContent(), /bevestigd/, 'een aanvraag is geen bevestiging');
  assert.deepEqual(fouten, []);
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
