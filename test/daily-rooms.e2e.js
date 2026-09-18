/* Approved daily rooms, proven with a real empty account and real mutations.
   A failed read or empty search must never impersonate a first visit. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, edgeBediening } = require('./helper');
const pw = laadPlaywright();
async function post(base, route, body, token) {
  const r = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
  const data = await r.json(); assert.ok(r.ok, route + ': ' + JSON.stringify(data)); return data;
}
async function language(page, code, name) {
  await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
  await page.locator('[data-edge-face="all"]').click();
  await page.locator('[data-edge-smart-language]').click();
  await page.locator('#rtg-lang-zoek').fill(name);
  await page.locator('#rtg-lang-hint[data-lang="' + code + '"]').click();
  await page.waitForFunction(c => document.documentElement.lang === c, code);
}
test('Daily rooms: first visit to real content, Edge, language, layout and recovery',
  { skip: geenBrowser(pw), timeout: 240000 }, async () => {
  const srv = await startServer({ env: { RTG_DEMO: '0', RTG_MAGNAAT_TEST: '0', RTG_AI_UIT: '1', SMTP_URL: '' } });
  let browser;
  try {
    const reg = await post(srv.base, '/api/auth/register', { name: 'Schermcontrole', email: 'daily' + Date.now() + '@v.test',
      phone: '0612345678', password: 'geheim123', geboortedatum: '1990-02-02', tier: 'rtg' });
    assert.ok(reg.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await context.addInitScript(token => { localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    const page = await context.newPage(), errors = [];
    letOpFouten(page, errors);
    async function open(app, state = 'empty') {
      await page.goto(srv.base + '/apps/' + app + '.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('body[data-daily-state="' + state + '"]');
      await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
      await page.evaluate(() => document.fonts.ready);
    }
    async function screenshot(name) {
      if (!process.env.RTG_DAILY_SCREENSHOTS) return;
      fs.mkdirSync(process.env.RTG_DAILY_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.RTG_DAILY_SCREENSHOTS, name + '.png'), fullPage: true });
    }
    for (const app of ['pulse', 'agenda', 'bestanden', 'notities']) {
      await open(app);
      await page.waitForFunction(() => [...document.querySelectorAll('.daily-photo')].every(i => i.complete && i.naturalWidth));
      assert.equal(await page.locator('#dailyIntro h1').count(), 1);
      assert.equal(await page.locator('.rtg-adaptive-bar:visible').count(), 1);
      assert.equal(await page.locator('.rtg-reality-graph,.rtg-deep-nav,.kantoor-intro').count(), 0);
      assert.ok((await page.locator('#dailyIntro').boundingBox()).y < 100, app + ': no duplicate top bar');
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), app + ': no overflow at ' + width);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await screenshot(app + '-empty');
      await language(page, 'en', 'English');
      await page.waitForFunction(() => /small moment|Make room|A place|Give your thoughts/.test(document.querySelector('#dailyIntro h1').textContent));
      await language(page, 'nl', 'Nederlands');
      await page.evaluate(() => document.documentElement.dir = 'rtl');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), app + ': RTL');
      await page.evaluate(() => document.documentElement.dir = 'ltr');
    }
    // A new note stays a draft on language switches and failed writes.
    await page.locator('#dailyIntro [data-daily-target="nieuwNotitie"]').click();
    await page.locator('#ntTitel').fill('Voor het weekend');
    await page.locator('#ntTekst').fill('Maak ruimte voor een lange wandeling.');
    await page.evaluate(() => window.RTGi18n.set('en')); // shared language event, also used by the embedding shell
    assert.equal(await page.locator('#ntTitel').inputValue(), 'Voor het weekend');
    await page.evaluate(() => window.RTGi18n.set('nl'));
    await page.route('**/api/notities/bewaar', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Tijdelijk niet beschikbaar."}' }));
    await page.locator('#ntBewaar').click();
    await page.waitForFunction(() => document.querySelector('#melding').textContent.includes('Tijdelijk'));
    assert.ok(await page.locator('#ntScrim').isVisible());
    assert.equal((await post(srv.base, '/api/notities/mijn', {}, reg.token)).eigen.length, 0);
    await page.unroute('**/api/notities/bewaar');
    await page.locator('#ntVast').click();
    await page.waitForSelector('#bord .nkaart.vast');
    assert.equal((await post(srv.base, '/api/notities/mijn', {}, reg.token)).eigen.length, 1);
    await screenshot('notities-filled');
    await page.locator('#zoek').fill('niets-met-deze-naam');
    assert.match(await page.locator('#bord').textContent(), /geen resultaten/);
    assert.equal(await page.locator('body').getAttribute('data-daily-state'), 'ready');

    await open('bestanden');
    const chooser = page.waitForEvent('filechooser');
    await page.locator('#dailyIntro [data-daily-target="kies"]').click();
    await (await chooser).setFiles({ name: 'Reisplanning.txt', mimeType: 'text/plain', buffer: Buffer.from('Onze reisplanning.') });
    await page.waitForSelector('#lijst .item');
    page.once('dialog', d => d.accept('Reizen'));
    await edgeBediening(page, '+ Map');
    await page.waitForSelector('#mappen .mapkaart');
    const files = await post(srv.base, '/api/bestanden/mijn', {}, reg.token);
    assert.equal(files.items.length, 1); assert.equal(files.mappen.length, 1);
    await screenshot('bestanden-filled');
    await page.locator('#mappen .mapkaart').click();
    assert.match(await page.locator('#lijst').textContent(), /geen bestanden in deze map/);
    assert.equal(await page.locator('body').getAttribute('data-daily-state'), 'ready');
    await page.locator('#zoek').fill('niets-met-deze-naam');
    assert.match(await page.locator('#lijst').textContent(), /geen resultaten/);

    await open('agenda');
    await page.locator('#dailyIntro [data-daily-target="nieuwBtn"]').click();
    await page.locator('#afTitel').fill('Samen aan tafel');
    const today = new Date().toISOString().slice(0, 10);
    await page.locator('#afDatum').fill(today);
    await page.locator('#afTijd').fill('19:30');
    await page.locator('#afPlek').fill('Aan het water');
    await page.locator('#afBewaar').click();
    await page.waitForSelector('#kal .litem');
    assert.match(await page.locator('#kal').textContent(), /Samen aan tafel/);
    await screenshot('agenda-filled');
    const before = await page.locator('[data-daily-date][aria-pressed="true"]').getAttribute('data-daily-date');
    await page.locator('[data-daily-date][aria-pressed="false"]').first().click();
    await page.waitForFunction(() => document.querySelector('#kal').textContent.includes('op deze dag geen afspraken'));
    assert.equal(await page.locator('body').getAttribute('data-daily-state'), 'ready', 'an empty day is not an empty week');
    await language(page, 'en', 'English');
    assert.notEqual(await page.locator('[data-daily-date][aria-pressed="true"]').getAttribute('data-daily-date'), before);
    await language(page, 'nl', 'Nederlands');

    await open('pulse');
    await page.locator('[data-daily-target="dailyCompose"]').click();
    await page.locator('#nw').fill('Een kleine wandeling maakt ruimte voor een goed gesprek.');
    await language(page, 'en', 'English');
    assert.equal(await page.locator('#nw').inputValue(), 'Een kleine wandeling maakt ruimte voor een goed gesprek.');
    await page.locator('#plaats').click();
    await page.waitForSelector('article.post');
    page.once('dialog', d => d.accept('Bewaard'));
    await page.locator('[data-bewaar]').click();
    await page.waitForSelector('[data-saved="true"]');
    // The semantic action must not depend on the translated button text.
    await language(page, 'nl', 'Nederlands');
    assert.equal((await post(srv.base, '/api/member/pulse/feed', {}, reg.token)).feed.length, 1);
    await page.waitForFunction(() => { const b = document.querySelector('.rtguitvoer-knop'); return b && !!b.closest('.rtg-edge-chrome'); });
    await screenshot('pulse-filled');

    for (const [app, route] of [['pulse','member/pulse/feed'], ['agenda','agenda/bereik'], ['bestanden','bestanden/mijn'], ['notities','notities/mijn']]) {
      await page.route('**/api/' + route, r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"Tijdelijk niet beschikbaar."}' }));
      await open(app, 'error');
      assert.equal(await page.locator('.daily-photo').count(), 0, 'outage is not a first visit');
      await page.unroute('**/api/' + route);
      await page.locator('[data-daily-target="retry"]').click();
      await page.waitForSelector('body[data-daily-state="ready"]');
    }
    assert.deepEqual(errors, [], 'no browser errors');
    await context.close();
  } finally { if (browser) await browser.close(); await stop(srv); }
});
