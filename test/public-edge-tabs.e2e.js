'use strict';
// Public presentation only: app destinations are intercepted before any account,
// provider or mutation request can leave this read-only fixture.
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { laadPlaywright, startBrowser, letOpFouten } = require('./helper');
const edgeUI = require('./public-edge-interactions');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const sheetSelector = '.ds-public-edge .rtg-adaptive-sheet';
let server, browser, base;

test.before(async () => {
  const remote = process.env.RTG_EDGE_TABS_URL;
  if (remote) {
    assert.match(remote, /^https:\/\/[a-f0-9]{8}-rahul-travel-group-www\.rtg-corporate-website\.workers\.dev\/?$/, 'RTG_EDGE_TABS_URL moet een onveranderlijke RTG-preview zijn');
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

async function ready(page) {
  await page.waitForFunction(() => !!window.RTGPublicApp && !!history.state?.rtgMagazine);
  await page.evaluate(() => document.fonts.ready);
}
async function fixture(width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
  const appVisits = [], denied = [];
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base || !['GET', 'HEAD'].includes(request.method())) {
      denied.push(request.method() + ' ' + request.url());
      return route.fulfill({ status: 503, body: 'Read-only Edge fixture: external and mutation traffic excluded' });
    }
    if (url.pathname.startsWith('/apps/')) {
      appVisits.push(url.pathname);
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html lang="nl"><title>Onderschepte appbestemming</title><body>Alleen een routetoets; geen account geladen.</body></html>' });
    }
    return route.continue();
  });
  const page = await context.newPage(), errors = [], missing = [];
  page.setDefaultTimeout(10000);
  letOpFouten(page, errors);
  page.on('response', response => {
    if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) missing.push(response.url());
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await ready(page);
  return { context, page, errors, missing, appVisits, denied };
}
async function openMenu(page) {
  return edgeUI.menu(page);
}
async function mode(page, name) {
  return edgeUI.mode(page, name);
}
async function noOverflow(page, sheet, label) {
  const bounds = await sheet.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, body: document.documentElement.scrollWidth, viewport: innerWidth }));
  assert.ok(bounds.scrollWidth <= bounds.width + 1, label + ': geen horizontale overloop in Edge');
  assert.ok(bounds.body <= bounds.viewport + 1, label + ': geen horizontale documentoverloop');
}
async function closeStaysReachable(sheet, height, label) {
  await sheet.evaluate(node => { node.scrollTop = node.scrollHeight; });
  const close = sheet.locator('[data-rtg-adaptive-close]');
  const reachable = await close.evaluate(node => {
    const box = node.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
    return { top: box.top, bottom: box.bottom, hit: node.contains(document.elementFromPoint(x, y)) };
  });
  assert.ok(reachable.top >= 0 && reachable.bottom <= height + 1 && reachable.hit, label + ': sluitknop blijft zichtbaar en aanklikbaar');
}
async function controlsHaveRoom(sheet, label) {
  for (const control of await sheet.locator('button:visible, a:visible, summary:visible').all()) {
    await edgeUI.seek(sheet.page(), control);
    const box = await control.boundingBox();
    assert.ok(box && box.height >= 43.9 && box.width >= 43.9, label + ': aanraakdoel minstens 44 × 44px: ' + (await control.innerText()).trim());
  }
}

for (const [width, height] of [[320, 844], [390, 844], [768, 900], [1440, 900], [390, 600]]) {
  test('alle Edge-tabs behouden kunst, bediening en sluitknop op ' + width + ' × ' + height, async () => {
    const { context, page, errors, missing } = await fixture(width, height);
    try {
      const sheet = await openMenu(page);
      assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1);
      assert.equal(await sheet.locator('.ds-edge-gallery').isVisible(), false, 'Ontdek heeft zijn eigen kunstbeeld, geen tweede galerij');
      for (const name of ['now', 'connect', 'media', 'account']) {
        await mode(page, name);
        const gallery = sheet.locator('.ds-edge-gallery');
        assert.equal(await gallery.count(), 1);
        const image = width >= 1100 ? sheet.locator('.ds-edge-reading-art') : gallery.locator('img');
        await image.evaluate(node => node.decode());
        assert.equal(await image.getAttribute('alt'), '', 'redactionele decoratie vormt geen extra bediening');
        assert.equal(await image.evaluate(node => node.complete && node.naturalWidth > 0), true);
        assert.ok((await gallery.locator('figcaption').innerText()).trim(), 'de bestaande toelichting blijft bij de tab');
        await noOverflow(page, sheet, name);
        await controlsHaveRoom(sheet, name);
        await closeStaysReachable(sheet, height, name);
        await sheet.evaluate(node => { node.scrollTop = 0; });
      }
      await mode(page, 'rahul');
      const studio = page.locator('#magazineDetailContent > #rahul.ds-rahul-studio');
      assert.equal(await studio.isVisible(), true);
      assert.equal(await studio.locator('.ds-rahul-art').count(), 1);
      await studio.locator('.ds-rahul-art img').evaluate(node => node.decode());
      assert.equal(await studio.locator('#intentForm input').isVisible(), true);
      assert.ok(await studio.locator('#intentFeedback').isVisible(), 'de lokale demo wordt niet als uitgevoerd voorstel voorgesteld');
      await openMenu(page);
      assert.equal(await sheet.locator('.ds-edge-gallery').isVisible(), false);
      assert.equal(await sheet.locator('#explorePanel .ds-discover-art').count(), 1);
      await sheet.locator('[data-rtg-adaptive-close]').click();
      await sheet.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []); assert.deepEqual(missing, []);
    } finally { await context.close(); }
  });
}

