/* TravelOS Spatial bij antwoordverlies.

   De server mag de aanvraag al hebben verwerkt terwijl het antwoord onderweg
   verdwijnt. De werkruimte moet dan bij de bron controleren en mag de mutatie
   nooit stilzwijgend herhalen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const h = require('./helper');

const pw = h.laadPlaywright();

async function api(base, route, body, token) {
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
  const account = await api(base, '/api/auth/register', {
    name: 'Travel herstelproef', email: 'travel-recovery-' + unique + '@voorbeeld.test',
    phone: '0612345678', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  const status = await api(base, '/api/onboarding/status', {}, account.token);
  await api(base, '/api/onboarding/teken', {
    naam: 'Travel herstelproef', akkoord: true, contractVersion: status.contract.versie
  }, account.token);
  return account.token;
}

test('TravelOS herstelt na antwoordverlies zonder een tweede aanvraag te versturen',
  { skip: h.geenBrowser(pw) }, async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spatial-travel-recovery-'));
    const server = await h.startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DATA_DIR: dataDir } });
    const browser = await h.startBrowser(pw);
    try {
      const token = await member(server.base);
      const context = await browser.newContext({
        viewport: { width: 1440, height: 960 }, serviceWorkers: 'block', reducedMotion: 'reduce'
      });
      await context.addInitScript((value) => {
        localStorage.setItem('rtg_member_token', value);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, token);
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      h.letOpFouten(page, errors);

      let submitRequests = 0;
      await page.route('**/api/reisbureau/boek', async (route) => {
        submitRequests++;
        await route.fetch();
        await route.abort('failed');
      });

      await page.goto(server.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
      const travel = page.locator('[data-rtg-module="travel"]');
      await travel.locator('.rtg-travel-option').first().waitFor();
      await travel.locator('.rtg-travel-option').first().click();
      const date = new Date(Date.now() + 36 * 86400000).toISOString().slice(0, 10);
      await travel.locator('[data-rtg-travel-input="date"]').fill(date);
      await travel.locator('[data-rtg-travel-action="review"]').click();
      page.once('dialog', (dialog) => dialog.accept());
      await travel.locator('[data-rtg-travel-action="submit"]').click();

      await travel.getByRole('heading', { name: 'Uitkomst nog onbekend' }).waitFor();
      const uncertainContext = await page.evaluate(() => window.RTGAdaptief.context());
      assert.ok(uncertainContext.acties.includes('travel.request.check'));
      assert.ok(!uncertainContext.acties.includes('travel.request.submit'));
      assert.equal(submitRequests, 1);

      await travel.locator('[data-rtg-travel-action="check"]').click();
      await travel.getByRole('heading', { name: 'Aanvraag ontvangen' }).waitFor();
      assert.match(await travel.innerText(), /bij de bron teruggevonden/i);
      assert.equal(submitRequests, 1, 'bronherstel verstuurde de aanvraag opnieuw');

      const requests = (await api(server.base, '/api/reisbureau/mijn', {}, token)).aanvragen;
      assert.equal(requests.length, 1);
      assert.equal(requests[0].vertrek, date);
      assert.deepEqual(errors, []);
      await context.close();
    } finally {
      await browser.close().catch(() => {});
      await h.stop(server.child || server);
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
