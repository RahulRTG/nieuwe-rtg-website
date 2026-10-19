/* RTG Navigatie op het RTG Design System: het bewijs van batch 4 uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.
   Naar het model van test/hotels-ds.e2e.js, met de stappen uit
   test/lib/ds-toets.js.

   Wat deze toets eist:
     1. geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de bundel;
        de ds-poort klopt en de Edge staat; het scherm is een Canvas met de
        kaart als vlak;
     2. de kernhandeling slaagt tegen de echte routekern: rond Ibiza (het
        eigen net) zegt de badge zichtbaar "Demonstratienet", een gezochte
        bestemming wordt een route met ETA en stappen, en een andere
        vervoerwijze rekent opnieuw. Het demonstratienet blijft in beeld
        terwijl de route openstaat;
     3. zonder plek geen verzonnen kaart: de poort zegt waarom en biedt een
        zelfgekozen vertrekpunt, en daarna bouwt de kaart alsnog;
     4. op 390, 820 en 1440 px loopt niets over, en in het Arabisch staat
        dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, wachtOpRust } = require('./helper');
const { alleenDs, edgeLabels, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
/* Het eigen demonstratienet ligt rond Ibiza-stad (kern/navigatie.js REF). */
const IBIZA = { latitude: 38.91, longitude: 1.43 };
let srv, browser, token;

async function post(url, data, auth = token) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, taal = 'nl', { plek = IBIZA } = {}) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce',
    ...(plek ? { permissions: ['geolocation'], geolocation: plek } : { permissions: [] }) });
  await ctx.addInitScript(([t, l, gps]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    localStorage.setItem('rtg_os_gps', gps); localStorage.setItem('rtg_member_token', t); }, [token, taal, plek ? '1' : '0']);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/navigatie.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  return { ctx, page, fouten };
}
const badge = page => page.locator('#liveBadge').textContent();

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now();
  token = (await post('/api/auth/register', { name: 'Nav Lid', email: 'nav-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: een Canvas, geen erfenisblad, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'canvas');
  assert.equal(await page.locator('canvas#kaart.ds-canvas__vlak').count(), 1, 'de kaart is het vlak van het Canvas');
  assert.equal(await page.locator('.ds-canvas__bediening #kaartenKnop').count(), 1, 'Kaarten is de zwevende bediening');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('rond Ibiza: "Demonstratienet" in beeld, en een bestemming wordt een route', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await page.waitForFunction(() => /Demonstratienet/.test(document.querySelector('#liveBadge').textContent), null, { timeout: 20000 });
  assert.equal(await page.locator('#poort').evaluate(e => e.hidden), true, 'met een plek blijft de poort dicht');
  assert.ok(await page.locator('#liveBadge').isVisible(), 'de markering van het demonstratienet staat in beeld');
  await wachtOpRust(page); // de kaart is uitgetekend voor het beeld
  await beeld(page, 'navigatie-390');
  await page.fill('#zoek', 'laad');
  await page.waitForSelector('#res [role="option"]');
  assert.match(await page.locator('#res [role="option"] .af').first().textContent(), /\d/, 'met de afstand vanaf hier');
  await beeld(page, 'navigatie-390-zoek');
  await page.locator('#res [role="option"]').first().click();
  await page.waitForSelector('#paneel.zien');
  assert.match(await page.locator('#etaGroot').textContent(), /\d+\s*min/);
  assert.ok(await page.locator('#stappen li').count() > 0, 'bocht-voor-bocht');
  assert.ok(await page.locator('#liveBadge').isVisible(), 'ook met een route open blijft het demonstratienet te zien');
  assert.match(await badge(page), /Demonstratienet/);
  await beeld(page, 'navigatie-390-route');
  const auto = await page.locator('#etaGroot').textContent();
  await page.locator('#modusrij button', { hasText: 'Lopen' }).click();
  await page.waitForFunction(a => document.querySelector('#etaGroot').textContent !== a, auto);
  assert.equal(await page.locator('#modusrij button[aria-pressed="true"]').textContent().then(t => /Lopen/.test(t)), true);
  await page.locator('#sluitPaneel').click();
  assert.equal(await page.locator('#paneel').evaluate(e => e.hidden), true);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder plek de poort met een eigen vertrekpunt, en daarna alsnog een kaart', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', { plek: null });
  /* De locatievraag van shared/plek.js komt eerst; "Nu niet" is een antwoord,
     en de poort hoort er meteen op te reageren. */
  await page.locator('.rtgplek .nee').click();
  await page.waitForSelector('#poort.zien', { timeout: 20000 });
  assert.match(await page.locator('#poortReden').textContent(), /niet vrijgegeven[\s\S]*verzint nooit/);
  assert.equal(await badge(page), 'Locatie onbekend');
  assert.equal(await page.locator('#intelligenceDock').evaluate(e => e.hidden), true, 'de poort ligt onderaan, niet de statuskaart');
  await beeld(page, 'navigatie-390-poort');
  await page.locator('#manualStart').click();
  await page.waitForSelector('#startResultaten button');
  await page.locator('#startResultaten button').first().click();
  await page.waitForFunction(() => document.querySelector('#poort').hidden);
  await page.waitForFunction(() => /Demonstratienet|actief/.test(document.querySelector('#liveBadge').textContent), null, { timeout: 20000 });
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await page.waitForFunction(() => document.querySelector('#badge3d').textContent && document.querySelector('#sourceNetwork').textContent !== '·', null, { timeout: 20000 });
    await geenOverloop(page);
    await page.fill('#zoek', 'laad');
    await page.waitForSelector('#res [role="option"]');
    await page.locator('#res [role="option"]').first().click();
    await page.waitForSelector('#paneel.zien');
    await geenOverloop(page);
    await beeld(page, 'navigatie-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
