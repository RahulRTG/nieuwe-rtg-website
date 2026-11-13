'use strict';
// Public text retrieval and reader routing only. This is not an AI or service qualification.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const { laadPlaywright, startBrowser, letOpFouten } = require('./helper');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
let server, browser, base;
test.before(async () => {
  server = http.createServer((req, res) => {
    let route = new URL(req.url, 'http://localhost').pathname;
    if (route === '/') route = '/index.html';
    else if (/^\/(ds|fonts|images|shared|site)\//.test(route)) route = '/public' + route;
    const file = path.resolve(root, '.' + route);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (error, bytes) => { res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' }); res.end(error ? 'missing' : bytes); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = 'http://127.0.0.1:' + server.address().port;
  browser = await startBrowser(laadPlaywright({ eigenDriver: false }));
});
test.after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function fixture() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
  await context.route('**/*', route => new URL(route.request().url()).origin === base && ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.fulfill({ status: 503, body: 'Read-only public search proof' }));
  const page = await context.newPage(), errors = [];
  letOpFouten(page, errors);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.RTGPublicApp && !!window.RTGCommand);
  return { page, context, errors };
}
async function search(page, query) {
  await page.evaluate(() => window.RTGCommand.open());
  await page.locator('#commandSearch').fill(query);
}

for (const [query, expected] of [['wat kost RTG?', '#prijsbeleid'], ['wie zit achter RTG?', '#artikel-interview'], ['hoe werkt privacy?', '#regie']]) {
  test('een gewone vraag geeft relevante bronnen, geen gegenereerd antwoord: ' + query, async () => {
    const { page, context, errors } = await fixture();
    try {
      await search(page, query);
      assert.equal(await page.locator('#commandResults a').first().getAttribute('href'), expected);
      assert.match(await page.locator('#commandStatus').innerText(), /resultaten/);
      await page.locator('#commandResults a').first().click();
      assert.equal(await page.locator('#commandDialog').isVisible(), false);
      assert.equal(await page.locator('#magazineDetailContent ' + expected).isVisible(), true);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
test('ieder gepubliceerd artikel is op titel vindbaar en opent zijn ene bestaande bronnode', async () => {
  const { page, context, errors } = await fixture();
  try {
    const articles = await page.locator('[data-issue-article]').evaluateAll(nodes => nodes.map(node => ({ id: node.id, title: node.querySelector('h2').textContent })));
    await page.evaluate(() => { window.__searchSources = new Map(Array.from(document.querySelectorAll('[data-issue-article]'), node => [node.id, node])); });
    for (const article of articles) {
      await search(page, article.title);
      const result = page.locator('#commandResults a[href="#' + article.id + '"]');
      assert.equal(await result.count(), 1, article.title);
      await result.click();
      assert.equal(await page.evaluate(id => document.getElementById(id) === window.__searchSources.get(id), article.id), true);
      assert.equal(await page.locator('#magazineDetailContent > #' + article.id).isVisible(), true);
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('zoekresultaat opent de precieze FAQ, niet een nieuwe antwoordkopie', async () => {
  const { page, context, errors } = await fixture();
  try {
    await search(page, 'Welke kosten kunnen erbij komen?');
    const result = page.locator('#commandResults a').first();
    assert.match(await result.getAttribute('href'), /^#magazine-vraag-/);
    await result.click();
    const faq = page.locator('#faqList details').filter({ has: page.getByText('Welke kosten kunnen erbij komen?', { exact: true }) });
    assert.equal(await faq.count(), 1);
    assert.equal(await faq.evaluate(node => node.open), true);
    assert.equal(await faq.isVisible(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('platform en appresultaten blijven beschikbaar en het toetsenbord werkt als een lijst links', async () => {
  const { page, context, errors } = await fixture();
  try {
    await search(page, 'RTG Graph');
    assert.equal(await page.locator('#commandResults a').first().getAttribute('href'), '#graph');
    await page.locator('#commandSearch').press('ArrowDown');
    assert.equal(await page.locator('#commandResults a').first().evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.locator('#commandSearch').evaluate(node => node === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#magazineDetailContent #graph').isVisible(), true);
    const tool = await page.evaluate(() => Object.values(window.RTGWebsiteTruth.worlds).flatMap(world => world.tools)[0]);
    await search(page, tool.name);
    assert.equal(await page.locator('#commandResults a').evaluateAll((nodes, route) => {
      const base = new URL(document.querySelector('meta[name="rtg-app-base"]').content, document.baseURI);
      const expected = new URL(route.replace(/^\//, ''), base).href;
      return nodes.some(node => node.href === expected);
    }, tool.route), true, 'de volledige canonieke app-URL inclusief view-query blijft behouden');
    assert.equal(await page.locator('#commandResults [role="option"]').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('alledaagse vraagruis blokkeert het reisverhaal niet', async () => {
  const { page, context, errors } = await fixture();
  try {
    await search(page, 'Waar kan ik meer lezen over reizen?');
    const story = page.locator('#commandResults a[href="#artikel-reizen"]');
    assert.equal(await story.count(), 1);
    await story.click();
    assert.equal(await page.locator('#magazineDetailContent #artikel-reizen').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('leeg resultaat, onbetrouwbare invoer en zoeken sturen geen zoekvraag naar een dienst', async () => {
  const { page, context, errors } = await fixture();
  try {
    await search(page, '');
    const requests = []; page.on('request', request => requests.push(request.url()));
    await page.locator('#commandSearch').fill('<img src=x onerror=alert(1)> onbewezenzoekterm');
    assert.equal(await page.locator('#commandEmpty').isVisible(), true);
    assert.equal(await page.locator('#commandResults a').count(), 0);
    assert.equal(await page.locator('#commandResults img').count(), 0);
    await page.locator('#commandSearch').press('Enter');
    assert.equal(await page.locator('#commandDialog').isVisible(), true);
    await page.locator('#commandSearch').fill('schoonheid');
    assert.equal(await page.locator('#commandResults a[href="#artikel-interview"]').count(), 1, 'de letterlijke interviewtekst is ook geïndexeerd');
    await page.waitForTimeout(100);
    assert.deepEqual(requests, [], 'geen fetch, externe AI of zoeklog');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
