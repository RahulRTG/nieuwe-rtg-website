'use strict';
// Presentation and native navigation only. No provider, account or mutation traffic.
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { laadPlaywright, startBrowser } = require('./helper');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
let server, browser, base;
test.before(async () => {
  const remote = process.env.RTG_DISCOVER_URL;
  if (remote) {
    // Only an immutable preview URL is allowed, never the live worker or an
    // arbitrary host. The same GET/HEAD-only browser routing applies below.
    assert.match(remote, /^https:\/\/[a-f0-9]{8}-rahul-travel-group-www\.rtg-corporate-website\.workers\.dev\/?$/, 'RTG_DISCOVER_URL moet een onveranderlijke RTG-preview zijn');
    base = new URL(remote).origin;
  } else {
    server = http.createServer((req, res) => {
      let route = new URL(req.url, 'http://localhost').pathname;
      if (route === '/') route = '/index.html';
      else if (/^\/(ds|fonts|images|shared|site)\//.test(route)) route = '/public' + route;
      const file = path.resolve(root, '.' + route);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
      fs.readFile(file, (error, bytes) => {
        res.writeHead(error ? 404 : 200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
        res.end(error ? 'missing' : bytes);
      });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    base = 'http://127.0.0.1:' + server.address().port;
  }
  browser = await startBrowser(laadPlaywright({ eigenDriver: false }));
});
test.after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function fixture(width = 390, height = 844) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
  await context.route('**/*', route => new URL(route.request().url()).origin === base && ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.fulfill({ status: 503, body: 'Read-only discover fixture: external traffic excluded' }));
  const page = await context.newPage(), errors = [], missing = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) missing.push(response.url());
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.RTGPublicApp && !!history.state?.rtgMagazine);
  await page.evaluate(() => document.fonts.ready);
  return { context, page, errors, missing };
}
async function openMenu(page) {
  // Native WebKit pointer clicks need not focus a button. Start with the
  // keyboard when proving return-to-opener, so the focus owner is explicit.
  await page.locator('[data-magazine-menu]').focus();
  await page.keyboard.press('Enter');
  await page.locator('#explorePanel').waitFor({ state: 'visible' });
  assert.equal(await page.locator('[data-magazine-menu]').getAttribute('aria-expanded'), 'true');
  return page.locator('.ds-public-edge .rtg-adaptive-sheet').filter({ has: page.locator('#explorePanel') });
}
async function closed(page) {
  await page.locator('#explorePanel').waitFor({ state: 'hidden' });
  assert.equal(await page.locator('[data-magazine-menu]').getAttribute('aria-expanded'), 'false');
}
async function leaf(page, id) {
  await page.waitForFunction(id => !document.getElementById('magazineHome').hidden && history.state?.rtgMagazine.id === id && document.querySelector('[data-issue-caption]').textContent === document.getElementById(id).dataset.issueLabel, id);
}
async function seekMenuControl(page, sheet, control) {
  const status = sheet.locator('.ds-edge-page-status');
  async function turn(direction) {
    const button = sheet.locator('[data-edge-page="' + direction + '"]');
    if (await button.isDisabled()) return false;
    const old = await status.innerText();
    await button.click();
    await page.waitForFunction(old => document.querySelector('.ds-edge-page-status').textContent !== old, old);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    return true;
  }
  let wrapped = false;
  for (let index = 0; index < 100; index++) {
    const reachable = await control.evaluate(node => {
      const box = node.getBoundingClientRect(), view = document.querySelector('.ds-edge-pages').getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
      return box.height >= 43.9 && box.width >= 43.9 && box.left >= view.left - 1 && box.right <= view.right + 1 && box.top >= view.top - 1 && box.bottom <= view.bottom + 1 && node.contains(document.elementFromPoint(x, y));
    });
    if (reachable) return;
    if (await turn(1)) continue;
    if (wrapped) break;
    wrapped = true;
    for (let previous = 0; previous < 100 && await turn(-1); previous++) {}
  }
  assert.fail('Geen horizontaal menublad voor ' + (await control.innerText()).trim());
}

for (const [width, height] of [[320, 844], [390, 844], [768, 900], [1440, 900], [390, 600]]) {
  test('Ontdek: compleet kunstbeeld, ruime doelen en bereikbare sluitknop op ' + width + ' × ' + height, async () => {
    const { context, page, errors, missing } = await fixture(width, height);
    try {
      const sheet = await openMenu(page), panel = page.locator('#explorePanel');
      assert.equal(await panel.evaluate(node => node.classList.contains('ds-discover')), true);
      assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1, 'de bestaande Edge blijft de enige eigenaar');
      const art = panel.locator('img[src$="rtg-discover-salon.webp"]');
      assert.equal(await art.count(), 1, 'één origineel kunstbeeld, geen extra logo of beeldstapel');
      await art.evaluate(image => image.decode());
      const imageState = await art.evaluate(image => {
        const box = image.getBoundingClientRect(), style = getComputedStyle(image);
        return { complete: image.complete && image.naturalWidth > 0, ratio: box.width / box.height, naturalRatio: image.naturalWidth / image.naturalHeight, fit: style.objectFit, anchor: image.closest('a')?.getAttribute('href') };
      });
      assert.equal(imageState.complete, true);
      assert.ok(Math.abs(imageState.ratio - imageState.naturalRatio) < .02 || imageState.fit === 'contain', 'het schilderij is volledig zichtbaar');
      assert.equal(imageState.anchor, '#journal');
      assert.deepEqual(await panel.locator('.ds-discover-routes a[data-go]').evaluateAll(nodes => nodes.map(node => node.dataset.go)), ['reisverhaal', 'goedeleven', 'journal', 'ondernemen', 'passen', 'rahul']);
      assert.deepEqual(await sheet.locator('[data-rtg-adaptive-mode]').evaluateAll(nodes => nodes.map(node => node.dataset.rtgAdaptiveMode)), ['now', 'rahul', 'connect', 'media', 'account']);
      const more = panel.locator('details').first();
      await more.locator('summary').click();
      assert.equal(await more.evaluate(node => node.open), true);
      for (const control of await sheet.locator('a:visible, button:visible, summary:visible').all()) {
        const size = await control.boundingBox();
        assert.ok(size && size.height >= 43.9, 'aanraakdoel minstens 44px: ' + (await control.innerText()).trim());
      }
      const bounds = await sheet.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, body: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(bounds.scrollWidth <= bounds.width + 1, 'de galerie heeft geen horizontale overloop');
      assert.ok(bounds.body <= bounds.viewport + 1, 'de pagina zelf schuift niet horizontaal');
      await sheet.evaluate(node => { node.scrollTop = node.scrollHeight; });
      const close = sheet.locator('[data-rtg-adaptive-close]'), closeBox = await close.boundingBox();
      assert.ok(closeBox && closeBox.y >= 0 && closeBox.y + closeBox.height <= height + 1, 'sluiten blijft ook onderaan het menu in het zicht');
      await close.click();
      await closed(page);
      await page.waitForFunction(() => document.activeElement === document.querySelector('[data-magazine-menu]'));
      assert.deepEqual(errors, []); assert.deepEqual(missing, []);
    } finally { await context.close(); }
  });
}

