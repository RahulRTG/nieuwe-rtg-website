'use strict';
// The painted public doorway is presentation over the original Adaptive Edge.
// Static fixtures only: accounts, providers and all mutations remain blocked.
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { laadPlaywright, startBrowser, letOpFouten } = require('./helper');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const edge = '.ds-public-edge.ds-edge', sheet = edge + ' .rtg-adaptive-sheet';
let server, browser, base;

test.before(async () => {
  const remote = process.env.RTG_PAINTED_EDGE_URL;
  if (remote) {
    assert.match(remote, /^https:\/\/[a-f0-9]{8}-rahul-travel-group-www\.rtg-corporate-website\.workers\.dev\/?$/, 'alleen een onveranderlijke RTG-preview');
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
  assert.ok(pw, 'de expliciete Playwright-runtime moet beschikbaar zijn; geen stil overgeslagen bewijs');
  browser = await startBrowser(pw);
});
test.after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function fixture(width, { height = 844, route = '/', rtl = false, largeText = false } = {}) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
  const blocked = [], translations = [];
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    if (request.method() === 'POST' && url.pathname === '/api/talen' && [base, 'https://app.rahultravelgroup.com'].includes(url.origin)) {
      translations.push(request.url());
      return route.fulfill({ status: 503, body: 'Existing i18n request blocked; no live translation or mutation.' });
    }
    if (url.origin !== base || !['GET', 'HEAD'].includes(request.method()) || /^\/(apps|api)\//.test(url.pathname)) {
      blocked.push(request.method() + ' ' + request.url());
      return route.fulfill({ status: 503, body: 'Painted Edge proof: account, provider and mutation traffic blocked.' });
    }
    return route.continue();
  });
  const page = await context.newPage(), errors = [], missing = [];
  page.setDefaultTimeout(10000);
  letOpFouten(page, errors);
  page.on('response', response => { if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) missing.push(response.url()); });
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.classList.contains('ds-public-edge-page') && document.body.dataset.rtgAdaptiveReady === 'true');
  await page.locator('.ds-public-edge-toggle').waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  if (rtl) await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
  if (largeText) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await settle(page);
  await page.evaluate(() => {
    window.paintedOriginal = {
      buttons: Array.from(document.querySelectorAll('.ds-public-edge .rtg-adaptive-bar button')),
      routes: Array.from(document.querySelectorAll('#explorePanel .ds-discover-routes a')),
      rahul: document.getElementById('rahul'), intent: document.getElementById('intent')
    };
  });
  return { context, page, errors, missing, blocked, translations };
}
async function hit(control) {
  const result = await control.evaluate(node => {
    const b = node.getBoundingClientRect();
    const target=document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
    return { ok: b.width >= 43.9 && b.height >= 43.9 && b.left >= -.5 && b.right <= innerWidth + .5 && b.top >= -.5 && b.bottom <= innerHeight + .5 && node.contains(target), label:node.getAttribute('aria-label')||node.textContent, rect:[b.left,b.top,b.width,b.height], viewport:[innerWidth,innerHeight], target:target&&target.outerHTML.slice(0,400) };
  });
  if(!result.ok)console.log('Unreachable control',JSON.stringify(result));
  return result.ok;
}
async function noCoverOverflow(page) {
  const bounds = await page.evaluate(() => ({ view: document.body.dataset.magazineView, x: scrollX, y: scrollY, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, vw: innerWidth, vh: innerHeight }));
  assert.ok(bounds.width <= bounds.vw + 1, 'geen horizontale documentoverloop');
  if (bounds.view === 'cover') {
    assert.equal(bounds.y, 0, 'de cover blijft bovenaan');
    assert.ok(bounds.height <= bounds.vh + 2, 'de cover krijgt geen verticale scroll');
  }
}
async function alphaProof(image) {
  const pixels = await image.evaluate(node => {
    const canvas = document.createElement('canvas'); canvas.width = node.naturalWidth; canvas.height = node.naturalHeight;
    const context = canvas.getContext('2d'); context.drawImage(node, 0, 0);
    const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const alpha = (x, y) => rgba[(y * canvas.width + x) * 4 + 3];
    const patch = (x, y) => {
      const values = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) values.push(alpha(x + dx, y + dy));
      return Math.max(...values);
    };
    let painted = 0, transparent = 0;
    for (let i = 3; i < rgba.length; i += 4) { if (rgba[i] >= 128) painted++; if (rgba[i] <= 2) transparent++; }
    return {
      corners: [[1, 1], [canvas.width - 2, 1], [1, canvas.height - 2], [canvas.width - 2, canvas.height - 2]].map(([x, y]) => patch(x, y)),
      mouth: patch(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
      painted: painted / (canvas.width * canvas.height), transparent: transparent / (canvas.width * canvas.height)
    };
  });
  assert.ok(pixels.corners.every(alpha => alpha <= 2), 'alle vier afbeeldingshoeken zijn echt transparant, niet wit geschilderd');
  assert.ok(pixels.mouth <= 2, 'ook de open mondspleet heeft echte alpha-transparantie');
  assert.ok(pixels.painted > .1, 'het asset bevat een substantieel zichtbaar geschilderd lippenbeeld');
  assert.ok(pixels.transparent > .1, 'de transparante ruimte is geen toevallig enkel hoekpixel');
}
async function collapsed(page, expectFocus = false) {
  const door = page.locator(edge + ' .ds-public-edge-toggle');
  await page.waitForFunction(() => document.querySelector('.ds-public-edge-toggle')?.getAttribute('aria-expanded') === 'false');
  assert.equal(await door.getAttribute('aria-label'), 'Edge openen');
  assert.equal(await hit(door), true, 'de losse geschilderde lippen hebben een bereikbaar doel van minstens 44px');
  assert.equal(await page.locator(edge + ' .rtg-adaptive-bar').isVisible(), false, 'gesloten is geen tweede balk zichtbaar');
  const paint = await door.evaluate(node => {
    const s = getComputedStyle(node), canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d'); context.fillStyle = s.backgroundColor; context.fillRect(0, 0, 1, 1);
    return { alpha: context.getImageData(0, 0, 1, 1).data[3], background: s.backgroundImage, shadow: s.boxShadow, borders: [s.borderTopWidth, s.borderRightWidth, s.borderBottomWidth, s.borderLeftWidth], focused: document.activeElement === node };
  });
  assert.equal(paint.alpha, 0, 'geen gekleurde knopachtergrond onder de geschilderde lippen');
  assert.equal(paint.background, 'none'); assert.equal(paint.shadow, 'none', 'geen capsule-schaduw');
  assert.ok(paint.borders.every(value => parseFloat(value) === 0), 'geen omranding rond het vrijstaande kunstmerk');
  if (expectFocus) assert.equal(paint.focused, true, 'Escape keert terug naar de zichtbare lippenknop');
  const image = door.locator('img');
  assert.equal(await image.count(), 1); await image.evaluate(node => node.decode());
  assert.match(await image.getAttribute('src'), /\/brand\/rtg-edge-lips\.webp$/);
  assert.equal(await image.getAttribute('alt'), '', 'het knoplabel draagt de functie, het schilderij is decoratief');
  assert.equal(await image.evaluate(node => node.naturalWidth > 0 && node.naturalHeight > 0 && getComputedStyle(node).objectFit === 'contain'), true);
  await alphaProof(image);
  await noCoverOverflow(page);
}
async function openDock(page) {
  const bar = page.locator(edge + ' .rtg-adaptive-bar');
  if (!await bar.isVisible()) {
    const door = page.locator(edge + ' .ds-public-edge-toggle');
    await door.focus(); await page.keyboard.press('Enter');
    await bar.waitFor({ state: 'visible' }); await settle(page);
  }
  return bar;
}
async function dockProof(page) {
  const bar = await openDock(page), buttons = bar.locator('button.ds-edge__knop');
  assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1, 'één runtime, geen nieuwe geschilderde navigatie-eigenaar');
  assert.equal(await buttons.count(), 5);
  assert.deepEqual(await buttons.evaluateAll(nodes => nodes.map(node => node.dataset.rtgAdaptiveAction)), ['home', 'worlds', 'ai', 'context', 'menu']);
  assert.equal(await buttons.evaluateAll(nodes => nodes.every((node, index) => node === window.paintedOriginal.buttons[index])), true, 'de vijf oorspronkelijke action-nodes blijven behouden');
  for (const button of await buttons.all()) assert.equal(await hit(button), true, 'alle vijf acties zijn binnen het scherm en minstens 44px');
  // The class may be on the image itself or its decorative wrapper.
  const painted = bar.locator('[data-rtg-adaptive-action="ai"] .ds-edge-painted-lips');
  assert.equal(await painted.count(), 1, 'de centrale Rahul-knop draagt precies één geschilderd lippenbeeld');
  const image = painted.locator('xpath=self::img | .//img');
  assert.equal(await image.count(), 1); await image.evaluate(node => node.decode());
  assert.match(await image.getAttribute('src'), /\/brand\/rtg-edge-lips\.webp$/);
  assert.equal(await image.evaluate(node => node.classList.contains('rtg-adaptive-lips')), true, 'het oorspronkelijke native lippencontract blijft aanwezig');
  assert.equal(await image.isVisible(), true);
  assert.equal(await painted.evaluate(node => node.closest('[data-rtg-adaptive-action]')?.dataset.rtgAdaptiveAction), 'ai');
  await noCoverOverflow(page);
}
async function action(page, name) {
  const bar = await openDock(page), button = bar.locator('[data-rtg-adaptive-action="' + name + '"]');
  assert.equal(await hit(button), true); await button.focus(); await page.keyboard.press('Enter'); await settle(page);
}
async function escape(page) {
  const before = await page.evaluate(() => ({ focus: document.activeElement?.outerHTML.slice(0, 400), state: document.querySelector('.rtg-adaptive-edge')?.dataset.rtgAdaptiveState }));
  await page.keyboard.press('Escape'); await page.locator(sheet).waitFor({ state: 'hidden' }); await settle(page);
  if (!await page.locator(edge + ' .ds-public-edge-toggle').evaluate(node => document.activeElement === node)) {
    const after = await page.evaluate(() => ({ focus: document.activeElement?.outerHTML.slice(0, 400), state: document.querySelector('.rtg-adaptive-edge')?.dataset.rtgAdaptiveState }));
    console.log('Escape focus diagnostic', JSON.stringify({ before, after }));
  }
  await collapsed(page, true);
}
async function mode(page, name) {
  const button = page.locator(sheet + ' [data-rtg-adaptive-mode="' + name + '"]');
  await button.focus(); await settle(page);
  assert.equal(await hit(button), true, name + ': de originele horizontale modetab blijft bereikbaar');
  await page.keyboard.press('Enter'); await settle(page);
  if (name === 'rahul') await page.locator('#magazineDetailContent > #rahul').waitFor({ state: 'visible' });
  else {
    const desktop = await page.evaluate(() => matchMedia('(min-width: 1100px)').matches);
    await page.locator(sheet + (desktop ? ' .ds-edge-reading-art[data-editorial-ready]' : ' .ds-edge-gallery[data-mode="' + name + '"] img')).waitFor({ state: 'visible' });
    assert.equal(await button.getAttribute('aria-pressed'), 'true');
  }
}
async function turn(page, direction) {
  const button = page.locator(sheet + ' [data-edge-page="' + direction + '"]');
  if (await button.isDisabled()) return false;
  const status = await page.locator(sheet + ' .ds-edge-page-status').innerText();
  assert.equal(await hit(button), true, 'de echte menubladerknop blijft bereikbaar');
  await button.click();
  await page.waitForFunction(old => document.querySelector('.ds-edge-page-status').textContent !== old, status); await settle(page); return true;
}
async function scanOriginals(page, key, targetIndex) {
  for (let index = 0; index < 80 && await turn(page, -1); index++);
  const found = new Set();
  for (let index = 0; index < 80; index++) {
    const state = await page.evaluate(key => {
      const viewport = document.querySelector('.ds-edge-pages'), bounds = viewport.getBoundingClientRect();
      return {
        count: viewport.querySelectorAll('.ds-edge-leaf').length,
        status: document.querySelector('.ds-edge-page-status').textContent.match(/\d+/g).map(Number),
        overflow: viewport.querySelectorAll('[data-edge-page-overflow]').length,
        overflowDetails: Array.from(viewport.querySelectorAll('[data-edge-page-overflow]')).map(node => ({
          text: node.textContent, height: node.scrollHeight, available: viewport.clientHeight,
          children: Array.from(node.children).map(child => ({ tag: child.tagName, className: child.className, height: child.getBoundingClientRect().height }))
        })),
        originals: window[key].map((node, id) => {
          const b = node.getBoundingClientRect();
          return { id, connected: node.isConnected, hit: b.width >= 43.9 && b.height >= 43.9 && b.left >= bounds.left - 1 && b.right <= bounds.right + 1 && b.top >= bounds.top - 1 && b.bottom <= bounds.bottom + 1 && node.contains(document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)) };
        })
      };
    }, key);
    assert.deepEqual(state.status, [index + 1, state.count], 'de teller beschrijft de echte menubladen');
    assert.equal(state.overflow, 0, 'geen oorspronkelijke bediening wordt stil afgeknipt: ' + JSON.stringify(state.overflowDetails));
    for (const item of state.originals) { assert.equal(item.connected, true, 'het oorspronkelijke element blijft verbonden'); if (item.hit) found.add(item.id); }
    assert.equal(await hit(page.locator(sheet + ' [data-rtg-adaptive-close]')), true);
    await noCoverOverflow(page);
    if (targetIndex !== undefined && found.has(targetIndex)) return;
    if (!await turn(page, 1)) { assert.equal(found.size, state.originals.length, 'alle originele acties zijn over de menubladen bereikbaar'); return; }
  }
  assert.fail('het geschilderde menu moet eindig en volledig bereikbaar blijven');
}
function clean(result) { assert.deepEqual(result.errors, []); assert.deepEqual(result.missing, []); assert.deepEqual(result.blocked, [], 'geen account-, provider- of mutatieverzoek buiten de expliciet geblokkeerde i18n-aanvraag'); }

