'use strict';
// Presentation geometry only: static sources, read-only requests, no live providers.
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { laadPlaywright, startBrowser } = require('./helper');
const ROOT = path.resolve(__dirname, '..');
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 1440, height: 1000 }];
const PHOTOS = [
  { id: 'salon-verhaal', side: 'right' },
  { id: 'foundation-verhaal', side: 'left' },
  { id: 'eigen-regie', side: 'right' },
  { id: 'reisverhaal', side: 'left' }
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
      res.writeHead(error ? 404 : 200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(error ? 'Missing static source' : bytes);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await startBrowser(laadPlaywright({ eigenDriver: false }));
});
test.after(async () => {
  if (browser) await browser.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function visit(route, viewport) {
  const context = await browser.newContext({ viewport, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
  await context.route('**/*', route => new URL(route.request().url()).origin === base && ['GET', 'HEAD'].includes(route.request().method())
    ? route.continue() : route.fulfill({ status: 503, body: 'Read-only presentation proof; external providers excluded' }));
  const page = await context.newPage(), errors = [], missing = [];
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) missing.push(response.url());
  });
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.classList.contains('ds-public-edge-page'));
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return { page, context, errors, missing };
}
function near(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) <= 1, message + ': expected ' + expected + ', received ' + actual);
}
async function bounds(locator) {
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
  });
}
async function fullViewport(page, selector, viewport) {
  const rect = await bounds(page.locator(selector));
  near(rect.left, 0, selector + ' reaches the left screen edge');
  near(rect.right, viewport.width, selector + ' reaches the right screen edge');
  near(rect.top, 0, selector + ' starts at the top screen edge');
  near(rect.bottom, viewport.height, selector + ' reaches the bottom screen edge');
  assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).paddingBottom), '0px', 'The collapsed Edge reserves no blank body strip');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Only the native reel scrolls horizontally');
}
async function collapsedEdge(page) {
  const edge = page.locator('.ds-public-edge .rtg-adaptive-edge');
  assert.equal(await edge.count(), 1, 'One native Edge runtime');
  assert.ok(['dock', 'peek'].includes(await edge.getAttribute('data-rtg-adaptive-state')), 'Native Edge starts in a collapsed state');
  assert.equal(await page.locator('.ds-public-edge-toggle').getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('.ds-public-edge-toggle').isVisible(), true, 'The small Edge entrance remains reachable');
  assert.equal(await edge.locator('.rtg-adaptive-bar').isVisible(), false, 'The bar does not open automatically');
  assert.equal(await edge.locator('.rtg-adaptive-sheet').isVisible(), false, 'The sheet does not open automatically');
}
function clean(visit) {
  assert.deepEqual(visit.errors, [], 'No browser errors');
  assert.deepEqual(visit.missing, [], 'All requested presentation assets load');
}
async function showLeaf(page, id) {
  await page.evaluate(id => window.RTGPublicApp.shell.page(id), id);
  await page.waitForFunction(id => {
    const leaf = document.getElementById(id), track = document.getElementById('issueTrack');
    return !document.getElementById('magazineHome').hidden && Math.abs(leaf.getBoundingClientRect().left - track.getBoundingClientRect().left) <= 1;
  }, id);
  await settle(page);
}

