'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, token, conversation;
async function post(path, data, auth = token) {
  const r = await fetch(srv.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
  const j = await r.json(); assert.equal(r.status, 200, path + JSON.stringify(j)); return j;
}
async function context() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.addInitScript(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl');
    localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token); return ctx;
}
async function open(page) {
  await page.goto(srv.base + '/apps/wereld.html', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-rtg-desktop]');
}
test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { RTG_DEMO: '0', SMTP_URL: '', RTG_AI_UIT: '1' } });
  browser = await pw.chromium.launch(browserOpties(pw));
  async function register(n) { const stamp = Date.now() + n; return post('/api/auth/register', { name: 'Widget lid ' + n,
    email: 'widget-' + stamp + '@e.test', phone: '06' + String(stamp).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg' }, null); }
  token = (await register(1)).token;
  const other = (await register(2)).token;
  const key = 'user-' + (await post('/api/auth/me')).user.id;
  const otherKey = 'user-' + (await post('/api/auth/me', {}, other)).user.id;
  await post('/api/member/connect', { key: otherKey });
  await post('/api/member/connect/respond', { key, action: 'accept' }, other);
  conversation = (await post('/api/comm/begin', { met: otherKey })).gesprek.id;
  await post('/api/comm/stuur', { id: conversation, tekst: 'Dit is ons echte testgesprek.' }, other);
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });
test('a failed preference read cannot overwrite stored widgets; explicit changes survive reload', { skip }, async () => {
  await post('/api/ik/workspace/zet', { scope: 'living', workspace: { order: ['notities'], hidden: [] } });
  const ctx = await context(), page = await ctx.newPage(); let writes = 0;
  try {
    page.on('request', r => { if (r.url().endsWith('/api/ik/workspace/zet')) writes++; });
    await page.route('**/api/ik/workspace', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await open(page);
    await page.waitForFunction(() => /konden niet worden opgehaald/.test(document.querySelector('.wd-favorites').textContent));
    await page.locator('.wd-library [data-widget="geld"] .wd-widget-pin').click();
    assert.equal(writes, 0);
    assert.deepEqual((await post('/api/ik/workspace', { scope: 'living' })).workspace.order, ['notities']);
    await page.unroute('**/api/ik/workspace');
    await page.locator('.wd-favorites').getByRole('button', { name: 'Probeer opnieuw' }).click();
    await page.waitForFunction(() => /zijn bewaard/.test(document.querySelector('.wd-favorites').textContent));
    const saved = page.waitForResponse(r => r.url().endsWith('/api/ik/workspace/zet'));
    await page.locator('.wd-library [data-widget="geld"] .wd-widget-pin').click(); await saved;
    await page.reload(); await page.waitForSelector('.wd-favorites [data-widget="geld"]');
    assert.deepEqual((await post('/api/ik/workspace', { scope: 'living' })).workspace.order, ['notities', 'geld']);
    assert.deepEqual((await post('/api/ik/workspace', { scope: 'travel' })).workspace.order, []);
  } finally { await ctx.close(); }
});
test('search, week selection and real conversation selection survive desktop interaction', { skip }, async () => {
  await post('/api/ik/workspace/zet', { scope: 'living', workspace: { order: ['agenda'], hidden: [] } });
  const ctx = await context(), page = await ctx.newPage(), errors = []; letOpFouten(page, errors);
  try {
    await open(page); await page.waitForSelector('.wd-favorites [data-widget="agenda"] [data-state="ready"]');
    await page.locator('.wd-favorites').getByRole('button', { name: 'Een week vooruit' }).click();
    await page.waitForSelector('.wd-favorites [data-widget="agenda"] [data-state="ready"]');
    await page.locator('#wdSearch').fill('agenda');
    await page.evaluate(() => window.RTGi18n.set('en'));
    assert.equal(await page.locator('#wdSearch').inputValue(), 'agenda');
    await page.waitForSelector('.wd-favorites [data-widget="agenda"] [data-state="ready"]');
    assert.equal(await page.locator('.wd-favorites').getByRole('button', { name: 'Previous week' }).isEnabled(), true);
    await page.evaluate(() => window.RTGi18n.set('ar'));
    assert.equal(await page.locator('html').getAttribute('dir'), 'rtl');
    for (const width of [1024, 1440]) {
      await page.setViewportSize({ width, height: 1050 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    }
    await page.evaluate(() => window.RTGi18n.set('nl'));
    await page.locator('.wd-people a[href="/apps/comm.html?gesprek=' + encodeURIComponent(conversation) + '"]').click();
    const frame = page.frameLocator('iframe[data-desktop-app^="/apps/comm.html?gesprek="]');
    await frame.locator('#veld').waitFor({ state: 'visible' });
    await frame.locator('#bubbels').getByText(/Dit is ons echte testgesprek/).waitFor();
    assert.match(await frame.locator('#bubbels').innerText(), /Dit is ons echte testgesprek/);
    assert.deepEqual(errors, []);
  } finally { await ctx.close(); }
});
