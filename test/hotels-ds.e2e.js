/* RTG Verblijven op het RTG Design System: het bewijs van batch 3 uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.

   Wat deze toets eist, en waarom elk punt:
     1. er is geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de
        stijlbundel die de server van de <link>s maakt. Een scherm dat ook
        maar een erfenisblad laadt, krijgt de oude vorm terug: een regel buiten
        een cascadelaag wint van elke laag (ONTWERPSYSTEEM.md par. 5);
     2. de Edge staat, met Rahul in het midden, en er zweeft geen tweede greep;
     3. de kernhandeling slaagt tegen de echte verblijfskern: een verblijf
        aanvragen bij een echt huis, en het daarna onder Mijn reizen zien staan
        als "Aangevraagd", nooit als bevestigd;
     4. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren voor de
   vergelijking met de mockups. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { decodeer, PAD } = require('../server/middleware/stijlbundel-rij');

const pw = laadPlaywright(), skip = geenBrowser(pw);
const BEELDEN = process.env.RTG_DS_BEELDEN || '';
let srv, browser, token;

async function post(url, data, auth = token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl') {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/hotels.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForSelector('#inhoud .ds-kaart, #inhoud .ds-status__titel');
  return { ctx, page, fouten };
}
async function beeld(page, naam) {
  if (!BEELDEN) return;
  fs.mkdirSync(BEELDEN, { recursive: true });
  await page.screenshot({ path: path.join(BEELDEN, 'hotels-' + naam + '.png') });
}
/* Elk actief blad, met de bundel uitgepakt tot de bladen die erin zitten. */
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
  token = (await post('/api/auth/register', { name: 'Verblijf Lid', email: 'verblijf-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, geen tweede greep, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  const lijst = await bladen(page);
  assert.ok(lijst.length, 'er is minstens een blad actief');
  for (const b of lijst) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad actief op een gemigreerd scherm: ' + b);
  assert.ok(lijst.includes('/ds/rtg-ds.css'), 'het Design System is geladen');
  assert.equal(await page.locator('.rtgsprong-greep').count(), 0, 'de sprong tekent geen eigen greep naast de Edge');
  /* De ds-poort van de basis klopt: wat contract.json dsPoort noemt, laadt
     hier werkelijk niet (de statische meting vertrouwt daarop). */
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'ds', 'contract.json'), 'utf8'));
  const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src && new URL(s.src).pathname).filter(Boolean));
  for (const dicht of contract.dsPoort['public/shared/basis.js']) {
    assert.ok(!scripts.includes(dicht) && !lijst.includes(dicht), dicht + ' laadt op een ds-scherm terwijl de ds-poort hem dicht noemt');
  }
  assert.ok(scripts.includes('/shared/basis.js') || scripts.includes('/scriptbundel.js'), 'de basis draait (gedrag blijft)');
  assert.equal(await page.locator('html[data-ds]').count(), 1);
  const edge = await page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
  assert.deepEqual(edge, ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  await page.locator('[data-ds-edge="acties"]').click();
  assert.ok((await page.locator('#dsEdgeBlad').textContent()).includes('Mijn reizen'), 'Acties toont de handelingen van dit scherm');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dsEdgeBlad').isHidden(), true, 'Escape sluit het blad');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een verblijf aanvragen loopt over de echte verblijfskern en blijft "Aangevraagd"', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  assert.ok(await page.locator('#inhoud .ds-kaart').count() > 0, 'de seed heeft huizen; de collectie toont ze');
  await beeld(page, '390');
  await page.locator('[data-huis]').first().click();
  assert.equal(await page.locator('#verblijfBlad').evaluate(d => d.open), true, 'het verblijfsblad opent');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  assert.equal(await page.locator('#rBoek').isDisabled(), true, 'zonder kamer is aanvragen niet mogelijk');
  await page.locator('[data-kamer]').first().click();
  assert.match(await page.locator('#rTotaal').textContent(), /totaal/);
  await beeld(page, '390-detail');
  await page.locator('#rBoek').click();
  await page.waitForSelector('#inhoud .ds-detail__status');
  assert.equal(await page.locator('#verblijfBlad').evaluate(d => d.open), false, 'het blad sluit na de aanvraag');
  assert.match(await page.locator('#inhoud').textContent(), /Aangevraagd/);
  assert.doesNotMatch(await page.locator('#inhoud').textContent(), /Klaar voor aankomst|U bent thuis/, 'een aanvraag is geen bevestiging');
  const mijn = await post('/api/verblijf/mijn', {});
  assert.equal(mijn.verblijven.length, 1, 'de server heeft de aanvraag');
  assert.equal(mijn.verblijven[0].status, 'aangevraagd');
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
