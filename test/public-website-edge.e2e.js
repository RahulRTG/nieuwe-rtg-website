'use strict';
// One native public Edge. These fixtures never load accounts, call providers,
// mutate application state or replace the original magazine/detail owners.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { laadPlaywright, startBrowser } = require('./helper');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const details = [...['community', 'rtg-pass', 'business-lite', 'business-pass', 'lifestyle-pass'].map(id => '/public/site/passen/' + id + '.html'), ...['livingos', 'travelos', 'workos', 'foundationos'].map(id => '/public/site/werelden/' + id + '.html'), '/public/site/techniek/techniek.html', '/explore/index.html', '/public/site/404.html'];
const edgeSelector = '.ds-public-edge.ds-edge', sheetSelector = edgeSelector + ' .rtg-adaptive-sheet';
let server, browser, base;

test.before(async () => {
  const remote = process.env.RTG_WEBSITE_EDGE_URL;
  if (remote) {
    const approvedLive = process.env.RTG_WEBSITE_EDGE_LIVE === '1' && /^https:\/\/www\.rahultravelgroup\.com\/?$/.test(remote);
    assert.ok(approvedLive || /^https:\/\/[a-f0-9]{8}-rahul-travel-group-www\.rtg-corporate-website\.workers\.dev\/?$/.test(remote), 'alleen een onveranderlijke RTG-preview, of expliciete alleen-lezen controle van de canonieke live website');
    base = new URL(remote).origin;
  } else {
    server = http.createServer((req, res) => {
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
      let route = new URL(req.url, 'http://localhost').pathname;
      if (route === '/') route = '/index.html';
      else if (/^\/(ds|fonts|images|shared|site)\//.test(route)) route = '/public' + route;
      const file = path.resolve(root, '.' + route);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (error, bytes) => {
        res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
        res.end(req.method === 'HEAD' ? '' : error ? 'missing' : bytes);
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
  }
  browser = await startBrowser(laadPlaywright({ eigenDriver: false }));
});
test.after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function fixture(width, route = '/') {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('rtg_lang', 'nl');
    window.websiteOriginal = {};
    const remember = () => {
      for (const [key, selector] of [['footer', 'footer'], ['controls', '.ds-issue-controls'], ['article', '#artikel-interview']]) {
        if (!window.websiteOriginal[key]) window.websiteOriginal[key] = document.querySelector(selector);
      }
    };
    new MutationObserver(remember).observe(document, { childList: true, subtree: true });
  });
  const denied = [];
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base || !['GET', 'HEAD'].includes(request.method()) || /^\/(apps|api)\//.test(url.pathname)) {
      denied.push(request.method() + ' ' + url.href);
      return route.fulfill({ status: 503, body: 'Public Edge proof: account, provider and mutation traffic excluded' });
    }
    return route.continue();
  });
  const page = await context.newPage(), errors = [], missing = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) missing.push(response.url()); });
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.classList.contains('ds-public-edge-page') && document.body.dataset.rtgAdaptiveReady === 'true');
  await page.evaluate(() => document.fonts.ready); await settle(page);
  return { context, page, errors, missing, denied };
}
async function hit(control) {
  return control.evaluate(node => {
    const box = node.getBoundingClientRect();
    return box.width >= 43.9 && box.height >= 43.9 && box.left >= -.5 && box.right <= innerWidth + .5 && box.top >= -.5 && box.bottom <= innerHeight + .5 && node.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  });
}
async function chrome(page, label) {
  assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1, label + ': één canonieke Edge');
  assert.equal(await page.locator(edgeSelector).count(), 1, label + ': gedeelde DS-host');
  const bar = page.locator(edgeSelector + ' .rtg-adaptive-bar.ds-edge__balk');
  const door=page.locator('.ds-public-edge-toggle');
  assert.equal(await bar.isVisible(), false, label + ': standaard geen balk in beeld');
  assert.equal(await door.getAttribute('aria-expanded'),'false');
  assert.equal(await hit(door),true,label + ': kleine lippenknop is bereikbaar en minstens 44px');
  await door.click();await settle(page);
  assert.equal(await bar.isVisible(),true,label + ': expliciete tik opent de echte appbalk');
  const buttons = bar.locator('button.ds-edge__knop');
  assert.equal(await buttons.count(), 5, label + ': vijf native knoppen, geen gekopieerde websitebalk');
  assert.deepEqual(await buttons.evaluateAll(nodes => nodes.map(node => node.dataset.rtgAdaptiveAction)), ['home', 'worlds', 'ai', 'context', 'menu']);
  for (const button of await buttons.all()) assert.equal(await hit(button), true, label + ': native knop binnen scherm en minstens44px: ' + await button.getAttribute('aria-label'));
  await door.click();await settle(page);
  assert.equal(await bar.isVisible(),false,label + ': expliciet sluiten werkt');
  for (const selector of ['.ds-magazine-masthead', '.ds-issue-topline', '.ds-public-site-header', '.world-header', '.explore-header', 'footer']) {
    assert.equal(await page.locator(selector + ':visible').count(), 0, label + ': geen tweede statische chrome: ' + selector);
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + ': geen horizontale documentoverloop');
}
async function barAction(page, action) {
  if(!await page.locator(edgeSelector+' .rtg-adaptive-bar').isVisible()){await page.locator('.ds-public-edge-toggle').click();await settle(page);}
  const button = page.locator(edgeSelector + ' .rtg-adaptive-bar [data-rtg-adaptive-action="' + action + '"]');
  assert.equal(await hit(button), true, action + ': native bediening is bereikbaar');
  await button.focus(); await page.keyboard.press('Enter'); await settle(page);
}
function safeTraffic(denied){
  // Existing i18n can request translations. It remains blocked, never allowed
  // through this proof. No account, provider or other write request is valid.
  assert.deepEqual(denied.filter(request=>request!=='POST https://app.rahultravelgroup.com/api/talen'&&request!=='POST '+base+'/api/talen'),[],'geen account-, provider- of ander mutatieverzoek');
}
async function seek(page, target) {
  const sheet = page.locator(sheetSelector);
  if (!await sheet.locator('.ds-edge-pages').count()) { await target.scrollIntoViewIfNeeded(); assert.equal(await hit(target), true); return; }
  const previous = sheet.locator('[data-edge-page="-1"]'), next = sheet.locator('[data-edge-page="1"]');
  async function turn(button) {
    const before = await sheet.locator('.ds-edge-page-status').innerText();
    await button.click();
    await page.waitForFunction(before => document.querySelector('.ds-edge-page-status').textContent !== before, before); await settle(page);
  }
  for (let index = 0; index < 80 && !await previous.isDisabled(); index++) await turn(previous);
  for (let index = 0; index < 80; index++) {
    if (await hit(target)) return;
    if (await next.isDisabled()) break;
    await turn(next);
  }
  assert.fail('bediening ontbreekt op alle echte Edge-bladen: ' + await target.textContent());
}
async function editionAction(page, label) {
  await barAction(page, 'context');
  const title = await page.evaluate(() => document.body.dataset.magazineView === 'article' ? 'Bij dit verhaal' : 'Op dit blad');
  assert.equal(await page.locator(sheetSelector + ' .rtg-adaptive-sheet-head h2').innerText(), title, 'actiekop volgt het gelezen blad of artikel');
  const button = page.locator(sheetSelector).getByRole('button', { name: label, exact: true });
  await seek(page, button); await button.click(); await settle(page);
}
async function cover(page) {
  await page.waitForFunction(() => document.body.dataset.magazineView === 'cover');
  await settle(page);
  assert.equal(await page.evaluate(() => scrollY), 0);
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 2), 'de editie heeft geen verticale documentscroll');
}
async function escapeToEdge(page) {
  await page.keyboard.press('Escape');
  await page.locator(sheetSelector).waitFor({ state: 'hidden' }); await settle(page);
  assert.equal(await page.evaluate(() => {
    const active = document.activeElement, box = active.getBoundingClientRect();
    return active !== document.body && box.width > 0 && box.height > 0 && active.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  }), true, 'Escape herstelt focus op daadwerkelijk bereikbare bediening');
}

