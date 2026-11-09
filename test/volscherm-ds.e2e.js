/* Echte instelling -> bestaande werkruimte. De losse main-proef onderaan is
   expliciet een componentfixture, geen bewijs voor een extra productroute. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs } = require('./lib/ds-toets');
const { gereed, sluit, wissel, volleWerkruimte, mobiel } = require('./lib/volscherm-browser');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser, tmp, lid, office;
test.before(async () => {
  if (skip) return;
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-volscherm-ds-'));
  srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE',
    RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
  const post = async (url, body, token) => {
    const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
    const j = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(j)); return j;
  };
  lid = (await post('/api/auth/register', { name: 'Rand tot rand proef', email: 'randen@volscherm.test', phone: '0612345678',
    password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg' })).token;
  office = (await post('/api/office/login', { code: 'RTG-OFFICE' })).token; assert.ok(lid && office);
  // De echte lege Notities-toestand biedt eerst aan een notitie te maken.
  // De zoekproef begint expliciet met een via de bestaande route bewaarde notitie.
  await post('/api/notities/bewaar', { titel: 'Bestaande proefnotitie', tekst: 'Voor de werkruimteproef' }, lid);
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => {
  if (browser) await browser.close(); if (srv) await stop(srv.child);
  if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
});

for (const route of ['wonen', 'studio-pda']) test(route + ': Rand tot rand houdt werkvlak, panelen en mobiel dezelfde eigenaar',
  { skip, timeout: 120000 }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  try {
    await ctx.addInitScript(({ lid, office }) => {
      localStorage.setItem('rtg_member_token', lid); localStorage.setItem('rtg_office_token', office);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { lid, office });
    const page = await ctx.newPage(), fouten = letOpFouten(page, []);
    await page.goto(srv.base + '/apps/' + route + '.html', { waitUntil: 'domcontentloaded' }); await gereed(page);
    await alleenDs(page); assert.equal(await page.locator('#volCss').count(), 0);
    const main = page.locator('.wd-home main'), origineel = await main.elementHandle();
    const smal = (await page.locator('.wd-home').boundingBox()).width;
    if (route === 'studio-pda') await page.locator('#pNaam').fill('Mijn onbewaarde studioconcept');
    await wissel(page, true, true); await volleWerkruimte(page);
    assert.ok((await page.locator('.wd-home').boundingBox()).width > smal + 100);
    assert.equal(await main.evaluate((el, oud) => el === oud, origineel), true);
    if (route === 'studio-pda') assert.equal(await page.locator('#pNaam').inputValue(), 'Mijn onbewaarde studioconcept');

    await page.locator('.wd-app-controls > summary').click(); await page.locator('#wdSearch').fill('notities');
    await page.locator('.wd-library [data-widget="notities"] [data-widget-open="notities"]').click();
    const iframe = page.locator('iframe[data-desktop-app="/apps/notities.html"]'), iframeNode = await iframe.elementHandle();
    const frame = page.frameLocator('iframe[data-desktop-app="/apps/notities.html"]');
    await frame.locator('#zoek').fill('Onbewaard in het appvenster'); await volleWerkruimte(page, '.wd-focus');
    const breed = (await page.locator('.wd-focus').boundingBox()).width;
    await wissel(page, false, true);
    assert.ok((await page.locator('.wd-focus').boundingBox()).width < breed - 100);
    await wissel(page, true, true);
    assert.equal(await iframe.evaluate((el, oud) => el === oud, iframeNode), true);
    assert.equal(await frame.locator('#zoek').inputValue(), 'Onbewaard in het appvenster');
    for (const width of [390, 820]) {
      await mobiel(page, width);
      const r = await iframe.boundingBox();
      assert.ok(r && r.height > 44 && r.width > 44 && r.x >= 0 && r.x + r.width <= width + 1);
      assert.equal(await frame.locator('#zoek').inputValue(), 'Onbewaard in het appvenster');
    }
    await page.locator('.wd-focus-head').getByRole('button', { name: 'Terug naar uw overzicht', exact: true }).click();
    assert.equal(await page.locator('#osMenuBtn').isVisible(), false, 'de gemigreerde werkruimte toont geen tweede hamburger naast Edge');
    assert.equal(await page.locator('.ds-edge__balk [data-ds-edge="menu"]').isVisible(), true, 'Edge blijft de zichtbare systeemdeur');
    assert.equal(await page.locator('.amn-blad').getByRole('button', { name: 'Rand tot rand', exact: true }).count(), 0);
    const namen = await page.locator('.amn-tegel').allTextContents();
    assert.ok(!namen.some(n => /^(Draaien|Volledig|Rand tot rand)$/.test(n.trim())), 'instellingen zijn geen appfuncties');
    await page.setViewportSize({ width: 1440, height: 1000 }); await volleWerkruimte(page);
    assert.equal(await main.evaluate((el, oud) => el === oud, origineel), true);
    if (route === 'studio-pda') assert.equal(await page.locator('#pNaam').inputValue(), 'Mijn onbewaarde studioconcept');
    await page.reload({ waitUntil: 'domcontentloaded' }); await gereed(page); await volleWerkruimte(page);
    assert.equal(await page.evaluate(() => RTGVol.aan()), true, 'herladen leest de echte toestelvoorkeur');
    await page.setViewportSize({ width: 390, height: 844 }); await page.reload({ waitUntil: 'domcontentloaded' });
    await gereed(page); await mobiel(page, 390);
    await page.setViewportSize({ width: 1440, height: 1000 }); await wissel(page, false, true);
    await page.reload({ waitUntil: 'domcontentloaded' }); await gereed(page);
    assert.equal(await page.evaluate(() => RTGVol.aan()), false);
    assert.ok((await page.locator('.wd-home').boundingBox()).width <= smal + 2);
    assert.equal(await page.locator('#volCss').count(), 0); await alleenDs(page);
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});

test('losse DS-main: componentfixture bedient echte voorkeurcontroller en CSS zonder werkruimteruntime',
  { skip }, async () => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
  try {
    const page = await ctx.newPage(), fouten = letOpFouten(page, []);
    await page.route('**/__volscherm-component', route => route.fulfill({ contentType: 'text/html', body:
      '<!doctype html><html lang="nl" data-ds="1"><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<link rel="stylesheet" href="/ds/rtg-ds.css"><script defer src="/shared/volscherm.js"></script>' +
      '<script defer src="/shared/bediening.js"></script></head><body class="ds-scherm"><main class="ds-taak">' +
      '<button class="ds-knop" id="open" onclick="RTGBediening.open()">Instellingen openen</button>' +
      '<input class="ds-invoer" aria-label="Concept" value="Mijn losse concept"></main></body></html>' }));
    await page.goto(srv.base + '/__volscherm-component'); await page.waitForFunction(() => !!window.RTGBediening);
    const main = page.locator('main'), oud = await main.elementHandle(), klein = (await main.boundingBox()).width;
    await page.locator('#open').click(); const dialog = page.getByRole('dialog', { name: 'Instellingen', exact: true });
    await dialog.getByRole('button', { name: 'Rand tot rand', exact: true }).click();
    await sluit(page, dialog, '#open');
    assert.ok((await main.boundingBox()).width >= 1438 && (await main.boundingBox()).width > klein + 100);
    assert.equal(await main.evaluate((el, node) => el === node, oud), true);
    assert.equal(await page.getByLabel('Concept').inputValue(), 'Mijn losse concept');
    for (const width of [390, 519, 520, 820, 1440]) {
      await page.setViewportSize({ width, height: 844 }); await page.locator('#open').click();
      assert.equal(await dialog.getByRole('button', { name: 'Rand tot rand', exact: true }).count(), width >= 520 ? 1 : 0);
      await sluit(page, dialog, '#open');
      assert.ok((await main.boundingBox()).width <= width + 1);
    }
    await page.reload(); await page.waitForFunction(() => !!window.RTGBediening);
    assert.equal(await page.evaluate(() => RTGVol.aan()), true);
    assert.ok((await main.boundingBox()).width >= 1438);
    await page.locator('#open').click(); await dialog.getByRole('button', { name: 'Rand tot rand', exact: true }).click();
    await sluit(page, dialog, '#open'); assert.ok((await main.boundingBox()).width <= klein + 2);
    assert.equal(await page.locator('#volCss').count(), 0); await alleenDs(page, { basis: false });
    assert.deepEqual(fouten, []);
  } finally { await ctx.close(); }
});
