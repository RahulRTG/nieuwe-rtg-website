/* De Brigade RTG Airport op het RTG Design System: het bewijs uit
   TRAVELOS-MIGRATIE.md par. 3, in een echte browser tegen een echte server
   (stroom E, de werklaag uit par. 1b).

   Wat deze toets eist, en waarom elk punt:
     1. geen stijlblad buiten /ds/ en /fonts/, ook niet in de stijlbundel; de
        ds-poort van de basis klopt; de Edge staat;
     2. de kernhandeling slaagt tegen de echte grenskern: een marechaussee
        logt in met zijn pincode, opent de grensbalie, ziet de reiziger op
        CODENAAM (nooit zijn echte naam) en geeft akkoord; de server heeft
        het besluit;
     3. een incident melden loopt ook over de echte kern, en zonder werkinlog
        blijft de brigade dicht;
     4. op 390, 820 en 1440 px loopt niets horizontaal over, en in het
        Arabisch staat dir="rtl" zonder overloop.
   De API-kant van de brigade staat in test/marechaussee.test.js. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, edgeLabels, edgeActies, geenOverloop, beeld } = require('./lib/ds-toets');

const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, kmar, kmarId, codenaam;

async function post(url, data, auth) {
  const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const body = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(body)); return body;
}
async function open(breedte, hoogte, { taal = 'nl', token = kmar } = {}) {
  const ctx = await browser.newContext({ viewport: { width: breedte, height: hoogte }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(([t, l]) => {
    if (sessionStorage.getItem('rtg_toets_opslag')) return;
    sessionStorage.setItem('rtg_toets_opslag', '1');
    localStorage.setItem('rtg_lang', l); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (t) localStorage.setItem('rtg_werk_kmar', t); else localStorage.removeItem('rtg_werk_kmar');
  }, [token, taal]);
  const page = await ctx.newPage();
  const fouten = letOpFouten(page, []);
  await page.goto(srv.base + '/apps/marechaussee.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  return { ctx, page, fouten };
}
const cockpit = page => page.waitForFunction(() => /Controles gedaan/.test(document.querySelector('#app').textContent));

test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  const roster = await post('/api/supplier/roster', { code: 'KMAR' });
  kmarId = roster.staff.find(m => m.role === 'manager').id;
  kmar = (await post('/api/supplier/login', { code: 'KMAR', staffId: kmarId, pin: '1234' })).token;
  // een reiziger checkt in op de open vlucht RT205, zodat de grensbalie werk heeft
  const u = Date.now().toString().slice(-8);
  const reg = await post('/api/auth/register', { name: 'Grens Reiziger', email: 'kmds' + u + '@x.nl',
    phone: '068' + u.slice(1), password: 'geheim123', geboortedatum: '1986-05-05', tier: 'rtg', pasApp: 'rtg' });
  codenaam = reg.state.user.codename;
  const bord = await post('/api/member/vluchten/bord', {}, reg.token);
  const rt = bord.vluchten.find(v => v.nummer === 'RT205');
  await post('/api/onboarding/paspoort', { nummer: 'NX1234567', vervaldatum: '2032-01-01',
    nationaliteit: 'Nederlandse', geboortedatum: '1990-01-01' }, reg.token);
  const bk = await post('/api/member/vluchten/boek', { id: rt.id }, reg.token);
  await post('/api/member/vluchten/incheck', { id: bk.boeking.id }, reg.token);
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('alleen het Design System: geen erfenisblad, de ds-poort klopt, de Edge staat', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, { token: null });
  await alleenDs(page);
  assert.deepEqual(await edgeLabels(page), ['Home', 'Werelden', 'Vraag Rahul', 'Acties', 'Menu']);
  assert.match(await edgeActies(page), /Inloggen/);
  assert.equal(await page.locator('#app').isHidden(), true, 'zonder werkinlog is de brigade dicht');
  assert.match(await page.textContent('main'), /brigade/i, 'het scherm zegt voor wie het is');
  assert.equal(await page.locator('body').getAttribute('data-rtg-context-bron'), 'marechaussee');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

test('inloggen, de grensbalie en een akkoord lopen over de echte grenskern, op codenaam', { skip }, async () => {
  const { ctx, page, fouten } = await open(390, 844, { token: null });
  await page.waitForFunction(id => !!document.querySelector('#wie option[value="' + id + '"]'), kmarId);
  await page.selectOption('#wie', String(kmarId));
  await page.fill('#pin', '1234');
  await page.locator('#loginGo').click();
  await cockpit(page);
  await beeld(page, 'marechaussee-390');
  await page.locator('[data-rol="grens"]').click();
  await page.selectOption('#gVlucht', 'RT205');
  await page.locator('#gLaad').click();
  await page.waitForFunction(c => document.querySelector('#gLijst').textContent.includes(c), codenaam);
  assert.ok(!/Grens Reiziger/.test(await page.textContent('#gLijst')), 'de echte naam blijft in de kluis');
  await beeld(page, 'marechaussee-390-grens');
  const rij = page.locator('#gLijst .ds-lijst__rij', { hasText: codenaam });
  await rij.getByRole('button', { name: 'Akkoord ✓' }).click();
  await page.waitForFunction(c => [...document.querySelectorAll('#gLijst .ds-lijst__rij')]
    .some(r => r.textContent.includes(c) && /akkoord/.test(r.querySelector('.ds-lijst__tijd').textContent)), codenaam);
  const lijst = await post('/api/kmar/controle/lijst', { vlucht: 'RT205' }, kmar);
  assert.equal(lijst.passagiers.find(p => p.codenaam === codenaam).besluit, 'akkoord', 'de server heeft het besluit');

  await page.locator('#terug').click();
  await cockpit(page);
  await page.locator('[data-rol="incidenten"]').click();
  await page.waitForFunction(() => document.querySelector('#iZone').options.length > 0);
  assert.equal(await page.locator('body').getAttribute('data-ds-schermtype'), 'taak');
  await page.fill('#iTekst', 'Achtergelaten tas bij de balie');
  assert.match(await edgeActies(page), /Incident melden/);
  await page.locator('#iMeld').click();
  await page.waitForFunction(() => /Achtergelaten tas/.test(document.querySelector('#iLijst').textContent));
  const inc = await post('/api/kmar/incidenten', {}, kmar);
  assert.ok(inc.incidenten.some(i => /Achtergelaten tas/.test(i.tekst) && !i.gesloten), 'het incident staat open op de server');
  await beeld(page, 'marechaussee-390-incident');
  assert.deepEqual(fouten, []);
  await ctx.close();
});

for (const [naam, b, h, taal] of [['820', 820, 1180, 'nl'], ['1440', 1440, 900, 'nl'], ['390-ar', 390, 844, 'ar']]) {
  test('geen horizontale overloop op ' + naam, { skip }, async () => {
    const { ctx, page, fouten } = await open(b, h, { taal });
    if (taal === 'ar') await page.waitForFunction(() => document.documentElement.dir === 'rtl');
    await cockpit(page);
    await geenOverloop(page);
    for (const rol of ['grens', 'patrouille', 'incidenten']) {
      await page.locator('[data-rol="' + rol + '"]').click();
      await page.waitForSelector('#terug');
      await page.waitForFunction(() => document.querySelector('.ds-lijst .ds-lijst__rij, .ds-lijst .ds-meta'));
      await geenOverloop(page);
      await page.locator('#terug').click();
      await cockpit(page);
    }
    await beeld(page, 'marechaussee-' + naam);
    assert.deepEqual(fouten, []);
    await ctx.close();
  });
}
