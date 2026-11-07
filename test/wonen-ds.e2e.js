/* Voorbereide regressie van de drie Wonen-schermen. Nog niet uitgevoerd.
   De volledige DS-proef is een afrondingsvoorwaarde: de gedeelde metgezel,
   bediening en randen zijn nog WIP en kunnen de erfeniscontrole laten zakken.
   Deze toets geeft die afhankelijkheid geen vrijstelling. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs } = require('./lib/ds-toets');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, token;
const ROUTES = { wonen: '/apps/wonen.html', onderhoud: '/apps/onderhoud.html', woningdossier: '/apps/woningdossier.html' };
async function post(pad, body) {
  const r = await fetch(srv.base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}) });
  const data = await r.json();
  assert.equal(r.status, 200, pad + ': ' + JSON.stringify(data));
  return data;
}
async function open(naam, sessie = token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(t => {
    localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_member_token', t);
  }, sessie);
  const page = await ctx.newPage(), fouten = [];
  letOpFouten(page, fouten, { eigenZeef: true });
  await page.goto(srv.base + ROUTES[naam], { waitUntil: 'domcontentloaded' });
  return { ctx, page, fouten };
}
test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  token = (await post('/api/auth/register', { name: 'Wonen toets', email: 'wonen-ds-' + Date.now() + '@example.test',
    phone: '0612345678', password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg' })).token;
  assert.ok(token);
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('Wonen: volledige DS-laadgraaf van alle drie schermen zonder erfenis', { skip }, async () => {
  for (const naam of ['wonen', 'onderhoud', 'woningdossier']) {
    const { ctx, page, fouten } = await open(naam);
    try {
      await page.waitForSelector('.ds-edge__balk');
      await alleenDs(page);
      assert.equal(await page.locator('nav[aria-label="Wonen en thuis"] [aria-current="page"]').getAttribute('href'), ROUTES[naam]);
      assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  }
});

test('Wonen: onderhoud melden en intrekken bewaart de bestaande handeling en status', { skip }, async () => {
  const { ctx, page, fouten } = await open('onderhoud');
  try {
    await page.locator('#nieuwMelding').click();
    await page.locator('#meldingTitel').fill('Kraan lekt DS-proef');
    await page.locator('#meldingPlek').fill('Keuken');
    await page.locator('#meldingUrgentie').selectOption('hoog');
    await page.locator('#meldingNotitie').fill('Druppelt');
    await page.locator('#meldingBewaar').click();
    await page.waitForSelector('#meldingDialoog:not([open])', { state: 'attached' });
    await page.waitForFunction(() => document.querySelector('#onderhoudLijst').textContent.includes('Kraan lekt DS-proef'));
    const gemaakt = (await post('/api/home/onderhoud')).meldingen.find(m => m.titel === 'Kraan lekt DS-proef');
    assert.equal(gemaakt.status, 'gemeld');
    assert.equal(gemaakt.urgentie, 'hoog');
    page.once('dialog', dialoog => dialoog.accept());
    await page.locator('[data-annuleer="' + gemaakt.id + '"]').click();
    await page.waitForFunction(() => !document.querySelector('#onderhoudLijst').textContent.includes('Kraan lekt DS-proef'));
    assert.equal((await post('/api/home/onderhoud')).meldingen.find(m => m.id === gemaakt.id).status, 'geannuleerd');
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});

test('Wonen: document toevoegen en zoeken gebruikt de bestaande woningmap', { skip }, async () => {
  const { ctx, page, fouten } = await open('woningdossier');
  try {
    await page.waitForFunction(() => document.querySelector('#dossierLijst').textContent.includes('Nog geen documenten'));
    const kies = page.waitForEvent('filechooser');
    await page.locator('#dossierToevoegen').click();
    await (await kies).setFiles({ name: 'Garantie DS-proef.txt', mimeType: 'text/plain', buffer: Buffer.from('Woningdossier regressie') });
    await page.waitForFunction(() => document.querySelector('#dossierLijst').textContent.includes('Garantie DS-proef.txt'));
    const bestanden = await post('/api/bestanden/mijn');
    const map = bestanden.mappen.find(m => m.naam === 'Woningdossier');
    assert.ok(map && bestanden.items.some(d => d.map === map.id && d.naam === 'Garantie DS-proef.txt'));
    await page.locator('#dossierZoek').fill('onbekend document');
    assert.match(await page.textContent('#dossierLijst'), /Geen woningdocument met deze naam/);
    await page.locator('#dossierZoek').fill('garantie');
    assert.equal(await page.locator('#dossierLijst a').getAttribute('href'), '/apps/bestanden.html');
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});

test('Wonen: de drie schermen behouden hun accountdeur', { skip }, async () => {
  for (const [naam, doel, knop] of [['wonen', '#thuisStand', null], ['onderhoud', '#onderhoudLijst', '#nieuwMelding'], ['woningdossier', '#dossierLijst', '#dossierToevoegen']]) {
    const { ctx, page, fouten } = await open(naam, null);
    try {
      assert.match(await page.textContent(doel), /Log eerst in op LivingOS/);
      assert.equal(await page.locator(doel + ' a').getAttribute('href'), '/apps/app.html');
      if (knop) assert.equal(await page.locator(knop).isDisabled(), true);
      assert.deepEqual(fouten, []);
    } finally { await ctx.close(); }
  }
});
