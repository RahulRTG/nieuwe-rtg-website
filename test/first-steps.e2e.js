/* The approved first-visit designs against a real, empty RTG server. Photos
   and category buttons must never masquerade as account data or bookable stock. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, edgeActies, letOpFouten } = require('./helper');
const pw = laadPlaywright();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==', 'base64');
async function post(base, pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  const d = await r.json(); assert.ok(r.ok, pad + ': ' + JSON.stringify(d)); return d;
}
async function action(page, name) {
  await edgeActies(page);
  await page.locator('.rtg-adaptive-controls button').filter({ hasText: new RegExp('^' + name + '$') }).click();
}
async function language(page, code, name) {
  await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
  await page.locator('[data-edge-face="all"]').click();
  await page.locator('[data-edge-smart-language]').click();
  await page.locator('#rtg-lang-zoek').fill(name);
  await page.locator('#rtg-lang-hint[data-lang="' + code + '"]').click();
  await page.waitForFunction(c => document.documentElement.lang === c, code);
}

test('Four editorial first visits: responsive, language, shared Edge and real first actions',
  { skip: geenBrowser(pw), timeout: 180000 }, async () => {
  const srv = await startServer({ env: { RTG_DEMO: '0', RTG_MAGNAAT_TEST: '0', RTG_AI_UIT: '1', SMTP_URL: '' } });
  let browser;
  try {
    const reg = await post(srv.base, '/api/auth/register', { name: 'Ontwerpcontrole', email: 'first' + Date.now() + '@v.test',
      phone: '0612345678', password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' });
    assert.ok(reg.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.addInitScript(token => {
      localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    const page = await context.newPage(), errors = [];
    letOpFouten(page, errors);
    async function open(app, first = true, suffix = '') {
      await page.goto(srv.base + '/apps/' + app + '.html' + suffix, { waitUntil: 'domcontentloaded' });
      if (first) await page.waitForSelector('.rtg-first-steps');
      if (!suffix) await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
      await page.evaluate(() => document.fonts.ready);
    }
    for (const app of ['salon', 'genootschap', 'reisbureau', 'galerij']) {
      await open(app);
      await page.waitForFunction(() => [...document.querySelectorAll('.rtg-first-steps img')].every(i => i.complete && i.naturalWidth > 0));
      assert.equal(await page.locator('.rtg-adaptive-bar').count(), 1);
      assert.equal(await page.locator('.rtg-first-steps h1').count(), 1);
      assert.equal(await page.locator('.rtg-reality-graph,.tos-module-hero,.rtg-suite-hero').count(), 0);
      const header = await page.locator('.rtg-first-steps').boundingBox();
      assert.ok(header.y < 100, app + ' begins directly below the shared world header');
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), app + ': no overflow at ' + width);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await language(page, 'en', 'English');
      await page.waitForFunction(() => document.querySelector('.rtg-first-steps h1').innerText.match(/Beautiful|Together|Where|Some moments/));
      const controls = await page.locator('.rtg-first-steps [data-first-action]').evaluateAll(elements => elements.map(e => e.dataset.firstAction));
      await language(page, 'nl', 'Nederlands');
      assert.deepEqual(await page.locator('.rtg-first-steps [data-first-action]').evaluateAll(elements => elements.map(e => e.dataset.firstAction)), controls, 'language changes presentation, not the action');
      await page.evaluate(() => document.documentElement.dir = 'rtl');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), app + ': RTL layout');
      await page.evaluate(() => document.documentElement.dir = 'ltr');
      if (process.env.RTG_FIRST_SCREENSHOTS) {
        fs.mkdirSync(process.env.RTG_FIRST_SCREENSHOTS, { recursive: true });
        await page.screenshot({ path: path.join(process.env.RTG_FIRST_SCREENSHOTS, app + '.png'), fullPage: true });
      }
    }
    // Interest cards search the real group registry, without creating or joining anything.
    await open('genootschap');
    await page.locator('[data-first-interest="dinner"]').click();
    await page.waitForSelector('#zveld');
    assert.equal(await page.locator('#zveld').inputValue(), 'eten');
    await page.waitForFunction(() => document.querySelector('#zuit').textContent.includes('Niets gevonden'));
    assert.deepEqual((await post(srv.base, '/api/genootschap/mijn', {}, reg.token)).groepen, []);
    await action(page, 'Mijn genootschappen');
    await page.locator('[data-first-action="found"]').click();
    await page.locator('#nnaam').fill('Aan tafel');
    await language(page, 'en', 'English');
    assert.equal(await page.locator('#nnaam').inputValue(), 'Aan tafel', 'a language change keeps the draft');
    await language(page, 'nl', 'Nederlands');
    await page.locator('#nover').fill('Samen koken en eten.');
    await page.locator('#bnieuw').click();
    await page.waitForFunction(() => document.querySelector('main').textContent.includes('Aan tafel'));
    assert.equal(await page.locator('.rtg-first-steps').count(), 0, 'real groups replace the welcome');
    assert.equal((await post(srv.base, '/api/genootschap/mijn', {}, reg.token)).groepen.length, 1);

    await open('reisbureau');
    await page.locator('[data-first-preference="rest"]').click();
    await page.locator('[data-first-action="wish"]').click();
    assert.equal(await page.locator('#adviesIn').inputValue(), 'Ik wil tot rust komen.');
    await page.locator('#adviesGo').click();
    await page.waitForFunction(() => /geen passende reis/.test(document.querySelector('#adviesUit').textContent));
    const mine = await post(srv.base, '/api/reisbureau/mijn', {}, reg.token);
    assert.equal((mine.aanvragen || []).length, 0, 'exploring never makes a booking request');

    await open('galerij');
    page.once('dialog', dialog => dialog.accept('Zomer aan zee'));
    await page.locator('[data-first-action="album"]').click();
    await page.waitForFunction(() => document.querySelector('#albums').textContent.includes('Zomer aan zee'));
    assert.equal((await post(srv.base, '/api/galerij/mijn', {}, reg.token)).albums.length, 1);
    await action(page, 'Albums'); // back to the empty photo timeline
    await page.waitForSelector('[data-first-action="photo"]');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('[data-first-action="photo"]').click();
    await (await chooser).setFiles({ name: 'avond.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('#tijdlijn .thumb');
    assert.equal(await page.locator('.rtg-first-steps').count(), 0);
    const gallery = await post(srv.base, '/api/galerij/mijn', {}, reg.token);
    assert.equal(gallery.beelden.length, 1);
    assert.equal(gallery.beelden[0].bron, 'bestand', 'the Gallery uses the existing storage');

    await open('salon');
    await page.locator('[data-first-action="topics"]').click();
    await page.waitForSelector('#zoekveld');
    await page.locator('#zoekveld').fill('een woord dat niet bestaat');
    await page.locator('#zoekknop').click();
    await page.waitForFunction(() => document.querySelector('main').textContent.includes('geen momenten gevonden'));
    assert.equal(await page.locator('.rtg-first-steps').count(), 0, 'an empty search is not a first visit');
    await action(page, 'Feed');
    await page.locator('[data-first-action="share"]').click();
    await page.locator('#ptekst').fill('Onze eerste avond aan zee.');
    await page.locator('#plaatsknop').click();
    await page.waitForFunction(() => document.querySelector('main').textContent.includes('Onze eerste avond aan zee.'));
    await action(page, 'Feed');
    await page.waitForSelector('[data-post]');
    assert.equal(await page.locator('.rtg-first-steps').count(), 0, 'real posts replace the welcome');
    const circleLink = await page.locator('.salon-kringlink').boundingBox();
    assert.ok(circleLink && circleLink.width >= 44 && circleLink.height >= 44,
      'Beheer uw kringen blijft ook na het eerste bericht goed aanraakbaar');

    // An outage must not turn into the claim that the member has no photos.
    await page.route('**/api/galerij/mijn', r => r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Tijdelijk niet beschikbaar.' }) }));
    await open('galerij', false);
    await page.waitForSelector('[data-first-retry]');
    assert.equal(await page.locator('.rtg-first-steps').count(), 0);
    await page.unroute('**/api/galerij/mijn');
    await page.locator('[data-first-retry]').click();
    await page.waitForSelector('#tijdlijn .thumb');
    assert.deepEqual(errors, [], 'no page errors');
    await context.close();
  } finally { if (browser) await browser.close(); await stop(srv); }
});
