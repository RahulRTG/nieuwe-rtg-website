'use strict';
// A finite horizontal magazine/menu; vertical reading belongs only to an
// explicitly opened article/detail. No app, account or mutation traffic.
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const { laadPlaywright, startBrowser, letOpFouten } = require('./helper');
const root = path.join(__dirname, '..');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
const ids = ['editie', 'inhoudsopgave', 'interview', 'bedoeling', 'reisverhaal', 'reisnotities', 'goedeleven', 'salon-verhaal', 'ondernemen', 'foundation-verhaal', 'atelier', 'werelden-gids', 'code', 'vertrouwen', 'eigen-regie', 'lid-worden', 'service-gids', 'tot-ziens'];
const sizes = [[320, 844, false], [390, 844, false], [768, 900, false], [1440, 900, false], [390, 600, false], [390, 600, true], [391, 650, false], [393, 600, false], [320, 600, true]];
const sheetSelector = '.ds-public-edge .rtg-adaptive-sheet';
const doorSelector = '.ds-public-edge .ds-public-edge-toggle';
const barSelector = '.ds-public-edge .rtg-adaptive-bar';
const longCaption = 'Een zorgvuldig gelezen verhaal over reizen, ontmoetingen, persoonlijke aandacht en de ruimte om het goede leven op uw eigen manier te ontdekken.';
let server, browser, base;

test.before(async () => {
  const remote = process.env.RTG_FIXED_MAGAZINE_URL;
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
  browser = await startBrowser(laadPlaywright({ eigenDriver: false }));
});
test.after(async () => { if (browser) await browser.close(); if (server) await new Promise(resolve => server.close(resolve)); });

async function settle(page) { await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))); }
async function fixture(width, height, largeText) {
  const context = await browser.newContext({ viewport: { width, height }, locale: 'nl-NL', reducedMotion: 'reduce', serviceWorkers: 'block' });
  await context.addInitScript(() => localStorage.setItem('rtg_lang', 'nl'));
  await context.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    return url.origin === base && ['GET', 'HEAD'].includes(request.method()) && !url.pathname.startsWith('/apps/')
      ? route.continue() : route.fulfill({ status: 503, body: 'Read-only fixed-magazine fixture' });
  });
  const page = await context.newPage(), errors = [], missing = [];
  page.setDefaultTimeout(10000);
  letOpFouten(page, errors);
  page.on('response', response => { if (response.status() >= 400 && ['image', 'script', 'stylesheet', 'font'].includes(response.request().resourceType())) missing.push(response.url()); });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.RTGPublicApp && !!history.state?.rtgMagazine && document.body.dataset.magazineView === 'cover');
  await page.evaluate(() => document.fonts.ready);
  if (largeText) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  await settle(page);
  await page.evaluate(() => {
    window.fixedSourceContents = document.getElementById('inhoudsopgave');
    window.fixedSourceArticle = document.getElementById('artikel-code');
    window.fixedSourceFooter = document.querySelector('.ds-magazine-footer');
    window.fixedMenuNodes = Array.from(document.querySelectorAll('#explorePanel a, #explorePanel button, #explorePanel summary'));
  });
  return { context, page, errors, missing };
}