test('herhaald tabwisselen behoudt dezelfde toelichting, één galerij en het oorspronkelijke Rahul-formulier', async () => {
  const { context, page, errors } = await fixture();
  try {
    await page.evaluate(() => {
      window.edgeTestRahul = document.getElementById('rahul');
      window.edgeTestIntent = document.getElementById('intent');
      window.edgeTestCopy = document.querySelector('.ds-edge-gallery figcaption p, .ds-public-edge .rtg-adaptive-sheet-head p');
    });
    const sheet = await openMenu(page);
    await mode(page, 'rahul');
    await page.locator('#intent').fill('Een reis met kunst en gesprekken');
    for (let round = 0; round < 3; round++) {
      await openMenu(page);
      for (const name of ['connect', 'media', 'account', 'now']) {
        await mode(page, name);
        assert.equal(await sheet.locator('.ds-edge-gallery').count(), 1);
        assert.equal(await page.evaluate(() => document.querySelector('.ds-edge-gallery figcaption p') === window.edgeTestCopy), true, 'geen kloon of verloren beschrijving');
      }
      await mode(page, 'rahul');
      assert.equal(await page.evaluate(() => document.getElementById('rahul') === window.edgeTestRahul && document.getElementById('intent') === window.edgeTestIntent), true);
      assert.equal(await page.locator('#intent').inputValue(), 'Een reis met kunst en gesprekken');
      assert.equal(await page.locator('#rahul .ds-rahul-art').count(), 1);
      assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1);
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Menu opent de inhoud en de contextactie opent de bestaande actielijst zonder een tweede eigenaar', async () => {
  const { context, page, errors } = await fixture();
  try {
    const sheet = await openMenu(page);
    const contents = sheet.locator('#explorePanel').getByRole('button', { name: 'Inhoud van deze editie', exact: true });
    await edgeUI.seek(page, contents); await contents.click();
    await page.waitForFunction(() => !document.getElementById('magazineHome').hidden && history.state?.rtgMagazine.id === 'inhoudsopgave');
    await sheet.waitFor({ state: 'hidden' });
    await edgeUI.action(page, 'context');
    await page.locator('.pp-menu-panel').waitFor({ state: 'visible' });
    assert.equal(await sheet.locator('.ds-edge-gallery').isVisible(), false, 'een eigen actiespaneel stapelt geen extra schilderij');
    assert.equal(await sheet.locator('.rtg-adaptive-service button:visible').count(), 0, 'Nu naar Acties laat geen oude serviceknoppen door');
    assert.ok(await sheet.locator('.pp-menu-panel button').count() >= 5);
    assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Connect, Media en Account laten na sluiten geen serviceknoppen achter in Ontdek of Acties', async () => {
  const { context, page, errors } = await fixture();
  try {
    for (const name of ['connect', 'media', 'account']) {
      const sheet = await openMenu(page);
      await mode(page, name);
      assert.ok(await sheet.locator('.rtg-adaptive-service button:visible').count() >= 2, name + ': service heeft eerst zijn eigen werkende bediening');
      await sheet.locator('[data-rtg-adaptive-close]').click();
      await sheet.waitFor({ state: 'hidden' });
      await openMenu(page);
      assert.equal(await sheet.locator('#explorePanel').isVisible(), true);
      assert.equal(await sheet.locator('.rtg-adaptive-service button:visible').count(), 0, name + ' naar sluiten naar Ontdek: geen achtergebleven serviceknoppen');
      assert.equal(await sheet.locator('.ds-edge-gallery').isVisible(), false, name + ': Ontdek behoudt alleen zijn eigen kunstbeeld');
      await edgeUI.action(page, 'context');
      await page.locator('.pp-menu-panel').waitFor({ state: 'visible' });
      assert.equal(await sheet.locator('.rtg-adaptive-service button:visible').count(), 0, name + ' naar Nu naar Acties: alleen bediening van het actiespaneel');
      assert.equal(await sheet.locator('.ds-edge-gallery').isVisible(), false);
      assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1);
      await sheet.locator('[data-rtg-adaptive-close]').click();
      await sheet.waitFor({ state: 'hidden' });
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Connect, Media en Account behouden hun echte appbestemmingen zonder een account te openen', async () => {
  const { context, page, errors, appVisits } = await fixture();
  const routes = [
    ['connect', 'Open berichten', '/apps/comm.html'],
    ['connect', 'Open uw mensen', '/apps/wereld.html'],
    ['media', 'Open RTG Media', '/apps/media.html'],
    ['media', 'Open RTG Sound', '/apps/muziek.html'],
    ['account', 'Open uw account', '/apps/ik.html'],
    ['account', 'Privacy en veiligheid', '/apps/veilig.html'],
    ['account', 'Uw gegevens', '/apps/mijn-gegevens.html']
  ];
  try {
    for (const [name, label, expected] of routes) {
      const sheet = await openMenu(page);
      await mode(page, name);
      const destination = sheet.locator('.rtg-adaptive-service button').filter({ hasText: label });
      await edgeUI.seek(page, destination);
      await Promise.all([
        page.waitForURL(base + expected),
        destination.click()
      ]);
      assert.equal(new URL(page.url()).pathname, expected);
      assert.equal(appVisits.at(-1), expected, 'de app wordt door de fixture onderschept');
      await page.goto(base, { waitUntil: 'networkidle' }); await ready(page);
    }
    assert.deepEqual(appVisits, routes.map(route => route[2]));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('een actieve mediaspeler behoudt de oorspronkelijke vorige-, speel- en volgende-acties', async () => {
  const { context, page, errors } = await fixture();
  try {
    await page.evaluate(() => {
      window.edgeMediaCalls = [];
      window.RTGSpeler = { live: () => true, stuur: command => window.edgeMediaCalls.push(command) };
    });
    const sheet = await openMenu(page);
    await mode(page, 'media');
    for (const label of ['Vorige', 'Speel of pauzeer', 'Volgende']) {
      const control = sheet.locator('.rtg-adaptive-media-controls button').filter({ hasText: label });
      await edgeUI.seek(page, control); await control.click();
    }
    assert.deepEqual(await page.evaluate(() => window.edgeMediaCalls), ['prev', 'toggle', 'next']);
    const sourceTitle = await page.locator('#editie').getAttribute('data-issue-label');
    assert.equal((await sheet.locator('.ds-edge-gallery figcaption').innerText()).trim(), sourceTitle, 'ook tijdens afspelen blijft de caption bij het echte huidige blad');
    await mode(page, 'connect'); await mode(page, 'media');
    const toggle = sheet.locator('.rtg-adaptive-media-controls button').filter({ hasText: 'Speel of pauzeer' });
    await edgeUI.seek(page, toggle); await toggle.click();
    assert.deepEqual(await page.evaluate(() => window.edgeMediaCalls), ['prev', 'toggle', 'next', 'toggle']);
    assert.equal(await sheet.locator('.rtg-adaptive-media-controls').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('alle Edge-tabs blijven bruikbaar met 200% tekst en met RTL op een kort scherm', async () => {
  for (const variant of ['large-text', 'rtl']) {
    const { context, page, errors } = await fixture(variant === 'rtl' ? 320 : 390, 600);
    try {
      await page.evaluate(value => {
        if (value === 'large-text') document.documentElement.style.fontSize = '200%';
        else document.documentElement.dir = 'rtl';
      }, variant);
      const sheet = await openMenu(page);
      for (const name of ['now', 'connect', 'media', 'account']) {
        await mode(page, name);
        await noOverflow(page, sheet, variant + '/' + name);
        await controlsHaveRoom(sheet, variant + '/' + name);
        await closeStaysReachable(sheet, 600, variant + '/' + name);
        await sheet.evaluate(node => { node.scrollTop = 0; });
      }
      await sheet.locator('[data-rtg-adaptive-close]').click();
      await sheet.waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});
