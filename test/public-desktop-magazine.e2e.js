'use strict';
// Desktop composition and mobile non-regression only. No accounts or real providers.
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { laadPlaywright, startBrowser, letOpFouten } = require('./helper');
const ROOT = path.resolve(__dirname, '..');
// Optional historical comparison: pass the immutable reviewed asset directory.
// Regular CI still runs every desktop check without a host-specific /tmp path.
const FROZEN = process.env.RTG_DESKTOP_MOBILE_BASELINE ? path.resolve(process.env.RTG_DESKTOP_MOBILE_BASELINE) : null;
const PAGES = ['editie', 'inhoudsopgave', 'interview', 'bedoeling', 'reisverhaal', 'reisnotities', 'goedeleven', 'salon-verhaal', 'ondernemen', 'foundation-verhaal', 'atelier', 'werelden-gids', 'code', 'vertrouwen', 'eigen-regie', 'lid-worden', 'service-gids', 'tot-ziens'];
const STORIES = [
  ['interview', 'artikel-interview'], ['reisverhaal', 'artikel-reizen'],
  ['goedeleven', 'artikel-leven'], ['salon-verhaal', 'artikel-leven'],
  ['foundation-verhaal', 'artikel-foundation'], ['code', 'artikel-code']
];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const servers = [];
let browser, base, frozenBase;

async function staticOrigin(root) {
  const server = http.createServer((request, response) => {
    let route = new URL(request.url, 'http://localhost').pathname;
    if (route === '/') route = '/index.html';
    else if (/^\/(ds|fonts|images|shared|site)\//.test(route)) route = '/public' + route;
    const file = path.resolve(root, '.' + route);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403); return response.end(); }
    fs.readFile(file, (error, bytes) => {
      response.writeHead(error ? 404 : 200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      response.end(error ? 'Missing static presentation source' : bytes);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  servers.push(server);
  return 'http://127.0.0.1:' + server.address().port;
}

test.before(async () => {
  if (FROZEN) assert.ok(fs.existsSync(path.join(FROZEN, 'index.html')), 'The supplied immutable, previously reviewed mobile baseline exists');
  base = await staticOrigin(ROOT);
  if (FROZEN) frozenBase = await staticOrigin(FROZEN);
  browser = await startBrowser(laadPlaywright({ eigenDriver: false }));
});
test.after(async () => {
  if (browser) await browser.close();
  await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve))));
});

