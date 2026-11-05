/* Bestaande RTGDeel-owner met de echte centrale DS-CSS. Componentproef;
   de echte Foundation-route wordt afzonderlijk met gezinssessie beproefd. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { geenOverloop } = require('./lib/ds-toets');
const { bundel } = require('../scripts/bundel');
const pw = laadPlaywright();
const pad = '/apps/zz-deelmenu-ds-proef.html';
const legacyPad = '/apps/zz-deelmenu-legacy-proef.html';
const labels = ['Hoe gaat het echt met jou?', 'Even je hart luchten', 'Wanneer het te veel wordt'];
test('DS deelmenu blijft volledig leesbaar en bedienbaar; wisselen en herscan verliezen geen concept of domeingrens',
  { skip: geenBrowser(pw) }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-deelmenu-ds-'));
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
      '<body class="ds-scherm"><main class="ds-taak">' + labels.map((l, i) =>
        '<section class="kaart ds-velden" data-deel="' + i + '"><h2 class="ds-titel">' + l + '</h2>' +
        (i === 0 ? '<label class="ds-veldlabel">Concept<textarea id="concept" class="ds-invoer ds-invoer--tekst"></textarea></label>' : '<p>Inhoud ' + i + '</p>') +
        (i === 1 ? '<p id="privaat" hidden>Niet bevoegd</p>' : '') + '</section>').join('') +
      '</main><script src="/shared/deelmenu.js"></script></body></html>' }));
    await page.route('**/shared/deelmenu.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: bundel('shared/deelmenu.js').toString('utf8') }));
    assert.equal((await page.goto(server.base + pad, { waitUntil: 'load' })).status(), 200);
    await page.evaluate(() => document.fonts.ready);
    await page.waitForSelector('.ds-deelmenu-knop');
    assert.equal(await page.locator('#rtgdeel-stijl').count(), 0);
    assert.equal(await page.locator('style').count(), 0);
    await page.locator('#concept').fill('Mijn eigen concept');
    await page.evaluate(() => { window.__concept = document.getElementById('concept'); });
    const basis = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
    for (const width of [390,820,1440]) for (const zoom of [1,2]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(({ basis, zoom }) => { document.documentElement.style.fontSize = basis * zoom + 'px'; }, { basis, zoom });
      await geenOverloop(page);
      for (const [i, name] of labels.entries()) {
        const button = page.getByRole('button', { name, exact: true });
        const m = await button.evaluate(b => {
          const r = b.getBoundingClientRect(), s = getComputedStyle(b);
          return { width: r.width, height: r.height, x: r.x, right: r.right, font: s.fontFamily,
            wrap: s.whiteSpace, scroll: b.scrollWidth, client: b.clientWidth };
        });
        assert.ok(m.width >= 44 && m.height >= 44 && m.x >= 0 && m.right <= width + 1 && m.scroll <= m.client + 1,
          JSON.stringify({ width, zoom, name, m }));
        assert.match(m.font, /Inter/); assert.equal(m.wrap, 'normal');
        await button.click();
        assert.equal(await button.getAttribute('aria-current'), 'true');
        const visible = await page.locator('[data-deel]').evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).map(n => n.getAttribute('data-deel')));
        assert.deepEqual(visible, [String(i)], 'de huidige sectie is werkelijk zichtbaar, andere DS-gridsecties niet');
        assert.equal(await page.locator('#privaat').evaluate(e => e.hidden && !e.checkVisibility()), true);
        await button.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
        assert.equal(await button.evaluate(e => document.activeElement === e && e.matches(':focus-visible') && parseFloat(getComputedStyle(e).outlineWidth) >= 2), true);
      }
    }
    const opnieuw = await page.evaluate(() => {
      RTGDeel.herscan(); RTGDeel.open(RTGDeel.delen()[0]);
      return { zelfde: window.__concept === document.getElementById('concept'), tekst: document.getElementById('concept').value,
        verborgen: document.getElementById('privaat').hidden, balken: document.querySelectorAll('.ds-deelmenu').length };
    });
    assert.deepEqual(opnieuw, { zelfde: true, tekst: 'Mijn eigen concept', verborgen: true, balken: 1 });
    // Het domein mag een sectie zelf sluiten; het menu mag die niet ontsluiten.
    assert.equal(await page.evaluate(() => {
      const sectie = document.querySelector('[data-deel="1"]'); sectie.hidden = true;
      RTGDeel.open(RTGDeel.delen()[1]); return sectie.hidden && !sectie.checkVisibility();
    }), true);

    /* Een bestaande host krijgt dezelfde componenten. De expliciete
       legacy-kaartregel staat ongelegerd en probeert display:grid te zetten;
       de canonieke verbergklasse moet desondanks betrouwbaar winnen. */
    await page.route('**' + legacyPad, r => r.fulfill({ status: 200, contentType: 'text/html', body:
      '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>.kaart{display:grid}</style></head><body><main>' + labels.map((l, i) =>
        '<section class="kaart" data-deel="' + i + '"><h2>' + l + '</h2>' +
        (i === 1 ? '<p id="privaat-legacy" hidden>Niet bevoegd</p>' : '<p>Inhoud ' + i + '</p>') + '</section>').join('') +
      '</main><script src="/shared/deelmenu.js"></script></body></html>' }));
    await page.goto(server.base + legacyPad, { waitUntil: 'load' });
    await page.waitForSelector('.ds-deelmenu-knop');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--ds-doel').trim() !== '');
    assert.equal(await page.locator('#rtgDsRuntimeCss').getAttribute('href'), '/ds/rtg-ds.css');
    assert.equal(await page.locator('#rtgdeel-stijl').count(), 0);
    await page.getByRole('button', { name: labels[1], exact: true }).click();
    assert.deepEqual(await page.locator('[data-deel]').evaluateAll(nodes => nodes.filter(n => n.checkVisibility()).map(n => n.getAttribute('data-deel'))), ['1']);
    assert.equal(await page.locator('#privaat-legacy').evaluate(e => e.hidden && !e.checkVisibility()), true);
    assert.deepEqual(fouten, []);
  } finally { if (browser) await browser.close(); server?.child.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
});
