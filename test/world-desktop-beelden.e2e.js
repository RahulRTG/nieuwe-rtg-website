/* Koud mobiel openen gebruikt de bestaande camera, DS Edge en native editor. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { geenOverloop, beeld } = require('./lib/ds-toets');
const pw = laadPlaywright();

test('Wonen en Studio openen hun beeldeditor koud mobiel via DS Acties', { skip: geenBrowser(pw) }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ds-wereldbeelden-'));
  let srv, browser;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE',
      RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
    async function post(url, body) {
      const response = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      assert.equal(response.status, 200, url + ': ' + JSON.stringify(data));
      return data;
    }
    const office = (await post('/api/office/login', { code: 'RTG-OFFICE' })).token;
    assert.ok(office, 'echte kantoorsessie voor Studio');
    browser = await pw.chromium.launch(browserOpties(pw));
    let livingToken = '';
    for (const [route, world] of [['wonen', 'living'], ['studio-pda', 'work']]) {
      const token = (await post('/api/auth/register', { name: 'Beeldenproef ' + world,
        email: world + '@wereldbeelden.test', phone: world === 'living' ? '0612345678' : '0612345679',
        password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg' })).token;
      assert.ok(token, route + ': eigen echte ledensessie');
      if (world === 'living') livingToken = token;
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      try {
        await context.addInitScript(({ token, office }) => {
          localStorage.setItem('rtg_member_token', token);
          if (office) localStorage.setItem('rtg_office_token', office);
          localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
        }, { token, office: world === 'work' ? office : null });
        const page = await context.newPage(), errors = letOpFouten(page, []);
        await page.goto(srv.base + '/apps/' + route + '.html', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.body.classList.contains('ds-wereldwerkruimte') &&
          document.body.dataset.rtgDesktopState === 'ready' && !!window.RTGDesktopHome?.current);
        const actions = page.locator('[data-ds-edge="acties"]'), editor = page.locator('dialog.pi-editor');
        await actions.waitFor();
        assert.equal(await page.locator('.ds-edge').count(), 1);
        assert.equal(await page.locator('.wd-home main').isVisible(), true);
        assert.equal(await page.locator('.wp-atmosphere').isVisible(), false);
        assert.equal(await page.locator('.wd-library').isVisible(), false);
        const sourceAction = page.locator('.wp-atmosphere > .pi-change[data-ds-actie="Beelden aanpassen"][data-rtg-edge-bar]');
        assert.equal(await sourceAction.count(), 1);
        assert.equal(await sourceAction.getAttribute('aria-label'), 'Beelden aanpassen',
          route + ': bron en Edge-kloon dragen dezelfde actie-identiteit');
        assert.equal(await editor.count(), 0, route + ': editor was nog niet geopend');
        await beeld(page, route + '-390');

        for (let ronde = 0; ronde < 2; ronde++) {
          await actions.click();
          const entrance = page.locator('#dsEdgeBlad').getByRole('button', { name: 'Beelden aanpassen', exact: true });
          assert.equal(await entrance.count(), 1, route + ': één beeldactie');
          await entrance.click();
          await editor.waitFor({ state: 'visible' });
          assert.equal(await editor.count(), 1, route + ': één editor');
          assert.equal(await editor.evaluate(el => el instanceof HTMLDialogElement && el.open && el.matches(':modal')), true);
          assert.equal(await page.locator('#dsEdgeBlad').isVisible(), false, 'actielijst sluit voor de editor');
          assert.equal(await editor.locator('.pi-slots').inputValue(), world + '/sfeer');
          assert.equal(await editor.locator('.pi-crop').getAttribute('data-preview'), 'mobile');
          assert.equal(await editor.getByRole('button', { name: 'Mobiel', exact: true }).getAttribute('aria-pressed'), 'true');
          assert.equal(await editor.evaluate(el => el.contains(document.activeElement)), true, 'native dialoog neemt focus');
          await page.waitForFunction(() => {
            const img = document.querySelector('.pi-crop img'); return img?.complete && img.naturalWidth > 0;
          });
          assert.equal(await editor.locator('.pi-crop img').isVisible(), true);
          await geenOverloop(page);
          if (!ronde) await beeld(page, route + '-beeldeditor-390');
          await page.keyboard.press('Escape');
          await editor.waitFor({ state: 'detached' });
          await page.waitForFunction(() => document.activeElement === document.querySelector('[data-ds-edge="acties"]'));
          assert.equal(await actions.getAttribute('aria-expanded'), 'false');
          assert.equal(await page.locator('body').getAttribute('data-image-editor'), null);
          assert.equal(await page.locator('.wd-home main').isVisible(), true);
        }
        assert.deepEqual(errors, [], route + ': geen runtimefouten');
      } finally { await context.close(); }
    }

    const desktop = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    try {
      await desktop.addInitScript((token) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, livingToken);
      const page = await desktop.newPage(), errors = letOpFouten(page, []);
      await page.goto(srv.base + '/apps/wonen.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.classList.contains('ds-wereldwerkruimte') &&
        document.body.dataset.rtgDesktopState === 'ready' && !!window.RTGDesktopHome?.current);
      const sourceAction = page.locator('.wp-atmosphere > .pi-change[data-rtg-edge-bar]');
      assert.equal(await sourceAction.isVisible(), false, 'de bedekte bronactie wordt niet als tweede knop gepresenteerd');
      await page.locator('[data-ds-edge="acties"]').click();
      const entrance = page.locator('#dsEdgeBlad').getByRole('button', { name: 'Beelden aanpassen', exact: true });
      assert.equal(await entrance.count(), 1, 'de contextuele Edge presenteert exact één beeldactie');
      await entrance.click();
      await page.locator('dialog.pi-editor').waitFor({ state: 'visible' });
      assert.deepEqual(errors, [], 'desktop opent dezelfde editor zonder runtimefouten');
    } finally { await desktop.close(); }
  } finally {
    if (browser) await browser.close();
    if (srv) await stop(srv.child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
