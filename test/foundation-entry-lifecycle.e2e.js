'use strict';
/* A denied session is a normal entry state, not an uncaught script failure.
   Real guest pages and a server-issued family session; no request interception
   or authorization override. This covers initializer exits, not release approval. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, edgeBediening } = require('./helper');
const pw = laadPlaywright();
const ROUTES = ('agenda babyboek beheer beroepen bieb bord budget contact dromen geld gevoel geloofbieb gezondheid hulpwijzer keuken kleuren klusjes kompas leerpaspoort liedjes mediawijs memorie mijnbanden ochtend opvoeden oppasinfo overhoren pesten presenteren projecten rechten schrijven schrift schoolbieb steun studie tellen toetsen veilig verhaaltje verjaardagen vrienden werk zakgeld').split(' ');

async function withServer(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-foundation-entry-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: tmp } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    await fn({ base, browser });
  } finally {
    if (browser) await browser.close();
    await stop(child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
function watch(page) {
  const errors = [], domain = [];
  letOpFouten(page, errors);
  page.on('request', req => {
    const url = new URL(req.url());
    if (/^\/api\/(?:foundation|rtf)(?:\/|$)/.test(url.pathname)) domain.push({ path: url.pathname, method: req.method() });
  });
  return { errors, domain };
}

test('all 44 previously throwing Foundation entries stop cleanly without a session',
  { skip: geenBrowser(pw), timeout: 180000 }, async () => {
  await withServer(async ({ base, browser }) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(() => { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); });
    for (const route of ROUTES) {
      const page = await ctx.newPage(), observed = watch(page);
      try {
        const target = '/apps/foundation/' + route + '.html';
        const response = await page.goto(base + target, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200, target);
        await page.waitForSelector('#rtf-toegang-slot:visible, .rtgdeur:visible', { timeout: 12000 });
        await page.waitForFunction(() => document.readyState === 'complete'
          && window.Sessie && !window.Sessie.actief());
        assert.equal(new URL(page.url()).pathname, target, 'a denied visitor keeps the requested destination');
        assert.deepEqual(observed.errors, [], target + ' must not throw on an expected denied session');
        assert.deepEqual(observed.domain, [], target + ' must not begin a private API or realtime flow');
        const links = await page.locator('#rtf-toegang-slot a, .rtgdeur a').evaluateAll(els => els.map(e => e.getAttribute('href')));
        assert.ok(links.some(href => /index\.html/.test(href || '')), target + ' retains a route to sign in');
      } finally { await page.close(); }
    }
    await ctx.close();
  });
});

test('server-issued family session still initializes agenda and management, then revocation closes access',
  { skip: geenBrowser(pw), timeout: 60000 }, async () => {
  await withServer(async ({ base, browser }) => {
    async function post(route, body) {
      const response = await fetch(base + '/api/foundation' + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      assert.equal(response.status, 200, route + ': ' + (data.error || response.status));
      return data;
    }
    const family = await post('/gezin/maak', { gezinsnaam: 'Initializer proof', naam: 'Ouder', pin: '2468', bevoegdGezin: true, privacyAkkoord: true });
    assert.ok(family.code && family.token);
    const session = await post('/gezin/inloggen', { code: family.code, pin: '2468' });
    assert.ok(session.token && session.profiel.beheerder);
    const auth = { code: family.code, token: session.token, profiel: session.profiel };
    const today = new Date().toISOString().slice(0, 10);
    await post('/gezin/agenda', { ...auth, titel: 'Bewaarde gezinsafspraak', datum: today, tijd: '13:00', herhaal: 'geen' });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await ctx.addInitScript(s => {
      localStorage.setItem('rtf_sessie', JSON.stringify(s));
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, auth);
    const page = await ctx.newPage(), observed = watch(page);
    await page.goto(base + '/apps/foundation/agenda.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mgrid', { timeout: 15000 });
    await page.waitForFunction(() => !document.documentElement.classList.contains('rtf-toegang-dicht'));
    assert.match(await page.locator('#bord').textContent(), /Bewaarde gezinsafspraak/);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.mgrid', { timeout: 15000 });
    assert.match(await page.locator('#bord').textContent(), /Bewaarde gezinsafspraak/, 'persisted content reappears after reload');
    await page.goto(base + '/apps/foundation/beheer.html', { waitUntil: 'domcontentloaded' });
    await edgeBediening(page, 'Profielen');
    await page.waitForSelector('#plist .prow', { timeout: 15000 });
    assert.match(await page.locator('#plist').textContent(), /Ouder/);
    assert.deepEqual(observed.errors, [], 'authorized page initialization must still run');
    await post('/gezin/sessie/intrek', { code: family.code, token: family.token, profielId: session.profiel.id });
    await page.goto(base + '/apps/foundation/agenda.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#rtf-toegang-slot', { timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector('#rtf-toegang-slot').textContent.includes('Jouw veilige wereld wacht op je'));
    assert.equal(await page.locator('#rtf-toegang-slot').isVisible(), true);
    assert.equal(await page.locator('#bord').isVisible(), false, 'revoked access must not expose the private agenda');
    assert.deepEqual(observed.errors, [], 'revocation is handled without a page crash');
    await ctx.close();
  });
});