async function hit(control) {
  return control.evaluate(node => {
    const box = node.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
    return box.width >= 43.9 && box.height >= 43.9 && box.left >= -.5 && box.right <= innerWidth + .5 && box.top >= -.5 && box.bottom <= innerHeight + .5 && node.contains(document.elementFromPoint(x, y));
  });
}
async function fixed(page, scope, label) {
  const result = await scope.evaluate(node => {
    const scrollables = [node, ...node.querySelectorAll('*')].filter(element => {
      const box = element.getBoundingClientRect(), style = getComputedStyle(element);
      return box.width > 0 && box.height > 0 && box.right > 0 && box.left < innerWidth && /^(auto|scroll)$/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 2;
    }).map(element => element.id || element.className || element.tagName);
    return { scrollables, y: scrollY, documentHeight: document.documentElement.scrollHeight, height: innerHeight, documentWidth: document.documentElement.scrollWidth, width: innerWidth };
  });
  assert.deepEqual(result.scrollables, [], label + ': geen verticaal scrollvlak in de voorvertoning');
  assert.equal(result.y, 0, label + ': document blijft bovenaan');
  assert.ok(result.documentHeight <= result.height + 2, label + ': document is viewportvast, hoogte ' + result.documentHeight + '/' + result.height);
  assert.ok(result.documentWidth <= result.width + 2, label + ': document krijgt geen horizontale overloop');
  assert.equal(await page.locator('body').getAttribute('data-magazine-view'), 'cover');
}
async function leaf(page, id) {
  await page.waitForFunction(id => !document.getElementById('magazineHome').hidden && document.querySelector('[data-issue-caption]').textContent === document.getElementById(id).dataset.issueLabel, id);
  await settle(page);
}
async function openEdge(page, name) {
  // Real reading movement closes the quiet doorway. Wait for that original
  // owner to settle before opening, rather than retrying an interrupted click.
  await page.evaluate(() => new Promise((resolve, reject) => {
    const track = document.getElementById('issueTrack');
    let position = track.scrollLeft, stable = performance.now(), started = stable;
    function sample(now) {
      const next = track.scrollLeft;
      if (Math.abs(next - position) > .1) stable = now;
      position = next;
      if (now - stable >= 220) return resolve();
      if (now - started > 4000) return reject(new Error('het oorspronkelijke magazine blijft bewegen'));
      requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }));
  if (!await page.locator(barSelector).isVisible()) {
    const door = page.locator(doorSelector);
    assert.equal(await hit(door), true, 'de oorspronkelijke Edge-ingang blijft bereikbaar');
    await door.focus(); await page.keyboard.press('Enter'); await settle(page);
  }
  const control = page.locator(barSelector + ' [data-rtg-adaptive-action="' + name + '"]');
  assert.equal(await hit(control), true, name + ': de native Edge-actie blijft bereikbaar');
  await control.focus(); await page.keyboard.press('Enter');
  await page.locator(sheetSelector).waitFor({ state: 'visible' });
  await page.waitForFunction(() => /^\d+\s*\/\s*\d+$/.test(document.querySelector('.ds-edge-page-status').textContent));
  await settle(page);
}
async function seek(page, control) {
  await firstMenuPage(page);
  for (let index = 0; index < 80; index++) {
    if (await hit(control)) return;
    if (!await turnMenu(page, 1)) break;
  }
  assert.fail('de oorspronkelijke actie is nergens volledig bereikbaar: ' + await control.textContent());
}
async function contentsPage(page) {
  await openEdge(page, 'context');
  const contents = page.locator(sheetSelector).getByRole('button', { name: 'Inhoud van deze editie', exact: true });
  await seek(page, contents); await contents.click(); await leaf(page, 'inhoudsopgave');
}
async function sourceCaption(page) {
  // Exercise a legitimate long title at its original reader owner. The Edge
  // must derive and paginate it; never replace the generated caption itself.
  await page.evaluate(title => {
    document.getElementById('editie').dataset.issueLabel = title;
    window.dispatchEvent(new Event('rtg-public-reading-change'));
    window.fixedCaptionSource = document.querySelector('.ds-edge-gallery figcaption p');
  }, longCaption);
  await page.waitForFunction(title => document.querySelector('.ds-edge-gallery figcaption p').textContent === title, longCaption);
}
async function back(page) {
  await page.locator('#magazineBack').click();
  await page.waitForFunction(() => document.body.dataset.magazineView === 'cover' && !document.getElementById('magazineHome').hidden);
  await settle(page);
}
async function turnMenu(page, direction) {
  const button = page.locator(sheetSelector + ' [data-edge-page="' + direction + '"]');
  if (await button.isDisabled()) return false;
  assert.equal(await hit(button), true, 'menubladerknop blijft volledig bereikbaar');
  const old = await page.locator('.ds-edge-page-status').innerText();
  await button.click();
  await page.waitForFunction(old => document.querySelector('.ds-edge-page-status').textContent !== old, old);
  await settle(page);
  return true;
}
async function firstMenuPage(page) {
  for (let index = 0; index < 80; index++) if (!await turnMenu(page, -1)) return;
  assert.fail('horizontaal menu heeft geen begrensd begin');
}
async function reachableOriginals(page, key) {
  return page.evaluate(key => {
    const viewport = document.querySelector('.ds-edge-pages').getBoundingClientRect();
    return window[key].map((node, index) => {
      const box = node.getBoundingClientRect(), x = box.left + box.width / 2, y = box.top + box.height / 2;
      const reachable = node.isConnected && box.width >= 43.9 && box.height >= 43.9 && box.left >= viewport.left - 1 && box.right <= viewport.right + 1 && box.top >= viewport.top - 1 && box.bottom <= viewport.bottom + 1 && y >= 0 && y <= innerHeight && node.contains(document.elementFromPoint(x, y));
      return { index, label: node.textContent.trim(), reachable };
    });
  }, key);
}
async function scanMenu(page, key, targetIndex) {
  const found = new Set(), sheet = page.locator(sheetSelector);
  await firstMenuPage(page);
  for (let pageIndex = 0; pageIndex < 80; pageIndex++) {
    await fixed(page, sheet, 'menublad ' + (pageIndex + 1));
    const layout = await sheet.locator('.ds-edge-pages').evaluate(node => {
      const viewport = node.getBoundingClientRect();
      return {
        status: document.querySelector('.ds-edge-page-status').textContent.match(/\d+/g).map(Number),
        leaves: Array.from(node.querySelectorAll('.ds-edge-leaf')).map(leaf => {
          const box = leaf.getBoundingClientRect();
          return { width: box.width, height: box.height, hidden: leaf.hidden, inert: leaf.inert };
        }),
        clipped: Array.from(node.querySelectorAll('[data-edge-page-overflow]')).map(leaf => ({ label: leaf.textContent.trim().slice(0, 120), contentHeight: leaf.scrollHeight, availableHeight: node.clientHeight })),
        width: viewport.width, height: viewport.height
      };
    });
    assert.ok(layout.leaves.length > 0, 'het menu heeft echte expliciete bladen');
    assert.deepEqual(layout.clipped, [], 'geen afzonderlijke bron wordt stil afgeknipt in een menublad');
    assert.deepEqual(layout.status, [pageIndex + 1, layout.leaves.length], 'de teller telt echte bladen, niet geschatte CSS-kolommen');
    for (const pageBox of layout.leaves) {
      assert.equal(pageBox.hidden || pageBox.inert, false, 'geen verborgen of inerte duplicaatbladen');
      assert.ok(Math.abs(pageBox.width - layout.width) <= 2, 'ieder menublad past exact in de horizontale viewport');
      assert.ok(pageBox.height <= layout.height + 2, 'ieder menublad blijft binnen de beschikbare hoogte');
    }
    assert.equal(await hit(sheet.locator('[data-rtg-adaptive-close]')), true, 'sluiten blijft bereikbaar zonder verticale scroll');
    const current = await reachableOriginals(page, key);
    current.filter(item => item.reachable).forEach(item => found.add(item.index));
    if (targetIndex !== undefined && found.has(targetIndex)) return found;
    if (!await turnMenu(page, 1)) return found;
  }
  assert.fail('horizontaal menu heeft geen begrensd einde');
}

for (const [width, height, largeText] of sizes) {
  const label = width + ' × ' + height + (largeText ? ' / 200% tekst' : '');
  test('18 viewportvaste bladen, inhoud en colofon via Edge; alleen een geopend verhaal scrollt op ' + label, async () => {
    const { context, page, errors, missing } = await fixture(width, height, largeText);
    try {
      assert.deepEqual(await page.locator('#issueTrack > [data-issue-page]').evaluateAll(nodes => nodes.map(node => node.id)), ids);
      await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' })); await settle(page);
      for (let index = 0; index < ids.length; index++) {
        await leaf(page, ids[index]);
        const card = page.locator('#' + ids[index]);
        await fixed(page, card, ids[index]);
        assert.equal(await page.locator('[data-carousel-status]').textContent(), (index + 1) + ' / 18');
        const preview = card.locator('[data-read-leaf="' + ids[index] + '"]');
        if (await card.evaluate(node => node.classList.contains('ds-issue-condensed'))) assert.equal(await hit(preview), true, ids[index] + ': volledige inhoud heeft een bereikbare opening');
        await openEdge(page, 'context');
        const publication = page.locator(sheetSelector).getByRole('button', { name: 'Service, informatie en colofon', exact: true });
        await seek(page, publication);
        assert.equal(await hit(publication), true, 'de oorspronkelijke colofonroute blijft vanaf ieder blad bereikbaar via Edge');
        if (index < ids.length - 1) {
          const next = page.locator('[data-carousel-next]');
          await seek(page, next);
          assert.equal(await hit(next), true, 'volgende bladzijde blijft binnen het scherm');
          await next.click();
        }
      }
      assert.equal(await page.locator('[data-carousel-next]').getAttribute('aria-disabled'), 'true', 'de editie is eindig');
      await page.locator(sheetSelector).getByRole('button', { name: 'Service, informatie en colofon', exact: true }).click();
      await page.waitForFunction(() => document.body.dataset.magazineView === 'article' && document.getElementById('magazineDetailContent').contains(window.fixedSourceFooter));
      assert.equal(await page.evaluate(() => document.querySelector('#magazineDetailContent .ds-magazine-footer') === window.fixedSourceFooter), true, 'Info opent de oorspronkelijke footer, geen kopie');
      await back(page);
      await contentsPage(page);
      const contents = page.locator('#inhoudsopgave');
      if (await contents.evaluate(node => node.classList.contains('ds-issue-condensed'))) {
        await contents.locator('[data-read-leaf="inhoudsopgave"]').click();
        await page.waitForFunction(() => document.getElementById('magazineDetailContent').contains(window.fixedSourceContents));
        assert.equal(await page.evaluate(() => document.querySelector('#magazineDetailContent > #inhoudsopgave') === window.fixedSourceContents), true);
      }
      await page.locator('#journal a[href="#artikel-code"]').click();
      await page.waitForFunction(() => document.body.dataset.magazineView === 'article' && document.getElementById('magazineDetailContent').contains(window.fixedSourceArticle));
      assert.equal(await page.evaluate(() => document.querySelector('#magazineDetailContent > #artikel-code') === window.fixedSourceArticle), true, 'het oorspronkelijke verhaal blijft de leeseigenaar');
      await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }));
      await page.waitForFunction(() => window.scrollY > 100);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 100), 'het geopende artikel kan echt verticaal worden gelezen');
      await back(page);
      await fixed(page, page.locator('#magazineHome'), 'terug uit het artikel');
      assert.equal(await page.locator('#issueTrack > [data-issue-page]').count(), 18, 'alle originele bladen zijn terug in de editie');
      assert.deepEqual(errors, []); assert.deepEqual(missing, []);
    } finally { await context.close(); }
  });

  test('Ontdek en alle servicetabs zijn volledig horizontaal bereikbaar op ' + label, async () => {
    const { context, page, errors, missing } = await fixture(width, height, largeText);
    try {
      assert.deepEqual(await page.locator('#explorePanel .ds-discover-routes a').evaluateAll(nodes => nodes.map(node => node.dataset.go)), ['reisverhaal', 'goedeleven', 'journal', 'ondernemen', 'passen', 'rahul']);
      if (width === 320 && largeText) {
        const skip = page.locator('.ds-magazine-skip'), menu = page.locator(doorSelector);
        assert.ok(await skip.evaluate(node => node.getBoundingClientRect().bottom <= 0), 'de hogere 200%-skiplink blijft in rust volledig buiten beeld');
        assert.equal(await hit(menu), true, 'de verborgen skiplink onderschept het mobiele menu niet');
        // macOS Safari includes links with Option-Tab; ordinary Tab follows
        // the OS preference and may skip links, including the skiplink.
        const tabKey = browser.browserType().name() === 'webkit' ? 'Alt+Tab' : 'Tab';
        await page.keyboard.press(tabKey);
        await page.waitForFunction(() => document.activeElement === document.querySelector('.ds-magazine-skip'));
        assert.equal(await hit(skip), true, 'de eerste toetsenbord-Tab toont de volledige bereikbare skiplink');
        await page.keyboard.press(tabKey); await settle(page);
        assert.equal(await skip.evaluate(node => document.activeElement === node), false, 'Tab verlaat de skiplink zonder focusval');
        assert.ok(await skip.evaluate(node => node.getBoundingClientRect().bottom <= 0), 'de skiplink verdwijnt opnieuw na focusverlies');
        assert.equal(await hit(menu), true, 'het menu is na de toetsenbordfocus opnieuw vrij bereikbaar');
        await fixed(page, page.locator('#magazineHome'), '200%-skiplinkfocus');
      }
      await openEdge(page, 'menu');
      const sheet = page.locator(sheetSelector);
      await sheet.waitFor({ state: 'visible' });
      await page.waitForFunction(() => /^\d+\s*\/\s*\d+$/.test(document.querySelector('.ds-edge-page-status').textContent));
      const summaryIndex = await page.evaluate(() => window.fixedMenuNodes.findIndex(node => node.tagName === 'SUMMARY'));
      assert.ok(summaryIndex >= 0, 'de oorspronkelijke ingang naar platformmogelijkheden bestaat');
      assert.ok((await scanMenu(page, 'fixedMenuNodes', summaryIndex)).has(summaryIndex), 'platformmogelijkheden zijn horizontaal bereikbaar');
      const summary = await page.evaluateHandle(index => window.fixedMenuNodes[index], summaryIndex);
      await summary.asElement().click();
      await settle(page);
      assert.equal(await page.evaluate(index => window.fixedMenuNodes[index].parentElement.open, summaryIndex), true);
      const found = await scanMenu(page, 'fixedMenuNodes');
      const expected = await page.evaluate(() => window.fixedMenuNodes.map((node, index) => ({ index, label: node.textContent.trim(), connected: node.isConnected })));
      assert.deepEqual(expected.filter(item => !item.connected || !found.has(item.index)).map(item => item.label), [], 'elke oorspronkelijke route, taal/zoek/actietoets en platformlink past op een bereikbaar menublad');
      for (const name of ['connect', 'media', 'account', 'now']) {
        const tab = sheet.locator('[data-rtg-adaptive-mode="' + name + '"]');
        await tab.focus(); await settle(page);
        assert.equal(await hit(tab), true, name + ': tab blijft zonder verticale scroll bereikbaar');
        await tab.click();
        await sheet.locator(width >= 1100 ? '.ds-edge-reading-art[data-editorial-ready]' : '.ds-edge-gallery[data-mode="' + name + '"] img').waitFor({ state: 'visible' });
        await settle(page);
        assert.equal(await hit(tab), true, name + ': actieve tab blijft zichtbaar in de horizontale rij');
        const tabTops = await sheet.locator('[data-rtg-adaptive-mode]').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
        assert.ok(Math.max(...tabTops) - Math.min(...tabTops) <= 1, 'alle servicetabs blijven op één regel');
        const count = await page.evaluate(name => {
          const selector = name === 'now' ? '.ds-edge-reading-links a, .ds-edge-reading-links button' : '.rtg-adaptive-service button';
          window.fixedServiceNodes = Array.from(document.querySelectorAll('.ds-public-edge ' + selector.split(', ').join(', .ds-public-edge ')));
          return window.fixedServiceNodes.length;
        }, name);
        assert.equal(count, name === 'account' ? 3 : name === 'now' ? 1 : 2, name + ': oorspronkelijke serviceacties of de actuele zoekingang zijn aanwezig');
        const accessible = await scanMenu(page, 'fixedServiceNodes');
        assert.equal(accessible.size, count, name + ': alle acties zijn volledig horizontaal bereikbaar');
        assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1, 'één canonieke Edge');
      }
      await sheet.locator('[data-rtg-adaptive-close]').click();
      await sheet.waitFor({ state: 'hidden' });
      await fixed(page, page.locator('#magazineHome'), 'menu gesloten');
      assert.deepEqual(errors, []); assert.deepEqual(missing, []);
    } finally { await context.close(); }
  });
}

