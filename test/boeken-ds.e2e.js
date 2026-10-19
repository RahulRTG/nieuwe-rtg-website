/* RTG Boeken op het RTG Design System: het bewijs van stroom G uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.
   Naar het model van test/hotels-ds.e2e.js, met de stappen uit
   test/lib/ds-toets.js. De volle leesplekstroom (debounce, heropenen) bewaakt
   test/boeken.e2e.js; deze toets eist wat de overgang raakt.

   Wat deze toets eist:
     1. geen stijlblad actief buiten /ds/ en /fonts/, de ds-poort klopt en de
        Edge staat;
     2. de kernhandeling slaagt tegen de echte boekenkern: de plank toont de
        huisbibliotheek en het boek uit de kluis als kaarten, een boek opent in
        de lezer (Detail), de lettermaat is een data-maat en geen stijl, en de
        leesplek die na scrollen wordt bewaard staat daarna als voortgang op de
        plank (een native <progress>);
     3. op 390, 820 en 1440 px loopt niets over, en in het Arabisch staat
        dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, token, kluisId;

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
  await page.goto(srv.base + '/apps/boeken.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForSelector('#eigen [data-boek]');
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now();
  token = (await post('/api/auth/register', { name: 'Lees Lid', email: 'boek-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
  const tekst = Array(200).fill('Een eigen verhaal uit de kluis, regel voor regel.').join('\n');
  kluisId = (await post('/api/bestanden/upload', { naam: 'mijn-verhaal.txt',
    dataUrl: 'data:text/plain;base64,' + Buffer.from(tekst).toString('base64') })).id;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System en de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'collectie');
  await beeld(page, 'boeken-390');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('lezen: de plank, de lezer, de lettermaat en de leesplek over de echte boekenkern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  assert.ok(await page.locator('#plank .ds-kaart[data-boek]').count() >= 5, 'de huisbibliotheek staat als kaarten op de plank');
  assert.equal(await page.locator('#eigenKop').isHidden(), false, 'het kluiskopje staat er met een kluisboek');

  await page.locator('#plank [data-boek="haas"]').click();
  await page.waitForFunction(() => !document.querySelector('#leesBlok').hidden && /\S/.test(document.querySelector('#tekst').textContent));
  assert.equal(await page.locator('#leesTitel').textContent(), 'De haas en de schildpad');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  assert.equal(await page.locator('#tekst').getAttribute('style'), null, 'de lettermaat is geen stijl');
  const voor = await page.locator('#tekst').evaluate(e => parseFloat(getComputedStyle(e).fontSize));
  await page.locator('#groter').click();
  assert.equal(await page.locator('#tekst').getAttribute('data-maat'), '2');
  await page.waitForFunction(v => parseFloat(getComputedStyle(document.querySelector('#tekst')).fontSize) > v, voor);
  await page.locator('#kleiner').click();
  await beeld(page, 'boeken-390-lezer');
  await page.locator('#terug').click();
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'collectie');

  await page.locator('#eigen [data-boek]').first().click();
  await page.waitForFunction(() => !document.querySelector('#leesBlok').hidden && /eigen verhaal/.test(document.querySelector('#tekst').textContent));
  await page.evaluate(() => { const el = document.querySelector('#tekst'); el.scrollTop = (el.scrollHeight - el.clientHeight) / 2; el.dispatchEvent(new Event('scroll')); });
  await page.locator('#terug').click();
  await page.waitForFunction(() => /% gelezen/.test(document.querySelector('#eigen').textContent));
  const plek = ((await post('/api/boeken/voortgang', {})).voortgang['kluis:' + kluisId] || {}).plek || 0;
  assert.ok(plek > 0.4, 'de server heeft de leesplek');
  assert.ok(await page.locator('#eigen progress.ds-voortgang').evaluate(p => p.value) > 40, 'de voortgang staat op de plank');
  await beeld(page, 'boeken-390-plank');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'boeken-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
