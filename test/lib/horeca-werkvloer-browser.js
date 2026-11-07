'use strict';
const assert = require('node:assert/strict');
const { alleenDs, geenOverloop, beeld } = require('./ds-toets');

async function echteLabeldoelen(page, context, verplicht) {
  const velden = () => page.locator('#main').evaluate(main => [...main.querySelectorAll('input,select,textarea')]
    .map(el => ({ id: el.id, naam: el.name, waarde: el.value, checked: el.checked })));
  const voor = await velden(), vakjes = page.locator('#main input[type="checkbox"]:visible');
  if (verplicht) assert.ok(await vakjes.count() > 0, 'echte tafelkeuzes aanwezig: ' + context);
  for (let i = 0; i < await vakjes.count(); i++) {
    const vakje = vakjes.nth(i), checked = await vakje.isChecked();
    const handle = await vakje.evaluateHandle(el => [...(el.labels || [])].find(label =>
      label.control === el && label.getClientRects().length && getComputedStyle(label).visibility !== 'hidden'));
    const label = handle.asElement();
    assert.ok(label, 'zichtbaar native gekoppeld label: ' + context);
    try {
      await label.scrollIntoViewIfNeeded();
      const meet = () => label.evaluate(el => {
        const r = el.getBoundingClientRect();
        const beschrijf = node => {
          if (!node) return null;
          const b = node.getBoundingClientRect();
          return { tag: node.tagName, id: node.id, klasse: node.getAttribute('class'),
            rect: { x: b.x, y: b.y, w: b.width, h: b.height, onder: b.bottom, rechts: b.right } };
        };
        // Klik op de labelrand, buiten het kleine vakje zelf. Geen forceclick,
        // dispatchEvent of check(): het volledige label moet de handeling dragen.
        const x = 4, y = r.height / 2, hit = document.elementFromPoint(r.x + x, r.y + y);
        return { w: r.width, h: r.height, x, y, raak: !!hit && (hit === el || el.contains(hit)) && hit !== el.control,
          edgeHit: !!hit?.closest('.ds-edge'),
          punt: { x: r.x + x, y: r.y + y }, label: beschrijf(el), vakje: beschrijf(el.control), hit: beschrijf(hit),
          hitOuder: beschrijf(hit?.parentElement), viewport: { w: innerWidth, h: innerHeight, scrollX, scrollY },
          visueleViewport: window.visualViewport && { w: visualViewport.width, h: visualViewport.height,
            x: visualViewport.offsetLeft, y: visualViewport.offsetTop, schaal: visualViewport.scale },
          edge: [...document.querySelectorAll('.ds-edge,.ds-edge__balk')].map(beschrijf) };
      });
      let doel = await meet();
      if (doel.edgeHit) {
        // Viewport-intersectie is geen vrije klikplek boven vaste navigatie.
        // Een mens mag scrollen. Doe één echte wielbeweging over het werkvlak,
        // zonder Edge te verbergen, een ander klikpunt te kiezen of tijd af te wachten.
        const boven = Math.min(...doel.edge.map(e => e.rect.y));
        await page.mouse.move(doel.viewport.w / 2, Math.max(1, boven / 2));
        await page.mouse.wheel(0, Math.max(1, Math.ceil(doel.label.rect.onder - boven + 8)));
        await page.waitForFunction(el => {
          const r = el.getBoundingClientRect(), e = document.querySelector('.ds-edge');
          return r.top >= 0 && (!e || r.bottom <= e.getBoundingClientRect().top - 1);
        }, label);
        doel = await meet();
      }
      assert.ok(doel.w >= 43.9 && doel.h >= 43.9 && doel.raak, 'labeldoel44 bereikbaar buiten vakje: ' + JSON.stringify({ context, index: i, doel }));
      try {
        await label.click({ position: { x: doel.x, y: doel.y } });
        assert.equal(await vakje.isChecked(), !checked, 'echte labelrandklik wijzigt de tafelkeuze');
      } finally {
        if (await vakje.isChecked() !== checked) await label.click({ position: { x: doel.x, y: doel.y } });
      }
      assert.equal(await vakje.isChecked(), checked, 'de oorspronkelijke tafelkeuze is hersteld');
    } finally { await handle.dispose(); }
  }
  assert.deepEqual(await velden(), voor, 'labelproef behoudt alle keuzes en conceptvelden');
}

