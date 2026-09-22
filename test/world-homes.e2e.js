/* Approved homes must retain real data, language state and the shared Edge.
   AI is off: built-in copy must still work and photos must never invent trips. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser;
const routes = ['/apps/reizen.html', '/apps/kantoor.html', '/apps/foundation/index.html'];
async function post(pad, data, token) {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(data || {}) });
  const json = await r.json(); assert.equal(r.status, 200, pad + ': ' + JSON.stringify(json)); return json;
}
async function context(token, family) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(({ token, family }) => {
    localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    if (token) localStorage.setItem('rtg_member_token', token);
    if (family) localStorage.setItem('rtf_sessie', JSON.stringify(family));
  }, { token, family }); return ctx;
}
async function open(page, route) {
  await page.goto(srv.base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
  await page.waitForFunction(() => !document.body.hasAttribute('data-rtg-world-start') || document.body.dataset.rtgWorldStart === 'ready');
}
async function actions(page) {
  await page.evaluate(() => window.RTGAdaptiveEdge.setState('dock'));
  await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
  await page.waitForSelector('.rtg-adaptive-controls:visible');
}
test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DEMO: '0' } });
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('new homes fit mobile and desktop, use one Edge and retain visible free Foundation access', { skip }, async () => {
  const ctx = await context(), page = await ctx.newPage(), errors = [];
  letOpFouten(page, errors);
  try {
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await open(page, route);
        await page.waitForFunction(() => [...document.querySelectorAll('.wh-photo>img')].filter(e => e.checkVisibility()).some(e => e.complete && e.naturalWidth));
        assert.equal(await page.locator('.rtg-adaptive-bar').count(), 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, route + ' at ' + width);
        if (width === 390) {
          await page.evaluate(() => window.RTGi18n.set('ar'));
          assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, route + ' RTL');
          await page.evaluate(() => window.RTGi18n.set('nl'));
        }
        const heading = page.locator('.wh-home h1:visible').first();
        assert.match(await heading.evaluate(e => getComputedStyle(e).fontFamily), /Bodoni Moda/);
        if (route.includes('foundation')) {
          assert.match(await page.locator('#vWelkom .wh-free').innerText(), /Altijd 100% gratis/);
          await page.locator('#vWelkom .wh-support').scrollIntoViewIfNeeded();
          const supportGeometry = await page.locator('#vWelkom .wh-support').evaluate(e => {
            const r = e.getBoundingClientRect();
            return { visible: r.bottom > 0 && r.top < innerHeight, top: Math.round(r.top), viewport: innerHeight,
              pageTop: Math.round(scrollY), pageHeight: document.documentElement.scrollHeight };
          });
          assert.equal(supportGeometry.visible, true, 'the lower part can be reached by scrolling: ' +
            route + ' at ' + width + ' ' + JSON.stringify(supportGeometry));
        }
      }
    }
    await open(page, routes[2]);
    await actions(page);
    await page.locator('[data-rtg-adaptive-source="bMaak"]').click();
    await page.waitForSelector('#dlgMaak[open]');
    await page.fill('#mNaam', 'Naam blijft staan');
    await page.evaluate(() => window.RTGi18n.set('en'));
    assert.equal(await page.locator('#mNaam').inputValue(), 'Naam blijft staan');
    assert.match(await page.locator('#vWelkom .wh-free').textContent(), /Always 100% free/);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});

test('a confirmed journey reaches the new hero and language changes preserve import input', { skip }, async () => {
  const n = Date.now(), member = await post('/api/auth/register', { name: 'Traveller', email: 'wh' + n + '@e.test',
    phone: '06' + String(n).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'business', pasApp: 'business' });
  const ctx = await context(member.token), page = await ctx.newPage();
  try {
    await open(page, routes[0]);
    await page.waitForSelector('body[data-world-home-state="ready"]');
    assert.equal(await page.locator('#worldTravelDetail').isVisible(), false, 'no invented destination for an empty account');
    const van = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
    const tot = new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10);
    const read = await post('/api/reis/invoer/lees', { tekst: 'Hilton Dubai Palm\nCheck-in ' + van + ', check-out ' + tot + '\nBoekingsnummer: XY7788Q' }, member.token);
    await post('/api/reis/invoer/bevestig', { id: read.voorstel.id, velden: { titel: 'Eigen reis', bestemming: 'Dubai' } }, member.token);
    await open(page, routes[0]);
    await page.waitForSelector('#worldTravelDetail:not([hidden])');
    assert.match(await page.locator('#worldTravelDetail').innerText(), /Dubai/);
    await page.locator('#worldTravelImport>summary').click();
    await page.fill('#invTekst', 'Mijn eigen bevestiging');
    await page.evaluate(() => window.RTGi18n.set('en'));
    assert.equal(await page.locator('#invTekst').inputValue(), 'Mijn eigen bevestiging');
    assert.equal(await page.locator('#worldTravelTitle').innerText(), 'Somewhere else entirely.');
    assert.match(await page.locator('#worldTravelDetail').innerText(), /Dubai/);
    await page.locator('#worldTravelAction').click();
    await page.waitForSelector('[data-blad="reizen"]:visible');
    await page.route('**/api/reis/reizen', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Source unavailable"}' }));
    await open(page, routes[0]);
    await page.waitForSelector('body[data-world-home-state="error"]');
    assert.match(await page.locator('#worldTravelMessage').innerText(), /niet ophalen|could not load/i);
    assert.equal(await page.locator('#worldTravelDetail').isVisible(), false);
  } finally { await ctx.close(); }
});

