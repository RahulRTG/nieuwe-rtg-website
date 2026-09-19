'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop } = require('./helper');
const pw = laadPlaywright();

const SCHERMEN = [
  ['/apps/foundation/os-publiek.html', 'foundation', { width: 390, height: 844 }],
  ['/apps/foundation/os-publiek.html', 'foundation', { width: 1366, height: 900 }]
];

test('LivingOS Home keert vanuit de routevergelijker en een app terug naar de vernieuwde momentenfeed',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext();
    await context.addInitScript(() => localStorage.setItem('rtg_cookieinfo_v1', '1'));
    const page = await context.newPage();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const source of ['/apps/living-os.html?view=worlds', '/apps/notities.html']) {
        await page.goto(base + source, { waitUntil: 'domcontentloaded' });
        await wacht(page, new URL(page.url()).pathname);
        await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').click();
        await page.waitForLoadState('domcontentloaded');
        assert.equal(new URL(page.url()).pathname, '/apps/wereld.html', source + ' op ' + width);
        await wacht(page, '/apps/wereld.html');
        await page.waitForSelector('.living-intro');
        assert.equal(await page.locator('#feed').count(), 1, 'de vernieuwde momentenfeed staat er');
        assert.equal(await page.locator('.lo-rail').count(), 0, 'geen routevergelijker als home');
        assert.equal((await meet(page)).bars, 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
        assert.equal(await page.locator('.rtg-edge-mark').getAttribute('href'), '/apps/wereld.html');
      }
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});

test('het RTG-beeldmerk blijft intact bij een eerder opgeslagen foutieve Engelse vertaling',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_lang', 'en');
      localStorage.setItem('rtg_tr_v2_en', JSON.stringify({
        RTG: 'RTG (No Translation Needed)', 'Rahul Travel Group': 'A wrong brand name'
      }));
    });
    const page = await context.newPage();
    for (const pad of ['/apps/living-os.html', '/apps/wereld.html']) {
      await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
      await wacht(page, pad);
      await page.waitForFunction(() => !!window.RTGi18n);
      await page.evaluate(() => window.RTGi18n.set('en'));
      await page.waitForFunction(() => document.querySelector('.rtg-adaptive-bar [data-rtg-adaptive-action="worlds"] small')?.textContent === 'Worlds');
      assert.equal(await page.locator('.rtg-edge-mark-short').textContent(), 'RTG');
      assert.equal(await page.locator('.rtg-edge-mark-lockup strong').textContent(), 'Rahul Travel Group');
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});

async function wacht(page, pad) {
  await page.waitForFunction(verwacht => location.pathname !== verwacht || document.body &&
    document.body.dataset.rtgAdaptiveReady === 'true' && window.RTGAdaptiveEdge && (() => {
      const bar = document.querySelector('.rtg-adaptive-bar');
      if (!bar) return false;
      const r = bar.getBoundingClientRect(), s = getComputedStyle(bar);
      return r.width > 100 && r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight &&
        s.visibility === 'visible' && Number(s.opacity) > .99;
    })(),
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
      barBreedte: br.width,
      midden: Math.abs((br.left + br.width / 2) - (lr.left + lr.width / 2)),
      lipBreedte: lr.width,
      richting: getComputedStyle(bar.querySelector('button')).flexDirection,
      aiKopieZichtbaar: zichtbaar(bar.querySelector('[data-rtg-adaptive-action="ai"] .rtg-adaptive-item-copy')),
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
          assert.ok(m.barBreedte <= 721, 'Edge wijkt af van de vaste marketingmaat: ' + m.barBreedte);
          assert.equal(m.richting, 'column');
          assert.equal(m.aiKopieZichtbaar, false);
          assert.equal(m.knoppen.length, 5);
          m.knoppen.forEach(k => {
            assert.ok(k.width >= 43.5 && k.height >= 43.5, 'raakvlak is ' + k.width + 'x' + k.height);
            assert.ok(k.labelWeight >= 600, 'label is te licht: ' + k.labelWeight);
          });
          await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
          await page.waitForSelector('.rtg-edge-index[aria-hidden="false"]');
          await page.keyboard.press('Escape');
          await page.waitForSelector('.rtg-edge-index[aria-hidden="false"]', { state: 'hidden' });
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

test('Edge voert appbediening uit, controleert actuele beschikbaarheid en sluit werkbladen',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const call = async (url, body, token) => {
      const response = await fetch(base + url, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify(body) });
      assert.equal(response.status, 200, url);
      return response.json();
    };
    const account = await call('/api/auth/register', { name: 'Edge Proef',
      email: 'edge' + Date.now() + '@voorbeeld.test', password: 'Edge-proef-12345',
      geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    const agreement=await call('/api/onboarding/status',{},account.token);
    await call('/api/onboarding/teken', { naam: 'Edge Proef', akkoord: true,contractVersion:agreement.contract.versie }, account.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(token => {
      localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, account.token);
    const page = await context.newPage();
    await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
    await wacht(page, '/apps/app.html');
    await page.waitForSelector('#rtgCommand[data-stand="open"]');
    assert.equal(await page.locator('.cmd-balk').isVisible(), false);

    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="ai"]').click();
    await page.locator('.rtg-adaptive-question input').fill('open LIFE');
    await page.locator('.rtg-adaptive-question button').click();
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.cmd-pane iframe'))
      .some(frame => frame.getAttribute('src') === '/apps/rtg.html'));
    assert.equal(await page.locator('.cmd-praat').isVisible(), true, 'the existing reply remains readable above Edge');
    await require('./helper').edgeActies(page);
    await page.locator('.rtg-adaptive-controls').getByRole('button', { name: 'Sluit dit werkblad', exact: true }).click();
    await page.waitForSelector('.cmd-pane', { state: 'detached' });

    // A retained proxy must recheck its original control at the moment of use.
    await page.evaluate(() => {
      window.__edgeExecutions = 0;
      const root = document.createElement('nav'); root.className = 'wos-dock'; root.id = 'edgeProbe';
      const button = document.createElement('button'); button.id = 'edgeProbeAction'; button.textContent = 'Proefhandeling';
      button.onclick = () => window.__edgeExecutions++;
      root.appendChild(button); document.body.appendChild(root);
    });
    await require('./helper').edgeActies(page);
    const source = page.locator('[data-rtg-adaptive-source="edgeProbeAction"]');
    await source.waitFor({ state: 'visible' });
    assert.equal(await page.locator('#edgeProbe').isVisible(), false);
    await source.evaluate(proxy => { document.getElementById('edgeProbeAction').disabled = true; proxy.click(); });
    assert.equal(await page.evaluate(() => window.__edgeExecutions), 0, 'disabled owner cannot execute through a stale proxy');
    await page.evaluate(() => { document.getElementById('edgeProbeAction').disabled = false; });
    await source.click();
    assert.equal(await page.evaluate(() => window.__edgeExecutions), 1, 'the real click reaches its existing handler once');
    await require('./helper').edgeActies(page);
    await source.evaluate(proxy => { document.getElementById('edgeProbe').remove(); proxy.click(); });
    assert.equal(await page.evaluate(() => window.__edgeExecutions), 1, 'removed owner cannot execute through a retained proxy');
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});
