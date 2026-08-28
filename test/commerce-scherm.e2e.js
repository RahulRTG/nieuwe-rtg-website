/* HET ONDERNEMERSSCHERM VAN RTG COMMERCE IN EEN ECHTE BROWSER.

   De commerce-kern heeft zijn eigen servertoetsen, maar die bewijzen niet dat
   het scherm met een leverancierssessie opkomt en zijn verkoopweg werkelijk
   langs dezelfde API aanmaakt. scripts/schermen.js eist daarom ook voor dit
   nieuwe scherm een eigen tocht door de browser.

   Draai los: node --test test/commerce-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('RTG Commerce: een leverancier opent zijn verkoopwegen en maakt er een aan',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-commerce-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = async (pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    let browser;
    try {
      const bezetting = await post('/api/supplier/roster', { code: 'KIKUNOI' });
      const manager = (bezetting.body.staff || []).find((s) => s.role === 'manager');
      assert.ok(manager, 'de demozaak heeft een manager');
      const login = await post('/api/supplier/login',
        { code: 'KIKUNOI', staffId: manager.id, pin: '1234' });
      assert.ok(login.body.token, 'de manager-login geeft een leverancierssessie');

      browser = await pw.chromium.launch(browserOpties(pw));
      const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_sup_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, login.body.token);
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      await page.goto(base + '/apps/leverancier-commerce.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#n-maak', { state: 'visible', timeout: 20000 });

      assert.equal((await page.getByRole('heading',
        { name: 'Verkoopwegen en retouren', exact: true }).textContent()).trim(),
      'Verkoopwegen en retouren');
      assert.ok(await page.locator('#n-soort option').count() > 0, 'het scherm toont de soorten uit de server');
      assert.ok(await page.locator('#n-toegang option').count() > 0, 'het scherm toont de toegangsvormen uit de server');

      await page.locator('#n-naam').fill('Schermwinkel');
      const gezet = page.waitForResponse((r) => r.url().endsWith('/api/supplier/verkoopweg/zet'));
      await page.locator('#n-maak').click();
      assert.equal((await gezet).status(), 200, 'aanmaken via het scherm lukt');
      await page.waitForFunction(() => [...document.querySelectorAll('#wegen .kaart h3')]
        .some((h) => /Schermwinkel/.test(h.textContent)), null, { timeout: 15000 });
      assert.deepEqual(fouten, [], 'geen JS-fouten op het commerce-scherm: ' + fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
