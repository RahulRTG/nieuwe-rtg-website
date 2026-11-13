'use strict';
// Visual contract only. Existing public-edge-tabs.e2e.js owns native service,
// account-route, media, form-identity and repeated-navigation regression proofs.
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { laadPlaywright, startBrowser } = require('./helper');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const sheetSelector = '.ds-public-edge .rtg-adaptive-sheet';
const screenshotDirectory = path.join(root, 'output/brand/journal-edition-01');
let server, browser, base;

test.before(async () => {
  const remote = process.env.RTG_COLOUR_TABS_URL;
  if (remote) {
    assert.match(remote, /^https:\/\/[a-f0-9]{8}-rahul-travel-group-www\.rtg-corporate-website\.workers\.dev\/?$/, 'RTG_COLOUR_TABS_URL moet een onveranderlijke RTG-preview zijn');
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

async function fixture(width, height = 844, largeText = false) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base || !['GET', 'HEAD'].includes(request.method()) || url.pathname.startsWith('/apps/')) {
      return route.fulfill({ status: 503, body: 'Read-only colour fixture: app, external and mutation traffic excluded' });
    }
    return route.continue();
  });
  const page = await context.newPage(), errors = [], missing = [];
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) missing.push(response.url());
  });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.RTGPublicApp && !!history.state?.rtgMagazine);
  await page.evaluate(() => document.fonts.ready);
  if (largeText) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await page.locator('[data-magazine-menu]').click();
  await page.locator('#explorePanel').waitFor({ state: 'visible' });
  return { context, page, errors, missing, sheet: page.locator(sheetSelector) };
}

async function inspect(sheet, options = {}) {
  return sheet.evaluate((node, options) => {
    // Canvas resolves both rgb() and CSS Color 4 color(srgb ...) values in the
    // actual browser, avoiding a regex that silently misreads color-mix().
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    function colour(css) {
      context.clearRect(0, 0, 1, 1); context.fillStyle = css; context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data);
    }
    function composite(front, back) {
      const alpha = front[3] / 255;
      return [0, 1, 2].map(index => front[index] * alpha + back[index] * (1 - alpha)).concat(255);
    }
    function background(element) {
      const stack = []; for (let current = element; current; current = current.parentElement) stack.unshift(current);
      return stack.reduce((paint, current) => composite(colour(getComputedStyle(current).backgroundColor), paint), [255, 255, 255, 255]);
    }
    function luminance(rgb) {
      const linear = rgb.slice(0, 3).map(value => { value /= 255; return value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4); });
      return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    }
    function contrast(element, pseudo) {
      const style = getComputedStyle(element, pseudo), back = background(element), ink = colour(style.color);
      ink[3] *= Number(style.opacity);
      const front = composite(ink, back);
      const a = luminance(front), b = luminance(back); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    }
    function visible(element) {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      // Native closed details can retain layout boxes through
      // ::details-content/content-visibility; only their own summary is shown.
      for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName !== 'DETAILS' || parent.open) continue;
        const summary = Array.from(parent.children).find(child => child.tagName === 'SUMMARY');
        if (!summary || !summary.contains(element)) return false;
      }
      return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0;
    }
    const controls = Array.from(node.querySelectorAll(options.controls || 'button, .ds-edge-now a, .ds-discover-service a, .ds-discover-service summary, .ds-discover-routes a, .ds-discover-art')).filter(visible).map(control => {
      const box = control.getBoundingClientRect(), textParents = [], walker = document.createTreeWalker(control, NodeFilter.SHOW_TEXT);
      let text; while ((text = walker.nextNode())) if (text.textContent.trim() && !text.parentElement.closest('[aria-hidden="true"]')) textParents.push(text.parentElement);
      const selector = control.tagName.toLowerCase() + (control.id ? '#' + control.id : '') + (control.classList.length ? '.' + Array.from(control.classList).join('.') : '') + (control.hasAttribute('href') ? '[href="' + control.getAttribute('href') + '"]' : '');
      return { label: control.innerText.trim() || control.getAttribute('aria-label') || control.textContent.trim() || selector, selector, rect: { x: box.x, y: box.y, width: box.width, height: box.height }, width: box.width, height: box.height, disabled: control.disabled || control.getAttribute('aria-disabled') === 'true', contrast: Math.min(...(textParents.length ? textParents : [control]).map(element => contrast(element))) };
    });
    function capsule(element) {
      const style = getComputedStyle(element), box = element.getBoundingClientRect();
      const radius = value => value.endsWith('%') ? parseFloat(value) * Math.min(box.width, box.height) / 100 : parseFloat(value);
      return { width: box.width, height: box.height, radii: [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius].map(radius), background: colour(style.backgroundColor), ink: colour(style.color) };
    }
    const active = node.querySelector('[data-rtg-adaptive-mode][aria-pressed="true"]');
    const activeStyle = active ? getComputedStyle(active) : null;
    const activeTab = active ? { ...capsule(active), weight: activeStyle.fontWeight, lineWidth: parseFloat(activeStyle.borderBottomWidth), lineColour: colour(activeStyle.borderBottomColor), accent: colour(activeStyle.getPropertyValue('--ds-accent').trim()) } : null;
    const fields = Array.from(node.querySelectorAll('#intentForm input, #intentForm button')).filter(visible).map(element => ({ label: element.id || element.innerText.trim(), ...capsule(element) }));
    const readability = Array.from(node.querySelectorAll(options.readability || '#intentForm label, #intentForm input, #intentForm button, #intentForm small, #intentFeedback')).filter(visible).map(element => ({ label: element.id || element.innerText.trim(), contrast: contrast(element) }));
    const input = node.querySelector('#intentForm input[placeholder]');
    if (input) readability.push({ label: 'placeholder', contrast: contrast(input, '::placeholder') });
    const style = getComputedStyle(node), header = node.querySelector('.rtg-adaptive-sheet-head');
    return {
      paperToken: style.getPropertyValue('--ds-edge-paper').trim(),
      journalToken: style.getPropertyValue('--ds-journal-paper').trim(), journalPaper: colour(style.getPropertyValue('--ds-journal-paper').trim()),
      paper: colour(style.backgroundColor), header: header ? colour(getComputedStyle(header).backgroundColor) : null,
      controls, activeTab, fields, readability, width: node.clientWidth, scrollWidth: node.scrollWidth,
      documentWidth: document.documentElement.scrollWidth, viewport: innerWidth
    };
  }, options);
}

