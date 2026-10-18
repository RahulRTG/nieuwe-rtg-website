/* De persistente Edge gebruikt de bestaande staten en bewijst in een echte
   mobiele browser dat rust, activatie, context, focus en routeherstel elkaar
   niet verstoren. Alleen een bewust scroll- of veeggebaar mag hem verkleinen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { browserOpties, geenBrowser, laadPlaywright, startServer, stop } = require('./helper');
const pw = laadPlaywright();

async function gereed(page) {
  await page.waitForFunction(() => document.body.dataset.rtgAdaptiveReady === 'true' &&
    window.RTGAdaptiveEdge && window.RTGEdge2);
}

test('de volledige Edge blijft in rust bedienbaar, focusveilig en vastgezet',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.route('**/api/onboarding/status', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true })
    }));
    await context.addInitScript(() => localStorage.setItem('rtg_cookieinfo_v1', '1'));
    const page = await context.newPage();
    await page.goto(srv.base + '/apps/reizen.html', { waitUntil: 'domcontentloaded' });
    await gereed(page);
    await page.clock.install();
    await page.evaluate(() => RTGAdaptiveEdge.setState('dock'));
    const host = page.locator('.rtg-adaptive-edge');
    const bar = page.locator('.rtg-adaptive-bar');

    assert.equal(await host.getAttribute('data-rtg-adaptive-state'), 'dock');
    assert.equal(await host.getAttribute('data-rtg-adaptive-presence'), 'active');
    await bar.hover();
    await page.mouse.move(10, 10);
    await page.clock.runFor(3600);
    assert.equal(await host.getAttribute('data-rtg-adaptive-state'), 'dock',
      'stilte verbergt geen primaire navigatie');
    assert.equal(await host.getAttribute('data-rtg-adaptive-motion'), 'available');
    assert.equal(await host.getAttribute('data-rtg-adaptive-presence'), 'active');
    const maat = await host.evaluate(node => {
      const r = node.getBoundingClientRect();
      const targets = [].map.call(node.querySelectorAll('.rtg-adaptive-bar > button'), button => {
        const b = button.getBoundingClientRect(); return { width: b.width, height: b.height };
      });
      return { width: r.width, height: r.height, targets: targets };
    });
    assert.ok(maat.width > 300 && maat.height >= 63.5, JSON.stringify(maat));
    assert.equal(maat.targets.length, 5, 'de standaard-Edge houdt alle vijf functies zichtbaar');
    maat.targets.forEach(target => assert.ok(target.width >= 44 && target.height >= 44, JSON.stringify(maat)));

    await bar.hover();
    assert.equal(await host.getAttribute('data-rtg-adaptive-state'), 'dock');
    assert.equal(await host.getAttribute('data-rtg-adaptive-presence'), 'active');
    assert.ok(await bar.evaluate(node => parseFloat(getComputedStyle(node).transitionDuration) <= .001));

    await bar.locator('[data-rtg-adaptive-action="context"]').click();
    await page.waitForFunction(() => document.querySelector('.rtg-adaptive-edge')?.dataset.rtgAdaptiveState === 'expanded');
    assert.equal(await host.getAttribute('data-rtg-adaptive-presence'), 'expanded');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.querySelector('.rtg-adaptive-edge')?.dataset.rtgAdaptiveState === 'dock');

    await page.evaluate(() => RTGAdaptiveEdge.setDeck('context'));
    assert.equal(await host.getAttribute('data-rtg-adaptive-state'), 'deck');
    assert.equal(await host.getAttribute('data-rtg-adaptive-presence'), 'contextual');
    await page.evaluate(() => RTGAdaptiveEdge.setState('dock'));
    await page.mouse.move(10, 10);
    await page.clock.runFor(3600);
    assert.equal(await host.getAttribute('data-rtg-adaptive-presence'), 'active');
    await bar.hover();

    await bar.locator('.rtg-adaptive-item[data-rtg-adaptive-action="ai"]').focus();
    await page.clock.runFor(7200);
    assert.notEqual(await host.getAttribute('data-rtg-adaptive-state'), 'peek', 'focus mag de Edge niet verkleinen');

    await page.evaluate(() => {
      document.activeElement.blur();
      RTGAdaptiveEdge.setState('dock');
      document.body.dataset.rtgEdge2Auto = 'false';
    });
    await page.mouse.move(10, 10);
    await page.clock.runFor(7200);
    assert.equal(await host.getAttribute('data-rtg-adaptive-state'), 'dock', 'handmatige Edge 2-keuze blijft vastgezet');

    await page.evaluate(() => { document.body.dataset.rtgEdge2Auto = 'true'; RTGAdaptiveEdge.setState('dock'); });
    await page.clock.runFor(3600);
    assert.equal(await host.getAttribute('data-rtg-adaptive-presence'), 'active');

    await page.evaluate(() => {
      RTGAdaptiveEdge.setState('dock');
      const input = document.createElement('input'); input.id = 'quietPresenceInput';
      input.setAttribute('aria-label', 'Proefveld'); document.body.appendChild(input); input.focus();
    });
    await page.clock.runFor(7200);
    assert.equal(await host.getAttribute('data-rtg-adaptive-state'), 'dock', 'actieve invoer blijft vrij van automatische verkleining');

    await page.evaluate(() => document.getElementById('quietPresenceInput').remove());
    await page.goto(srv.base + '/apps/reisboek.html', { waitUntil: 'domcontentloaded' });
    await gereed(page);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await gereed(page);
    assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1, 'routeherstel tekent precies één Edge');
    assert.equal(await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="back"]').count() +
      await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').count(), 1,
    'de bestaande navigatie blijft bereikbaar');
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await gereed(page);
    assert.equal(new URL(page.url()).pathname, '/apps/reisboek.html');
    assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1, 'vooruit-herstel tekent precies één Edge');
  } finally {
    if (browser) await browser.close();
    await stop(srv.child);
  }
});
