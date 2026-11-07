/* Werkelijke Studio-host met expliciete knopfixture voor de nieuw-sneltoets.
   Geen claim over een Studio-aanmaakproces; API's/domeingegevens wijzigen niet. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();
test('DS-sneltoetsen op Studio: ontdekte acties, native modaliteit, focus en grote tekst',
  { skip: geenBrowser(pw), timeout: 60000 }, async () => {
  const srv = await startServer({ env: { OFFICE_CODE: 'RTG-OFFICE', SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1',
    LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
  let browser;
  try {
    const r = await fetch(srv.base + '/api/office/login', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'RTG-OFFICE' }) });
    assert.equal(r.status, 200); const { token } = await r.json(); assert.ok(token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addInitScript(t => {
      localStorage.setItem('rtg_office_token', t); localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    try {
      const page = await context.newPage(), fouten = letOpFouten(page, []);
      await page.goto(srv.base + '/apps/studio-pda.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.dataset.rtgDesktopState === 'ready' &&
        window.RTGSneltoets && document.querySelector('#pFilters button'));
      /* De zichtbare DS-Edge is de enige universele bediening. Het oude
         appmenuknopje blijft als bron voor bestaande functies aanwezig maar is
         op een gemigreerd scherm geen geldige focusbestemming meer. */
      const ingang = page.locator('.ds-edge__balk [data-ds-edge="acties"]'), blad = page.locator('dialog.ds-sneltoets');
      // Studio's Concept-knop heet niet Nieuw. De sneltoets belooft die dus niet.
      assert.equal(await page.evaluate(() => RTGSneltoets.nieuwKnop()), null);
      const nieuw = 'Nieuw proefstuk';
      // Expliciete DOM-fixture voor het gedeelde sneltoetscontract.
      await page.evaluate(() => {
        window.__snelNieuw = 0;
        const b = document.createElement('button'); b.className = 'ds-knop';
        b.textContent = 'Nieuw proefstuk'; b.addEventListener('click', () => window.__snelNieuw++);
        document.querySelector('main').appendChild(b);
      });
      // Native dialogen hebben geen redundant aria-modal nodig om te blokkeren.
      await page.evaluate(() => {
        const d = document.createElement('dialog'); d.id = 'nativeSnelProef';
        d.innerHTML = '<button type="button">Native proef</button>';
        document.body.appendChild(d); d.showModal();
        window.__snelOnder = [];
        window.__snelUitvoer = window.RTGUitvoer; window.__snelDeel = window.RTGDeel;
        window.RTGUitvoer = { beschikbaar: () => true, neemMee: () => window.__snelOnder.push('export') };
        window.RTGDeel = { delen: () => ['deel'], open: () => window.__snelOnder.push('deel') };
      });
      for (const key of ['n', 'e', '1', '?', '/']) await page.keyboard.press(key);
      assert.equal(await page.evaluate(() => window.__snelNieuw), 0);
      assert.deepEqual(await page.evaluate(() => window.__snelOnder), []);
      assert.equal(await blad.count(), 0);
      assert.equal(await page.evaluate(() => document.activeElement.closest('dialog')?.id), 'nativeSnelProef');
      await page.keyboard.press('Escape');
      await page.evaluate(() => {
        document.querySelector('#nativeSnelProef').remove();
        window.RTGUitvoer = window.__snelUitvoer; window.RTGDeel = window.__snelDeel;
      });
      for (const width of [390, 820, 1440]) for (const percentage of [100, 200]) {
        await page.setViewportSize({ width, height: 480 });
        await page.evaluate(p => { document.documentElement.style.fontSize = p + '%'; }, percentage);
        await ingang.focus(); await page.keyboard.press('?'); await blad.waitFor({ state: 'visible' });
        assert.equal(await page.locator('#rtgsnel-stijl').count(), 0, 'geen oude stijlinjectie');
        assert.equal(await blad.getAttribute('aria-modal'), 'true');
        assert.equal(await blad.getByText('nieuw: ' + nieuw, { exact: true }).count(), 1);
        assert.equal(await blad.evaluate(el => el.matches(':modal')), true);
        const sluit = blad.getByRole('button', { name: 'Sluiten', exact: true });
        assert.equal(await sluit.evaluate(el => document.activeElement === el), true);
        await page.keyboard.press('Tab');
        const focus = await blad.evaluate(el => ({ binnen: el.contains(document.activeElement),
          documentFocus: document.hasFocus(), tag: document.activeElement.tagName, id: document.activeElement.id }));
        // De browser mag zijn eigen adresbalk bereiken; de achterliggende app
        // mag geen focus krijgen. Native modaliteit blijft daarbij leidend.
        assert.ok(focus.binnen || !focus.documentFocus && focus.tag === 'BODY', JSON.stringify(focus));
        await page.keyboard.press('Shift+Tab');
        assert.equal(await sluit.evaluate(el => document.activeElement === el), true);
        await page.keyboard.press('n'); assert.equal(await page.evaluate(() => window.__snelNieuw), 0);
        const formaat = await blad.evaluate(el => ({ r: el.getBoundingClientRect().toJSON(), w: innerWidth, h: innerHeight,
          breed: el.clientWidth, inhoud: el.scrollWidth }));
        assert.ok(formaat.r.x >= 0 && formaat.r.right <= formaat.w + 1 && formaat.r.y >= 0 && formaat.r.bottom <= formaat.h + 1, JSON.stringify(formaat));
        assert.ok(formaat.inhoud <= formaat.breed + 1, 'tekst past zonder horizontale scroll');
        await sluit.scrollIntoViewIfNeeded();
        const doel = await sluit.boundingBox(); assert.ok(doel.width >= 44 && doel.height >= 44);
        await page.keyboard.press('Escape'); await blad.waitFor({ state: 'hidden' });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const terug = await ingang.evaluate(el => ({ klopt: document.activeElement === el,
          ingang: { id: el.id, klasse: el.className, tekst: el.textContent.trim() },
          actief: document.activeElement && { id: document.activeElement.id, klasse: document.activeElement.className,
            tekst: document.activeElement.textContent.trim(), tag: document.activeElement.tagName } }));
        assert.equal(terug.klopt, true, JSON.stringify(terug));
      }
      await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
      await page.setViewportSize({ width: 390, height: 844 });
      await ingang.focus(); await page.keyboard.press('?'); await blad.getByRole('button', { name: 'Sluiten', exact: true }).click();
      await page.keyboard.press('?'); await blad.waitFor({ state: 'visible' });
      await page.evaluate(async () => {
        const d = document.querySelector('dialog.ds-sneltoets');
        const gesloten = new Promise(resolve => d.addEventListener('close', resolve, { once: true }));
        d.querySelector('button').click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
        await gesloten;
      });
      assert.equal(await blad.evaluate(el => el.open && !el.hidden), true, 'heropening blijft zichtbaar na oud close-event');
      await page.keyboard.press('Escape');
      // Een label is tekst, ook wanneer een app een tekenreeks met HTML draagt.
      await page.evaluate(() => { RTGSneltoets.nieuwKnop().textContent = 'Nieuw <img src=x onerror="window.__xss=1">'; });
      await ingang.focus(); await page.keyboard.press('?'); await blad.waitFor({ state: 'visible' });
      assert.match(await blad.locator('dl').textContent(), /<img src=x/);
      assert.equal(await blad.locator('img').count(), 0); assert.equal(await page.evaluate(() => window.__xss), undefined);
      await page.keyboard.press('Escape');
      assert.deepEqual(fouten, []);
    } finally { await context.close(); }
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