/* Alleen presentatiecontrole op de echte geopende domeinroute. De aanroeper
   maakt rekeningen/wijken via echte API's en voert daarna de werkhandeling uit. */
async function werkvloerMatrix(page, { naam, focus, panelen, checkboxen = false }) {
  await page.waitForFunction(() => document.body.classList.contains('ds-wereldwerkruimte') &&
    document.body.dataset.rtgDesktopState === 'ready' &&
    document.querySelector('.ds-edge') && document.querySelector('#osMenuBtn'));
  await page.evaluate(() => document.fonts.ready);
  await alleenDs(page);
  assert.equal(await page.locator('body').getAttribute('data-rtg-world'), 'work');
  const letters = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
  for (const [width, height, zoom] of [[390, 1000, 100], [390, 1000, 200], [820, 1000, 100], [820, 1000, 200], [1440, 1000, 100], [1440, 1000, 200], [390, 568, 200]]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(z => { document.documentElement.style.fontSize = z + '%'; }, zoom);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const meting = await page.locator('#main').evaluate(main => {
      const zichtbaar = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
      return { font: parseFloat(getComputedStyle(document.documentElement).fontSize), breed: main.clientWidth, inhoud: main.scrollWidth,
        doelen: [...main.querySelectorAll('button,a[href],input,select,textarea')].filter(zichtbaar).map(el => {
          const r = el.getBoundingClientRect();
          const label = el.type === 'checkbox' && [...(el.labels || [])].find(l => l.control === el && zichtbaar(l));
          const lr = label && label.getBoundingClientRect();
          return { id: el.id, type: el.type, w: r.width, h: r.height, label: lr ? { w: lr.width, h: lr.height } : null };
        }) };
    });
    const context = JSON.stringify({ naam, width, height, zoom, meting });
    assert.ok(Math.abs(meting.font - letters * zoom / 100) < .1, 'werkelijke tekstvergroting: ' + context);
    assert.ok(meting.inhoud <= meting.breed + 1, 'werkvlak zonder horizontale afsnijding: ' + context);
    await geenOverloop(page);
    assert.ok(meting.doelen.length, 'domeinbediening is werkelijk aanwezig');
    assert.deepEqual(meting.doelen.filter(el => el.type === 'checkbox'
      ? el.w < 23.9 || el.h < 23.9 || !el.label || el.label.w < 43.9 || el.label.h < 43.9
      : el.w < 43.9 || el.h < 43.9), [], context);
    await echteLabeldoelen(page, context, checkboxen);
    for (const selector of panelen) {
      const panel = page.locator(selector).first();
      await panel.scrollIntoViewIfNeeded();
      assert.equal(await panel.isVisible(), true, selector + ': ' + context);
    }
    const knop = page.locator(focus).first();
    await knop.scrollIntoViewIfNeeded();
    await knop.focus();
    assert.equal(await knop.evaluate(el => document.activeElement === el), true, 'domeinbediening ontvangt focus');
    await knop.click({ trial: true });
    assert.equal(await knop.evaluate(el => {
      const r = el.getBoundingClientRect(), raak = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !!raak && (raak === el || el.contains(raak));
    }), true, 'het doel is boven de Edge bereikbaar: ' + context);
    if (zoom === 100 && width !== 820) await beeld(page, 'horeca-' + naam + '-' + width);
  }
  await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
  await page.setViewportSize({ width: 390, height: 1000 });
  const menu = page.locator('#osMenuBtn');
  await menu.scrollIntoViewIfNeeded();
  assert.equal(await menu.evaluate(el => !!el.closest('.ds-horeca-werkkop') && !el.classList.contains('amn-zweef')), true, 'menu blijft in de bestaande schermkop');
  await menu.click();
  await page.waitForFunction(() => document.querySelector('#osMenuBtn').getAttribute('aria-expanded') === 'true');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#osMenuBtn').getAttribute('aria-expanded') === 'false');
  assert.equal(await menu.evaluate(el => document.activeElement === el), true, 'menu sluit met focus terug');
}

module.exports = { werkvloerMatrix };
