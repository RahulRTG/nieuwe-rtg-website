/* RTG MOVE IN EEN ECHTE BROWSER -- de eigen weg van dit scherm.

   scripts/moveproef.js meet dezelfde keten als PROEF en schrijft MOVEPROEF.json;
   dat is een instrument en geen toets. De schermdekking (scripts/schermen.js)
   telt alleen wat een .e2e.js werkelijk aflegt, en tot deze toets was
   move.html het enige scherm dat alleen door veegtoetsen werd aangetikt -- een
   teken van leven is geen bewijs dat de app doet wat hij belooft. De keten
   vond dat pas toen het oordeel over alle delen voor het eerst kon draaien
   (run 34566836183: "Deze schermen legt geen enkele toets werkelijk af:
   /apps/move.html").

   Wat hier vaststaat, in de vorm van de proef: twee echte boekingen worden een
   oordeel op het scherm, de verderknop noemt de LUCHTHAVEN en niet de
   bestemming (bij een vlucht lopen "waar ga ik heen" en "waar moet ik zijn"
   uiteen), en een tik brengt de reiziger naar Navigatie met de OPGELOSTE plek,
   zodat er niets opnieuw wordt geraden. En zonder sessie: geen oordeel, wel de
   weg naar de inlog.

   Draai los: node --test test/move.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');

const pw = laadPlaywright();
const SCHERM = '/apps/move.html';
const morgen = () => new Date(Date.now() + 86400000).toISOString().slice(0, 10);

async function post(base, pad, lijf, tok) {
  const r = await fetch(base + pad, { method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
    body: JSON.stringify(lijf || {}) });
  return { status: r.status, data: await r.json().catch(() => null) };
}

/* Een ECHT lid langs de echte registratieroute; een nagebouwd token meet je
   eigen aanname en niet de deur. */
async function proeflid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const r = await post(base, '/api/auth/register', { name: 'Proeflid', email: 'mve' + u + '@voorbeeld.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1985-05-05', tier: 'rtg' });
  assert.equal(r.status, 200, 'proeflid: ' + JSON.stringify(r.data));
  return r.data.token;
}

async function blad(browser, token) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'nl-NL', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  await page.addInitScript(t => {
    try { localStorage.setItem('rtg_cookieinfo_v1', '1'); if (t) localStorage.setItem('rtg_member_token', t); } catch (e) {}
  }, token || '');
  return { ctx, page, fouten };
}

test('RTG Move weegt twee echte boekingen tot een oordeel en brengt de reiziger naar Navigatie',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', NODE_ENV: 'test', RTG_DEMO: '1' } });
  let browser;
  try {
    const base = srv.base;
    const tok = await proeflid(base);

    /* Een afspraak van 08:00 en een charter van 09:30: twee onderdelen op twee
       plekken, en de tweede is een vlucht -- dus de volgende plek is een
       luchthaven en niet de bestemming. */
    const d = morgen();
    const bk = await post(base, '/api/booking/request', { supplierCode: 'KAITO', serviceId: 's1', date: d, time: '08:00' }, tok);
    assert.equal(bk.status, 200, 'boeking: ' + JSON.stringify(bk.data));
    assert.equal((await post(base, '/api/booking/pay', { ref: bk.data.boeking.ref }, tok)).status, 200, 'boeking betaald');
    const ch = await post(base, '/api/member/vluchten/charter',
      { soort: 'privejet', bestemming: 'Parijs Le Bourget', datum: d, tijd: '09:30' }, tok);
    assert.equal(ch.status, 200, 'charter: ' + JSON.stringify(ch.data));

    browser = await pw.chromium.launch(browserOpties(pw));
    const { ctx, page, fouten } = await blad(browser, tok);
    await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.naad', { timeout: 20000 });

    const oordeel = (await page.locator('#oordeel').textContent()).trim();
    const dekking = (await page.locator('#mDekking').textContent()).trim();
    const cijfers = (await page.locator('.naad .cijfers').first().textContent()).trim();
    assert.match(oordeel, /betrouwbaar|lucht|lukken/i, 'het oordeel gaat over de overgang: "' + oordeel + '"');
    assert.match(dekking, /%/, 'de dekking staat erbij: "' + dekking + '"');
    assert.match(cijfers, /min/, 'de minuten staan erbij: "' + cijfers + '"');

    const label = (await page.locator('#verder').textContent()).trim();
    assert.match(label, /airport|luchthaven/i, 'de verderknop noemt de luchthaven: "' + label + '"');
    assert.doesNotMatch(label, /parijs|bourget/i, 'en niet de bestemming: "' + label + '"');

    await page.locator('#verder').click();
    await page.waitForURL(/navigatie\.html/, { timeout: 15000 });
    const naar = String(new URL(page.url()).searchParams.get('naar') || '').split(',').map(Number);
    assert.equal(naar.length, 2, 'Navigatie krijgt een plek mee: ' + page.url());
    assert.ok(Number.isFinite(naar[0]) && Number.isFinite(naar[1]), 'en die plek is OPGELOST: ' + page.url());
    assert.deepEqual(fouten, [], 'geen paginafout op het scherm of in de overdracht');
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    stop(srv);
  }
});

test('zonder sessie toont RTG Move geen oordeel maar de weg naar de inlog',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '', NODE_ENV: 'test', RTG_DEMO: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const { ctx, page, fouten } = await blad(browser, null);
    await page.goto(srv.base + SCHERM, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const t = document.querySelector('#toelichting');
      return t && t.textContent.trim().length > 0;
    }, null, { timeout: 20000 });
    const uitleg = (await page.locator('#toelichting').textContent()).trim();
    const oordeel = (await page.locator('#oordeel').textContent()).trim();
    assert.match(uitleg, /aan te melden|meld u aan|inloggen/i, 'de toelichting wijst naar de inlog: "' + uitleg + '"');
    assert.doesNotMatch(oordeel, /lucht|betrouwbaar/i, 'en er staat geen verzonnen oordeel: "' + oordeel + '"');
    assert.deepEqual(fouten, [], 'geen paginafout zonder sessie');
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    stop(srv);
  }
});
