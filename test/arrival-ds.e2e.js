/* RTG Invisible Arrival op het RTG Design System: het bewijs van batch 4 uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.
   Naar het model van test/hotels-ds.e2e.js, met de stappen uit
   test/lib/ds-toets.js.

   Wat deze toets eist:
     1. geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de bundel;
        de ds-poort klopt en de Edge staat, met "Maak mijn plan" onder Acties;
     2. de kernhandeling slaagt tegen de echte arrivalkern: een wens wordt een
        plan (Gesprek en Taak), het plan gaat als aanvraag naar een echte zaak,
        en de pass staat daarna op "Aangevraagd" (Detail). Er staat nergens
        "geboekt", en de pass bewaart zich als { p, tot } voor de nadering;
     3. een puls met de hand komt aan bij de server;
     4. op 390, 820 en 1440 px loopt niets over, en in het Arabisch staat
        dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om de schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
const ZAAK = 'KIKUNOI';
let srv, browser;

async function open(breedte, hoogte, taal = 'nl', pas = null) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([l, p]) => {
    localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (p) localStorage.setItem('rtg_arrival_pass', JSON.stringify(p));
  }, [taal, pas]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/arrival.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  return { ctx, page, fouten };
}
function morgen() { return new Date(Date.now() + 86400000).toISOString().slice(0, 10); }

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.match(await edgeActies(page), /Maak mijn plan/, 'Acties toont de eerste handeling');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'gesprek');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een wens wordt een plan, en het plan een aanvraag die "Aangevraagd" blijft', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await beeld(page, 'arrival-390');
  await page.fill('#wish', 'Morgen om 20:00 met 4 mensen, een rolstoel en een notenallergie.');
  await page.locator('#interpret').click();
  await page.waitForSelector('#plan:not([hidden])');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'taak');
  assert.match(await page.locator('#stroom .ds-gesprek__bericht--eigen').innerText(), /notenallergie/, 'de eigen woorden staan in het gesprek');
  assert.match(await page.locator('#flags').innerText(), /allergiebriefing vereist/, 'Rahul zegt wat hij herkende');
  assert.match(await page.locator('#flags').innerText(), /toegankelijke route/);
  await beeld(page, 'arrival-390-plan');
  /* De datum uit de wens kan vandaag zijn; een vaste dag morgen houdt de
     aanvraag binnen het venster van de kern. */
  await page.fill('#date', morgen());
  await page.fill('#time', '20:00');
  await page.fill('#people', '4');
  await page.fill('#code', ZAAK);
  await page.fill('#name', 'Gast');
  await page.locator('#request').click();
  await page.waitForSelector('#pass:not([hidden])');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  assert.match(await page.locator('#passStatus').innerText(), /Aangevraagd/);
  assert.match(await page.locator('#serviceLine [aria-current="step"]').innerText(), /zaak bevestigt/, 'de zaak bevestigt, niet het scherm');
  assert.match(await page.locator('#promises').innerText(), /Allergiebriefing keuken[\s\S]*wacht-op-mens/, 'een belofte die een mens raakt, wacht op een mens');
  assert.doesNotMatch(await page.locator('main').innerText(), /geboekt/i, 'een aanvraag is geen boeking');
  const bewaard = await page.evaluate(() => JSON.parse(localStorage.getItem('rtg_arrival_pass') || 'null'));
  assert.ok(bewaard && bewaard.p && Date.parse(bewaard.tot) > Date.now(), 'de pass staat als { p, tot } voor shared/plaatsnadering.js');
  await page.locator('#pass').evaluate(e => e.scrollIntoView());
  await beeld(page, 'arrival-390-pass');

  await page.locator('[data-pulse="onderweg"]').click();
  let pas = null;
  for (let i = 0; i < 20; i++) {
    pas = await fetch(srv.base + '/api/arrival/pass', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pass: bewaard.p }) }).then(r => r.json());
    if (pas.pass && pas.pass.pulse === 'onderweg') break;
    await new Promise(r => setTimeout(r, 200));
  }
  assert.equal(pas.pass.pulse, 'onderweg', 'de handknop komt aan bij de zaak');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een fout van de kern komt in de melding van het scherm, niet in een browservenster', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  let venster = false;
  page.on('dialog', d => { venster = true; d.dismiss().catch(() => {}); });
  await page.fill('#wish', 'Morgen om 19:00 met 2 mensen.');
  await page.locator('#interpret').click();
  await page.waitForSelector('#plan:not([hidden])');
  await page.fill('#code', 'BESTAAT-NIET');
  await page.locator('#request').click();
  await page.waitForFunction(() => document.querySelector('#melding').textContent.trim().length > 0);
  assert.equal(venster, false);
  assert.equal(await page.locator('#pass').evaluate(e => e.hidden), true, 'zonder geldige zaak geen pass');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await page.fill('#wish', 'Morgen om 20:00 met 2 mensen.');
    await page.locator('#interpret').click();
    await page.waitForSelector('#plan:not([hidden])');
    await geenOverloop(page);
    await beeld(page, 'arrival-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