test('Rahul behoudt gekleurd papier, leesbaar formulier en capsulebediening', async () => {
  const { context, page, sheet, errors, missing } = await fixture(390);
  try {
    await sheet.locator('[data-rtg-adaptive-mode="rahul"]').click();
    await sheet.waitFor({ state: 'hidden' });
    const studio = page.locator('#magazineDetailContent > #rahul.ds-rahul-studio');
    await studio.waitFor({ state: 'visible' });
    await studio.locator('#intent').fill('Een reis met kunst en gesprekken');
    const state = await inspect(studio);
    assert.equal(state.paper[3], 255, 'Rahul heeft een volledig dekkende grondkleur');
    assert.ok(Math.max(...state.paper.slice(0, 3)) - Math.min(...state.paper.slice(0, 3)) >= 12, 'Rahul heeft zichtbaar gekleurd papier: ' + state.paper.join(','));
    assert.equal(state.fields.length, 2, 'het bestaande invoerveld en de bestaande verzendknop blijven beschikbaar');
    for (const field of state.fields) {
      assert.ok(field.width >= 43.9 && field.height >= 43.9, field.label + ': minstens 44 × 44px');
      assert.ok(field.radii.every(radius => radius >= field.height / 2 - .5), field.label + ': capsulevorm');
    }
    assert.ok(state.readability.length >= 6, 'label, invoertekst, knop, hulptekst, status en placeholder worden gemeten');
    for (const text of state.readability) assert.ok(text.contrast >= 4.5, 'Rahul: tekstcontrast minstens 4.5:1 voor ' + text.label + ', gemeten ' + text.contrast.toFixed(2));
    assert.ok(state.scrollWidth <= state.width + 1, 'geen horizontale overloop in Rahul');
    assert.ok(state.documentWidth <= state.viewport + 1, 'geen horizontale documentoverloop');
    await studio.locator('#intentForm').evaluate(node => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await snapshot(page, studio, 390, 'rahul', false);
    assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  } finally { await context.close(); }
});

async function snapshot(page, sheet, width, name, largeText) {
  if (process.env.RTG_COLOUR_SCREENSHOTS !== '1' || largeText || !(width === 390 || width === 1440 && name === 'discover')) return;
  await sheet.evaluate(async node => {
    node.scrollTop = 0;
    await Promise.all(Array.from(node.querySelectorAll('img')).filter(image => image.getBoundingClientRect().width > 0).map(image => image.decode()));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDirectory, 'colour-tabs-' + name + '-' + (width === 390 ? 'mobile' : 'desktop') + '.png'), animations: 'disabled' });
}