test('lange native captions blijven exact en volledig leesbaar na tekstvergroting, tabwissel en resize', async () => {
  const { context, page, errors, missing } = await fixture(320, 600, true);
  try {
    await sourceCaption(page);
    await openEdge(page, 'menu');
    const sheet = page.locator(sheetSelector);
    const captions = { connect: longCaption, account: longCaption };
    let sawFragments = false;
    for (const [mode, expected] of Object.entries(captions)) {
      const tab = sheet.locator('[data-rtg-adaptive-mode="' + mode + '"]');
      await tab.focus(); await settle(page);
      assert.equal(await hit(tab), true, mode + ': de lange bronkop bedekt de native tab niet');
      await tab.click();
      await page.waitForFunction(mode => document.querySelector('.ds-edge-gallery').dataset.mode === mode, mode);
      await sheet.locator('.ds-edge-gallery[data-mode="' + mode + '"] img').waitFor({ state: 'visible' });
      assert.equal(await sheet.locator('.ds-edge-reading-caption').textContent(), expected, 'de compacte oriëntatiekop bewaart de volledige brontekst');
      assert.equal(await sheet.locator('.ds-edge-reading-caption').getAttribute('aria-label'), 'Blad 1 · 18: ' + expected, 'de volledige bronkop blijft toegankelijk benoemd');
      for (const [width, height, largeText] of [[320, 600, true], [390, 844, false], [320, 600, true]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(largeText => { document.documentElement.style.fontSize = largeText ? '200%' : ''; }, largeText);
        await settle(page); await firstMenuPage(page); await settle(page);
        const source = await page.evaluate(() => {
          const node = document.querySelector('.ds-edge-gallery figcaption p'), spans = Array.from(node.querySelectorAll(':scope > .ds-edge-caption-leaf'));
          return { same: node === window.fixedCaptionSource, text: node.textContent, count: spans.length || 1 };
        });
        assert.equal(source.same, true, mode + ': de oorspronkelijke alinea blijft de eigenaar');
        assert.equal(source.text, expected, mode + ': geen tekst wordt herschreven, gedupliceerd of weggelaten');
        sawFragments ||= source.count > 1;
        const found = new Set();
        for (let index = 0; index < 80; index++) {
          await fixed(page, sheet, mode + ': captionblad');
          assert.equal(await sheet.locator('[data-edge-page-overflow]').count(), 0, mode + ': geen caption of actie wordt afgeknipt');
          const current = await page.evaluate(() => {
            const viewport = document.querySelector('.ds-edge-pages').getBoundingClientRect();
            const source = document.querySelector('.ds-edge-gallery figcaption p'), spans = Array.from(source.querySelectorAll(':scope > .ds-edge-caption-leaf'));
            let offset = 0;
            // Generated fragments may be replaced by image/font reflow. Read
            // the current native paragraph and track its logical text, not
            // disposable wrapper identities from an earlier layout.
            const fragments = (spans.length ? spans : [source]).map(node => {
              const start = offset; offset += node.textContent.length;
              const range = document.createRange(); range.selectNodeContents(node);
              const rects = Array.from(range.getClientRects()).filter(box => box.width > 0 && box.height > 0);
              return { start, end: offset, visible: node.isConnected && rects.length > 0 && rects.every(box => box.left >= viewport.left - 1 && box.right <= viewport.right + 1 && box.top >= viewport.top - 1 && box.bottom <= viewport.bottom + 1 && node.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))) };
            });
            return { same: source === window.fixedCaptionSource, text: source.textContent, fragments };
          });
          assert.equal(current.same, true, mode + ': ook na herpaginering blijft de oorspronkelijke alinea eigenaar');
          assert.equal(current.text, expected, mode + ': ook tijdens het bladeren blijft de volledige brontekst exact');
          current.fragments.filter(fragment => fragment.visible).forEach(fragment => {
            for (let offset = fragment.start; offset < fragment.end; offset++) found.add(offset);
          });
          if (!await turnMenu(page, 1)) break;
        }
        assert.equal(found.size, expected.length, mode + ': ieder teken van de bron staat in een volledig zichtbaar tekstfragment bij ' + width + 'px/' + (largeText ? '200%' : '100%'));
      }
    }
    assert.equal(sawFragments, true, 'de kleine 200%-viewport oefent werkelijk de lange-captionpaginering');
    assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  } finally { await context.close(); }
});

