'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(), skip = geenBrowser(pw);
const { haalSessies, opslagVoor } = require('../scripts/lib/proefsessies');
let srv, browser, member, other, conversation;
async function post(path, body, token) {
  const r = await fetch(srv.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  const j = await r.json(); assert.equal(r.status, 200, path + ': ' + JSON.stringify(j)); return j;
}
async function pageFor() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    reducedMotion: 'reduce', serviceWorkers: 'block' });
  await ctx.addInitScript(token => { localStorage.setItem('rtg_member_token', token);
    localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, member.token);
  const page = await ctx.newPage(); page.setDefaultTimeout(10000); return { ctx, page };
}
async function open(page, route) {
  await page.goto(srv.base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
}
async function actions(page) { await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click(); }
test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { RTG_DEMO: '0', RTG_AI_UIT: '1', SMTP_URL: '' } });
  browser = await pw.chromium.launch(browserOpties(pw, { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }));
  const stamp = Date.now();
  async function register(n) { return post('/api/auth/register', { name: 'Controls test ' + n, email: 'controls-' + stamp + '-' + n + '@e.test',
    phone: '06' + String(stamp + n).slice(-8), password: 'geheim123', geboortedatum: '1985-01-01', tier: 'rtg' }); }
  member = await register(1); other = await register(2);
  const key = 'user-' + (await post('/api/auth/me', {}, member.token)).user.id;
  const otherKey = 'user-' + (await post('/api/auth/me', {}, other.token)).user.id;
  await post('/api/member/connect', { key: otherKey }, member.token);
  await post('/api/member/connect/respond', { key, action: 'accept' }, other.token);
  conversation = (await post('/api/comm/begin', { met: otherKey }, member.token)).gesprek.id;
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });

test('mobile camera controls remain reachable through the standard Edge', { skip }, async () => {
  const { ctx, page } = await pageFor();
  try {
    await open(page, '/apps/camera.html');
    await page.waitForFunction(() => !document.querySelector('#sluiter').disabled);
    assert.equal(await page.locator('#openKnop svg').isVisible(), true);
    assert.equal(await page.locator('#flitsKnop[hidden]').isVisible(), false);
    await actions(page);
    const swap = page.locator('.rtg-adaptive-controls [data-rtg-adaptive-source="wisselKnop"]');
    assert.equal(await swap.count(), 1, 'the hidden overflow camera switch must remain in Edge actions');
    await swap.click();
    await page.waitForFunction(() => !document.querySelector('#sluiter').disabled);
    await page.locator('#sluiter').click();
    await page.waitForSelector('#duimpje:not([hidden])');
    assert.match(await page.locator('#duimBeeld').getAttribute('src'), /^blob:/);
  } finally { await ctx.close(); }
});

test('mobile Klankwerk can save a real composition from the Edge', { skip }, async () => {
  const { ctx, page } = await pageFor();
  try {
    await open(page, '/apps/klankwerk.html'); await page.locator('#nieuw').click();
    await page.waitForSelector('#rack .kanaal');
    await page.locator('#tNaam').fill('Mobiele compositie');
    await page.locator('#tNaam').press('Tab');
    await actions(page);
    const save = page.locator('.rtg-adaptive-controls [data-rtg-adaptive-source="bewaar"]');
    assert.equal(await save.count(), 1, 'the mobile save action must not disappear with the old menu');
    await save.click();
    await page.waitForFunction(() => /Bewaard/.test(document.querySelector('#melding').textContent));
    await page.reload();
    await page.getByText('Mobiele compositie', { exact: true }).waitFor();
  } finally { await ctx.close(); }
});

test('mobile messages send to the intended test recipient and retain the conversation after reload', { skip }, async () => {
  const { ctx, page } = await pageFor();
  try {
    await open(page, '/apps/comm.html?gesprek=' + encodeURIComponent(conversation));
    await page.locator('#veld').fill('Bericht via de mobiele bediening.');
    await page.locator('#stuur').click();
    await page.locator('#bubbels .bub').filter({ hasText: 'Bericht via de mobiele bediening.' }).waitFor();
    const read = await post('/api/comm/gesprek', { id: conversation }, other.token);
    assert.equal(read.gesprek.berichten.filter(b => b.tekst === 'Bericht via de mobiele bediening.').length, 1);
    await page.reload(); await page.locator('#veld').waitFor();
    await page.locator('#bubbels .bub').filter({ hasText: 'Bericht via de mobiele bediening.' }).waitFor();
    const control = page.locator('[data-ai="afspraken"]');
    assert.equal(await control.evaluate(e => { const r = e.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!top && e.contains(top); }), true, 'the Edge must not cover conversation actions');
  } finally { await ctx.close(); }
});

test('switching worlds reaches their current homes through the visible Edge', { skip }, async () => {
  const { ctx, page } = await pageFor();
  const errors = []; letOpFouten(page, errors);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  try {
    await open(page, '/apps/kantoor.html');
    for (const [name, route] of [['LivingOS', '/apps/wereld.html'], ['TravelOS', '/apps/reizen.html'],
      ['FoundationOS', '/apps/foundation/index.html'], ['WorkOS', '/apps/kantoor.html']]) {
      await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="worlds"]').click();
      await page.locator('.rtg-edge-worlds a').filter({ hasText: name }).click();
      await page.waitForURL(srv.base + route);
      await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
      assert.equal(await page.locator('.rtg-adaptive-bar').count(), 1);
    }
    assert.deepEqual(errors, [], 'world switches preserve working navigation without application errors');
  } finally { await ctx.close(); }
});

test('mobile office screens keep the standard Edge inside the physical viewport', { skip }, async () => {
  const staff = await startServer({ env: { RTG_MAGNAAT_TEST: '1', RTG_AI_UIT: '1', SMTP_URL: '' } });
  let ctx;
  try {
    const auth = await haalSessies(staff.base);
    assert.deepEqual(auth.overgeslagen, []);
    ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await ctx.addInitScript(data => { for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v); },
      { ...opslagVoor(auth.sessies), rtg_lang: 'nl' });
    for (const route of ['/apps/kantoren.html', '/apps/routedossier.html']) {
      const page = await ctx.newPage();
      await page.goto(staff.base + route);
      await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
      const edge = page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]');
      const rect = await edge.boundingBox();
      assert.ok(rect && rect.y >= 0 && rect.y + rect.height <= 844 && rect.x + rect.width <= 390,
        route + ': content overflow must not push the fixed Edge outside the phone screen');
      await edge.click();
      assert.equal(await page.locator('.rtg-adaptive-controls').isVisible(), true);
      await page.close();
    }
  } finally { if (ctx) await ctx.close(); await stop(staff.child); }
});
