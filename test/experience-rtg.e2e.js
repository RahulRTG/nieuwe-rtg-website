'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop, letOpFouten } = require('./helper');
const pw = laadPlaywright();
const root = path.resolve(__dirname, '..');
const menu = page => page.getByRole('button', { name: 'Alle functies', exact: true }).click();
async function go(page, name) {
  await menu(page);
  await page.locator('#explorePanel').getByRole('link', { name }).click();
}
async function ready(page) {
  await page.waitForSelector('body.experience-ready[data-rtg-adaptive-ready="true"]');
}
async function actions(page, name) {
  await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
  await page.locator('#contextActions').getByRole('button', { name, exact: true }).click();
}

test('Experience RTG: real public route, one Edge, interactive demos and explicit welcome handoff',
  { skip: geenBrowser(pw), timeout: 180000 }, async t => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const width of [320, 390, 1440]) await t.test('viewport ' + width, async () => {
      const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await context.newPage(), errors = [], failed = [], mutations = [];
      letOpFouten(page, errors);
      page.on('response', r => { if (r.status() >= 400 && !r.url().includes('/api/')) failed.push(r.url()); });
      page.on('request', r => {
        // The shared language catalogue is a read using POST with an empty body.
        if (new URL(r.url()).pathname === '/api/talen' && r.method() === 'POST' && r.postData() === '{}') return;
        if (r.method() !== 'GET' && r.method() !== 'HEAD') mutations.push(r.url());
      });
      await page.goto(base + '/', { waitUntil: 'networkidle' }); await ready(page);
      assert.equal(await page.locator('.rtg-adaptive-bar').count(), 1);
      assert.equal(await page.locator('.rtg-edge-bottom').count(), 0);
      const geometry = await page.evaluate(() => {
        const bar = document.querySelector('.rtg-adaptive-bar'), r = bar.getBoundingClientRect();
        return { overflow: document.documentElement.scrollWidth > innerWidth + 1,
          inside: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
          token: getComputedStyle(bar).getPropertyValue('--edge-bar-bg').trim(),
          targets: [...bar.querySelectorAll('button')].every(b => b.clientWidth >= 44 && b.clientHeight >= 44) };
      });
      assert.deepEqual(geometry, { overflow: false, inside: true, token: '#0a0805', targets: true });
      await go(page, /Alle passen/);
      assert.equal(new URL(page.url()).hash, '#passen');
      await go(page, /Alle vragen/);
      assert.equal(await page.locator('[data-faq]:visible').count(), 23);
      await page.locator('#faqSearch').fill('FoundationOS echt');
      assert.equal(await page.locator('[data-faq]:visible').count(), 1);
      await page.locator('[data-faq]:visible summary').click();
      assert.match(await page.locator('[data-faq]:visible').innerText(), /altijd 100% gratis/);
      await page.locator('#faqSearch').fill('geen-vraag-met-dit-woord');
      assert.equal(await page.locator('#faqEmpty').isVisible(), true);
      await go(page, /Playground/);
      assert.match(await page.locator('#demoResult').innerText(), /conflict/);
      await page.locator('#demoOption').selectOption('late');
      assert.match(await page.locator('#demoSteps').innerText(), /Avondvertrek past/);
      await actions(page, 'Bekijk het voorbeeldvoorstel');
      await page.locator('#confirmExample').click();
      assert.match(await page.locator('#exampleReceipt').innerText(), /niets geboekt, betaald, verstuurd of gedeeld/);
      await page.keyboard.press('Escape');
      await go(page, /Privacy & regie/);
      await page.locator('#allowCalendar').uncheck();
      await page.locator('#allowLocation').uncheck();
      await actions(page, 'Bekijk het veranderde voorstel');
      assert.match(await page.locator('#proposalSummary').innerText(), /Agenda niet gedeeld/);
      assert.match(await page.locator('#proposalSummary').innerText(), /vervoer blijft een open vraag/);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Praat met Rahul', exact: true }).click();
      await page.locator('#intent').fill('Ik heb een strandtent met 40 medewerkers');
      await page.getByRole('button', { name: 'Verken mijn voorbeeld', exact: true }).click();
      assert.match(await page.locator('#intentFeedback').innerText(), /Een zaak, één overzicht/);
      await go(page, /Uw RTG/);
      await page.locator('summary').getByText('Waarom zie ik dit?', { exact: true }).click();
      assert.match(await page.locator('#personalReasons').innerText(), /WorkOS/);
      await page.getByRole('button', { name: 'Werelden', exact: true }).click();
      await page.locator('#worldPanel [data-select-world="foundation"]').click();
      assert.equal(await page.locator('[data-room]:visible').getAttribute('data-room'), 'foundation');
      await actions(page, 'Volgende wereld');
      assert.equal(await page.locator('[data-room]:visible').getAttribute('data-room'), 'living');
      await page.locator('#worldStage').scrollIntoViewIfNeeded();
      const stage = await page.locator('#worldStage').boundingBox();
      await page.mouse.move(stage.x + stage.width * .8, stage.y + 100);
      await page.mouse.down();
      await page.mouse.move(stage.x + stage.width * .2, stage.y + 100, { steps: 5 });
      await page.mouse.up();
      assert.equal(await page.locator('[data-room]:visible').getAttribute('data-room'), 'travel');
      await go(page, /Maak mijn RTG/);
      assert.equal(new URL(await page.locator('#createAccount').getAttribute('href')).hash, '');
      await page.locator('#carryInterests').check();
      const handoff = new URL(await page.locator('#createAccount').getAttribute('href'));
      assert.equal(handoff.origin, base);
      assert.equal(handoff.hash, '#rtg-experience=living,travel,work,foundation');
      assert.deepEqual(mutations, [], 'public simulations send no mutations');
      assert.deepEqual(errors, []); assert.deepEqual(failed, []);
      // Real click into the existing isolated app. No fake account is created.
      await page.locator('#createAccount').click();
      await page.waitForSelector('#gate .ag-experience', { timeout: 60000 });
      assert.match(await page.locator('#gate .ag-experience').innerText(), /TravelOS, WorkOS, FoundationOS/);
      assert.equal(new URL(page.url()).hash, '');
      await page.goto(base + '/'); await ready(page);
      assert.match(await page.locator('#personalSummary').innerText(), /Ontdek een situatie/);
      await go(page, /Playground/);
      await page.locator('label:has(input[value="work"])').click();
      await menu(page);
      await page.locator('#explorePanel [data-reset]').click();
      assert.match(await page.locator('#personalSummary').innerText(), /Ontdek een situatie/);
      assert.equal(await page.locator('#carryInterests').isDisabled(), true);
      assert.equal(await page.locator('#intent').inputValue(), '');
      await menu(page); await page.keyboard.press('Escape');
      assert.equal(await page.locator('#explorePanel').isVisible(), false);
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('data-rtg-adaptive-action')), 'menu');
      await context.close();
    });
  } finally { if (browser) await browser.close(); await stop(child); }
});

