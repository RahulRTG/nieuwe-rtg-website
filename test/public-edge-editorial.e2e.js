'use strict';
// Public editorial chrome follows the original reading owner. No account,
// provider or mutation traffic is permitted in this browser proof.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { laadPlaywright, startBrowser } = require('./helper');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const edge = '.ds-public-edge.ds-edge', host = edge + ' .rtg-adaptive-edge';
const bar = edge + ' .rtg-adaptive-bar', door = edge + ' .ds-public-edge-toggle', sheet = edge + ' .rtg-adaptive-sheet';
let server, browser, base;

test.before(async () => {
  const remote = process.env.RTG_EDITORIAL_EDGE_URL;
  if (remote) {
    const live = process.env.RTG_EDITORIAL_EDGE_LIVE === '1' && /^https:\/\/www\.rahultravelgroup\.com\/?$/.test(remote);
    assert.ok(live || /^https:\/\/[a-f0-9]{8}-rahul-travel-group-www\.rtg-corporate-website\.workers\.dev\/?$/.test(remote), 'alleen een onveranderlijke preview of expliciete alleen-lezen livecontrole');
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
  const pw = laadPlaywright({ eigenDriver: false });
  assert.ok(pw, 'Playwright is verplicht; geen stil overgeslagen browserbewijs');
  browser = await startBrowser(pw);
});
test.after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function fixture(width, route = '/') {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('rtg_lang', 'nl');
    window.editorialOriginal = {};
    new MutationObserver(() => {
      for (const id of ['artikel-reizen', 'artikel-code']) if (!window.editorialOriginal[id]) window.editorialOriginal[id] = document.getElementById(id);
    }).observe(document, { childList: true, subtree: true });
  });
  const denied = [], errors = [], missing = [];
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname === '/api/talen' && [base, 'https://app.rahultravelgroup.com'].includes(url.origin)) return route.fulfill({ status: 503, body: 'Translation disabled in read-only proof.' });
    if (url.origin !== base || !['GET', 'HEAD'].includes(request.method()) || /^\/(apps|api)\//.test(url.pathname)) {
      denied.push(request.method() + ' ' + request.url());
      return route.fulfill({ status: 503, body: 'Editorial public Edge proof: account, provider and mutation traffic blocked.' });
    }
    return route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) missing.push(response.url()); });
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.classList.contains('ds-public-edge-page') && document.body.dataset.rtgAdaptiveReady === 'true' && !!document.querySelector('.ds-public-edge[data-edge-reading]'));
  await page.evaluate(() => document.fonts.ready); await settle(page);
  return { context, page, denied, errors, missing };
}
function clean(result) { assert.deepEqual(result.errors, []); assert.deepEqual(result.missing, []); assert.deepEqual(result.denied, []); }
const normalized = value => value.replace(/\s+/g, ' ').trim();
async function hit(locator) {
  return locator.evaluate(node => {
    const r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width >= 43.9 && r.height >= 43.9 && r.left >= -.5 && r.right <= innerWidth + .5 && r.top >= -.5 && r.bottom <= innerHeight + .5 && node.contains(hit);
  });
}
async function quiet(page) {
  assert.equal(await page.locator(door).getAttribute('aria-expanded'), 'false', 'contextverandering opent de gesloten Edge niet');
  assert.equal(await page.locator(bar).isVisible(), false);
  assert.equal(await page.locator(door).evaluate(node => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)', 'de gesloten ingang blijft transparant');
}
async function readingScrollSettled(page) {
  // Native wheel inertia and scroll-snap can continue after the first event.
  // Opening during that movement correctly closes the quiet Edge again. Wait
  // for actual stable owner positions, not a synthetic scroll or a retry click.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const tracks = Array.from(document.querySelectorAll('#issueTrack,[data-reel-track]')).filter(node => node.getClientRects().length);
    if (!tracks.length) return resolve();
    const started = performance.now(); let stable = started;
    let positions = tracks.map(node => [node.scrollLeft, node.scrollTop]);
    const changed = () => { stable = performance.now(); };
    tracks.forEach(node => node.addEventListener('scroll', changed, { passive: true }));
    function finish(error) { tracks.forEach(node => node.removeEventListener('scroll', changed)); if (error) reject(error); else resolve(); }
    function sample(now) {
      const next = tracks.map(node => [node.scrollLeft, node.scrollTop]);
      if (next.some((position, i) => position[0] !== positions[i][0] || position[1] !== positions[i][1])) stable = now;
      positions = next;
      if (now - stable >= 220) return finish();
      if (now - started > 4000) return finish(new Error('de oorspronkelijke leesbladen blijven bewegen'));
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  await settle(page);
}
async function openBar(page) {
  await readingScrollSettled(page);
  if (!await page.locator(bar).isVisible()) { await page.locator(door).click(); await settle(page); }
  assert.equal(await page.locator(bar).isVisible(), true);
}
async function action(page, name) {
  await openBar(page);
  const button = page.locator(bar + ' [data-rtg-adaptive-action="' + name + '"]');
  assert.equal(await hit(button), true, name + ': oorspronkelijke knop blijft bereikbaar');
  await button.focus(); await page.keyboard.press('Enter'); await settle(page);
}
async function waitReading(page, id) {
  await page.waitForFunction(({ edge, id }) => document.querySelector(edge).dataset.edgeReading === id, { edge, id });
  await settle(page);
}
async function source(page, selector, titleSelector) {
  return page.locator(selector).evaluate((node, titleSelector) => ({
    title: node.dataset.issueLabel || (node.querySelector(titleSelector || 'h1,h2') || node).innerText.replace(/\s+/g, ' ').trim(),
    image: node.querySelector('img[src]')?.src || '',
    links: Array.from(node.querySelectorAll('a[href]')).map(a => a.getAttribute('href'))
  }), titleSelector);
}
async function sameContext(page, source, width) {
  const caption = page.locator(edge + ' .ds-edge-reading-caption');
  assert.ok(await caption.count(), 'de Edge heeft een contextbijschrift');
  assert.ok(normalized(await caption.first().textContent()).includes(normalized(source.title)), 'bijschrift komt van het echte huidige blad: ' + source.title);
  if (source.image) {
    const art = page.locator(width >= 1100 ? edge + ' .ds-edge-reading-art' : edge + ' .ds-edge-gallery img');
    assert.ok(await art.count(), 'de redactionele context heeft beeld');
    assert.equal(await art.first().evaluate(node => node.src), source.image, 'contextbeeld is de oorspronkelijke pagina-afbeelding, geen generiek tabbeeld');
  }
}
async function seek(page, target) {
  const pager = page.locator(sheet + ' .ds-edge-pages');
  if (!await pager.count()) { await target.scrollIntoViewIfNeeded(); assert.equal(await hit(target), true); return; }
  const previous = page.locator(sheet + ' [data-edge-page="-1"]'), next = page.locator(sheet + ' [data-edge-page="1"]');
  async function turn(button) {
    const before = await page.locator(sheet + ' .ds-edge-page-status').innerText();
    await button.click();
    await page.waitForFunction(before => document.querySelector('.ds-edge-page-status').textContent !== before, before); await settle(page);
  }
  for (let i = 0; i < 80 && !await previous.isDisabled(); i++) await turn(previous);
  for (let i = 0; i < 80; i++) {
    if (await hit(target)) return;
    if (await next.isDisabled()) break;
    await turn(next);
  }
  assert.fail('contextactie is niet bereikbaar op enig menublad: ' + await target.textContent());
}
async function realHorizontalScroll(page, selector) {
  const track = page.locator(selector), before = await track.evaluate(node => node.scrollLeft), box = await track.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 280));
  await page.mouse.wheel(Math.max(500, box.width), 0);
  await page.waitForFunction(({ selector, before }) => Math.abs(document.querySelector(selector).scrollLeft - before) > 20, { selector, before });
  await readingScrollSettled(page);
}

