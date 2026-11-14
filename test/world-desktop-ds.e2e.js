/* Werkruimte: zes domeinschermen, echte sessies en opslag. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { alleenDs, geenOverloop, beeld } = require('./lib/ds-toets');
const pw = laadPlaywright();
const routes = ['studio-pda', 'hardware-pda', 'architect-pda', 'wonen', 'onderhoud', 'woningdossier'];

async function zichtbaarInVenster(locator) {
  const q = await locator.evaluate(el => {
    const s = getComputedStyle(el);
    return { ...el.getBoundingClientRect().toJSON(), viewport: [innerWidth, innerHeight], route: location.pathname,
      visible: s.visibility === 'visible', flex: s.flex, transition: s.transition };
  });
  assert.ok(q.visible && q.width > 0 && q.height > 0 && q.left >= 0 && q.right <= q.viewport[0] + 1 && q.top >= 0 && q.bottom <= q.viewport[1] + 1, JSON.stringify(q));
}

test('DS-domeinen behouden bibliotheek, favorieten, appvenster en persoonlijke beelden',
  { skip: geenBrowser(pw) }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ds-wereld-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE', RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
  let browser, token;
  async function post(url, data, auth = token) {
    const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(data || {}) });
    const j = await r.json(); assert.equal(r.status, 200, url + ': ' + JSON.stringify(j)); return j;
  }
  try {
    token = (await post('/api/auth/register', { name: 'Werkruimte proef', email: 'werkruimte@example.test', phone: '0612345678', password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg' }, null)).token;
    const office = (await post('/api/office/login', { code: 'RTG-OFFICE' }, null)).token;
    assert.ok(token && office, 'echte leden- en kantoorsessies');
    await post('/api/notities/bewaar', { soort: 'notitie', titel: 'Werkruimteproef', tekst: 'Eigen notitie voor de zoek- en vensterproef.' });
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const route of routes) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await ctx.addInitScript(({ token, office }) => {
        localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_office_token', office);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, { token, office });
      const page = await ctx.newPage(), errors = []; letOpFouten(page, errors);
      try {
        await page.goto(srv.base + '/apps/' + route + '.html', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => {
          const c = window.RTGDesktopHome?.current;
          return document.body.dataset.rtgDesktopState === 'ready' && c?.runtime && c.cards && c.frame && document.body.classList.contains('ds-ios-host');
        });
        await alleenDs(page); await geenOverloop(page);
        if (route === 'wonen' || route === 'studio-pda') await beeld(page, route + '-1440');
        assert.equal(await page.locator('.wd-home main').isVisible(), true, route + ': oorspronkelijke domeininhoud');
        await page.locator('.wd-app-controls > summary').click();
        await page.locator('#wdSearch').fill('notities');
        const kaart = page.locator('.wd-library [data-widget="notities"]');
        await kaart.locator('.pi-change').waitFor();
        for (const stand of ['Toon een lijst', 'Toon kaarten']) {
          await page.locator('.wd-filters').getByRole('button', { name: stand, exact: true }).click();
          assert.equal(await kaart.evaluate(el => {
            const a = el.querySelector('.wd-widget-pin').getBoundingClientRect(), b = el.querySelector('.pi-change').getBoundingClientRect();
            return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
          }), true, route + ': ster en camera afzonderlijk in ' + stand);
          const pin = kaart.locator('.wd-widget-pin'), voor = await pin.getAttribute('aria-pressed');
          const antwoord = page.waitForResponse(r => r.url().endsWith('/api/ik/workspace/zet') && r.request().method() === 'POST');
          await pin.click(); const response = await antwoord; assert.equal(response.status(), 200);
          assert.equal(await kaart.locator('.wd-widget-pin').getAttribute('aria-pressed'), String(voor !== 'true'));
          const opgeslagen = await post('/api/ik/workspace', { scope: route.includes('pda') ? 'work' : 'living' });
          assert.equal(opgeslagen.workspace.order.includes('notities'), voor !== 'true', JSON.stringify({ route, stand, verzoek: response.request().postDataJSON(), bewaard: opgeslagen.workspace.order }));
          assert.equal(await page.locator('dialog.pi-editor').count(), 0, 'pinnen opent geen beeldeditor');
        }
        await kaart.locator('[data-widget-open="notities"]').click();
        const iframe = page.locator('iframe[data-desktop-app="/apps/notities.html"]');
        const frame = page.frameLocator('iframe[data-desktop-app="/apps/notities.html"]');
        await frame.locator('#zoek').fill('Mijn open concept ' + route);
        assert.equal(await page.locator('.wd-home').isVisible(), false);
        assert.equal(await page.locator('.ds-edge').evaluate(el => !el.closest('.wd-home')), true);
        await zichtbaarInVenster(page.locator('.ds-edge__balk'));
        for (const width of [390, 820]) {
          await page.setViewportSize({ width, height: 844 });
          await alleenDs(page); await geenOverloop(page); await zichtbaarInVenster(iframe);
          await zichtbaarInVenster(page.locator('.ds-edge__balk'));
          if (route === 'wonen' && width === 390) await beeld(page, 'wereldwerkruimte-frame-mobiel');
          assert.equal(await frame.locator('#zoek').inputValue(), 'Mijn open concept ' + route);
        }
        await page.locator('.wd-focus-head').getByRole('button', { name: 'Terug naar uw overzicht', exact: true }).click();
        assert.equal(await page.locator('.wd-home').isVisible(), true);
        assert.equal(await page.locator('.wd-library').isVisible(), false, 'bestaande mobiele domeinweergave');
        await page.setViewportSize({ width: 1440, height: 1000 });
        await kaart.locator('[data-widget-open="notities"]').click();
        assert.equal(await frame.locator('#zoek').inputValue(), 'Mijn open concept ' + route);
        assert.equal(await iframe.count(), 1, 'heropenen bewaart hetzelfde appvenster');
        await page.locator('.wd-focus-head').getByRole('button', { name: 'Terug naar uw overzicht', exact: true }).click();

        if (route === 'studio-pda' || route === 'wonen') {
          const camera = kaart.locator('.pi-change'); await camera.click();
          const editor = page.locator('dialog.pi-editor[open]'); await editor.waitFor();
          const slot = await editor.locator('.pi-slots').inputValue();
          assert.equal(await editor.evaluate(el => el.contains(document.activeElement)), true, 'native dialoog neemt focus');
          await zichtbaarInVenster(editor);
          const [chooser] = await Promise.all([page.waitForEvent('filechooser'), editor.getByRole('button', { name: 'Upload foto', exact: true }).click()]);
          await chooser.setFiles({ name: 'eigen-beeld.webp', mimeType: 'image/webp', buffer: fs.readFileSync(path.join(__dirname, '../public/images/daily/notities.webp')) });
          const zoom = editor.getByLabel('Vergroten');
          await page.waitForFunction(() => !document.querySelector('.pi-sliders input').disabled);
          await page.waitForFunction(() => { const img = document.querySelector('.pi-crop img'); return img.complete && img.naturalWidth > 0; });
          assert.equal(await editor.locator('.pi-crop img').isVisible(), true);
          await zoom.focus(); await page.keyboard.press('ArrowRight');
          assert.equal(await zoom.inputValue(), '1.01');
          await editor.getByRole('button', { name: 'Mobiel', exact: true }).click();
          assert.equal(await zoom.inputValue(), '1', 'mobiele uitsnede is afzonderlijk');
          await page.setViewportSize({ width: 390, height: 844 });
          await zichtbaarInVenster(editor); await geenOverloop(page);
          await beeld(page, 'wereldwerkruimte-beeldeditor-' + route);
          await editor.getByRole('button', { name: 'Opslaan', exact: true }).click();
          await editor.waitFor({ state: 'hidden' });
          const bewaard = (await post('/api/ik/beelden')).images[slot];
          assert.ok(bewaard.file); assert.equal(bewaard.desktop.zoom, 1.01); assert.equal(bewaard.mobile.zoom, 1);
          await page.setViewportSize({ width: 1440, height: 1000 });
          await camera.click(); await editor.waitFor();
          await editor.getByRole('button', { name: 'Desktop', exact: true }).click();
          assert.equal(await zoom.inputValue(), '1.01', 'bewaarde uitsnede teruggelezen');
          await editor.getByRole('button', { name: 'Mijn foto’s', exact: true }).click();
          await editor.locator('.pi-gallery').getByRole('button', { name: 'eigen-beeld.webp', exact: true }).first().waitFor();
          await page.keyboard.press('Escape'); await editor.waitFor({ state: 'hidden' });
          assert.equal(await camera.evaluate(el => document.activeElement === el), true, 'Escape herstelt camerafocus');
        }
        assert.deepEqual(errors, [], route + ': geen runtimefouten');
      } finally { await ctx.close(); }
    }
  } finally {
    if (browser) await browser.close(); stop(srv.child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
