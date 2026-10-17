/* Gerichte toegankelijkheidsproef voor de TravelOS Spatial-taak.

   Deze proef vervangt geen handmatige schermlezerkeuring. Hij bewijst wel de
   kritieke toetsenbordvolgorde, focusoverdracht, aanraakmaat, live status,
   tekstvergroting en reduced-motiongrens van de echte browserweergave. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const h = require('./helper');

const pw = h.laadPlaywright();

async function post(base, route, body, token) {
  const response = await fetch(base + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  });
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  return data;
}

async function member(base) {
  const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const account = await post(base, '/api/auth/register', {
    name: 'Travel toegankelijkheidsproef', email: 'travel-a11y-' + unique + '@voorbeeld.test',
    phone: '0612345678', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  const status = await post(base, '/api/onboarding/status', {}, account.token);
  await post(base, '/api/onboarding/teken', {
    naam: 'Travel toegankelijkheidsproef', akkoord: true, contractVersion: status.contract.versie
  }, account.token);
  return account.token;
}

test('TravelOS Spatial houdt toetsenbord, focus, touchmaat en tekstvergroting bruikbaar',
  { skip: h.geenBrowser(pw) }, async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spatial-travel-a11y-'));
    const server = await h.startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DATA_DIR: dataDir } });
    const browser = await h.startBrowser(pw);
    try {
      const token = await member(server.base);
      const context = await browser.newContext({
        viewport: { width: 1280, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce'
      });
      await context.addInitScript((value) => {
        localStorage.setItem('rtg_member_token', value);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, token);
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      await page.goto(server.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
      const module = page.locator('[data-rtg-module="travel"]');
      const option = module.locator('.rtg-travel-option').first();
      await option.waitFor();

      await option.focus();
      await page.keyboard.press('Enter');
      const date = module.locator('[data-rtg-travel-input="date"]');
      await date.waitFor();
      assert.equal(await date.evaluate((node) => node === document.activeElement), true,
        'kiezen verplaatste focus niet naar het eerste relevante veld');
      await date.fill(new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10));

      const review = module.locator('[data-rtg-travel-action="review"]');
      await review.focus();
      await page.keyboard.press('Enter');
      const submit = module.locator('[data-rtg-travel-action="submit"]');
      await submit.waitFor();
      assert.equal(await submit.evaluate((node) => node === document.activeElement), true,
        'review verplaatste focus niet naar de expliciete verstuuractie');
      assert.equal(await module.locator('[role="status"][aria-live="polite"]').count() > 0, true,
        'de reviewstatus heeft geen beleefde live region');

      const sizes = await module.evaluate((root) => {
        const nodes = [...root.querySelectorAll('button')];
        return nodes.filter((node) => !node.disabled && node.getClientRects().length).map((node) => {
          const rect = node.getBoundingClientRect();
          return { action: node.dataset.rtgTravelAction || '', width: rect.width, height: rect.height };
        });
      });
      for (const size of sizes) {
        assert.ok(size.height >= 44, 'actie ' + size.action + ' is lager dan 44 px: ' + size.height);
      }

      const motion = await module.evaluate((root) => getComputedStyle(root.closest('.rtg-ss-module')).transitionDuration);
      assert.match(motion, /^(0s)(, 0s)*$/, 'reduced motion liet moduletransities actief: ' + motion);

      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
      await submit.scrollIntoViewIfNeeded();
      const enlarged = await module.evaluate((root) => ({
        client: root.clientWidth, scroll: root.scrollWidth,
        submitVisible: !!root.querySelector('[data-rtg-travel-action="submit"]')?.getClientRects().length
      }));
      assert.equal(enlarged.submitVisible, true);
      assert.ok(enlarged.scroll <= enlarged.client + 2,
        '200% tekst veroorzaakte horizontaal verborgen Travel-inhoud: ' + JSON.stringify(enlarged));
      await context.close();
    } finally {
      await browser.close().catch(() => {});
      await h.stop(server.child || server);
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
