'use strict';
// Public-only quiet presence: genuine content scroll and elapsed inactivity
// return the painted deck to its transparent doorway. No account/provider IO.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { laadPlaywright, startBrowser, letOpFouten } = require('./helper');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const edge = '.ds-public-edge.ds-edge', host = edge + ' .rtg-adaptive-edge';
const bar = edge + ' .rtg-adaptive-bar', door = edge + ' .ds-public-edge-toggle', sheet = edge + ' .rtg-adaptive-sheet';
const routes = [{ label: 'homepage', url: '/', track: '#issueTrack' }, { label: 'LivingOS', url: '/public/site/werelden/livingos.html', track: '#wereldbladen' }];
let server, browser, base;

test.before(async () => {
  const remote = process.env.RTG_QUIET_EDGE_URL;
  if (remote) {
    const live = process.env.RTG_QUIET_EDGE_LIVE === '1' && /^https:\/\/www\.rahultravelgroup\.com\/?$/.test(remote);
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

async function fixture(width, route = '/') {
  const context = await browser.newContext({ viewport: { width, height: 844 }, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
  const denied = [], errors = [], missing = [];
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    // Existing language middleware may ask for translation; never execute it.
    if (request.method() === 'POST' && url.pathname === '/api/talen' && [base, 'https://app.rahultravelgroup.com'].includes(url.origin)) return route.fulfill({ status: 503, body: 'Translation disabled in read-only proof.' });
    if (url.origin !== base || !['GET', 'HEAD'].includes(request.method()) || /^\/(apps|api)\//.test(url.pathname)) {
      denied.push(request.method() + ' ' + request.url());
      return route.fulfill({ status: 503, body: 'Quiet public Edge proof: account, provider and mutation traffic blocked.' });
    }
    return route.continue();
  });
  const page = await context.newPage(); page.setDefaultTimeout(10000);
  letOpFouten(page, errors);
  page.on('response', response => { if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) missing.push(response.url()); });
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.classList.contains('ds-public-edge-page') && document.body.dataset.rtgAdaptiveReady === 'true');
  await page.locator(door).waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await page.clock.install();
  await page.clock.runFor(100);
  return { context, page, denied, errors, missing };
}
function clean(result) { assert.deepEqual(result.errors, []); assert.deepEqual(result.missing, []); assert.deepEqual(result.denied, []); }
async function quiet(page) {
  assert.equal(await page.locator(door).getAttribute('aria-expanded'), 'false', 'de openbare Edge keert terug naar gesloten');
  assert.equal(await page.locator(door).getAttribute('aria-label'), 'Edge openen');
  assert.equal(await page.locator(bar).isVisible(), false, 'de geschilderde balk blijft niet staan');
  assert.equal(await page.locator(sheet).isVisible(), false);
  const paint = await page.locator(door).evaluate(node => {
    const s = getComputedStyle(node), r = node.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d'); context.fillStyle = s.backgroundColor; context.fillRect(0, 0, 1, 1);
    return { alpha: context.getImageData(0, 0, 1, 1).data[3], image: s.backgroundImage, shadow: s.boxShadow, border: s.borderTopWidth, reachable: r.width >= 44 && r.height >= 44 && node.contains(hit) };
  });
  assert.equal(paint.alpha, 0, 'gesloten lippen hebben een werkelijk transparante achtergrond');
  assert.equal(paint.image, 'none'); assert.equal(paint.shadow, 'none'); assert.equal(parseFloat(paint.border), 0);
  assert.equal(paint.reachable, true, 'de transparante lippen blijven een bereikbaar doel van minstens44px');
  const image = page.locator(door + ' img'); await image.evaluate(node => node.decode());
  assert.match(await image.getAttribute('src'), /\/brand\/rtg-edge-lips\.webp$/);
  const transparent = await image.evaluate(node => {
    const canvas = document.createElement('canvas'); canvas.width = node.naturalWidth; canvas.height = node.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(node, 0, 0);
    return [context.getImageData(1, 1, 1, 1).data[3], context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data[3]];
  });
  assert.ok(transparent.every(alpha => alpha <= 2), 'de afbeelding zelf is transparant in hoek en mondopening');
}
async function pointerOpen(page) {
  await page.locator(door).click();
  await page.clock.runFor(100);
  assert.equal(await page.locator(host).getAttribute('data-rtg-adaptive-state'), 'deck');
  assert.equal(await page.locator(bar).isVisible(), true);
  // A pointer click can leave focus on the opener. That must not pin the deck.
  await page.mouse.move(12, 12);
}
async function horizontalScroll(page, selector) {
  const track = page.locator(selector), before = await track.evaluate(node => node.scrollLeft);
  await expectContentScroll(page, selector);
  const rect = await track.boundingBox();
  await page.mouse.move(rect.x + rect.width / 2, rect.y + Math.min(rect.height / 2, 280));
  await page.mouse.wheel(Math.max(500, rect.width), 0);
  await page.clock.runFor(350);
  await deliveredContentScroll(page);
  await page.waitForFunction(({ selector, before }) => Math.abs(document.querySelector(selector).scrollLeft - before) > 20, { selector, before });
  assert.ok(Math.abs(await track.evaluate(node => node.scrollLeft) - before) > 20, 'een echte horizontale scroll heeft het originele magazine verplaatst');
}
async function expectContentScroll(page, selector) {
  await page.evaluate(selector => {
    window.__quietContentScroll = new Promise(resolve => (selector ? document.querySelector(selector) : document).addEventListener('scroll', () => resolve(true), { once: true }));
  }, selector);
}
async function deliveredContentScroll(page) {
  // WebKit can expose the compositor's new position before dispatching scroll.
  // Await the actual event, not four seconds of idle (which could hide a bug).
  let timeout;
  try {
    await Promise.race([page.evaluate(() => window.__quietContentScroll), new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('echte scroll niet binnen 1 seconde afgeleverd')), 1000); })]);
    await page.clock.runFor(50);
  } finally { clearTimeout(timeout); }
}

