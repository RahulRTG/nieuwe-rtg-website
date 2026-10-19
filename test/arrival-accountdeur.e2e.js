/* ============================================================================
   INVISIBLE ARRIVAL ZONDER SESSIE: DE ACCOUNTDEUR IN HET SCHERM.

   Eigenaarsbesluit 19 oktober 2026 (AGENTS.md: gebruiken vraagt een account).
   Wie /apps/arrival.html opent zonder sessie, werd naar /apps/app.html
   gestuurd en verloor daarmee de pagina waar hij was. Nu maakt hij in het
   scherm zelf een gratis account (shared/accountdeur.js) en gaat daarna
   verder: zijn aankomst aanvragen en de pass zien.

   EN DE PASS BLIJFT EEN TWEEDE SLEUTEL NAAST HET ACCOUNT. Een ander account
   dat dezelfde pass in zijn browser heeft (een doorgestuurde of gekopieerde
   link), ziet de aankomst van de eerste niet: de server zegt 404 en het
   scherm tekent niets van die pass.

   Draai: node --test test/arrival-accountdeur.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { browserOpties, geenBrowser, letOpFouten, startServer, stop } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const ZAAK = 'KIKUNOI';
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function api(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}

test('arrival: zonder sessie een gratis account in het scherm, daarna verder; een ander account ziet de pass niet',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-arrival-deur-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const fouten = [];

    /* 1. ZONDER SESSIE: de deur staat in het scherm, de wensbox nog niet. */
    const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctxA.addInitScript(() => { try { localStorage.setItem('rtg_cookieinfo_v1', '1'); } catch (e) {} });
    const a = await ctxA.newPage();
    letOpFouten(a, fouten);
    await a.goto(base + '/apps/arrival.html', { waitUntil: 'domcontentloaded' });
    await a.getByRole('heading', { name: 'Maak gratis een account', exact: true }).waitFor({ timeout: 15000 });
    assert.equal(await a.locator('#wish').isVisible(), false, 'zonder account staat de wensbox er nog niet');
    // het oude blok stuurde de gast weg naar de app ("LOG EERST IN" met een link). Buiten main
    // tekent de desktopschil (rtg-world-desktop.js, aside.wd-people in div.wd-shell) zelf een
    // link "View your conversations" naar /apps/app.html, en alleen als dat uitgestelde script
    // op tijd is: gemeten in 3 van 20 runs met de bredere assert. Daarom telt alleen main.
    assert.equal(await a.locator('main a[href="/apps/app.html"]').count(), 0, 'geen wegsturen naar de app meer');
    assert.equal(await a.getByText('LOG EERST IN').count(), 0);

    const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
    await a.getByLabel('Naam', { exact: true }).fill('Aankomst Gast');
    await a.getByLabel('E-mailadres', { exact: true }).fill('aankomst' + u + '@voorbeeld.nl');
    await a.getByLabel('Geboortedatum', { exact: true }).fill('1985-05-05');
    await a.getByLabel('Wachtwoord (minstens zes tekens)', { exact: true }).fill('geheim12345');
    await a.getByRole('button', { name: 'Account maken en doorgaan', exact: true }).click();

    /* 2. DAARNA VERDER, OP DEZELFDE PAGINA: aankomst aanvragen, de pass zien. */
    await a.locator('#wish').waitFor({ state: 'visible', timeout: 15000 });
    assert.ok(a.url().endsWith('/apps/arrival.html'), 'dezelfde pagina: ' + a.url());
    await a.fill('#wish', 'morgen om 20:00 met 2 mensen');
    await a.fill('#code', ZAAK);
    await a.click('#interpret');
    await a.locator('#plan.on').waitFor({ timeout: 15000 });
    await a.fill('#date', morgen());
    await a.fill('#time', '20:00');
    await a.fill('#people', '2');
    await a.click('#request');
    await a.locator('#pass.on').waitFor({ timeout: 15000 });
    const titel = await a.locator('#passTitle').textContent();
    assert.match(titel, /20:00/, 'de pass staat er: ' + titel);
    const bewaard = await a.evaluate(() => JSON.parse(localStorage.getItem('rtg_arrival_pass') || 'null'));
    assert.ok(bewaard && bewaard.p, 'de pass is bewaard');

    /* 3. EEN ANDER ACCOUNT MET DEZELFDE PASS: de server zegt 404, het scherm
       tekent niets van de aankomst van de eerste. */
    const v = Date.now().toString().slice(-8) + '7';
    const B = await api(base, '/api/auth/register', { name: 'Ander Account', email: 'ander' + v + '@voorbeeld.nl',
      password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'guest' });
    assert.ok(B.data.token, 'tweede account');
    const rechtstreeks = await api(base, '/api/arrival/pass', { pass: bewaard.p }, B.data.token);
    assert.equal(rechtstreeks.status, 404, 'de server kent deze pass niet voor een ander account');

    const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctxB.addInitScript((d) => {
      try {
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        localStorage.setItem('rtg_member_token', d.tok);
        localStorage.setItem('rtg_arrival_pass', JSON.stringify(d.pas));
      } catch (e) {}
    }, { tok: B.data.token, pas: bewaard });
    const b = await ctxB.newPage();
    letOpFouten(b, fouten);
    const antwoord = b.waitForResponse((r) => r.url().endsWith('/api/arrival/pass'));
    await b.goto(base + '/apps/arrival.html', { waitUntil: 'domcontentloaded' });
    assert.equal((await antwoord).status(), 404);
    await b.locator('#wish').waitFor({ state: 'visible' });
    assert.equal(await b.locator('#pass.on').count(), 0, 'het andere account ziet geen pass');
    assert.ok(!(await b.locator('#passTitle').textContent() || '').includes('20:00'), 'en niets van de aankomst');

    assert.deepEqual(fouten.filter((f) => !/404/.test(f)), [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
