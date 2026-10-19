/* RTG Reisbureau op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.

   Wat deze toets eist, en waarom elk punt:
     1. er is geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de
        stijlbundel; een erfenisblad brengt de oude vorm terug (ONTWERPSYSTEEM.md
        par. 5);
     2. de Edge staat, met Rahul in het midden, en de primaire handelingen van
        het scherm staan onder Acties;
     3. de kernhandeling slaagt tegen de echte kern: een reis aanvragen loopt
        over /api/reisbureau/boek en blijft "aangevraagd", nooit bevestigd; de
        aanvraag staat daarna onder Mijn aanvragen en is aan te wijzen, zodat
        het blikveld er een verwijzing van maakt (EDGE.md par. 14.4);
     4. een reiswens is een gesprek en boekt niets;
     5. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
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
  await page.goto(srv.base + '/apps/reisbureau.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForSelector('#lijst .ds-kaart, #lijst .ds-status__titel');
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, fouten };
}
async function beeld(page, naam) {
  if (!BEELDEN) return;
  fs.mkdirSync(BEELDEN, { recursive: true });
  await page.screenshot({ path: path.join(BEELDEN, 'reisbureau-' + naam + '.png') });
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
  token = (await post('/api/auth/register', { name: 'Reisbureau Lid', email: 'reisbureau-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  const lijst = await bladen(page);
  assert.ok(lijst.includes('/ds/rtg-ds.css'), 'het Design System is geladen');
  for (const b of lijst) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad actief op een gemigreerd scherm: ' + b);
  assert.equal(await page.locator('.rtgsprong-greep').count(), 0, 'de sprong tekent geen eigen greep naast de Edge');
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'ds', 'contract.json'), 'utf8'));
  const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src && new URL(s.src).pathname).filter(Boolean));
  for (const dicht of contract.dsPoort['public/shared/basis.js']) {
    assert.ok(!scripts.includes(dicht) && !lijst.includes(dicht), dicht + ' laadt op een ds-scherm terwijl de ds-poort hem dicht noemt');
  }
  assert.equal(await page.locator('html[data-ds]').count(), 1);
  const edge = await page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
  assert.deepEqual(edge, ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.equal(await page.locator('.rtg-adaptive-edge, .rtg-v4-header').count(), 0, 'geen tweede, oude Edge');
  await page.locator('[data-ds-edge="acties"]').click();
  assert.match(await page.locator('#dsEdgeBlad').textContent(), /Bekijk wat bij mij past/, 'Acties toont de handelingen van dit scherm');
  await page.keyboard.press('Escape');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een reis aanvragen loopt over de echte kern en blijft "aangevraagd"; de aanvraag is aan te wijzen', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  assert.ok(await page.locator('#lijst .ds-kaart--beeld').count() > 0, 'de seed heeft reizen; de collectie toont ze');
  await beeld(page, '390');
  await page.locator('#lijst [data-id]').first().click();
  assert.equal(await page.locator('#blad').evaluate(d => d.open), true, 'het reisblad opent');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  await page.waitForFunction(() => document.querySelectorAll('#bladRegels .ds-detail__gegeven').length > 3);
  assert.match(await page.locator('#rTotaal').textContent(), /Richtprijs/);
  await page.locator('#rPlus').click();
  assert.equal(await page.locator('#rAantal').textContent(), '3');
  assert.equal(await page.locator('#rBoek').isVisible(), false, 'versturen komt pas na controleren');
  await page.locator('#rReview').click();
  assert.match(await page.locator('#rSummary').textContent(), /niets betaald of definitief geboekt/);
  await beeld(page, '390-detail');
  await page.locator('#rBoek').click();
  await page.waitForFunction(() => /Referentie/.test(document.querySelector('#rStatus').textContent));
  assert.match(await page.locator('#rStatus').textContent(), /Aangevraagd, nog niet bevestigd/);
  const mijn = (await post('/api/reisbureau/mijn', {})).aanvragen;
  assert.equal(mijn.length, 1, 'de server heeft de aanvraag');
  assert.equal(mijn[0].status, 'aangevraagd');
  assert.equal(mijn[0].personen, 3);
  await page.locator('#bladTerug').click();
  const rij = page.locator('[data-aanvraag="' + mijn[0].ref + '"]');
  await rij.waitFor();
  assert.equal(await rij.locator('.ds-detail__status').textContent(), 'aangevraagd', 'een aanvraag is geen bevestiging');
  await rij.locator('h3').click();
  assert.equal(await rij.getAttribute('aria-current'), 'true');
  assert.deepEqual(await page.evaluate(() => RTGEdgeBlikveld.voorRahul().verwijzingen), [{ soort: 'reisaanvraag', id: mijn[0].ref }],
    'het blikveld maakt van de aangewezen aanvraag een verwijzing met alleen soort en ref');
  await beeld(page, '390-mijn');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een reiswens is een gesprek en boekt niets', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  assert.equal(await page.locator('#travelAdvice').isVisible(), true);
  await page.locator('#adviesIn').fill('Een rustige week aan zee.');
  await page.locator('#adviesGo').click();
  await page.waitForFunction(() => !/denkt mee/.test(document.querySelector('#adviesUit').textContent));
  assert.equal(await page.locator('#adviesUit .ds-gesprek__bericht--eigen').textContent(), 'Een rustige week aan zee.');
  assert.ok(await page.locator('#adviesUit .ds-gesprek__bericht:not(.ds-gesprek__bericht--eigen)').count() >= 1, 'het antwoord staat als bericht');
  const voor = (await post('/api/reisbureau/mijn', {})).aanvragen.length;
  if (await page.locator('#adviesOpen').count()) {
    await page.locator('#adviesOpen').click();
    assert.equal(await page.locator('#blad').evaluate(d => d.open), true, 'Bekijk opent het reisblad, verder niets');
  }
  assert.equal((await post('/api/reisbureau/mijn', {})).aanvragen.length, voor, 'een advies maakt geen aanvraag');
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
