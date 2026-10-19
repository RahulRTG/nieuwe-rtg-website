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
    /* Dit bewijs gaat over de bestaande Adaptive Edge. TravelOS draagt die
       sinds zijn migratie niet meer (hij staat op het RTG Design System, zie de
       toets hieronder); de proef draait daarom op een wereldhuis dat de
       Adaptive Edge nog wel draagt. */
    await page.goto(srv.base + '/apps/kantoor.html', { waitUntil: 'domcontentloaded' });
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
    /* Reisboek staat op het RTG Design System (TRAVELOS-MIGRATIE.md): daar
       staat precies één Edge, die van /ds/, en geen tweede oude ernaast. */
    const eenDsEdge = async () => {
      await page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
      assert.deepEqual(await page.evaluate(() => [document.querySelectorAll('.ds-edge').length,
        document.querySelectorAll('.rtg-adaptive-edge').length]), [1, 0], 'het reisboek tekent precies één Edge');
    };
    await page.goto(srv.base + '/apps/reisboek.html', { waitUntil: 'domcontentloaded' });
    await eenDsEdge();
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await gereed(page);
    assert.equal(await page.locator('.rtg-adaptive-edge').count(), 1, 'routeherstel tekent precies één Edge');
    assert.equal(await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="back"]').count() +
      await page.locator('.rtg-adaptive-bar [data-rtg-adaptive-action="home"]').count(), 1,
    'de bestaande navigatie blijft bereikbaar');
    await page.goForward({ waitUntil: 'domcontentloaded' });
    assert.equal(new URL(page.url()).pathname, '/apps/reisboek.html');
    await eenDsEdge(); // vooruit-herstel tekent precies één Edge
  } finally {
    if (browser) await browser.close();
    await stop(srv.child);
  }
});

/* Hetzelfde bewijs op TravelOS, nu op het RTG Design System: de ds-Edge kent
   geen verkleinstanden en blijft in rust volledig staan, met vijf bereikbare
   doelen van minstens 44 px, ook als een veld of Rahul de focus heeft, en na
   routeherstel staat er precies een Edge. */
test('de ds-Edge op TravelOS blijft in rust bedienbaar en wordt bij herstel een keer getekend',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  const dsGereed = (page) => page.waitForSelector('.ds-edge__balk [data-ds-edge="rahul"]');
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await context.addInitScript(() => localStorage.setItem('rtg_cookieinfo_v1', '1'));
    const page = await context.newPage();
    await page.goto(srv.base + '/apps/reizen.html', { waitUntil: 'domcontentloaded' });
    await dsGereed(page);
    await page.clock.install();
    const maat = () => page.locator('.ds-edge__balk').evaluate(node => {
      const r = node.getBoundingClientRect();
      const doelen = [].map.call(node.children, b => { const x = b.getBoundingClientRect(); return { width: x.width, height: x.height }; });
      return { width: r.width, height: r.height, zichtbaar: r.bottom <= innerHeight && r.height > 0, doelen };
    });
    await page.mouse.move(10, 10);
    await page.clock.runFor(7200);
    let m = await maat();
    assert.ok(m.zichtbaar && m.width > 300 && m.height >= 63.5, 'stilte verbergt geen primaire navigatie: ' + JSON.stringify(m));
    assert.equal(m.doelen.length, 5, 'de Edge houdt alle vijf functies zichtbaar');
    m.doelen.forEach(d => assert.ok(d.width >= 44 && d.height >= 44, JSON.stringify(m)));
    await page.locator('#rahulSnel').focus();
    await page.clock.runFor(7200);
    assert.ok((await maat()).zichtbaar, 'een actieve invoer verkleint de Edge niet');
    await page.locator('[data-ds-edge="rahul"]').click();
    assert.equal(await page.locator('.ds-edge__balk').getAttribute('data-ds-modus'), 'rahul');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.ds-edge__balk').getAttribute('data-ds-modus'), 'navigatie', 'Escape brengt de navigatie terug');

    await page.goto(srv.base + '/apps/reisboek.html', { waitUntil: 'domcontentloaded' });
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await dsGereed(page);
    assert.equal(await page.locator('.ds-edge').count(), 1, 'routeherstel tekent precies één Edge');
    assert.equal(await page.locator('.ds-edge__balk a[href="/apps/app.html"]').count(), 1, 'Home blijft bereikbaar');
    await page.goForward({ waitUntil: 'domcontentloaded' });
    assert.equal(new URL(page.url()).pathname, '/apps/reisboek.html');
  } finally {
    if (browser) await browser.close();
    await stop(srv.child);
  }
});