for (const width of [320, 390, 1440]) test('geschilderde Edge ' + width + 'px: vrijstaand gesloten merk, vijf originele acties en toetsenbordsluiting', async () => {
  const result = await fixture(width), { context, page } = result;
  try {
    await collapsed(page); await dockProof(page);
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    await page.keyboard.press('Escape'); await settle(page); await collapsed(page, true);
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('.ds-public-edge-toggle').waitFor({ state: 'visible' }); await settle(page);
    await collapsed(page); clean(result);
  } finally { await context.close(); }
});

test('geschilderde Edge op een detailbron gebruikt dezelfde vrijstaande ingang en oorspronkelijke runtime', async () => {
  const result = await fixture(390, { route: '/public/site/werelden/livingos.html' }), { context, page } = result;
  try { await collapsed(page); await dockProof(page); await page.keyboard.press('Escape'); await settle(page); await collapsed(page, true); clean(result); }
  finally { await context.close(); }
});

for (const [width,height,rtl,largeText] of [[320,600,false,false],[320,600,true,false],[390,600,false,true],[1440,900,false,false]]) test('geschilderd menu behoudt Nu, Rahul, Connect, Media en Account op '+width+'px' + (rtl ? ' in RTL' : '') + (largeText ? ' / 200% tekst' : ''), async () => {
  const result = await fixture(width, { height, rtl, largeText }), { context, page } = result;
  try {
    await collapsed(page);
    await action(page, 'menu');
    assert.deepEqual(await page.locator(sheet + ' [data-rtg-adaptive-mode]').evaluateAll(nodes => nodes.map(node => node.dataset.rtgAdaptiveMode)), ['now', 'rahul', 'connect', 'media', 'account']);
    await page.evaluate(() => { window.paintedRoutes = window.paintedOriginal.routes; });
    assert.equal(await page.locator('#explorePanel .ds-discover-routes a').count(), 6);
    await scanOriginals(page, 'paintedRoutes');
    await escape(page); await action(page, 'menu');
    for (const [name, labels] of [['connect', ['Open berichten', 'Open uw mensen']], ['media', ['Open RTG Media', 'Open RTG Sound']], ['account', ['Open uw account', 'Privacy en veiligheid', 'Uw gegevens']]]) {
      await mode(page, name);
      await page.evaluate(() => { window.paintedServices = Array.from(document.querySelectorAll('.rtg-adaptive-service button')); });
      assert.deepEqual(await page.locator(sheet + ' .rtg-adaptive-service button > span').allTextContents(), labels);
      await scanOriginals(page, 'paintedServices');
    }
    await mode(page, 'now');
    // Nu now follows the original current leaf. Its contextual links replace
    // the generic shortcut; the original edition entrance remains in Menu.
    await page.evaluate(() => { window.paintedNow = Array.from(document.querySelectorAll('.ds-edge-reading-links a, .ds-edge-reading-links button')); });
    assert.ok(await page.locator(sheet + ' .ds-edge-reading-links :is(a,button)').count() > 0, 'Nu heeft actuele leesacties');
    await scanOriginals(page, 'paintedNow');
    await escape(page); await action(page, 'menu');
    await page.evaluate(() => { window.paintedContents = Array.from(document.querySelectorAll('#explorePanel button')).filter(node => node.textContent === 'Inhoud van deze editie'); });
    assert.equal(await page.evaluate(() => window.paintedContents.length), 1, 'de oorspronkelijke inhoudsactie blijft één keer aanwezig');
    await scanOriginals(page, 'paintedContents', 0);
    await page.locator(sheet + ' #explorePanel').getByRole('button', { name: 'Inhoud van deze editie', exact: true }).click();
    await page.waitForFunction(() => history.state?.rtgMagazine?.id === 'inhoudsopgave'); await collapsed(page);
    await action(page, 'menu'); await mode(page, 'rahul');
    assert.equal(await page.evaluate(() => document.getElementById('rahul') === window.paintedOriginal.rahul && document.getElementById('intent') === window.paintedOriginal.intent), true, 'Rahul blijft het oorspronkelijke formulier, geen kunstzinnige kopie');
    await page.locator('#intent').fill('Een reis met kunst');
    await action(page, 'menu'); await mode(page, 'rahul');
    assert.equal(await page.locator('#intent').inputValue(), 'Een reis met kunst');
    await page.evaluate(() => { window.paintedMediaCalls = []; window.RTGSpeler = { live: () => true, stuur: command => window.paintedMediaCalls.push(command) }; });
    await action(page, 'menu'); await mode(page, 'media');
    await page.evaluate(() => { window.paintedMediaButtons = Array.from(document.querySelectorAll('.rtg-adaptive-media-controls button')); });
    for (let index = 0; index < 3; index++) {
      await scanOriginals(page, 'paintedMediaButtons', index);
      await page.locator(sheet + ' .rtg-adaptive-media-controls button').nth(index).click();
    }
    assert.deepEqual(await page.evaluate(() => window.paintedMediaCalls), ['prev', 'toggle', 'next'], 'de bestaande mediaspelerclosures blijven werken');
    // An article intentionally has native Back rather than a Home slot.
    await escape(page); await page.locator('#magazineBack').click();
    await page.waitForFunction(() => document.body.dataset.magazineView === 'cover');
    await collapsed(page); clean(result);
  } finally { await context.close(); }
});