test('Work Home opens the new home with actual appointments and exposes an outage', { skip }, async () => {
  const n = Date.now(), member = await post('/api/auth/register', { name: 'Colleague', email: 'ww' + n + '@e.test',
    phone: '07' + String(n).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg' });
  await post('/api/agenda/toevoegen', { titel: 'Eigen overleg', datum: new Date().toISOString().slice(0, 10), tijd: '14:00' }, member.token);
  const ctx = await context(member.token), page = await ctx.newPage();
  try {
    await open(page, '/apps/office.html');
    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').click();
    await page.waitForURL('**/apps/kantoor.html');
    await page.waitForSelector('#vandaag .cv-titel');
    assert.match(await page.locator('#vandaag').innerText(), /Eigen overleg/);
    await page.evaluate(() => window.RTGi18n.set('en'));
    assert.match(await page.locator('#worldWorkGreeting').innerText(), /Good (morning|afternoon|evening)\./);
    assert.match(await page.locator('#vandaag').innerText(), /Eigen overleg/);
    await page.route('**/api/kantoor/wereld', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await open(page, routes[1]);
    await page.waitForSelector('body[data-world-home-state="error"]');
    assert.match(await page.locator('#worldWorkState').innerText(), /niet ophalen|could not load/i);
  } finally { await ctx.close(); }
});

test('a Foundation child keeps personal tabs and all apps in the standard Edge, with explicit calendar failure', { skip }, async () => {
  const family = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Testgezin', naam: 'Ouder', pin: '1234', bevoegdGezin: true, privacyAkkoord: true });
  await post('/api/foundation/gezin/agenda', { code: family.code, token: family.token, titel: 'Samen wandelen', datum: new Date().toISOString().slice(0, 10), tijd: '16:00' });
  const child = await post('/api/foundation/gezin/profiel/maak', { code: family.code, token: family.token, naam: 'Milan', rol: 'kind', geboortedatum: '2015-04-04', pin: '5678', kleur: '#3A7BD5' });
  const chosen = await post('/api/foundation/gezin/profiel/kies', { code: family.code, profielId: child.profiel.id, pin: '5678' });
  const ctx = await context(null, { code: family.code, token: chosen.token, profiel: chosen.profiel }), page = await ctx.newPage();
  try {
    await open(page, routes[2]);
    await page.waitForSelector('#vVoorzijde:not([hidden])');
    assert.match(await page.locator('#rtfGroet').innerText(), /Milan/);
    await page.waitForFunction(() => /Samen wandelen/.test(document.querySelector('#rtfDagLijst').textContent));
    await actions(page);
    await page.locator('.rtg-adaptive-controls').getByRole('button', { name: 'Ontwikkeling', exact: true }).click();
    await page.waitForSelector('[data-rtf-paneel="groei"]:visible');
    await actions(page);
    await page.locator('.rtg-adaptive-controls').getByRole('button', { name: 'Alle apps', exact: true }).click();
    await page.waitForSelector('#vHub:not([hidden])');
    await page.route('**/api/foundation/gezin/agenda/bereik', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await open(page, routes[2]);
    await page.waitForFunction(() => /niet ophalen/.test(document.querySelector('#rtfDagLijst').textContent));
    await page.evaluate(() => window.RTGi18n.set('en'));
    assert.match(await page.locator('#rtfDagLijst').innerText(), /could not load your family calendar/);
    assert.match(await page.locator('#vVoorzijde .wh-free').innerText(), /Always 100% free/);
  } finally { await ctx.close(); }
});
