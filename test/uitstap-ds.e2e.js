/* De echte Uitstap-owner/CSS in native browserlagen. Het neutrale externe
   adres wordt uitsluitend in deze proef lokaal onderschept: geen webverkeer. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright(), pad = '/apps/zz-uitstap-ds-proef.html';
test('Uitstap blijft onmiddellijk beschikbaar in de echte modalvolgorde, op de beschermde deur en met grote tekst',
  { skip: geenBrowser(pw), timeout: 90000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitstap-ds-'));
  let server, browser;
  try {
    server = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dir } });
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block', reducedMotion: 'reduce' });
    const page = await ctx.newPage(), fouten = [];
    letOpFouten(page, fouten);
    await page.route('**' + pad, r => r.fulfill({ status: 200, contentType: 'text/html', body:
      '<!doctype html><html lang="nl" data-ds><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/ds/rtg-ds.css"></head>' +
      '<body class="ds-scherm ds-foundation"><main class="ds-taak" id="home"><h1>Uitstapproef</h1>' +
      '<label class="ds-veldlabel">Concept<textarea class="ds-invoer" id="concept">Behoud mijn concept</textarea></label></main>' +
      '<nav class="ds-edge"><div class="ds-edge__balk"><button class="ds-edge__knop">Menu</button></div></nav>' +
      '<dialog class="ds-dialoog" id="eerste"><h2>Eerste in DOM</h2><input class="ds-invoer" aria-label="Eerste invoer"></dialog>' +
      '<dialog class="ds-dialoog" id="laatste"><h2>Laatste in DOM</h2><input class="ds-invoer" aria-label="Laatste invoer"></dialog>' +
      '<script src="/shared/uitstap.js"></script></body></html>' }));
    let gevlucht = 0;
    await page.route('https://www.google.nl/**', r => { gevlucht++; return r.fulfill({ status: 200, contentType: 'text/html', body: '<title>Neutrale proef</title><p>Neutrale proefpagina</p>' }); });
    await page.goto(server.base + pad, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { window.__vlucht = document.getElementById('rtg-uitstap'); localStorage.setItem('vluchtconcept', 'behouden'); return document.fonts.ready; });
    const exit = page.locator('#rtg-uitstap');
    assert.equal(await exit.getAttribute('style'), null, 'DS injecteert geen oude knopstijl');
    const basis = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    for (const width of [390,820,1440]) for (const zoom of [1,2]) {
      await page.setViewportSize({ width, height: 568 });
      await page.evaluate(({ basis, zoom }) => { document.documentElement.style.fontSize = basis * zoom + 'px'; }, { basis, zoom });
      for (const host of ['body','laatste','eerste']) {
        if (host !== 'body') await page.locator('#' + host).evaluate(e => e.showModal());
        await page.waitForFunction(id => {
          const b = document.getElementById('rtg-uitstap');
          return b && (id === 'body' ? b.parentNode === document.body : b.parentNode.id === id);
        }, host);
        const m = await exit.evaluate(e => {
          const r = e.getBoundingClientRect(), s = getComputedStyle(e), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          const edge = document.querySelector('.ds-edge').getBoundingClientRect();
          return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height,
            viewport: [innerWidth,innerHeight], bereikbaar: e === hit || e.contains(hit), font: s.fontFamily,
            edgeVrij: r.bottom <= edge.y || r.right <= edge.x || r.x >= edge.right,
            zelfde: e === window.__vlucht, aantal: document.querySelectorAll('#rtg-uitstap').length };
        });
        assert.ok(m.w >= 44 && m.h >= 44 && m.x >= 0 && m.y >= 0 && m.right <= width + 1 && m.bottom <= 569 && m.bereikbaar && m.edgeVrij,
          JSON.stringify({ width, zoom, host, m }));
        assert.equal(m.zelfde, true); assert.equal(m.aantal, 1); assert.match(m.font, /Inter/);
        await exit.click({ trial: true });
        await exit.focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
        assert.equal(await exit.evaluate(e => document.activeElement === e && e.matches(':focus-visible') && parseFloat(getComputedStyle(e).outlineWidth) >= 2), true);
      }
      // De geometrieproef sluit via dezelfde native primitive; de Escape-
      // veiligheidsactie krijgt hieronder een afzonderlijke echte toets.
      await page.locator('#eerste').evaluate(e => e.close());
      await page.waitForFunction(() => !document.getElementById('eerste').open && document.getElementById('rtg-uitstap').parentNode.id === 'laatste');
      assert.equal(gevlucht, 0);
      await page.locator('#laatste').evaluate(e => e.close());
      await page.waitForFunction(() => document.getElementById('rtg-uitstap').parentNode === document.body);
    }
    // Native Escape closes only the first-in-DOM (last opened) dialog.
    await page.locator('#laatste').evaluate(e => e.showModal());
    await page.locator('#eerste').evaluate(e => e.showModal());
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('eerste').open && document.getElementById('rtg-uitstap').parentNode.id === 'laatste');
    assert.equal(gevlucht, 0);
    await page.locator('#laatste').evaluate(e => e.close());
    // Same DOM shape as DesktopSurface's protected, non-native Foundation door.
    await page.evaluate(() => {
      const home = document.getElementById('home'); home.inert = true;
      document.documentElement.classList.add('ds-foundation-dicht');
      const gate = document.createElement('section'); gate.className = 'ds-dialoog ds-foundation-toegang';
      gate.id = 'veiligedeur'; gate.setAttribute('role','alertdialog'); gate.setAttribute('aria-modal','true');
      gate.innerHTML = '<h2>Gesloten ruimte</h2><button class="ds-knop">Ander profiel</button>';
      document.body.appendChild(gate); gate.querySelector('button').focus();
    });
    await page.waitForFunction(() => document.getElementById('rtg-uitstap').parentNode.id === 'veiligedeur');
    await exit.click({ trial: true });
    assert.equal(await page.locator('#home').evaluate(e => e.inert), true);
    assert.equal(await page.locator('#concept').inputValue(), 'Behoud mijn concept');
    await page.locator('#veiligedeur').evaluate(e => { e.innerHTML = '<p>Nieuw antwoord, dezelfde gesloten deur</p>'; });
    await page.waitForFunction(() => document.getElementById('rtg-uitstap') === window.__vlucht && window.__vlucht.parentNode.id === 'veiligedeur');
    const history = await page.evaluate(() => window.history.length);
    await exit.click(); await page.waitForURL('https://www.google.nl/**');
    assert.equal(gevlucht, 1); assert.equal(await page.evaluate(() => window.history.length), history, 'replace stapelt geen nieuwe geschiedenis');
    await page.goto(server.base + pad, { waitUntil: 'domcontentloaded' });
    assert.equal(await page.evaluate(() => localStorage.getItem('vluchtconcept')), 'behouden');
    // Een bestaande overlay mag Escape stoppen; capture behoudt de vluchttoets.
    await page.locator('#eerste').evaluate(e => { e.showModal(); e.addEventListener('keydown', ev => ev.stopPropagation()); });
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await page.waitForURL('https://www.google.nl/**'); assert.equal(gevlucht, 2);
    assert.deepEqual(fouten, []);
  } finally { if (browser) await browser.close(); server?.child.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
});
