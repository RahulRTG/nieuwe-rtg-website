'use strict';
const assert = require('node:assert/strict');
const { alleenDs, geenOverloop, beeld } = require('./ds-toets');
async function land(page, route, base) {
  const r = await page.goto(base + '/apps/foundation/' + route + '.html', { waitUntil: 'load' }); assert.equal(r.status(), 200);
  await page.waitForFunction(() => window.Sessie?.actief() && !document.documentElement.classList.contains('rtf-toegang-dicht') && !!document.querySelector('.ds-wereldnav'));
  await page.evaluate(() => document.fonts.ready);
  await alleenDs(page);
  assert.equal(await page.locator('style').evaluateAll(nodes => nodes.filter(n => /\.sb-balk\{|\.rsm-sheet\{|\.rsm-rsheet\{/.test(n.textContent)).length), 0);
  assert.equal(await page.locator('.ws-doel').count(), 6, 'alle bestaande wereldbestemmingen behouden');
}
async function matrix(page, route) {
  const basis = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  for (const width of [390, 820, 1440]) for (const zoom of [1, 2]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(({ basis, zoom }) => { document.documentElement.style.fontSize = basis * zoom + 'px'; }, { basis, zoom });
    const overloop = await page.evaluate(() => ({ breedte: document.documentElement.clientWidth,
      inhoud: document.documentElement.scrollWidth,
      buiten: [...document.querySelectorAll('body *')].filter(e => e.checkVisibility({ checkVisibilityCSS: true })).map(e => {
        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
        return { tag: e.tagName, id: e.id, klasse: e.className, x: r.x, rechts: r.right, w: r.width,
          tekst: e.textContent.trim().slice(0, 90), display: s.display, min: s.minWidth, overflow: s.overflowX, wrap: s.whiteSpace };
      }).filter(e => e.x < -1 || e.rechts > document.documentElement.clientWidth + 1).slice(0, 15) }));
    assert.ok(overloop.inhoud <= overloop.breedte + 1, JSON.stringify({ route, width, zoom, overloop }));
    await geenOverloop(page);
    const m = await page.evaluate(() => ({ font: getComputedStyle(document.body).fontFamily,
      root: parseFloat(getComputedStyle(document.documentElement).fontSize),
      doelen: [...document.querySelectorAll('#main button,#main textarea,#main summary,.ds-foundation-balk button,.ws-doel')].filter(e => e.checkVisibility({ checkVisibilityCSS: true })).map(e => {
        const r = e.getBoundingClientRect(); return { naam: e.getAttribute('aria-label') || e.textContent.trim(), w: r.width, h: r.height, x: r.x, rechts: r.right, font: getComputedStyle(e).fontFamily };
      }) }));
    const detail = JSON.stringify({ route, width, zoom, m });
    assert.match(m.font, /Inter/); assert.ok(Math.abs(m.root - basis * zoom) < .1, detail);
    assert.ok(m.doelen.length >= 9, 'geen lege succesvolle matrix: ' + detail);
    assert.deepEqual(m.doelen.filter(e => e.w < 43.9 || e.h < 43.9 || e.x < -.1 || e.rechts > width + 1 || !/Inter/.test(e.font)), [], detail);
    const coach = { steun: 'Even je hart luchten', gevoel: 'Praten', pesten: 'Praat met een maatje',
      opvoeden: 'Vraag het je opvoedcoach', mediawijs: 'Sparren' }[route];
    if (coach && !await page.locator('#vraag').isVisible()) await page.locator('.rtgdeel-balk').getByRole('button', { name: coach, exact: true }).click();
    await page.locator('#vraag').fill('Mijn onafgemaakte vraag');
    await page.locator('#vraag').focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
    assert.equal(await page.locator('#vraag').evaluate(e => document.activeElement === e && e.matches(':focus-visible') && parseFloat(getComputedStyle(e).outlineWidth) >= 2), true, 'zichtbare toetsenbordfocus');
    assert.equal(await page.locator('#vraag').inputValue(), 'Mijn onafgemaakte vraag');
    if (zoom === 1) await beeld(page, 'foundation-' + route + '-' + width);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; }); await page.setViewportSize({ width: 390, height: 1000 });
}

module.exports = { land, matrix };
