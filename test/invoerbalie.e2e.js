/* Scherm-toets op DE INVOERBALIE in /apps/reizen.html (REIZEN.md fase 2).

   WAAROM DIT BESTAND ER IS. De serverkant staat in test/invoer.test.js. Wat
   daar niet te zien is, is of het SCHERM de twee stappen echt uit elkaar houdt
   -- en dat is de hele belofte van deze balie. Een knop "Lees voor" die stiekem
   al toevoegt, of een voorstel dat een afgeleid jaartal als gegeven toont, ziet
   er precies hetzelfde uit als een eerlijke.

   DRIE BEWERINGEN, en alle drie kunnen ze zakken:

   1. Lezen verandert niets aan uw reizen. Na "Lees voor" staat er nog geen
      onderdeel bij -- gemeten aan de API, niet aan het scherm.
   2. Het scherm toont WAARUIT elk veld komt, en markeert wat na te kijken is.
      Het afgeleide jaar van een boardingpass hoort zichtbaar onzeker te zijn.
   3. Pas na bevestigen staat het onderdeel in het register hierboven, in de
      reis waar het bij hoort.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, browserOpties, geenBrowser, laadPlaywright } = require('./helper');

const pw = laadPlaywright();
const PAS = 'M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 226F001A0025 100';
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

test('de invoerbalie leest voor, zegt wat onzeker is, en voegt pas toe na bevestiging',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-invoerbalie-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const u = Date.now().toString().slice(-8);
    const lid = (await post('/api/auth/register', { name: 'Reiziger', email: 'ib' + u + '@x.nl',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'business', pasApp: 'business' })).body.token;
    assert.ok(lid, 'het lid staat ingeschreven');

    browser = await pw.chromium.launch(browserOpties());
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
    await ctx.addInitScript((tok) => { try { localStorage.setItem('rtg_member_token', tok); } catch (e) {} }, lid);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/reizen.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#invLees', { timeout: 20000 });

    await page.fill('#invTekst', PAS);
    await page.click('#invLees');
    await page.waitForFunction(() => {
      const el = document.querySelector('#invUit');
      return el && el.querySelector('#invVoegToe');
    }, null, { timeout: 20000 });

    await t.test('lezen verandert niets aan de reizen', async () => {
      const na = await post('/api/reis/reizen', {}, lid);
      assert.deepEqual(na.body.reizen, [], 'na het lezen staat er nog geen reis');
      const mijn = await post('/api/reis/invoer/mijn', {}, lid);
      assert.deepEqual(mijn.body.onderdelen, [], 'en nog geen onderdeel');
    });

    await t.test('het scherm zegt waaruit elk veld komt, en wat na te kijken is', async () => {
      const tekst = await page.$eval('#invUit', el => el.innerText);
      assert.match(tekst, /AC834/, 'het gelezen vluchtnummer staat er: ' + tekst.slice(0, 300));
      assert.match(tekst, /vaste positie/i, 'met de onderbouwing erbij');
      assert.match(tekst, /na te kijken/i, 'en het afgeleide jaar staat als na te kijken gemarkeerd');
      /* Precies EEN veld hoort onzeker te zijn: het jaar van de boardingpass.
         Zou alles gemarkeerd staan, dan zegt de markering niets meer. */
      const gemarkeerd = await page.$$eval('#invUit .rtg-naam',
        els => els.filter(e => /na te kijken/i.test(e.innerText)).map(e => e.innerText));
      assert.equal(gemarkeerd.length, 1, 'alleen de datum: ' + JSON.stringify(gemarkeerd));
      assert.match(gemarkeerd[0], /^Van:/i);
    });

    await t.test('pas na bevestigen staat het in het register, in de juiste reis', async () => {
      await page.fill('#bTitel', 'AC834 naar Frankfurt');
      await page.fill('#bBestemming', 'Monaco');
      await page.fill('#bVan', dag(40));
      await page.click('#invVoegToe');
      await page.waitForFunction(() => {
        const el = document.querySelector('#komend');
        return el && /Monaco/i.test(el.innerText);
      }, null, { timeout: 20000 });

      const api = await post('/api/reis/reizen', {}, lid);
      assert.equal(api.body.reizen.length, 1, 'nu is er een reis');
      assert.equal(api.body.reizen[0].bestemming, 'Monaco');
      assert.deepEqual(api.body.reizen[0].herkomsten, ['handmatig'],
        'geplakte tekst zonder bestand is handmatig ingevoerd, en dat blijft zichtbaar');

      // en de balie toont hem als "door u toegevoegd", met een weghaalknop
      await page.waitForSelector('#invMijn [data-weg]', { timeout: 20000 });
      const mijn = await page.$eval('#invMijn', el => el.innerText);
      assert.match(mijn, /AC834 naar Frankfurt/);
      assert.match(mijn, /ingelezen/, 'de datum is bevestigd, dus er is niets meer na te kijken: ' + mijn);
    });

    assert.deepEqual(fouten, [], 'geen scriptfouten op het scherm');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