test('Ontdek vanaf het toetsenbord sluiten via Escape of dezelfde menuknop herstelt openerfocus', async () => {
  const { context, page, errors } = await fixture();
  try {
    await openMenu(page);
    assert.equal(await page.locator('#explorePanel').evaluate(node => node.contains(document.activeElement)), true);
    await page.keyboard.press('Escape'); await closed(page);
    await page.waitForFunction(() => document.activeElement === document.querySelector('[data-magazine-menu]'));
    await openMenu(page); await page.locator('[data-magazine-menu]').click(); await closed(page);
    await page.waitForFunction(() => document.activeElement === document.querySelector('[data-magazine-menu]'));
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Ontdek opent ook via een echte pointerklik en sluit via de bestaande sluitknop', async () => {
  const { context, page, errors, missing } = await fixture();
  try {
    await page.locator('[data-magazine-menu]').click();
    await page.locator('#explorePanel').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-magazine-menu]').getAttribute('aria-expanded'), 'true');
    const art = page.locator('#explorePanel img[src$="rtg-discover-salon.webp"]');
    await art.evaluate(image => image.decode());
    assert.equal(await art.evaluate(image => image.complete && image.naturalWidth > 0), true);
    await page.locator('.ds-public-edge .rtg-adaptive-sheet [data-rtg-adaptive-close]').click();
    await closed(page);
    assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  } finally { await context.close(); }
});