async function settle(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function visit(origin, viewport) {
  const context = await browser.newContext({ viewport, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
  await context.route('**/*', route => new URL(route.request().url()).origin === origin && ['GET', 'HEAD'].includes(route.request().method())
    ? route.continue() : route.fulfill({ status: 503, body: 'Read-only presentation proof; external providers excluded' }));
  const page = await context.newPage(), errors = [], missing = [];
  page.setDefaultTimeout(15000);
  letOpFouten(page, errors);
  page.on('response', response => {
    if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) missing.push(response.url());
  });
  await page.goto(origin + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.RTGPublicApp && document.body.classList.contains('ds-public-edge-page'));
  await page.evaluate(() => document.fonts.ready);
  await settle(page);
  return { context, page, errors, missing };
}
async function leaf(page, id) {
  await page.evaluate(id => window.RTGPublicApp.shell.page(id), id);
  await page.waitForFunction(({ id, number }) => {
    const track = document.getElementById('issueTrack'), sheet = document.getElementById(id);
    return !document.getElementById('magazineHome').hidden && Math.abs(sheet.getBoundingClientRect().left - track.getBoundingClientRect().left) <= 1 && document.querySelector('[data-carousel-status]').textContent.trim() === number + ' / 18';
  }, { id, number: PAGES.indexOf(id) + 1 });
  await page.waitForFunction(id => Array.from(document.querySelectorAll('#' + id + ' img')).every(image => image.complete && image.naturalWidth > 0), id);
  await page.locator('#' + id + ' img').evaluateAll(images => Promise.all(images.map(async image => {
    // WebKit can abort a decode while the carousel promotes a lazy image.
    // Retry that transition only; broken images and other errors still fail.
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await image.decode(); return; }
      catch (error) {
        if (attempt === 2 || error.name !== 'EncodingError' || !/Aborted by source change/.test(error.message)) throw error;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      }
    }
  })));
  await settle(page);
}
async function rect(locator) {
  return locator.evaluate(element => {
    const r = element.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
  });
}
function near(actual, expected, label, tolerance = 1) {
  assert.ok(Math.abs(actual - expected) <= tolerance, label + ': expected ' + expected + ', got ' + actual);
}
function separate(a, b, label) {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  assert.ok(width <= 1 || height <= 1, label + ' overlap: ' + width + ' × ' + height);
}
async function closedEdge(page) {
  const host = page.locator('.ds-public-edge .rtg-adaptive-edge');
  assert.equal(await host.count(), 1, 'One native Edge owner');
  assert.ok(['dock', 'peek'].includes(await host.getAttribute('data-rtg-adaptive-state')));
  assert.equal(await host.locator('.rtg-adaptive-bar').isVisible(), false, 'Edge stays closed');
  assert.equal(await host.locator('.rtg-adaptive-sheet').isVisible(), false, 'No sheet opens implicitly');
  const toggle = page.locator('.ds-public-edge-toggle');
  assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(await toggle.evaluate(element => {
    const r = element.getBoundingClientRect();
    return r.width >= 44 && r.height >= 44 && element.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
  }), true, 'The small Edge entry remains reachable');
}
async function viewportLeaf(page, id, viewport) {
  const box = await rect(page.locator('#' + id));
  near(box.left, 0, id + ' reaches left edge'); near(box.right, viewport.width, id + ' reaches right edge');
  near(box.top, 0, id + ' reaches top edge'); near(box.bottom, viewport.height, id + ' fills screen height');
  assert.equal(await page.locator('#' + id).evaluate(element => element.classList.contains('ds-issue-condensed')), false, id + ' displays its actual desktop composition');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1), true, 'The cover has no document scroll or overflow');
  assert.equal(await page.locator('body').evaluate(element => getComputedStyle(element).paddingBottom), '0px', 'No blank Edge reserve');
}
function clean(state) {
  assert.deepEqual(state.errors, [], 'No browser errors');
  assert.deepEqual(state.missing, [], 'All presentation assets load');
}

async function mobileGeometry(page, id) {
  return page.locator('#' + id).evaluate(element => {
    const sheet = element.getBoundingClientRect();
    const box = node => { const r = node.getBoundingClientRect(); return { left: r.left - sheet.left, top: r.top - sheet.top, width: r.width, height: r.height }; };
    const style = node => {
      const s = getComputedStyle(node);
      return { display: s.display, font: s.font, color: s.color, backgroundColor: s.backgroundColor, padding: s.padding, margin: s.margin, objectFit: s.objectFit, objectPosition: s.objectPosition };
    };
    const nodes = Array.from(element.querySelectorAll('h1,h2,h3,p,blockquote,dt,dd,.ds-issue-visual,.ds-cover-art,img,.ds-issue-preview'));
    return {
      condensed: element.classList.contains('ds-issue-condensed'), sheet: { width: sheet.width, height: sheet.height },
      nodes: nodes.map(node => ({ tag: node.tagName, className: node.className, text: node.tagName === 'IMG' ? node.getAttribute('src') : node.textContent.trim(), box: box(node), style: style(node) }))
    };
  });
}

test('desktop redesign preserves all 18 mobile leaves against the frozen full-bleed preview at 390×844', { skip: !FROZEN && 'Set RTG_DESKTOP_MOBILE_BASELINE to the reviewed immutable asset directory' }, async () => {
  const viewport = { width: 390, height: 844 };
  const current = await visit(base, viewport), previous = await visit(frozenBase, viewport);
  try {
    for (const id of PAGES) {
      await leaf(current.page, id); await leaf(previous.page, id);
      const actual = await mobileGeometry(current.page, id), expected = await mobileGeometry(previous.page, id);
      assert.equal(actual.condensed, expected.condensed, id + ' retains mobile fit mode');
      near(actual.sheet.width, expected.sheet.width, id + ' mobile leaf width');
      near(actual.sheet.height, expected.sheet.height, id + ' mobile leaf height');
      assert.equal(actual.nodes.length, expected.nodes.length, id + ' retains all mobile text and image nodes');
      for (let i = 0; i < actual.nodes.length; i++) {
        const a = actual.nodes[i], e = expected.nodes[i], label = id + ' mobile node ' + i + ' ' + a.tag;
        assert.deepEqual({ tag: a.tag, className: a.className, text: a.text, style: a.style }, { tag: e.tag, className: e.className, text: e.text, style: e.style }, label + ' retains content and core styles');
        for (const dimension of ['left', 'top', 'width', 'height']) near(a.box[dimension], e.box[dimension], label + ' ' + dimension);
      }
    }
    await closedEdge(current.page); await closedEdge(previous.page);
    clean(current); clean(previous);
  } finally { await current.context.close(); await previous.context.close(); }
});