for (const width of [390, 1440]) for (const route of routes) {
  test(route.label + ' ' + width + 'px: na vier seconden rust verdwijnt de balk; horizontaal scrollen sluit direct en blijft gesloten', async () => {
    const result = await fixture(width, route.url), { context, page } = result;
    try {
      await quiet(page); await pointerOpen(page);
      await page.clock.runFor(2000);
      assert.equal(await page.locator(bar).isVisible(), true, 'de bezoeker krijgt tijd om een actie te kiezen');
      await page.clock.runFor(3100); await quiet(page);
      await pointerOpen(page); await horizontalScroll(page, route.track);
      await quiet(page);
      await page.clock.runFor(5500); await quiet(page);
      assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1, 'geen tweede navigatie of runtime');
      clean(result);
    } finally { await context.close(); }
  });

  test(route.label + ' ' + width + 'px: aanwijzerbeweging verlengt de kiestijd; toetsenbordfocus en een geopend menu blijven bedienbaar', async () => {
    const result = await fixture(width, route.url), { context, page } = result;
    try {
      await pointerOpen(page);
      await page.locator(bar).hover(); await page.clock.runFor(2500);
      const bounds = await page.locator(bar).boundingBox();
      await page.mouse.move(bounds.x + bounds.width / 2 + 12, bounds.y + bounds.height / 2);
      await page.clock.runFor(2000);
      assert.equal(await page.locator(bar).isVisible(), true, 'echte aanwijzerbeweging begint de vier seconden kiestijd opnieuw');
      await page.clock.runFor(2500); await quiet(page);
      await page.locator(door).focus(); await page.keyboard.press('Enter');
      const first = page.locator(bar + ' button').first(); await first.focus();
      await page.keyboard.press('ArrowRight'); await page.mouse.move(12, 12);
      await page.clock.runFor(5500);
      assert.equal(await page.locator(bar).isVisible(), true, 'toetsenbordbediening wordt niet stil verborgen');
      assert.equal(await first.evaluate(node => document.activeElement === node), true, 'toetsenbordfocus blijft op de bestaande knop');
      await page.locator(bar + ' [data-rtg-adaptive-action="menu"]').click();
      await page.locator(sheet).waitFor({ state: 'visible' });
      await page.mouse.move(12, 12); await page.clock.runFor(5500);
      assert.equal(await page.locator(host).getAttribute('data-rtg-adaptive-state'), 'expanded', 'een geopend menu sluit niet door rust');
      // Scroll the real content, not a synthetic dispatched scroll event.
      await page.locator(route.track).evaluate(node => node.scrollBy({ left: node.clientWidth, behavior: 'instant' }));
      await page.clock.runFor(500);
      assert.equal(await page.locator(sheet).isVisible(), true, 'achtergrondscroll onderbreekt geen geopend menu');
      await page.keyboard.press('Escape'); await page.clock.runFor(50); await quiet(page);
      clean(result);
    } finally { await context.close(); }
  });
}

for (const width of [390, 1440]) {
  test('artikel ' + width + 'px: echte verticale scroll sluit onmiddellijk en heropent niet wanneer het lezen stopt', async () => {
    const result = await fixture(width, '/#artikel-code'), { context, page } = result;
    try {
      assert.equal(await page.locator('body').getAttribute('data-magazine-view'), 'article');
      await pointerOpen(page);
      const before = await page.evaluate(() => scrollY);
      await expectContentScroll(page, null);
      await page.mouse.move(width / 2, 220); await page.mouse.wheel(0, 500);
      await page.clock.runFor(350); await deliveredContentScroll(page); await page.waitForFunction(before => scrollY > before + 20, before);
      await quiet(page); await page.clock.runFor(5500); await quiet(page);
      clean(result);
    } finally { await context.close(); }
  });

  test('originele Rahul-invoer ' + width + 'px: typen en focus worden niet onderbroken door de rusttimer', async () => {
    const result = await fixture(width, '/#rahul'), { context, page } = result;
    try {
      const input = page.locator('#intent'); await input.waitFor({ state: 'visible' });
      await pointerOpen(page); await input.focus();
      await page.keyboard.type('Een rustige avond'); await page.clock.runFor(5500);
      assert.equal(await input.evaluate(node => document.activeElement === node), true, 'de echte invoer behoudt focus');
      assert.equal(await input.inputValue(), 'Een rustige avond');
      assert.equal(await page.locator(bar).isVisible(), true, 'actieve invoer wordt niet onderbroken door automatisch sluiten');
      await page.keyboard.type(' met vrienden');
      assert.equal(await input.inputValue(), 'Een rustige avond met vrienden');
      clean(result);
    } finally { await context.close(); }
  });
}
