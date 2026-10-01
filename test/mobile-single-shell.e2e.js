'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const pw = laadPlaywright(), skip = geenBrowser(pw);
let srv, browser;
test.before(async () => {
  if (skip) return;
  srv = await startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DEMO: '0' } });
  browser = await pw.chromium.launch(browserOpties(pw));
});
test.after(async () => { if (browser) await browser.close(); if (srv) await stop(srv.child); });
async function open(route, width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce', hasTouch: true });
  await ctx.addInitScript(() => { localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); });
  const page = await ctx.newPage();
  await page.goto(srv.base + route, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-rtg-desktop-state="ready"][data-rtg-adaptive-ready="true"]');
  return { page, ctx };
}
test('mobile login has one content surface, without a second title, tabs or desktop widgets', { skip }, async () => {
  const { page, ctx } = await open('/apps/app.html');
  try {
    for (const selector of ['.wd-greeting', '.wp-tabs', '.wd-people', '.wd-favorites', '.wd-library', '.wp-atmosphere']) {
      assert.equal(await page.locator(selector).isVisible(), false, selector + ' must not surround the mobile login');
    }
    assert.equal(await page.locator('.rtg-adaptive-bar:visible').count(), 1);
    assert.equal(await page.locator('.wd-home').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await page.evaluate(() => document.fonts.ready);
    const title = await page.locator('#gate .access-title').boundingBox();
    const header = await page.locator('.rtg-edge-top').boundingBox();
    assert.ok(title && header && title.y >= header.y + header.height,
      'the login heading starts below the shared brand header');
  } finally { await ctx.close(); }
});
test('the four mobile worlds expose their original content and keep it when changing viewport', { skip }, async () => {
  for (const route of ['/apps/rtg.html', '/apps/reizen.html', '/apps/kantoor.html', '/apps/foundation/os-publiek.html']) {
    const { page, ctx } = await open(route);
    try {
      assert.equal(await page.locator('.wp-scene').isVisible(), false, route + ': no second generated home');
      assert.equal(await page.locator('.wp-domain').isVisible(), false, route + ': no collapsed original home');
      const original = await page.locator('.wd-home').evaluate(el => {
        const node = [...el.children].find(n => !n.matches('.wp-scene'));
        window.__mobileOriginalNode = node;
        return !!node && node.getClientRects().length > 0;
      });
      assert.equal(original, true, route + ': actual home content is visible');
      await page.setViewportSize({ width: 1440, height: 1050 });
      await page.waitForSelector('body[data-rtg-desktop]');
      await page.locator('.wd-people').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.wd-people').isVisible(), true);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForSelector('body[data-rtg-shell="mobile"]');
      assert.equal(await page.evaluate(() => document.querySelector('.wd-home').contains(window.__mobileOriginalNode)), true);
      assert.equal(await page.locator('.rtg-adaptive-bar:visible').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, route);
    } finally { await ctx.close(); }
  }
});
test('one Edge responds to nested human scroll, keeps five reachable actions and respects focused input and open panels', { skip }, async () => {
  const { page, ctx } = await open('/apps/notities.html', 320);
  try {
    // An isolated scroll fixture exercises input routing, not a simulated
    // domain transaction. The real page, Edge and event handlers are used.
    await page.evaluate(() => {
      const scroller = document.createElement('section'); scroller.id = 'scroll-fixture';
      scroller.style.cssText = 'position:fixed;top:100px;left:16px;width:260px;height:400px;overflow:auto;z-index:2';
      const content = document.createElement('div'); content.style.height = '2400px';
      content.textContent = 'Scroll fixture'; scroller.appendChild(content); document.body.appendChild(scroller);
    });
    const host = page.locator('.rtg-adaptive-edge'), bar = page.locator('.rtg-adaptive-bar');
    const normal = await bar.boundingBox();
    await page.locator('#scroll-fixture').hover(); await page.mouse.wheel(0, 200);
    await page.waitForSelector('.rtg-adaptive-edge[data-rtg-adaptive-motion="reading"]');
    const small = await bar.boundingBox(); assert.ok(small.width < normal.width && small.height < normal.height);
    const actions = await bar.locator('button:visible').evaluateAll(nodes => nodes.map(n => ({ name:n.getAttribute('aria-label'), width:n.getBoundingClientRect().width, height:n.getBoundingClientRect().height })));
    assert.equal(actions.length, 5);
    for (const a of actions) { assert.ok(a.name); assert.ok(a.width >= 44 && a.height >= 44, JSON.stringify(a)); }
    await page.mouse.wheel(0, -100);
    await page.waitForSelector('.rtg-adaptive-edge[data-rtg-adaptive-state="dock"]');
    await bar.locator('[data-rtg-adaptive-action="context"]').click();
    assert.equal(await page.locator('.rtg-adaptive-sheet').isVisible(), true);
    await page.locator('#scroll-fixture').hover(); await page.mouse.wheel(0, 180);
    assert.equal(await host.getAttribute('data-rtg-adaptive-state'), 'expanded');
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      const input = document.createElement('input'); input.id = 'input-fixture'; input.setAttribute('aria-label','Unsaved fixture');
      document.querySelector('#scroll-fixture').prepend(input); input.focus();
    });
    await page.locator('#input-fixture').fill('Deze invoer blijft staan');
    await page.locator('#scroll-fixture').hover(); await page.mouse.wheel(0, 150);
    assert.equal(await host.getAttribute('data-rtg-adaptive-state'), 'dock');
    await page.setViewportSize({width:1440,height:1000}); await page.setViewportSize({width:320,height:844});
    assert.equal(await page.locator('#input-fixture').inputValue(), 'Deze invoer blijft staan');
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; document.activeElement.blur(); });
    await bar.locator('[data-rtg-adaptive-action="menu"]').click();
    assert.equal(await bar.locator('[data-rtg-adaptive-action="menu"]').getAttribute('aria-expanded'), 'true');
    const rect = await page.locator('.rtg-adaptive-sheet').boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= 320);
    assert.equal(await bar.isVisible(), false, 'the menu replaces the bar instead of adding another shell');
    assert.equal(await bar.evaluate(el => getComputedStyle(el).transitionDuration), '0s');
  } finally { await ctx.close(); }
});