for (const width of [320, 390, 1440]) test('homepage ' + width + 'px: uitsluitend native Edge, originele editieacties, inhoud, Info en zoekartikel', async () => {
  const { context, page, errors, missing, denied } = await fixture(width);
  try {
    await chrome(page, 'homepage'); await cover(page);
    await barAction(page, 'context');
    const sheet = page.locator(sheetSelector), next = sheet.locator('[data-carousel-next]'), previous = sheet.locator('[data-carousel-prev]');
    assert.equal(await page.evaluate(() => document.querySelector('.rtg-adaptive-sheet .ds-issue-controls') === window.websiteOriginal.controls), true, 'de oorspronkelijke bladercontroller verhuist, geen kopie');
    await seek(page, next); await next.click();
    await page.waitForFunction(() => document.querySelector('[data-carousel-status]').textContent.trim() === '2 / 18');
    await barAction(page, 'context');
    await seek(page, previous); await previous.click();
    await page.waitForFunction(() => document.querySelector('[data-carousel-status]').textContent.trim() === '1 / 18');
    await barAction(page, 'context');
    await escapeToEdge(page); await cover(page);
    await editionAction(page, 'Inhoud van deze editie');
    await page.waitForFunction(() => history.state.rtgMagazine.id === 'inhoudsopgave'); await cover(page);
    await editionAction(page, 'Service, informatie en colofon');
    await page.waitForFunction(() => document.body.dataset.magazineView === 'article' && document.getElementById('magazineDetailContent').contains(window.websiteOriginal.footer));
    assert.equal(await page.locator('#magazineDetailContent footer').count(), 1);
    assert.equal(await page.locator('#magazineDetailContent a[href$="/apps/juridisch/privacy.html"]').count(), 1);
    assert.equal(await page.locator('#magazineDetailContent a[href$="/apps/juridisch/voorwaarden.html"]').count(), 1);
    await editionAction(page, 'Terug naar de editie'); await cover(page);
    await editionAction(page, 'Zoek in RTG');
    await page.locator('#commandDialog').waitFor({ state: 'visible' });
    await page.locator('#commandSearch').fill('wie zit achter RTG?');
    await page.locator('#commandResults a[href="#artikel-interview"]').first().click();
    await page.waitForFunction(() => document.getElementById('magazineDetailContent').contains(window.websiteOriginal.article));
    assert.equal(await page.locator('#artikel-interview').count(), 1, 'zoeken opent de oorspronkelijke artikelnode');
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
    await page.waitForFunction(() => scrollY > 100);
    await editionAction(page, 'Terug naar de editie'); await cover(page);
    await barAction(page, 'menu');
    assert.equal(await sheet.locator('#explorePanel .ds-discover-art').count(), 1, 'de bestaande artistieke ingang blijft bestaan');
    assert.equal(await sheet.locator('#explorePanel .ds-discover-routes a').count(), 6);
    for (const label of ['Inhoud van deze editie', 'Zoek in RTG', 'Service, informatie en colofon']) {
      const entry = sheet.getByRole('button', { name: label, exact: true }).last();
      await seek(page, entry); assert.equal(await hit(entry), true, label + ' blijft ook via Menu beschikbaar');
    }
    await escapeToEdge(page); await chrome(page, 'terug uit Menu');
    assert.deepEqual(errors, []); assert.deepEqual(missing, []); safeTraffic(denied);
  } finally { await context.close(); }
});

