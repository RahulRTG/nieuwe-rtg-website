/* TravelOS (reizen) op het RTG Design System: het bewijs van stroom A uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.

   Wat deze toets eist, en waarom elk punt:
     1. er is geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de
        stijlbundel; de ds-poort van de basis klopt; de Edge staat, met Rahul
        in het midden, en er zweeft geen tweede greep;
     2. de Cover staat: de wereldnaam in Bodoni op de foto, een ingang op beeld
        en de rubrieken van de wereld, die echt van blad wisselen;
     3. de kernhandeling slaagt tegen de echte reiskern: een bevestiging
        voorlezen verandert NIETS, pas "Voeg toe" zet het bij de reizen, en het
        register toont het gegroepeerd onder zijn eigen kop;
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
const dag = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
let srv, browser, token;

async function post(url, data, auth = token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl', adres = '/apps/reizen.html', tok = token) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_member_token', t); }, [tok, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + adres, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForFunction(() => !/Laden/.test(document.querySelector('#wacht').textContent));
  return { ctx, page, fouten };
}
async function beeld(page, naam, opties) {
  if (!BEELDEN) return;
  fs.mkdirSync(BEELDEN, { recursive: true });
  await page.screenshot(Object.assign({ path: path.join(BEELDEN, 'reizen-' + naam + '.png') }, opties || {}));
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
  token = (await post('/api/auth/register', { name: 'Reis Lid', email: 'reizen-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
  /* Echte gegevens, langs de gewone routes: een reis bij het reisbureau en een
     verblijf in dezelfde plaats; samen horen ze een reis te worden. */
  const cat = await post('/api/reisbureau', {});
  const ibiza = cat.reizen.find(r => /ibiza/i.test(r.bestemming));
  await post('/api/reisbureau/boek', { tripId: ibiza.id, personen: 2, vertrek: dag(30) });
  const huis = (await post('/api/hotels', {})).huizen.find(h => /ibiza/i.test(h.stad || ''));
  await post('/api/verblijf', { supplierCode: huis.code, roomId: huis.kamers[0].id, aankomst: dag(30), vertrek: dag(34), personen: 2 });
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  const lijst = await bladen(page);
  assert.ok(lijst.length, 'er is minstens een blad actief');
  for (const b of lijst) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad actief op een gemigreerd scherm: ' + b);
  assert.ok(lijst.includes('/ds/rtg-ds.css'), 'het Design System is geladen');
  assert.equal(await page.locator('.rtgsprong-greep').count(), 0, 'de sprong tekent geen eigen greep naast de Edge');
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'ds', 'contract.json'), 'utf8'));
  const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src && new URL(s.src).pathname).filter(Boolean));
  for (const dicht of contract.dsPoort['public/shared/basis.js']) {
    assert.ok(!scripts.includes(dicht) && !lijst.includes(dicht), dicht + ' laadt op een ds-scherm terwijl de ds-poort hem dicht noemt');
  }
  for (const oud of ['/shared/randen.js', '/shared/metgezel.js', '/shared/klok.js', '/shared/uurwerk.js', '/shared/rtg-world-desktop.js']) {
    assert.ok(!scripts.includes(oud), oud + ' hoort niet op een ds-scherm');
  }
  assert.equal(await page.locator('html[data-ds]').count(), 1);
  assert.equal(await page.locator('.ds-edge').count(), 1, 'precies een Edge');
  const edge = await page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
  assert.deepEqual(edge, ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  await page.locator('[data-ds-edge="acties"]').click();
  assert.match(await page.locator('#dsEdgeBlad').textContent(), /Betreed TravelOS/, 'Acties toont de handelingen van dit scherm');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#dsEdgeBlad').isHidden(), true, 'Escape sluit het blad');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('de Cover: de wereld op de foto, een ingang, en rubrieken die echt van blad wisselen', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'cover');
  const titel = page.locator('.ds-cover .ds-cover__wereld');
  assert.equal(await titel.textContent(), 'TravelOS');
  assert.match(await titel.evaluate(e => getComputedStyle(e).fontFamily), /Bodoni/);
  assert.equal(await page.locator('.ds-cover__beeld').evaluate(i => i.complete && i.naturalWidth > 0 && /travel-heritage-v2/.test(i.src)), true, 'het eigen wereldbeeld staat');
  assert.match(await page.locator('.ds-cover__ondertitel').textContent(), /Experience the elite class/);
  assert.equal(await page.locator('.ds-cover [data-betreed]').getAttribute('href'), '#inhoud');
  await beeld(page, '390');
  await page.locator('.ds-cover__nav a', { hasText: 'Reizen' }).click();
  await page.waitForFunction(() => window.RTGReizen.staat.blad === 'reizen' && !document.querySelector('[data-blad="reizen"]').hidden);
  assert.equal(await page.locator('[data-tab="reizen"]').getAttribute('aria-selected'), 'true');
  assert.equal(new URL(page.url()).hash, '#reizen', 'het blad staat in het adres (Continuity)');
  await page.locator('[data-tab="taxi"]').click();
  assert.equal(await page.locator('[data-blad="taxi"]').isVisible(), true);
  assert.equal(await page.locator('[data-blad="reizen"]').isHidden(), true);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('het register groepeert per reis, en voorlezen verandert niets tot u bevestigt', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.locator('[data-tab="reizen"]').click();
  await page.waitForSelector('#komend [data-reiskop]');
  const koppen = await page.locator('#komend [data-reiskop]').allInnerTexts();
  assert.equal(koppen.length, 1, 'een reis, uit twee boekingen: ' + JSON.stringify(koppen));
  assert.match(koppen[0], /Ibiza/i); assert.match(koppen[0], /2 onderdelen/);
  assert.match(await page.locator('#stand').innerText(), /1 reis gepland/);
  await beeld(page, '390-reizen', { fullPage: true });

  const voor = (await post('/api/reis/reizen', {})).reizen.length;
  await page.fill('#invTekst', 'Rondreis India, vertrek ' + dag(60));
  await page.click('#invLees');
  await page.waitForSelector('#invVoegToe');
  assert.equal((await post('/api/reis/reizen', {})).reizen.length, voor, 'lezen zet nog niets bij de reizen');
  await page.fill('#bTitel', 'Rondreis India'); await page.fill('#bBestemming', 'India'); await page.fill('#bVan', dag(60));
  await page.click('#invVoegToe');
  await page.waitForFunction(() => [...document.querySelectorAll('#komend [data-reiskop]')].some(k => /India/.test(k.innerText)));
  assert.equal(await page.locator('[data-blad="reizen"]').isVisible(), true, 'na toevoegen staat het register in beeld');
  const na = (await post('/api/reis/reizen', {})).reizen;
  assert.equal(na.length, voor + 1, 'de server heeft de nieuwe reis');
  assert.ok(na.some(r => r.bestemming === 'India'));
  assert.match(await page.locator('#invMijn').innerText(), /Rondreis India/);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('Rahul en Samen: het gesprek en het gezelschap laden op de ds-vorm', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', '/apps/reizen.html#samen');
  await page.waitForFunction(() => document.querySelectorAll('#samenReizen .ds-chip').length > 0);
  assert.equal(await page.locator('#samenReizen .ds-chip[aria-pressed="true"]').count(), 1, 'een reis is gekozen');
  await page.waitForSelector('#samenLeden li');
  await page.locator('[data-tab="rahul"]').click();
  await page.fill('#rahulVraag', 'Wat staat er open?');
  await page.locator('#rahulForm button[type="submit"]').click();
  await page.waitForSelector('#rahulChat .ds-gesprek__bericht--eigen');
  assert.match(await page.locator('#rahulChat').innerText(), /Wat staat er open\?/);
  await beeld(page, '390-rahul');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    for (const blad of ['vandaag', 'reizen', 'taxi', 'samen', 'rahul']) {
      await page.evaluate((b) => window.RTGReizen.wisselBlad(b, false, { restore: true }), blad);
      const maat = await page.evaluate(() => ({ breed: document.documentElement.scrollWidth, venster: innerWidth }));
      assert.ok(maat.breed <= maat.venster, blad + ': scrollWidth ' + maat.breed + ' > ' + maat.venster);
    }
    await page.evaluate(() => window.RTGReizen.wisselBlad('vandaag', false, { restore: true }));
    await beeld(page, naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