test('static project path and JavaScript-disabled visitors retain content and relative assets',
  { skip: geenBrowser(pw), timeout: 60000 }, async () => {
  const prefix = '/nieuwe-rtg-website/';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith(prefix)) { res.writeHead(404); res.end(); return; }
    const relative = decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
    const file = path.resolve(root, relative);
    if ((relative !== 'index.html' && !relative.startsWith('public/')) || !file.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return; }
    try {
      const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
      res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream'); res.end(fs.readFileSync(file));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const javaScriptEnabled of [true, false]) {
      const context = await browser.newContext({ javaScriptEnabled, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      const page = await context.newPage(), failed = [];
      page.on('response', r => { if (r.status() >= 400) failed.push(r.url()); });
      await page.goto('http://127.0.0.1:' + server.address().port + prefix, { waitUntil: 'networkidle' });
      if (javaScriptEnabled) {
        await ready(page);
        assert.equal(await page.locator('#createAccount').getAttribute('href'), 'https://app.rahultravelgroup.com/apps/app.html');
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--edge-bar-bg').trim()), '#0a0805');
      } else {
        assert.equal(await page.locator('[data-room]:visible').count(), 4);
        assert.equal(await page.locator('[data-faq]:visible').count(), 23);
        await page.getByRole('link', { name: 'Passen', exact: true }).click();
        assert.equal(new URL(page.url()).hash, '#passen');
      }
      assert.deepEqual(failed, []);
      await context.close();
    }
  } finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
});
