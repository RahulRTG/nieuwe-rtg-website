/* Reizen & Veilig op het RTG Design System: het bewijs van batch 4 uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server.
   Naar het model van test/hotels-ds.e2e.js.

   Wat deze toets eist:
     1. geen stijlblad actief buiten /ds/ en /fonts/, ook niet in de bundel;
        de ds-poort klopt en de Edge staat. De zes bankhandelingen staan elk
        EEN keer onder Acties, en Reizen opent het reisblad;
     2. de kernhandeling slaagt tegen de echte veiligheidskern: een Moment
        (Live Circle) starten met een betrokken bedrijf. Het staat daarna in de
        lijst met zijn stand, en stoppen haalt het weg. Er wordt niets gedeeld
        zonder dat het lid het zelf start;
     3. het aanbod komt uit de catalogus van het Reisbureau: een beeldkaart per
        reis met de naam op de foto;
     4. op 390, 820 en 1440 px loopt niets over, en in het Arabisch staat
        dir="rtl" zonder overloop.
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
  await page.goto(srv.base + '/apps/reizen-veilig.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  await page.waitForSelector('[data-id="overzicht"] [data-momenten] > *');
  return { ctx, page, fouten };
}
async function beeld(page, naam) {
  if (!BEELDEN) return;
  fs.mkdirSync(BEELDEN, { recursive: true });
  await page.screenshot({ path: path.join(BEELDEN, 'reizen-veilig-' + naam + '.png') });
}
async function bladen(page) {
  const hrefs = await page.evaluate(() => [...document.styleSheets].map(s => s.href).filter(Boolean));
  const uit = [];
  for (const h of hrefs) { const u = new URL(h); if (u.pathname === PAD) uit.push(...decodeer(u.searchParams.get('f'))); else uit.push(u.pathname); }
  return uit;
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const now = Date.now();
  token = (await post('/api/auth/register', { name: 'Veilig Lid', email: 'rv-' + now + '@e.test',
    phone: '06' + String(now).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg', pasApp: 'rtg' }, null)).token;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System, en de bank staat eenmaal onder Acties', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  const lijst = await bladen(page);
  for (const b of lijst) assert.ok(/^\/(ds|fonts)\//.test(b), 'erfenisblad actief op een gemigreerd scherm: ' + b);
  assert.ok(lijst.includes('/ds/rtg-ds.css'));
  const contract = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'ds', 'contract.json'), 'utf8'));
  const scripts = await page.evaluate(() => [...document.scripts].map(s => s.src && new URL(s.src).pathname).filter(Boolean));
  for (const dicht of contract.dsPoort['public/shared/basis.js']) assert.ok(!scripts.includes(dicht) && !lijst.includes(dicht), dicht + ' laadt toch');
  const edge = await page.locator('.ds-edge__balk > *').evaluateAll(x => x.map(e => e.textContent.trim() || e.getAttribute('aria-label')));
  assert.deepEqual(edge, ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  await beeld(page, '390');
  await page.locator('[data-ds-edge="acties"]').click();
  const blad = page.locator('#dsEdgeBlad');
  for (const naam of ['Vandaag', 'Gaan', 'Reizen', 'RTG Veilig', 'Navigatie', 'Instellingen']) {
    assert.equal(await blad.getByRole('button', { name: naam, exact: true }).count(), 1, naam + ' staat eenmaal onder Acties');
  }
  await blad.getByRole('button', { name: 'Reizen', exact: true }).click();
  await page.waitForSelector('[data-id="reisblad"][data-actief] [data-reisaanbod]');
  /* De melding van de mediapoort krijgt hier haar vorm van het Design System
     (shared/media.css laadt niet): zichtbaar, met een sluitknop van 44px. */
  await page.evaluate(() => RTGMedia.meld({ rtg: RTGMedia.teksten.geweigerd }));
  const melding = await page.locator('.rtg-media-melding').evaluate(el => {
    const s = getComputedStyle(el), k = el.querySelector('button').getBoundingClientRect();
    return { positie: s.position, zicht: s.opacity, sluit: Math.min(k.width, k.height) };
  });
  assert.deepEqual(melding, { positie: 'fixed', zicht: '1', sluit: 44 });
  await page.locator('.rtg-media-melding button').click();
  assert.equal(await page.locator('.rtg-media-melding').count(), 0, 'de melding sluit');
  assert.equal(await page.locator('[data-open="reisblad"]').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('een Moment starten en stoppen loopt over de echte veiligheidskern', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  assert.match(await page.locator('[data-momenten]').innerText(), /Nog niets live gedeeld/, 'er wordt niets gedeeld zonder het lid');
  await page.locator('[data-id="overzicht"] .ds-knop[data-circle="maak"]').click();
  assert.equal(await page.locator('#rvDialoog').evaluate(d => d.open), true);
  await page.fill('#rvMomentForm [name=titel]', 'Diner bij het huis');
  await page.selectOption('#rvMomentForm [name=soort]', 'bedrijf');
  await page.fill('#rvMomentForm [name=ontvanger]', 'KAITO');
  await beeld(page, '390-taak');
  await page.locator('#rvMomentBewaar').click();
  await page.waitForSelector('[data-momenten] [data-moment]');
  assert.equal(await page.locator('#rvDialoog').evaluate(d => d.open), false);
  assert.match(await page.locator('[data-momenten]').innerText(), /Diner bij het huis/);
  const d = await post('/api/veiligheid/moment', {});
  assert.equal((d.momenten || []).length, 1, 'de server kent het Moment');
  assert.equal(d.momenten[0].ontvangers[0].niveau, 'voortgang', 'een bedrijf krijgt nooit een locatie');
  await page.locator('[data-momenten] [data-moment]').evaluate(e => e.scrollIntoView({ block: 'center' }));
  await beeld(page, '390-moment');
  await page.locator('[data-momenten] [data-stop]').click();
  await page.waitForFunction(() => !/Diner bij het huis/.test(document.querySelector('[data-momenten]').textContent));
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('het aanbod komt uit de catalogus, als beeldkaarten met de naam op de foto', { skip }, async () => {
  const catalogus = (await post('/api/reisbureau', {})).reizen || [];
  assert.ok(catalogus.length > 0, 'de zaaiset heeft samengestelde reizen');
  const { ctx, page, fouten } = await open(390, 844);
  await page.locator('[data-open="reisblad"]').click();
  const kaarten = page.locator('[data-id="reisblad"] [data-reisaanbod] .ds-kaart--beeld');
  await kaarten.first().waitFor();
  assert.deepEqual(await kaarten.locator('.ds-kaart__titel').allTextContents(), catalogus.slice(0, 3).map(r => r.titel));
  await page.locator('[data-reisaanbod]').evaluate(e => e.scrollIntoView());
  await beeld(page, '390-collectie');
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
