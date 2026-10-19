/* Mijn Stad op het RTG Design System: het bewijs van stroom G uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.
   Naar het model van test/hotels-ds.e2e.js, met de stappen uit
   test/lib/ds-toets.js.

   Wat deze toets eist:
     1. geen stijlblad actief buiten /ds/ en /fonts/, de ds-poort klopt, de
        Edge staat en Melden staat onder Acties;
     2. het stadsbeeld komt van de echte stadskern: het scenario en een kaart
        per domein, met de stand in woorden;
     3. de kernhandeling slaagt: een bewoner meldt iets, de server heeft de
        melding op zijn codenaam, en ze staat daarna onder Mijn meldingen als
        open ("de veldploeg kijkt ernaar"), nooit als opgelost;
     4. op 390, 820 en 1440 px loopt niets over, en in het Arabisch staat
        dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
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
  await page.goto(srv.base + '/apps/stad.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForFunction(() => !/Laden/.test(document.querySelector('#app').textContent));
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now();
  token = (await post('/api/auth/register', { name: 'Stad Lid', email: 'stad-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System, de Edge staat en Melden staat onder Acties', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.ok((await edgeActies(page)).includes('Meld iets in de stad'));
  const beeldStad = await post('/api/stad/bewoner', {});
  assert.match(await page.locator('#app .ds-kaart__titel').first().textContent(), new RegExp(beeldStad.scenario.label));
  assert.equal(await page.locator('#app [data-stand]').count(), beeldStad.domeinen.length, 'een kaart per domein');
  await beeld(page, 'stad-390');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een melding loopt over de echte stadskern en staat daarna als open', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  assert.match(await page.locator('#mijnM').textContent(), /Nog geen meldingen/);
  await page.fill('#mTekst', 'lantaarn bij de brug doet het niet');
  await page.locator('#mDoe').scrollIntoViewIfNeeded();
  await beeld(page, 'stad-390-melden');
  await page.locator('#mDoe').click();
  await page.waitForFunction(() => /lantaarn bij de brug/.test((document.querySelector('#mijnM') || {}).textContent || ''));
  assert.match(await page.locator('#toast').textContent(), /veldploeg heeft je melding/);
  const tekst = await page.locator('#mijnM').textContent();
  assert.match(tekst, /de veldploeg kijkt ernaar/);
  assert.doesNotMatch(tekst, /opgelost/, 'een melding is geen oplossing');
  const mijn = (await post('/api/stad/bewoner', {})).mijnMeldingen;
  assert.equal(mijn.length, 1, 'de server heeft de melding');
  assert.equal(mijn[0].tekst, 'lantaarn bij de brug doet het niet');
  await page.locator('#mijnM').scrollIntoViewIfNeeded();
  await beeld(page, 'stad-390-meldingen');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'stad-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