test('custom Edge menus replace screen controls without reserving an empty action strip', { skip }, async () => {
  const { page, ctx } = await open('/apps/notities.html');
  try {
    await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="menu"]').click();
    await page.waitForSelector('.rtg-adaptive-sheet[data-rtg-custom-panel="true"]');
    assert.equal(await page.locator('.rtg-adaptive-sheet>.rtg-edge-action').isVisible(), false);
    const head = await page.locator('.rtg-adaptive-sheet-head').boundingBox();
    const tabs = await page.locator('.rtg-adaptive-sheet .rtg-edge-face-tabs').boundingBox();
    assert.ok(tabs.y - head.y - head.height <= 24, 'menu follows its title without a ghost toolbar');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(), true);
  } finally { await ctx.close(); }
});


test('Sound lends its real playback controls to the single Edge', { skip }, async () => {
  const { page, ctx } = await open('/apps/muziek.html', 390);
  try {
    await page.locator('#heroSpeel').click();
    await page.waitForSelector('.rtg-adaptive-surface>.speler[data-actief="true"]');
    assert.equal(await page.locator('.rtg-adaptive-bar').isVisible(), false);
    assert.equal(await page.locator('.speler').count(), 1);
    await page.waitForFunction(() => window.RTGGeluid.stand().speelt === true);
    await page.locator('.rtg-adaptive-surface #knopSpeel').click();
    assert.equal(await page.evaluate(() => window.RTGGeluid.stand().speelt), false);
    await page.setViewportSize({ width: 320, height: 844 });
    const rect = await page.locator('.rtg-adaptive-surface').boundingBox();
    assert.ok(rect.x >= 0 && rect.x + rect.width <= 320);
    await page.locator('.rtg-adaptive-surface #knopSpeel').click();
    await page.waitForFunction(() => window.RTGGeluid.stand().speelt === true);
  } finally { await ctx.close(); }
});

test('Foundation keeps its original view actions inside one mobile Edge', { skip }, async () => {
  const response = await fetch(srv.base + '/api/foundation/gezin/maak', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gezinsnaam: 'Edge proef', naam: 'Beheerder', pin: '4321', geboortedatum: '1985-04-12' })
  });
  const gezin = await response.json();
  assert.ok(gezin.token, 'a real isolated test family owns the session');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce', hasTouch: true });
  try {
    await ctx.addInitScript(s => {
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtf_sessie', JSON.stringify(s));
    }, { code: gezin.code, token: gezin.token, gezin: gezin.gezin, profiel: gezin.profiel });
    const page = await ctx.newPage();
    await page.goto(srv.base + '/apps/foundation/meedoen-ontdekken.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body[data-rtg-adaptive-ready="true"]');
    await page.waitForSelector('.mo-nav.rtg-edge-owned-bar', { state: 'attached' });
    assert.equal(await page.locator('.mo-nav').isVisible(), false);
    assert.equal(await page.locator('.mo-top').isVisible(), false);
    assert.equal(await page.locator('.rtg-adaptive-bar:visible').count(), 1);
    for (const [label, view] of [['Mijn buurt', 'buurt'], ['Iets maken', 'maken'], ['Kansen', 'kansen'], ['Vandaag', 'vandaag']]) {
      await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="context"]').click();
      await page.locator('.rtg-adaptive-controls').getByRole('button', { name: label, exact: true }).click();
      await page.locator('[data-mo-view="' + view + '"]').waitFor({ state: 'visible' });
      assert.equal(await page.locator('.mo-nav [data-mo-tab="' + view + '"]').getAttribute('aria-current'), 'page');
      assert.equal(await page.locator('.rtg-adaptive-bar:visible').count(), 1);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  } finally { await ctx.close(); }
});