for (const viewport of VIEWPORTS) test('full bleed: home and photograph columns at ' + viewport.width + '×' + viewport.height, async () => {
  const state = await visit('/', viewport), { page, context } = state;
  try {
    await page.waitForFunction(() => document.body.dataset.magazineView === 'cover' && !!window.RTGPublicApp);
    await collapsedEdge(page);
    await fullViewport(page, '#issueTrack', viewport);
    for (const photo of PHOTOS) {
      await showLeaf(page, photo.id);
      const leaf = page.locator('#' + photo.id), visual = leaf.locator('.ds-issue-visual'), image = visual.locator('img');
      assert.equal(await leaf.evaluate(element => element.classList.contains('ds-issue-condensed')), false, photo.id + ' displays its real photograph at the target viewport');
      assert.equal(await visual.isVisible(), true, photo.id + ' photograph is visible');
      await image.evaluate(element => element.decode());
      const geometry = await visual.evaluate(element => {
        const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const leaf = element.closest('[data-issue-page]'), style = getComputedStyle(element), questions = leaf.querySelector('.ds-issue-questions');
        return { image: rect(element.querySelector('img')), visual: rect(element), leaf: rect(leaf), copy: rect(leaf.querySelector('.ds-issue-copy')), end: rect(questions || leaf.querySelector('.ds-issue-running')), margins: [style.marginTop, style.marginRight, style.marginBottom, style.marginLeft] };
      });
      assert.deepEqual(geometry.margins, ['0px', '0px', '0px', '0px'], photo.id + ' has no photograph frame');
      assert.ok(geometry.visual.height > 100, photo.id + ' has a substantial visible image pane');
      for (const side of ['left', 'right', 'top', 'bottom']) near(geometry.image[side], geometry.visual[side], photo.id + ' photograph fills its pane at ' + side);
      if (viewport.width < 760) {
        near(geometry.visual.left, geometry.leaf.left, photo.id + ' mobile image touches the left leaf edge');
        near(geometry.visual.right, geometry.leaf.right, photo.id + ' mobile image touches the right leaf edge');
        const first = photo.id === 'foundation-verhaal';
        near(geometry.visual.top, first ? geometry.leaf.top : geometry.copy.bottom, photo.id + ' has no gap before its image');
        near(geometry.visual.bottom, first ? geometry.copy.top : geometry.end.top, photo.id + ' has no gap after its image');
      } else {
        // Desktop spreads have deliberately different column proportions;
        // the photograph still meets the real copy column without a gutter.
        const middle = photo.side === 'left' ? geometry.copy.left : geometry.copy.right;
        near(geometry.visual.left, photo.side === 'left' ? geometry.leaf.left : middle, photo.id + ' begins at its column edge');
        near(geometry.visual.right, photo.side === 'right' ? geometry.leaf.right : middle, photo.id + ' ends at its column edge');
        near(geometry.visual.top, geometry.leaf.top, photo.id + ' touches the top of its row');
        near(geometry.visual.bottom, geometry.end.top, photo.id + ' touches the bottom of its row');
      }
      await fullViewport(page, '#issueTrack', viewport);
    }
    await showLeaf(page, 'interview');
    assert.equal(await page.locator('#interview .ds-issue-portrait img').evaluate(element => getComputedStyle(element).objectFit), 'contain', 'The founder portrait is never cropped to fill its cover');
    await collapsedEdge(page);
    clean(state);
  } finally { await context.close(); }
});

for (const viewport of VIEWPORTS) test('full bleed: complete interview portrait at ' + viewport.width + '×' + viewport.height, async () => {
  const state = await visit('/#artikel-interview', viewport), { page, context } = state;
  try {
    const portrait = page.locator('#magazineDetailContent #artikel-interview .ds-issue-portrait img');
    await portrait.waitFor({ state: 'visible' });
    await portrait.evaluate(element => element.decode());
    const image = await portrait.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight, width: rect.width, height: rect.height, left: rect.left, right: rect.right, fit: getComputedStyle(element).objectFit };
    });
    assert.deepEqual([image.naturalWidth, image.naturalHeight], [960, 1280], 'The original supplied portrait remains intact');
    assert.equal(image.fit, 'contain', 'Reading never crops the portrait');
    assert.ok(Math.abs(image.width / image.height - 3 / 4) < 0.001, 'The portrait renders at its natural 3:4 ratio');
    near(image.left, 0, 'The interview portrait has no outer gutter');
    near(image.right, viewport.width < 760 ? viewport.width : viewport.width / 2, 'The interview portrait fills its mobile page or desktop column');
    await collapsedEdge(page);
    clean(state);
  } finally { await context.close(); }
});

for (const world of ['livingos', 'travelos']) for (const viewport of VIEWPORTS) test('full bleed: ' + world + ' volume at ' + viewport.width + '×' + viewport.height, async () => {
  const state = await visit('/public/site/werelden/' + world + '.html', viewport), { page, context } = state;
  try {
    await collapsedEdge(page);
    await fullViewport(page, '[data-reel-track]', viewport);
    for (const kind of ['art', 'portrait', 'horizon']) {
      const sheet = page.locator('.ds-volume-sheet--' + kind), figure = sheet.locator('.ds-volume-image');
      await sheet.evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'instant' }));
      await settle(page);
      await figure.locator('img').evaluate(element => element.decode());
      const geometry = await figure.evaluate(element => {
        const rect = node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height }; };
        const style = getComputedStyle(element);
        return { figure: rect(element), image: rect(element.querySelector('img')), padding: [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft], fit: getComputedStyle(element.querySelector('img')).objectFit };
      });
      assert.deepEqual(geometry.padding, ['0px', '0px', '0px', '0px'], world + ' ' + kind + ' has no outer image padding');
      assert.ok(geometry.figure.height > 100, world + ' ' + kind + ' has a visible image pane');
      for (const side of ['left', 'right', 'top', 'bottom']) near(geometry.image[side], geometry.figure[side], world + ' ' + kind + ' fills its image pane at ' + side);
      if (kind === 'art') assert.equal(geometry.fit, 'contain', 'The complete brand artwork retains its own proportions');
      await fullViewport(page, '[data-reel-track]', viewport);
    }
    await collapsedEdge(page);
    clean(state);
  } finally { await context.close(); }
});