for (const route of details) test(route + ': dezelfde app-Edge, oorspronkelijke footer uitsluitend onder Info, veilige terugkeer', async () => {
  const { context, page, errors, missing, denied } = await fixture(390, route);
  try {
    await chrome(page, route);
    const original = await page.evaluate(() => ({ exists: !!window.websiteOriginal.footer, links: Array.from(window.websiteOriginal.footer?.querySelectorAll('a') || []).map(link => link.getAttribute('href')) }));
    assert.equal(original.exists, true, 'de oorspronkelijke publicatie-inhoud blijft aanwezig');
    for (let round = 0; round < 2; round++) {
      await barAction(page, 'menu');
      const info = page.locator(sheetSelector + ' [data-public-info]');
      await seek(page, info); await info.click();
      await page.locator(sheetSelector + ' #publicPageInfo').waitFor({ state: 'visible' });
      assert.equal(await page.evaluate(() => document.querySelector('#publicPageInfo footer') === window.websiteOriginal.footer), true, 'Info opent dezelfde footerbron');
      assert.equal(await page.locator('footer').count(), 1, 'geen tweede footer of gekopieerde juridische inhoud');
      assert.deepEqual(await page.locator('#publicPageInfo footer a').evaluateAll(nodes => nodes.map(node => node.getAttribute('href'))), original.links, 'alle oorspronkelijke vervolg- en juridische routes blijven ongewijzigd');
      const logo = page.locator('#publicPageInfo .ds-brand-lockup__image');
      await logo.scrollIntoViewIfNeeded();
      const mark = await logo.evaluate(async node => { await node.decode(); const box = node.getBoundingClientRect(); return { width: box.width, height: box.height, fit: getComputedStyle(node).objectFit, alt: node.alt }; });
      assert.ok(mark.width > 0 && mark.height > 0 && Math.abs(mark.width / mark.height - 1280 / 470) < .01, 'volledige lockup blijft proportioneel zichtbaar in Info');
      assert.equal(mark.fit, 'contain'); assert.equal(mark.alt, 'Rahul Travel Group — EXPERIENCE THE ELITE CLASS');
      await escapeToEdge(page); await chrome(page, route + ': Info gesloten');
    }
    assert.deepEqual(errors, []); assert.deepEqual(missing, []); safeTraffic(denied);
  } finally { await context.close(); }
});