test('een vertraagd kunstbeeld behoudt het gelezen captionblad en zijn logische tekstpositie', async () => {
  const { context, page, errors, missing } = await fixture(320, 600, true);
  try {
    const expected = longCaption;
    await sourceCaption(page);
    await page.evaluate(() => { window.fixedDelayedCaptionSource = document.querySelector('.ds-edge-gallery figcaption p'); });
    await openEdge(page, 'menu');
    const sheet = page.locator(sheetSelector), tab = sheet.locator('[data-rtg-adaptive-mode="connect"]');
    await tab.focus(); await settle(page);
    assert.equal(await hit(tab), true, 'de lange bronkop bedekt de Connect-tab niet');
    await tab.click();
    await page.waitForFunction(() => {
      const gallery = document.querySelector('.ds-edge-gallery'), image = gallery.querySelector('img');
      return gallery.dataset.mode === 'connect' && image.complete && image.naturalWidth > 0 && gallery.querySelectorAll('.ds-edge-caption-leaf').length > 1;
    });
    await settle(page); await firstMenuPage(page);
    const target = await page.evaluate(() => {
      const fragments = Array.from(document.querySelectorAll('.ds-edge-gallery figcaption p > .ds-edge-caption-leaf'));
      return Array.from(document.querySelectorAll('.ds-edge-pages .ds-edge-leaf')).indexOf(fragments[1]);
    });
    assert.ok(target > 1, 'de proef leest een tweede tekstfragment voorbij het kunstbeeld');
    for (let index = 0; index < target; index++) assert.equal(await turnMenu(page, 1), true);
    const before = await page.evaluate(() => {
      const source = document.querySelector('.ds-edge-gallery figcaption p'), fragments = Array.from(source.querySelectorAll(':scope > .ds-edge-caption-leaf'));
      window.fixedDelayedCaptionFragment = fragments[1];
      return { same: source === window.fixedDelayedCaptionSource, text: source.textContent, offset: fragments[0].textContent.length, status: document.querySelector('.ds-edge-page-status').textContent };
    });
    assert.equal(before.same, true); assert.equal(before.text, expected); assert.ok(before.offset > 0);
    assert.equal(Number(before.status.match(/\d+/)[0]), target + 1, 'het tweede tekstfragment wordt werkelijk gelezen');
    // Exercise the real captured image-load handler after navigation, without
    // relying on a particular network speed or cached-image timing.
    await page.evaluate(() => document.querySelector('.ds-edge-gallery img').dispatchEvent(new Event('load')));
    await page.waitForFunction(() => !window.fixedDelayedCaptionFragment.isConnected);
    await settle(page);
    const after = await page.evaluate(() => {
      const source = document.querySelector('.ds-edge-gallery figcaption p'), viewport = document.querySelector('.ds-edge-pages').getBoundingClientRect();
      const centre = viewport.left + viewport.width / 2, fragments = Array.from(source.querySelectorAll(':scope > .ds-edge-caption-leaf'));
      let offset = 0;
      const current = fragments.map(node => {
        const start = offset; offset += node.textContent.length;
        const box = node.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(node);
        const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0);
        return { start, distance: Math.abs(box.left + box.width / 2 - centre), visible: rects.length > 0 && rects.every(rect => rect.left >= viewport.left - 1 && rect.right <= viewport.right + 1 && rect.top >= viewport.top - 1 && rect.bottom <= viewport.bottom + 1 && node.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))) };
      }).sort((a, b) => a.distance - b.distance)[0];
      return { same: source === window.fixedDelayedCaptionSource, text: source.textContent, status: document.querySelector('.ds-edge-page-status').textContent, current };
    });
    assert.equal(after.same, true, 'het native bronknooppunt blijft behouden na het vertraagde load-event');
    assert.equal(after.text, expected, 'de native brontekst blijft exact');
    assert.equal(after.status, before.status, 'het kunstbeeld zet de lezer niet terug naar blad één');
    assert.equal(after.current.start, before.offset, 'dezelfde logische tekstpositie blijft vooraan');
    assert.equal(after.current.visible, true, 'het behouden tekstfragment blijft volledig zichtbaar en raakt niet afgeknipt');
    await fixed(page, sheet, 'caption na vertraagd beeld');
    assert.deepEqual(errors, []); assert.deepEqual(missing, []);
  } finally { await context.close(); }
});