async function warmChrome(page, selector) {
  const state = await inspect(page.locator(selector), { controls: 'a, button, summary', readability: 'p, small' });
  assert.ok(state.journalToken, selector + ': warm papier komt uit het centrale Journal-token');
  assert.equal(state.paper[3], 255, selector + ': de grond is volledig dekkend');
  assert.deepEqual(state.paper, state.journalPaper, selector + ': de grond volgt het semantische papier');
  assert.ok(state.paper[0] > state.paper[2] + 3 && state.paper[1] > state.paper[2], selector + ': warm papier, geen puur wit of koel grijs');
  for (const control of state.controls) {
    assert.ok(control.height >= 43.9 && control.width >= 43.9, selector + ': minstens 44 × 44px voor ' + control.label + ' (' + control.selector + '): ' + JSON.stringify(control.rect));
    if (!control.disabled) assert.ok(control.contrast >= 4.5, selector + ': bedieningscontrast minstens 4.5:1 voor ' + control.label + ', gemeten ' + control.contrast.toFixed(2));
  }
  for (const text of state.readability) assert.ok(text.contrast >= 4.5, selector + ': tekstcontrast minstens 4.5:1 voor ' + text.label + ', gemeten ' + text.contrast.toFixed(2));
  assert.ok(state.scrollWidth <= state.width + 1, selector + ': geen horizontale overloop');
}

for (const [width, height, largeText] of [[320, 844, false], [390, 844, false], [768, 900, false], [1440, 900, false], [390, 600, true]]) {
  test('zacht gekleurde Edge met klassieke onderstreepte tabs op ' + width + ' × ' + height + (largeText ? ' / 200% tekst' : ''), async () => {
    const { context, page, sheet, errors, missing } = await fixture(width, height, largeText);
    try {
      const palette = [];
      for (const name of ['discover', 'connect', 'media', 'account', 'now']) {
        if (name !== 'discover') {
          await sheet.locator('[data-rtg-adaptive-mode="' + name + '"]').click();
          await sheet.locator('.ds-edge-gallery[data-mode="' + name + '"] img').waitFor({ state: 'visible' });
          assert.equal(await sheet.locator('[data-rtg-adaptive-mode="' + name + '"]').getAttribute('aria-pressed'), 'true');
        }
        const state = await inspect(sheet);
        assert.ok(state.paperToken, name + ': kleur komt uit het semantische Edge-papiertoken');
        assert.equal(state.paper[3], 255, name + ': het hele paneel heeft een dekkende grondkleur');
        assert.ok(Math.max(...state.paper.slice(0, 3)) - Math.min(...state.paper.slice(0, 3)) >= 6, name + ': zacht gekleurd papier, geen wit of neutraal grijs: ' + state.paper.join(','));
        assert.deepEqual(state.header, state.paper, name + ': de kleur loopt door achter de vaste kop');
        assert.ok(state.scrollWidth <= state.width + 1, name + ': geen horizontale paneeloverloop');
        assert.ok(state.documentWidth <= state.viewport + 1, name + ': geen horizontale documentoverloop');
        for (const control of state.controls) {
          assert.ok(control.height >= 43.9 && control.width >= 43.9, name + ': minstens 44 × 44px voor ' + control.label + ' (' + control.selector + '): ' + JSON.stringify(control.rect));
          assert.ok(control.contrast >= 4.5, name + ': tekstcontrast minstens 4.5:1 voor ' + control.label + ', gemeten ' + control.contrast.toFixed(2));
        }
        if (name !== 'discover') {
          assert.ok(state.activeTab && state.activeTab.radii.every(radius => radius === 0), name + ': de actieve tab heeft geen capsulehoeken');
          assert.equal(state.activeTab.background[3], 0, name + ': de actieve tab blijft transparant');
          assert.deepEqual(state.activeTab.ink, state.activeTab.accent, name + ': actieve tekst gebruikt het bestaande accent');
          assert.equal(state.activeTab.lineWidth, 2, name + ': fijne onderstreping markeert de actieve tab');
          assert.deepEqual(state.activeTab.lineColour, state.activeTab.accent, name + ': onderstreping gebruikt hetzelfde accent');
          assert.equal(state.activeTab.weight, '500', name + ': ingetogen medium typografie');
        }
        palette.push(state.paper.slice(0, 3).join(','));
        await snapshot(page, sheet, width, name, largeText);
      }
      assert.ok(new Set(palette).size >= 3, 'de tabs gebruiken minstens drie eigen kleurfamilies, niet één herhaald wit paneel');
      assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1, 'de presentatie blijft in de oorspronkelijke Edge');
      await sheet.locator('[data-rtg-adaptive-close]').click();
      await sheet.waitFor({ state: 'hidden' });
      for (const selector of ['.ds-magazine-masthead', '.ds-issue-topline', '.ds-issue-controls']) await warmChrome(page, selector);
      await page.locator('.ds-magazine-imprint[data-read-leaf="publicatie"]').click();
      await page.locator('#magazineDetailContent > .ds-magazine-footer').waitFor({ state: 'visible' });
      await warmChrome(page, '#magazineDetailContent > .ds-magazine-footer');
      assert.deepEqual(errors, []); assert.deepEqual(missing, []);
    } finally { await context.close(); }
  });
}