for (const width of [390, 1440]) {
  test('editoriale Edge ' + width + 'px: opgewaardeerde iconen zonder rustlabels, echte bladcontext en oorspronkelijke artikelroute', async () => {
    const result = await fixture(width), { page, context } = result;
    try {
      await quiet(page); await openBar(page);
      const buttons = page.locator(bar + ' .rtg-adaptive-item');
      assert.equal(await buttons.count(), 5, 'één native balk met vijf eigen knoppen');
      for (const button of await buttons.all()) {
        assert.equal(await hit(button), true, 'iedere knop behoudt minimaal 44px en bereikbaarheid');
        const name = await button.getAttribute('aria-label'); assert.ok(name && name.trim(), 'icoon behoudt zijn toegankelijke naam');
        assert.equal(await button.getAttribute('title'), name, 'tooltip benoemt het icoon zonder permanente tekst');
        assert.equal(await button.locator('.rtg-adaptive-item-copy').isVisible(), false, 'labels verdwijnen in rust');
        if (await button.getAttribute('data-rtg-adaptive-action') === 'ai') assert.equal(await button.locator('.ds-edge-painted-lips').count(), 1, 'het goedgekeurde lippenmerk blijft bestaan');
        else assert.equal(await button.locator('svg[data-editorial-glyph]').count(), 1, 'native knop draagt het nieuwe redactionele pictogram');
      }
      await page.locator(door).click(); await realHorizontalScroll(page, '#issueTrack');
      const swiped = await page.locator(edge).getAttribute('data-edge-reading');
      assert.notEqual(swiped, 'editie', 'een echte horizontale leesbeweging ververst de Edge');
      await quiet(page);
      await page.evaluate(() => window.RTGPublicApp.shell.page('reisverhaal'));
      await waitReading(page, 'reisverhaal'); await quiet(page);
      const travel = await source(page, '#reisverhaal');
      await action(page, 'context'); await sameContext(page, travel, width);
      const read = page.locator(sheet + ' .ds-edge-reading-actions a[href="#artikel-reizen"], ' + sheet + ' .ds-edge-reading-links a[href="#artikel-reizen"]').filter({ visible: true }).first();
      await seek(page, read); await read.click();
      await waitReading(page, 'artikel-reizen');
      assert.equal(await page.evaluate(() => document.getElementById('magazineDetailContent').contains(window.editorialOriginal['artikel-reizen'])), true, 'de oorspronkelijke artikelnode opent; geen gekopieerd artikel');
      await quiet(page);
      await page.evaluate(() => window.RTGPublicApp.shell.back());
      await waitReading(page, 'reisverhaal'); await quiet(page);
      assert.equal(await page.locator('body').getAttribute('data-magazine-view'), 'cover');
      assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1);
      clean(result);
    } finally { await context.close(); }
  });

  test('services ' + width + 'px: Connect, Media en Account bewaren hun eigen acties naast de huidige inhoud', async () => {
    const result = await fixture(width), { page, context } = result;
    try {
      await page.evaluate(() => window.RTGPublicApp.shell.page('reisverhaal')); await waitReading(page, 'reisverhaal');
      const travel = await source(page, '#reisverhaal'); await action(page, 'context');
      const modes = [['connect', ['Open berichten', 'Open uw mensen']], ['media', ['Open RTG Media', 'Open RTG Sound']], ['account', ['Open uw account', 'Privacy en veiligheid', 'Uw gegevens']]];
      for (const [mode, labels] of modes) {
        const tab = page.locator(sheet + ' [data-rtg-adaptive-mode="' + mode + '"]'); await tab.click(); await settle(page);
        assert.equal(await tab.getAttribute('aria-pressed'), 'true');
        await sameContext(page, travel, width);
        const service = page.locator(sheet + ' .rtg-adaptive-service');
        const names = await service.locator('.rtg-adaptive-service-action').evaluateAll(nodes => nodes.map(node => {
          const copy = node.cloneNode(true); copy.querySelectorAll('[aria-hidden="true"]').forEach(hidden => hidden.remove());
          return copy.textContent.replace(/\s+/g, ' ').trim();
        }));
        assert.deepEqual(names, labels, 'geen nieuwe nep-dienst of vervangen native handeling');
        for (const label of labels) { const button = service.getByRole('button', { name: label, exact: true }); await seek(page, button); assert.equal(await hit(button), true); }
        assert.equal(await page.locator(sheet + ' .ds-edge-reading-links a[href="#artikel-reizen"]').count(), 1, mode + ': huidige artikel blijft als echte vervolgroute aanwezig');
      }
      clean(result);
    } finally { await context.close(); }
  });

  test('contextzoeken ' + width + 'px: de bestaande zoekdialoog vindt het echte reisartikel en sluit terug naar transparante rust', async () => {
    const result = await fixture(width), { page, context } = result;
    try {
      await page.evaluate(() => window.RTGPublicApp.shell.page('reisverhaal')); await waitReading(page, 'reisverhaal');
      const articleTitle = normalized(await page.locator('#artikel-reizen h2').first().textContent());
      await action(page, 'context');
      const search = page.locator(sheet + ' .ds-edge-reading-actions').getByRole('button', { name: 'Zoek bij dit verhaal', exact: true });
      await seek(page, search); await search.click();
      await page.locator('#commandDialog').waitFor({ state: 'visible' });
      assert.equal(normalized(await page.locator('#commandSearch').inputValue()), articleTitle, 'zoekopdracht gebruikt de echte geïndexeerde artikelkop');
      const resultLink = page.locator('#commandResults a[href="#artikel-reizen"]').first();
      await resultLink.waitFor({ state: 'visible' });
      assert.equal(await page.locator('#commandDialog').count(), 1, 'geen tweede zoekscherm of dienst');
      // Chromium gives a focused type=search field the first Escape to clear
      // its value. Test modal dismissal from a real result, not that native
      // input-clearing shortcut, which differs between browser engines.
      await resultLink.focus();
      assert.equal(await resultLink.evaluate(node => document.activeElement === node), true, 'de echte zoekuitkomst heeft toetsenbordfocus');
      await page.keyboard.press('Escape'); await page.locator('#commandDialog').waitFor({ state: 'hidden' });
      await settle(page); await quiet(page);
      assert.equal(await page.locator(edge).getAttribute('data-edge-reading'), 'reisverhaal', 'zoeken verandert niet stilzwijgend het gelezen blad');
      clean(result);
    } finally { await context.close(); }
  });

  test('LivingOS ' + width + 'px: de echte horizontale folio bepaalt context, afbeelding en vervolgactie', async () => {
    const result = await fixture(width, '/public/site/werelden/livingos.html'), { page, context } = result;
    try {
      const first = await page.locator(edge).getAttribute('data-edge-reading'); assert.ok(first);
      await quiet(page); await realHorizontalScroll(page, '#wereldbladen');
      await page.waitForFunction(({ edge, first }) => document.querySelector(edge).dataset.edgeReading !== first, { edge, first });
      await quiet(page);
      const current = await page.locator('#wereldbladen').evaluate(track => {
        const box = track.getBoundingClientRect(), middle = box.left + box.width / 2;
        return Array.from(track.querySelectorAll('[data-reel-page]')).reduce((best, node) => {
          const r = node.getBoundingClientRect(), distance = Math.abs(r.left + r.width / 2 - middle);
          return !best || distance < best.distance ? { distance, title: node.querySelector('h1,h2').innerText.replace(/\s+/g, ' ').trim(), image: node.querySelector('img').src, link: node.querySelector('a[href]').getAttribute('href') } : best;
        }, null);
      });
      await action(page, 'context'); await sameContext(page, current, width);
      const entries = page.locator(sheet + ' .ds-edge-reading-actions a[href], ' + sheet + ' .ds-edge-reading-links a[href]');
      assert.ok((await entries.evaluateAll(nodes => nodes.map(node => node.getAttribute('href')))).includes(current.link), 'vervolgactie is ontleend aan het daadwerkelijk gelezen blad');
      assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1);
      clean(result);
    } finally { await context.close(); }
  });

  test('dieplink ' + width + 'px: artikelcontext klopt onmiddellijk en na herladen zonder nieuwe pagina-eigenaar', async () => {
    const result = await fixture(width, '/#artikel-code'), { page, context } = result;
    try {
      for (let round = 0; round < 2; round++) {
        if (round) { await page.reload({ waitUntil: 'networkidle' }); await settle(page); }
        await waitReading(page, 'artikel-code'); await quiet(page);
        assert.equal(await page.locator('body').getAttribute('data-magazine-view'), 'article');
        assert.equal(await page.evaluate(() => document.getElementById('magazineDetailContent').contains(window.editorialOriginal['artikel-code'])), true);
        const title = await page.locator('#magazineDetailTitle').textContent();
        await action(page, 'context');
        assert.ok(normalized(await page.locator(edge + ' .ds-edge-reading-caption').first().textContent()).includes(normalized(title)), 'direct geopende artikelnaam verschijnt in de Edge');
        await page.keyboard.press('Escape'); await settle(page); await quiet(page);
      }
      clean(result);
    } finally { await context.close(); }
  });

  test('focus ' + width + 'px: echte contextverversing laat de actieve native serviceknop en toetsenbordfocus intact', async () => {
    const result = await fixture(width), { page, context } = result;
    try {
      await page.evaluate(() => window.RTGPublicApp.shell.page('reisverhaal')); await waitReading(page, 'reisverhaal');
      await action(page, 'context'); await page.locator(sheet + ' [data-rtg-adaptive-mode="connect"]').click(); await settle(page);
      const button = page.locator(sheet + ' .rtg-adaptive-service').getByRole('button', { name: 'Open berichten', exact: true });
      await seek(page, button); await button.focus(); await page.keyboard.press('ArrowRight');
      await button.evaluate(node => { window.editorialFocused = node; });
      // Scroll the original owner, rather than emitting a fake context event.
      // The open service sheet must not be reconstructed by this read update.
      await page.locator('#issueTrack').evaluate(track => track.scrollBy({ left: track.clientWidth, behavior: 'instant' }));
      await page.waitForFunction(({ edge }) => document.querySelector(edge).dataset.edgeReading !== 'reisverhaal', { edge });
      await settle(page);
      assert.equal(await page.evaluate(() => window.editorialFocused.isConnected && document.activeElement === window.editorialFocused), true, 'dezelfde serviceknop en focus blijven behouden');
      assert.equal(await page.locator(host).getAttribute('data-rtg-adaptive-state'), 'expanded');
      assert.equal(await page.locator(sheet + ' [data-rtg-adaptive-mode="connect"]').getAttribute('aria-pressed'), 'true');
      await page.keyboard.press('Escape'); await settle(page); await quiet(page);
      clean(result);
    } finally { await context.close(); }
  });

  test('geopende acties ' + width + 'px: nieuwe leescontext ververst de vervolglinks zonder native bediening of focus te vervangen', async () => {
    const result = await fixture(width), { page, context } = result;
    try {
      await page.evaluate(() => window.RTGPublicApp.shell.page('reisverhaal')); await waitReading(page, 'reisverhaal');
      await action(page, 'context');
      const panel = page.locator(sheet + ' .pp-menu-panel'), original = panel.getByRole('button', { name: 'Inhoud van deze editie', exact: true });
      await seek(page, original); await original.focus(); await page.keyboard.press('ArrowRight');
      await original.evaluate(node => { window.editorialActionFocused = node; });
      // Move the original magazine to a different real visual/article while
      // its contextual actions are open; do not call a test-only refresh API.
      await page.locator('#issueTrack').evaluate(track => {
        const bounds = track.getBoundingClientRect(), next = document.getElementById('goedeleven').getBoundingClientRect();
        track.scrollBy({ left: next.left + next.width / 2 - (bounds.left + bounds.width / 2), behavior: 'instant' });
      });
      await waitReading(page, 'goedeleven'); await readingScrollSettled(page);
      const life = await source(page, '#goedeleven'); await sameContext(page, life, width);
      assert.equal(await page.locator(host).getAttribute('data-rtg-adaptive-state'), 'expanded', 'de geopende acties blijven open');
      assert.equal(await page.evaluate(() => window.editorialActionFocused.isConnected && document.activeElement === window.editorialActionFocused), true, 'dezelfde native actie houdt toetsenbordfocus');
      assert.equal(await panel.locator('.ds-edge-reading-actions a[href="#artikel-reizen"]').count(), 0, 'het vorige reisartikel blijft niet als verouderde actie staan');
      const read = panel.locator('.ds-edge-reading-actions a[href="#artikel-leven"]');
      assert.equal(await read.count(), 1, 'het nieuwe blad levert precies één echte essayroute');
      await seek(page, read); await read.click(); await waitReading(page, 'artikel-leven');
      assert.equal(await page.locator('body').getAttribute('data-magazine-view'), 'article');
      await quiet(page); clean(result);
    } finally { await context.close(); }
  });
}