test('directe blad-links herladen in dezelfde leesstand en keren zonder kopie terug naar hun oorsprong', async () => {
  for (const id of ['inhoudsopgave', 'publicatie']) {
    const { context, page, errors } = await fixture(390, 600, false);
    try {
      const route = 'blad:' + id;
      await page.goto(base + '/#rtg?story=overview&detail=' + encodeURIComponent(route), { waitUntil: 'networkidle' });
      await page.waitForFunction(route => history.state?.rtgMagazine?.id === route && document.body.dataset.magazineView === 'article', route);
      const source = page.locator('#magazineDetailContent > .ds-issue-reader');
      assert.equal(await source.count(), 1);
      const text = await source.textContent();
      assert.equal(await page.evaluate(() => history.state.rtgMagazine.depth), 0, 'een directe link maakt geen fictieve teruggeschiedenis');
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForFunction(route => history.state?.rtgMagazine?.id === route && document.body.dataset.magazineView === 'article', route);
      assert.equal(await source.textContent(), text, 'alle oorspronkelijke inhoud blijft behouden na herladen');
      await page.evaluate(() => { window.fixedReloadedSource = document.querySelector('#magazineDetailContent > .ds-issue-reader'); });
      await back(page);
      await leaf(page, id === 'publicatie' ? 'editie' : id);
      assert.equal(await page.evaluate(id => id === 'publicatie'
        ? document.querySelector('body > .ds-magazine-footer') === window.fixedReloadedSource
        : document.querySelector('#issueTrack > #' + id) === window.fixedReloadedSource, id), true, 'terug herstelt exact de oorspronkelijke node');
      assert.equal(await page.locator('#magazineDetailContent > .ds-issue-reader').count(), 0);
      assert.equal(await page.locator('#issueTrack > [data-issue-page]').count(), 18);
      await fixed(page, page.locator('#magazineHome'), 'directe bladroute terug');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  }
});

test('browser-terug en vooruit herstellen het compacte inhoudsblad, zijn originele knop en de echte leesplek', async () => {
  const { context, page, errors } = await fixture(390, 600, true);
  try {
    await contentsPage(page);
    const opener = page.locator('#inhoudsopgave [data-read-leaf="inhoudsopgave"]');
    assert.equal(await hit(opener), true);
    await opener.click();
    await page.waitForFunction(() => history.state?.rtgMagazine?.id === 'blad:inhoudsopgave' && document.getElementById('magazineDetailContent').contains(window.fixedSourceContents));
    await page.evaluate(() => window.scrollTo({ top: 350, behavior: 'instant' }));
    await page.waitForFunction(() => scrollY > 100 && Math.abs(history.state.rtgMagazine.scroll - scrollY) < 2);
    const position = await page.evaluate(() => scrollY);
    await page.goBack();
    await leaf(page, 'inhoudsopgave');
    await page.waitForFunction(() => document.activeElement === document.querySelector('#inhoudsopgave [data-read-leaf="inhoudsopgave"]'));
    assert.equal(await page.evaluate(() => document.querySelector('#issueTrack > #inhoudsopgave') === window.fixedSourceContents), true);
    await fixed(page, page.locator('#magazineHome'), 'inhoud terug');
    await page.goForward();
    await page.waitForFunction(position => history.state?.rtgMagazine?.id === 'blad:inhoudsopgave' && Math.abs(scrollY - position) < 3, position);
    assert.equal(await page.evaluate(() => document.querySelector('#magazineDetailContent > #inhoudsopgave') === window.fixedSourceContents), true);
    assert.equal(await page.locator('#inhoudsopgave').count(), 1);
    await back(page); await leaf(page, 'inhoudsopgave');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test('RTL-menu heeft begrensde horizontale scroll, logische bladknoppen en passende fysieke pijltoetsen', async () => {
  const { context, page, errors } = await fixture(320, 600, false);
  try {
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    await openEdge(page, 'menu');
    const sheet = page.locator(sheetSelector), pages = sheet.locator('.ds-edge-pages');
    await page.waitForFunction(() => /^1\s*\/\s*\d+$/.test(document.querySelector('.ds-edge-page-status').textContent));
    assert.ok(await pages.evaluate(node => node.scrollWidth > node.clientWidth + 10), 'het kleine RTL-menu heeft meerdere bladen');
    await turnMenu(page, 1);
    assert.match(await sheet.locator('.ds-edge-page-status').innerText(), /^2\s*\//);
    assert.ok(await pages.evaluate(node => node.scrollLeft < 0), 'RTL bladert in de logische negatieve scrollrichting');
    await turnMenu(page, -1);
    await pages.focus(); await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => /^2\s*\//.test(document.querySelector('.ds-edge-page-status').textContent));
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => /^1\s*\//.test(document.querySelector('.ds-edge-page-status').textContent));
    await pages.evaluate(node => {
      const leaves = node.querySelectorAll('.ds-edge-leaf');
      const first = leaves[0].getBoundingClientRect(), second = leaves[1].getBoundingClientRect();
      node.scrollBy({ left: (second.left + second.width / 2) - (first.left + first.width / 2), behavior: 'instant' });
    });
    await page.waitForFunction(() => /^2\s*\//.test(document.querySelector('.ds-edge-page-status').textContent));
    await page.keyboard.press('End');
    await page.waitForFunction(() => { const values = document.querySelector('.ds-edge-page-status').textContent.match(/\d+/g); return values && values[0] === values[1]; });
    assert.equal(await sheet.locator('[data-edge-page="1"]').isDisabled(), true);
    await page.keyboard.press('Home');
    await page.waitForFunction(() => /^1\s*\//.test(document.querySelector('.ds-edge-page-status').textContent));
    assert.equal(await sheet.locator('[data-edge-page="-1"]').isDisabled(), true);
    await fixed(page, sheet, 'RTL-menu');
    assert.equal(await hit(sheet.locator('[data-rtg-adaptive-close]')), true);
    assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