for (const viewport of [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }]) {
  test('desktop editorial compositions remain complete and genuinely clickable at ' + viewport.width + '×' + viewport.height, async () => {
    const state = await visit(base, viewport), { page } = state;
    try {
      await leaf(page, 'editie'); await viewportLeaf(page, 'editie', viewport); await closedEdge(page);
      const art = await rect(page.locator('#editie .ds-cover-art'));
      for (const selector of ['.ds-cover-masthead', '.ds-cover-story', '.ds-cover-lines']) separate(art, await rect(page.locator('#editie ' + selector)), 'Cover artwork and ' + selector);
      separate(await rect(page.locator('#editie .ds-cover-story')), await rect(page.locator('#editie .ds-cover-lines')), 'Cover title and article teasers');
      for (const selector of ['#editie .ds-cover-art', '#editie .ds-cover-story h2 a']) {
        await leaf(page, 'editie'); await page.locator(selector).click();
        await page.waitForFunction(() => document.body.dataset.magazineView === 'cover' && document.querySelector('[data-carousel-status]').textContent.trim() === '2 / 18');
      }
      for (const [id, article] of STORIES) {
        await leaf(page, id); await viewportLeaf(page, id, viewport);
        const visual = page.locator('#' + id + ' .ds-issue-visual'), image = visual.locator('img');
        const visualBox = await rect(visual), copy = page.locator('#' + id + (id === 'interview' ? ' .ds-interview-heading' : ' .ds-issue-copy'));
        separate(visualBox, await rect(copy), id + ' photo and reading surface');
        assert.ok(visualBox.width > viewport.width * .25 && visualBox.height > viewport.height * .65, id + ' has a substantial photograph');
        assert.ok(Math.abs(visualBox.left) <= 1 || Math.abs(visualBox.right - viewport.width) <= 1, id + ' photograph reaches an outer screen edge');
        if (id === 'interview') {
          const portrait = await image.evaluate(element => {
            const r = element.getBoundingClientRect();
            return { natural: [element.naturalWidth, element.naturalHeight], ratio: r.width / r.height, left: r.left, fit: getComputedStyle(element).objectFit };
          });
          assert.deepEqual(portrait.natural, [960, 1280], 'The supplied founder portrait remains unchanged');
          assert.equal(portrait.fit, 'contain', 'The founder portrait remains uncropped');
          near(portrait.ratio, .75, 'The portrait pane follows its natural ratio', .005);
          near(portrait.left, 0, 'The founder portrait is flush with the left screen edge');
          separate(visualBox, await rect(page.locator('#interview .ds-interview-caption')), 'Interview portrait and quote');
        }
        for (const selector of ['#' + id + ' h2 a', '#' + id + ' .ds-issue-visual']) {
          await page.locator(selector).click();
          await page.waitForFunction(article => document.body.dataset.magazineView === 'article' && !!document.querySelector('#magazineDetailContent > #' + article), article);
          assert.equal(await page.locator('#magazineDetailContent > #' + article).isVisible(), true, id + ' opens the real article with ' + selector);
          await page.locator('#magazineBack').click();
          await page.waitForFunction(id => document.body.dataset.magazineView === 'cover' && Math.abs(document.getElementById(id).getBoundingClientRect().left) <= 1, id);
          await settle(page);
        }
        await closedEdge(page);
      }
      clean(state);
    } finally { await state.context.close(); }
  });
}
