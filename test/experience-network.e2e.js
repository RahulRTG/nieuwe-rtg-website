'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const h = require('./helper'), pw = h.laadPlaywright();
test('netwerkplan op mobiel en desktop: zoeken, kiezen, bevestigen, bewaren en herstel zonder AI',
  { skip: h.geenBrowser(pw), timeout: 180000 }, async t => {
    const srv = await h.startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } }); let browser;
    try {
      const response = await fetch(srv.base + '/api/auth/register', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Netwerkbrowser',
          email: 'network-browser@rtg.test', phone: '0612345678', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }) });
      const { token } = await response.json(); assert.ok(token);
      browser = await pw.chromium.launch(h.browserOpties(pw));
      for (const width of [390, 1440]) await t.test('breedte ' + width, async () => {
        const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block' });
        await context.addInitScript(tok => { localStorage.setItem('rtg_member_token', tok);
          localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
        const page = await context.newPage(), errors = []; h.letOpFouten(page, errors);
        await page.goto(srv.base + '/apps/rtg.html', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.RTGExperience && window.RTGExperience.bootstrap());
        await h.edgeActies(page); await page.locator('.xp-trigger').click();
        await page.getByRole('button', { name: 'Stel samen', exact: true }).click();
        const form = page.locator('form').filter({ has: page.locator('[name="network-title"]') });
        await form.locator('[name="network-title"]').fill('Plan ' + width);
        await form.locator('[name="network-needs"][value="product"]').check();
        await form.getByRole('button', { name: 'Zoek mogelijkheden' }).click();
        await form.locator('[name="network-choice-product"]').first().check();
        await form.getByRole('button', { name: 'Controleer en bewaar' }).click();
        await form.getByRole('button', { name: 'Bevestig en bewaar' }).click();
        await form.getByRole('link', { name: 'Open Mijn lijsten' }).waitFor();
        assert.match(await form.innerText(), /is bewaard/);
        assert.equal(await page.locator('.xp-dialog').evaluate(n => n.scrollWidth <= n.clientWidth + 1), true);
        const out = path.join(__dirname, '../artifacts/experience'); fs.mkdirSync(out, { recursive: true });
        await page.screenshot({ path: path.join(out, 'network-' + width + '.png') });
        // Offline zoeken behoudt invoer en kan na herstel opnieuw worden gedaan.
        await form.locator('[name="network-city"]').fill('Onbekende plaats');
        await context.setOffline(true); await form.getByRole('button', { name: 'Zoek mogelijkheden' }).click();
        await page.waitForFunction(() => !document.querySelector('[name="network-title"]').closest('form').querySelector('[type="submit"]').disabled);
        assert.equal(await form.locator('[name="network-title"]').inputValue(), 'Plan ' + width);
        await context.setOffline(false); await form.getByRole('button', { name: 'Zoek mogelijkheden' }).click();
        await form.getByText('Nog geen passend aanbod op deze plaats.').waitFor();
        assert.deepEqual(errors, []); await context.close();
      });
    } finally { if (browser) await browser.close(); await h.stop(srv.child); }
  });
