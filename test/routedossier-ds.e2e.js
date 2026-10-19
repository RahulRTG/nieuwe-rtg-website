/* Het routedossier op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server
   (stroom F, kantoorschermen op de werklaag).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat met Rahul in het midden en
        toont de handelingen van dit scherm;
     2. de kantoordeur blijft: zonder kantoortoken stuurt het scherm naar de
        ene kantoorinlog in de personeels-app, en het toont niets;
     3. de kernhandeling slaagt tegen de echte dossierkern: de telling komt van
        de server, een schakel kiezen verandert de lijst en zegt in woorden wat
        er gefilterd is, en een route opent als Detail met zijn elf schakels,
        elk met zijn teken in tekst;
     4. op 390, 820 en 1440 px loopt niets horizontaal over (ook niet met het
        dossier open), en in het Arabisch staat dir="rtl" zonder overloop.
   Zet RTG_DS_BEELDEN=<map> om schermafbeeldingen te bewaren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, kantoorAlsPersoon } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, kantoor;

async function open(breedte, hoogte, taal = 'nl', token = kantoor) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => { localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_office_token', t); }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/routedossier.html', { waitUntil: 'domcontentloaded' });
  if (token) {
    await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
    await page.waitForSelector('#lijst [data-pad]', { timeout: 30000 });
  }
  return { ctx, page, fouten };
}

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  kantoor = await kantoorAlsPersoon(srv.base);
  assert.ok(kantoor, 'het kantoor logt in');
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.match(await edgeActies(page), /Zoek een route/, 'Acties toont de handelingen van dit scherm');
  assert.equal(await page.locator('#dsEdgeBlad').isHidden(), true, 'Escape sluit het blad');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('zonder kantoortoken stuurt het scherm naar de ene kantoordeur', { skip }, async () => {
  const { ctx, page } = await open(390, 844, 'nl', null);
  await page.waitForURL(/\/apps\/personeel\.html\?kantoor=1&terug=%2Fapps%2Froutedossier\.html/);
  await ctx.close();
});

test('de schakels filteren de echte lijst en een route opent als Detail', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844);
  const api = await fetch(srv.base + '/api/office/routedossier', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kantoor },
    body: JSON.stringify({ pagina: 1, limiet: 40 }) }).then(r => r.json());
  assert.ok(api.routes > 1000, 'de server kent zijn routes');
  const getal = t => Number(String(t).replace(/[^\d]/g, ''));
  assert.equal(await page.locator('#assen [data-as]').count(), api.schakels.length, 'een keuze per schakel');
  assert.equal(await page.locator('#lijst [data-pad]').count(), api.lijst.resultaten.length);
  assert.match(await page.textContent('#samenvatting'), /routes × \d+ schakels/);
  assert.equal(getal((await page.textContent('#paginatel')).split('·')[1]), api.lijst.totaal, 'de telling komt van de server');
  await beeld(page, 'routedossier-390');

  /* Een schakel kiezen: aria-pressed, en de uitleg zegt in woorden wat er nu staat. */
  const as = page.locator('#assen [data-as]').first();
  const id = await as.getAttribute('data-as');
  await as.click();
  await page.waitForFunction(i => (document.querySelector('#filteruitleg').textContent || '').includes('openstaande werk op ' + i), id);
  assert.equal(await page.locator('#assen [data-as]').first().getAttribute('aria-pressed'), 'true');
  await page.locator('#wis').click();
  await page.waitForFunction(() => /^Alle routes\./.test(document.querySelector('#filteruitleg').textContent));

  /* Een route opent: methode, pad en elf regels, elk met het teken in tekst. */
  await page.fill('#zoek', '/api/pay/gezond');
  await page.locator('#zoeken').click();
  await page.waitForFunction(() => { const r = document.querySelectorAll('#lijst [data-pad]');
    return r.length && [...r].every(x => x.dataset.pad.includes('gezond')); });
  await page.locator('#lijst [data-pad]').first().click();
  await page.waitForSelector('#dossier[open]');
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'detail');
  assert.match(await page.textContent('#dPad'), /^\/api\/pay\/gezond/);
  assert.match(await page.textContent('#dMethode'), /GET|POST|PUT|DELETE|PATCH/);
  const lijf = await page.locator('#dLijf').innerText();
  assert.match(lijf, /VERVALSTAAT/);
  assert.match(lijf, /IN DE CODE/);
  assert.match(lijf, /WAT DIT DOSSIER NIET WEET/);
  assert.ok(await page.locator('#dLijf .ds-lijst__rij').count() >= api.schakels.length, 'elke schakel een regel');
  assert.match(await page.locator('#dLijf .ds-lijst__tijd').allTextContents().then(t => t.join('')), /[✓×∅?·]/, 'het teken staat in tekst');
  await geenOverloop(page);
  await beeld(page, 'routedossier-390-detail');
  await page.locator('#dSluit').click();
  assert.equal(await page.locator('#dossier').evaluate(d => d.open), false);
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'collectie');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, w, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(w, h, taal);
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await geenOverloop(page);
    await beeld(page, 'routedossier-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
