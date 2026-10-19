/* De Ghost Driver op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server
   (stroom E, de zaakschermen op de werklaag).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat;
     2. de zaakdeur blijft: zonder zaak-inlog zegt het scherm welke inlog hij
        mist;
     3. de kernhandeling slaagt tegen de echte voorspelling: elk uur uit het
        uurbeeld van de server staat als meter met zijn kans in woorden, de
        bouwstenen noemen de knooppunten, en het weerbeeld blijft zichtbaar
        "(demo)" heten (par. 1d: een simulatie die als echt oogt is erger);
     4. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, zaak;

async function post(pad, body, token) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
async function open(breedte, hoogte, taal = 'nl', token = zaak) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_sup_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/ghost.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  if (token) await page.waitForSelector('#vGhost:not([hidden]) #uren [data-uur]', { timeout: 30000 });
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'MKKX' });
  const m = (roster.body.staff || []).find(x => x.role === 'manager');
  zaak = (await post('/api/supplier/login', { code: 'MKKX', staffId: m.id, pin: '1234' })).body.token;
  assert.ok(zaak, 'de zaak logt in');
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.ok((await edgeLabels(page)).includes('Acties'), 'de Edge staat');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder zaak-inlog zegt het scherm welke inlog hij mist', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, 'nl', null);
  await page.waitForSelector('#vPoort:not([hidden])');
  assert.match(await page.textContent('#vPoort'), /inlog van uw zaak/);
  assert.equal(await page.locator('#vGhost').isHidden(), true);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('de voorspelling van de server staat per uur als meter, en de demo heet demo', { skip }, async () => {
  const api = (await post('/api/supplier/ghost', {}, zaak)).body;
  assert.ok((api.uurbeeld || []).length, 'de server levert een uurbeeld');
  const { ctx, page, fouten } = await open(390, 844);
  assert.equal(await page.locator('#uren [data-uur]').count(), api.uurbeeld.length, 'een meter per uur');
  const eerste = api.uurbeeld[0];
  const meter = page.locator('#uren [data-uur="' + eerste.tijd + '"] progress.ds-voortgang');
  assert.equal(await meter.evaluate(m => m.value), Math.min(100, eerste.kans),
    'de meter draagt de kans van de server');
  assert.match(await page.textContent('#uren [data-uur="' + eerste.tijd + '"]'), /% · (druk|middel|rustig)/, 'de stand staat er in woorden');
  assert.match(await page.textContent('#bouwstenen'), /weerbeeld \(demo\)/, 'het weerbeeld blijft een zichtbare demo');
  assert.match(await page.textContent('#bouwstenen'), new RegExp('Knooppunten \\(' + api.knooppunten.length + '\\)'));
  assert.match(await page.textContent('#uitleg'), new RegExp(api.stad));
  if (api.waarschuwingen.length) {
    assert.equal(await page.locator('#lijst [data-knooppunt]').count(), api.waarschuwingen.length);
    assert.match(await page.textContent('#lijst'), /Advies:/);
  } else assert.match(await page.textContent('#lijst'), /Rustig rijden/);
  await beeld(page, 'ghost-390');
  await geenOverloop(page);
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'ghost-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
