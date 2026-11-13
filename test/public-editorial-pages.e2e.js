'use strict';

/* Echte, geïsoleerde presentatieproef. Geen productieprovider, aankoop of login.
   390/1440 voor alle tien hosts; 320 en zonder JS ook voor beide referenties. */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { laadPlaywright, startBrowser, letOpFouten } = require('./helper');
const ROOT = path.resolve(__dirname, '..');
const CASES = [
  { file: 'passen/rtg-pass', pass: true, pilot: true },
  { file: 'werelden/travelos', scenario: 'travel', pilot: true, volume: true },
  { file: 'passen/community', pass: true },
  { file: 'passen/business-lite', pass: true },
  { file: 'passen/business-pass', pass: true },
  { file: 'passen/lifestyle-pass', pass: true },
  { file: 'werelden/livingos', scenario: 'dinner', pilot: true, volume: true },
  { file: 'werelden/workos', scenario: 'work' },
  { file: 'werelden/foundationos', scenario: 'family' },
  { file: 'techniek/techniek' }
];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
let server, browser, base;
test.before(async () => {
  server = http.createServer((req, res) => {
    let route = new URL(req.url, 'http://localhost').pathname;
    if (route === '/') route = '/index.html';
    else if (/^\/(ds|fonts|images|shared|site)\//.test(route)) route = '/public' + route;
    const file = path.resolve(ROOT, '.' + route);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (error, bytes) => {
      if (error) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(bytes);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
  const pw = laadPlaywright({ eigenDriver: false });
  assert.ok(pw, 'Deze proef vereist een echte Playwright-browser met geïsoleerde contexten');
  browser = await startBrowser(pw);
});
test.after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
async function session(width, javaScriptEnabled = true) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block', javaScriptEnabled });
  if (javaScriptEnabled) await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.fulfill({ status: 503, body: 'Externe diensten vallen buiten deze presentatieproef.' }));
  const page = await context.newPage(), errors = [], missing = [];
  page.setDefaultTimeout(10000);
  letOpFouten(page, errors);
  page.on('response', response => {
    if (response.url().startsWith(base) && response.status() >= 400 && ['stylesheet', 'script', 'image', 'font'].includes(response.request().resourceType())) missing.push(response.status() + ' ' + response.url());
  });
  return { context, page, errors, missing };
}
async function noOverflow(page, label) {
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(size.scroll <= size.viewport, label + ': geen horizontale pagina-overflow ' + JSON.stringify(size));
}
async function images(page, label) {
  for (const img of await page.locator('img').all()) {
    const source = await img.getAttribute('src');
    assert.ok(source, label + ': iedere afbeelding heeft een bron');
    if (await img.isVisible()) {
      await img.scrollIntoViewIfNeeded();
      await page.waitForFunction(el => el.complete && el.naturalWidth > 0, await img.elementHandle());
      const state = await img.evaluate(async el => {
        await el.decode(); const rect = el.getBoundingClientRect();
        return { loaded: el.complete && el.naturalWidth > 0, width: rect.width, height: rect.height };
      });
      assert.ok(state.loaded && state.width > 0 && state.height > 0, label + ': zichtbaar beeld laadt ' + source);
    } else {
      // Een gesloten menu mag lui laden; ook die bron moet echt decodeerbaar zijn.
      assert.equal(await img.evaluate(el => new Promise(resolve => {
        const probe = new Image(); probe.onload = () => resolve(probe.naturalWidth > 0); probe.onerror = () => resolve(false); probe.src = el.currentSrc || el.src;
      })), true, label + ': verborgen beeldbron bestaat ' + source);
    }
  }
}
async function structure(page, c, runtime = true) {
  assert.equal(await page.locator('html').getAttribute('data-ds') !== null, true);
  assert.match(await page.locator('body').getAttribute('class'), /\bds-public-editorial\b/);
  assert.equal(await page.locator('body').getAttribute('data-rtg-world'), 'living');
  assert.equal(await page.locator('h1').count(), 1, c.file + ': één echte hoofdtitel');
  assert.deepEqual(await page.locator('link[rel="stylesheet"]').evaluateAll(rows => rows.map(el => new URL(el.href).pathname)), ['/public/fonts/fonts.css', '/public/ds/rtg-ds.css']);
  const cover = page.locator('.world-hero .ds-public-cover');
  assert.equal(await cover.count(), 1); assert.equal(await cover.isVisible(), true);
  assert.match(await cover.locator('img').getAttribute('src'), /images\/editorial\//);
  if (c.volume) {
    assert.match(await page.locator('body').getAttribute('class'), /\bds-public-volume\b/);
    assert.equal(await page.locator('main').count(), 1);
    assert.equal(await page.locator('main#verhaal [data-reel-track] [data-reel-page]').count(), 5);
    assert.match(await page.locator('[data-reel-page]').first().getAttribute('class'), /\bworld-hero\b/);
    assert.equal(await page.locator('[data-reel-track] figcaption,.ds-public-chapters').count(), 0);
    assert.equal(await page.locator('#werelddetails').evaluate(el => el.tagName === 'DETAILS' && !el.open), true);
    assert.equal(await page.locator('#colofon').evaluate(el => el.tagName === 'DETAILS' && !el.open), true);
    assert.match(await page.locator('#colofon').textContent(), /AI/);
    assert.ok(await page.locator('#colofon a[href*="provenance" i]').count() > 0, c.file + ': herkomst blijft bereikbaar');
    assert.equal(await page.locator('#werelddetails .proof-detail').count(), 7);
  } else {
    const credit = await cover.locator('figcaption').innerText();
    assert.match(credit, /AI/); assert.match(credit, /sfeerbeeld/i);
    assert.equal(await page.locator('.ds-public-stroke').getAttribute('alt'), '');
  }
  if (c.scenario && runtime) {
    const panel = page.locator('[data-world-truth-slot] [data-app-truth-panel]');
    // A visual volume discloses the existing catalogue on request; it does
    // not remove or duplicate its owner. Other stories show it immediately.
    await panel.waitFor({ state: 'attached' });
    assert.equal(await panel.count(), 1, c.file + ': één catalogus bij de mogelijkheden');
    assert.equal(await page.locator('.world-hero [data-app-truth-panel]').count(), 0);
    await page.evaluate(async () => {
      const response = await fetch('/public/site/website-truth.json');
      if (!response.ok) throw new Error('Appwaarheid ontbreekt');
      window.RTGWebsiteTruthRefresh(await response.json());
    });
    assert.equal(await page.locator('[data-app-truth-panel]').count(), 1, c.file + ': herlevering maakt geen dubbele waarheid');
  }
  if (c.pass) {
    assert.equal(await page.locator('.world-hero [data-policy-price]').isVisible(), true);
    assert.match(await page.locator('.world-hero').innerText(), /nog niet (?:boekbaar|te boeken|vrijgegeven)/i);
    assert.equal(await page.locator('.world-hero [data-policy-billing]').count(), 0);
    assert.equal(await page.locator('#beschikbaarheid [data-policy-billing]').count(), 1);
  }
  if (c.scenario) assert.equal(await page.locator('[data-story-demo]').getAttribute('data-story-demo'), c.scenario);
}
async function chapterKeyboard(page, label, runtime = true) {
  if (await page.locator('body.ds-public-volume').count()) {
    for (const id of ['werelddetails', 'colofon']) {
      const link = page.locator('[data-editorial-reel] a[href="#' + id + '"]').first();
      assert.equal(await link.count(), 1, label + ': native link naar ' + id);
      await link.scrollIntoViewIfNeeded();
      const rect = await link.boundingBox();
      assert.ok(rect && rect.width >= 44 && rect.height >= 44, label + ': 44px-detaildoel ' + id);
      const disclosure = page.locator('#' + id);
      if (runtime) {
        await link.focus(); await page.keyboard.press('Enter');
        await page.waitForURL(url => url.hash === '#' + id);
      } else {
        // Native summaries remain an honest fallback; no controller is assumed.
        await disclosure.locator(':scope > summary').click();
      }
      assert.equal(await disclosure.getAttribute('open') !== null, true, label + ': ' + id + ' open');
      if (id === 'colofon') assert.match(await disclosure.innerText(), /AI/);
      await disclosure.locator(':scope > summary').click();
      await noOverflow(page, label + ' ' + id);
    }
    return;
  }
  const chapters = page.locator('.ds-public-chapters a');
  assert.ok(await chapters.count() >= 3, label + ': hoofdstukken bestaan');
  for (const link of await chapters.all()) {
    const rect = await link.boundingBox(), href = await link.getAttribute('href');
    assert.ok(rect && rect.width >= 44 && rect.height >= 44, label + ': 44px-hoofdstukdoel ' + href + ' ' + JSON.stringify(rect));
    await link.focus(); await page.keyboard.press('Enter');
    await page.waitForURL(url => url.hash === href);
    const target = page.locator(href);
    assert.equal(await target.count(), 1, label + ': één doel voor ' + href);
    await page.waitForFunction(selector => {
      const el = document.querySelector(selector), r = el && el.getBoundingClientRect();
      return r && r.top >= -1 && r.top < innerHeight - 40;
    }, href);
    // Safari's native full link traversal is Option-Tab when the system's
    // ordinary Tab preference is limited to form controls.
    await page.keyboard.press(browser.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab');
    assert.equal(await page.evaluate(() => document.activeElement !== document.body && !!document.activeElement.getClientRects().length), true, label + ': toetsenbord gaat na de sprong verder naar zichtbare bediening');
    await noOverflow(page, label + ' ' + href);
  }
}
async function menuEscape(page, label) {
  const menu = page.locator('[data-public-menu]');
  assert.equal(await menu.count(), 1, label + ': één menu-eigenaar');
  await menu.focus(); await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('[data-public-menu]').getAttribute('aria-expanded') === 'true');
  assert.ok(await page.getByRole('navigation', { name: 'Ontdek RTG', exact: true }).isVisible(), label + ': het menu opent echt');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('[data-public-menu]').getAttribute('aria-expanded') === 'false');
  assert.equal(await page.getByRole('navigation', { name: 'Ontdek RTG', exact: true }).isVisible(), false, label + ': Escape sluit het menu');
  assert.equal(await page.evaluate(() => document.activeElement !== document.body && !!document.activeElement.getClientRects().length), true, label + ': Escape laat focus niet achter in verborgen inhoud');
}

for (const c of CASES) for (const width of (c.volume ? [320, 390, 768, 1440] : c.pilot ? [320, 390, 1440] : [390, 1440])) {
  test(c.file + ' - ' + width + 'px: beelden, hoofdstukken, toetsenbord en menu', async () => {
    const { context, page, errors, missing } = await session(width);
    try {
      const response = await page.goto(base + '/public/site/' + c.file + '.html', { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      await page.evaluate(() => document.fonts.ready);
      await page.locator('.ds-public-site-header').waitFor();
      await structure(page, c);
      await images(page, c.file);
      await noOverflow(page, c.file);
      await chapterKeyboard(page, c.file);
      await menuEscape(page, c.file);
      assert.deepEqual(errors, [], c.file + ': geen runtimefouten');
      assert.deepEqual(missing, [], c.file + ': geen ontbrekende lokale assets');
    } finally { await context.close(); }
  });
}
for (const c of CASES.filter(row => row.pilot)) test(c.file + ' - 390px zonder JavaScript: echte leesbare inhoud en ankers', async () => {
  const { context, page, missing } = await session(390, false);
  try {
    await page.goto(base + '/public/site/' + c.file + '.html', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await structure(page, c, false); await images(page, c.file); await noOverflow(page, c.file);
    await chapterKeyboard(page, c.file, false);
    if (c.scenario) {
      if (c.volume) await page.locator('#werelddetails > summary').click();
      if(await page.locator('#proberen.ds-volume-dossier').count())await page.locator('#proberen>summary').click();
      assert.match(await page.locator('[data-story-fallback]').innerText(), /demonstratie|voorbeeld/i);
    }
    assert.deepEqual(missing, [], c.file + ': ook zonder runtime laden de lokale assets');
  } finally { await context.close(); }
});