test('alle redactionele menu-ingangen en het schilderij openen hun bestaande magazineblad', async () => {
  const { context, page, errors } = await fixture();
  try {
    for (const [route, expected] of [['reisverhaal', 'reisverhaal'], ['goedeleven', 'goedeleven'], ['journal', 'inhoudsopgave'], ['ondernemen', 'ondernemen']]) {
      await openMenu(page);
      await page.locator('#explorePanel .ds-discover-routes a[data-go="' + route + '"]').click();
      await closed(page); await leaf(page, expected);
    }
    await openMenu(page);
    await page.locator('#explorePanel a[href="#journal"]').first().click();
    await closed(page); await leaf(page, 'inhoudsopgave');
    for (const route of ['passen', 'rahul']) {
      await openMenu(page);
      await page.locator('#explorePanel .ds-discover-routes a[data-go="' + route + '"]').click();
      await closed(page);
      assert.equal(await page.locator('#magazineDetailContent > #' + route).isVisible(), true);
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('zoeken, taalkeuze en de actielijst behouden hun bestaande eigenaren vanuit Ontdek', async () => {
  const { context, page, errors } = await fixture();
  try {
    await openMenu(page);
    const details = page.locator('#explorePanel details').first();
    await details.locator('summary').click();
    const search = page.locator('#explorePanel [data-command-open]');
    await search.focus();
    await page.keyboard.press('Enter');
    await page.locator('#commandDialog').waitFor({ state: 'visible' });
    await page.locator('#commandDialog button[type="submit"]').click();
    await page.locator('#commandDialog').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('#explorePanel').isVisible(), true);
    await page.waitForFunction(() => document.activeElement === document.querySelector('#explorePanel [data-command-open]'));
    await search.click();
    await page.locator('#commandSearch').fill('wie zit achter RTG?');
    await page.locator('#commandResults a[href="#artikel-interview"]').first().click();
    await closed(page);
    assert.equal(await page.locator('#magazineDetailContent > #artikel-interview').isVisible(), true);
    await openMenu(page); await page.locator('#experienceLanguage').click();
    await closed(page);
    assert.ok(await page.locator('[role=dialog]:visible, dialog:visible').count() > 0);
    await page.keyboard.press('Escape');
    await openMenu(page); await page.locator('[data-magazine-actions]').click();
    await closed(page);
    assert.equal(await page.locator('.pp-menu-panel').isVisible(), true);
    assert.ok(await page.locator('.pp-menu-panel button').count() >= 5);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('Ontdek blijft bereikbaar met 200% tekst op een kort scherm en bij RTL op 320px', async () => {
  for (const mode of ['large-text', 'rtl']) {
    const width = mode === 'rtl' ? 320 : 390, height = 600;
    const { context, page, errors } = await fixture(width, height);
    try {
      await page.evaluate(mode => {
        if (mode === 'large-text') document.documentElement.style.fontSize = '200%';
        else document.documentElement.dir = 'rtl';
      }, mode);
      const sheet = await openMenu(page), details = page.locator('#explorePanel details').first();
      await seekMenuControl(page, sheet, details.locator('summary'));
      await details.locator('summary').click();
      assert.equal(await details.evaluate(node => node.open), true);
      const bounds = await sheet.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth, body: document.documentElement.scrollWidth, viewport: innerWidth }));
      assert.ok(bounds.scrollWidth <= bounds.width + 1, mode + ': geen horizontale overloop binnen het menu');
      assert.ok(bounds.body <= bounds.viewport + 1, mode + ': geen horizontale documentoverloop');
      for (const control of await details.locator('a:visible, button:visible').all()) {
        await seekMenuControl(page, sheet, control);
        const reachable = await control.evaluate(node => {
          const box = node.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
          return box.height >= 43.9 && x >= 0 && x <= innerWidth && y >= 0 && y <= innerHeight && node.contains(document.elementFromPoint(x, y));
        });
        assert.equal(reachable, true, mode + ': bereikbaar uitgebreid menu-item ' + (await control.innerText()).trim());
      }
      const close = sheet.locator('[data-rtg-adaptive-close]'), closeBox = await close.boundingBox();
      assert.ok(closeBox && closeBox.y >= 0 && closeBox.y + closeBox.height <= height + 1, mode + ': sluitknop blijft zichtbaar');
      await close.click(); await closed(page);
      await page.waitForFunction(() => document.activeElement === document.querySelector('[data-magazine-menu]'));
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});
