'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop } = require('./helper');
const pw = laadPlaywright();

const SCHERMEN = [
  ['/apps/foundation/os-publiek.html', 'foundation', { width: 390, height: 844 }],
  ['/apps/foundation/os-publiek.html', 'foundation', { width: 1366, height: 900 }]
];

async function wacht(page, pad) {
  await page.waitForFunction(verwacht => location.pathname !== verwacht || document.body &&
    document.body.dataset.rtgAdaptiveReady === 'true' && window.RTGAdaptiveEdge,
  pad, { timeout: 60000 });
}

async function meet(page) {
  return page.evaluate(() => {
    const zichtbaar = el => {
      if (!el) return false;
      const s = getComputedStyle(el), r = el.getBoundingClientRect();
      return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) !== 0 &&
        r.width > 1 && r.height > 1 && r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
    };
    const host = document.querySelector('.rtg-adaptive-edge');
    const bar = document.querySelector('.rtg-adaptive-bar');
    const lippen = document.querySelector('.rtg-adaptive-lips');
    const br = bar.getBoundingClientRect(), lr = lippen.getBoundingClientRect();
    return {
      ready: document.body.dataset.rtgAdaptiveReady,
      wereld: document.body.dataset.rtgWorld,
      hosts: document.querySelectorAll('.rtg-adaptive-edge').length,
      bars: [...document.querySelectorAll('.rtg-adaptive-bar')].filter(zichtbaar).length,
      oudeBalkZichtbaar: zichtbaar(document.querySelector('.rtg-edge-bottom')),
      binnen: br.left >= 0 && br.right <= innerWidth && br.bottom <= innerHeight,
      midden: Math.abs((br.left + br.width / 2) - (lr.left + lr.width / 2)),
      lipBreedte: lr.width,
      knoppen: [...bar.querySelectorAll('button')].map(el => {
        const r = el.getBoundingClientRect(), s = getComputedStyle(el), small = el.querySelector('small');
        return { width: r.width, height: r.height, color: s.color,
          labelWeight: small ? Number(getComputedStyle(small).fontWeight) : 0 };
      }),
      state: host.dataset.rtgAdaptiveState,
      deck: host.dataset.rtgAdaptiveDeck
    };
  });
}

test('Adaptive Edge is één tastbare RTG-laag op mobiel en desktop',
  { skip: geenBrowser(pw) }, async (t) => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext();
    await context.route('**/api/onboarding/status', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
    await context.addInitScript(() => {
      try {
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    });
    for (const [pad, wereld, maat] of SCHERMEN) {
      await t.test(wereld + ' ' + maat.width, async st => {
        const page = await context.newPage();
        try {
          await page.setViewportSize(maat);
          await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
          if (new URL(page.url()).pathname !== pad) { st.skip('route vraagt toegang'); return; }
          await wacht(page, pad);
          const m = await meet(page);
          assert.equal(m.ready, 'true');
          assert.equal(m.wereld, wereld);
          assert.equal(m.hosts, 1);
          assert.equal(m.bars, 1);
          assert.equal(m.oudeBalkZichtbaar, false);
          assert.equal(m.binnen, true);
          assert.ok(m.midden <= 1, 'lippen staan ' + m.midden + 'px uit het midden');
          assert.ok(m.lipBreedte >= 44, 'lippen zijn te klein: ' + m.lipBreedte);
          assert.equal(m.knoppen.length, 5);
          m.knoppen.forEach(k => {
            assert.ok(k.width >= 43.5 && k.height >= 43.5, 'raakvlak is ' + k.width + 'x' + k.height);
            assert.ok(k.labelWeight >= 600, 'label is te licht: ' + k.labelWeight);
          });
          if (maat.width === 390) {
            const veeg = async (dx, dy) => page.evaluate(([x, y]) => {
              const bar = document.querySelector('.rtg-adaptive-bar'), r = bar.getBoundingClientRect();
              const maak = (type, cx, cy) => bar.dispatchEvent(new PointerEvent(type, {
                bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', button: 0,
                clientX: cx, clientY: cy
              }));
              const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
              maak('pointerdown', sx, sy); maak('pointermove', sx + x, sy + y); maak('pointerup', sx + x, sy + y);
            }, [dx, dy]);
            await veeg(-120, 0);
            await page.waitForFunction(() => document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveDeck === 'context');
            await veeg(0, -90);
            await page.waitForFunction(() => document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState === 'expanded');
            assert.equal(await page.locator('.rtg-adaptive-sheet').isVisible(), true);
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => document.querySelector('.rtg-adaptive-edge').dataset.rtgAdaptiveState === 'dock');
          }
        } finally { await page.close(); }
      });
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});
