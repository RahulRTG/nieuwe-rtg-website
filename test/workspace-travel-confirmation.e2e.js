/* De TravelOS Spatial-werkruimte volgt de bestaande menselijke reisbalie.

   Spatial bevestigt zelf niets: het leest na een expliciete verversing de
   actuele status uit dezelfde Reisbureau-bron als de gewone Flow. */
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
    name: 'Travel bevestigingsproef', email: 'travel-confirm-' + unique + '@voorbeeld.test',
    phone: '0612345678', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
  });
  const status = await post(base, '/api/onboarding/status', {}, account.token);
  await post(base, '/api/onboarding/teken', {
    naam: 'Travel bevestigingsproef', akkoord: true, contractVersion: status.contract.versie
  }, account.token);
  return account.token;
}

test('TravelOS toont het bestaande menselijke besluit zonder een tweede statusbron',
  { skip: h.geenBrowser(pw) }, async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spatial-travel-confirm-'));
    const officeCode = 'RTG-SPATIAL-' + String(Date.now()).slice(-6);
    const server = await h.startServer({ env: {
      SMTP_URL: '', RTG_AI_UIT: '1', RTG_DATA_DIR: dataDir, OFFICE_CODE: officeCode
    } });
    const browser = await h.startBrowser(pw);
    try {
      const token = await member(server.base);
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
      await context.addInitScript((value) => {
        localStorage.setItem('rtg_member_token', value);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, token);
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors = [];
      h.letOpFouten(page, errors);

      await page.goto(server.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
      const travel = page.locator('[data-rtg-module="travel"]');
      await travel.locator('.rtg-travel-option').first().waitFor();
      await travel.locator('.rtg-travel-option').first().click();
      await travel.locator('[data-rtg-travel-input="date"]').fill(
        new Date(Date.now() + 38 * 86400000).toISOString().slice(0, 10));
      await travel.locator('[data-rtg-travel-action="review"]').click();
      page.once('dialog', (dialog) => dialog.accept());
      await travel.locator('[data-rtg-travel-action="submit"]').click();
      await travel.getByRole('heading', { name: 'Aanvraag ontvangen' }).waitFor();

      const requests = (await post(server.base, '/api/reisbureau/mijn', {}, token)).aanvragen;
      assert.equal(requests.length, 1);
      const ref = requests[0].ref;
      const office = await post(server.base, '/api/office/login', { code: officeCode });
      await post(server.base, '/api/office/reisbureau/besluit', {
        ref, besluit: 'bevestigd', bericht: 'Datum en verblijf zijn door de reisadviseur bevestigd.'
      }, office.token);

      await travel.locator('[data-rtg-travel-action="status"]').click();
      await travel.getByRole('heading', { name: 'Reis bevestigd' }).waitFor();
      assert.match(await travel.innerText(), /Datum en verblijf zijn door de reisadviseur bevestigd/);
      assert.doesNotMatch(await travel.innerText(), /door.{0,20}office|office.{0,20}door/i,
        'interne kantooridentiteit lekte naar de reiziger');

      const edge = await page.evaluate(() => window.RTGAdaptief.context());
      assert.equal(edge.activiteit, 'reis-bevestigd');
      assert.equal(edge.object.soort, 'reisaanvraag');
      assert.equal(edge.object.id, ref);
      assert.ok(edge.acties.includes('travel.request.status'));
      assert.deepEqual(errors, []);
      await context.close();
    } finally {
      await browser.close().catch(() => {});
      await h.stop(server.child || server);
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
