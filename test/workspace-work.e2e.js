/* WorkOS Spatial in een echte browser. Het paneel opent bestaande WerkOS-data
   pas na een expliciete handeling en houdt de verse WerkOS-sessie buiten DOM,
   Workspace State en browseropslag. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const h = require('./helper');

const pw = h.laadPlaywright();

async function api(base, route, body, token) {
  const response = await fetch(base + route, { method: 'POST', headers: {
    'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
  }, body: JSON.stringify(body || {}) });
  const data = await response.json().catch(() => ({}));
  assert.equal(response.status, 200, route + ': ' + JSON.stringify(data)); return data;
}

async function member(base, label) {
  const unique = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const account = await api(base, '/api/auth/register', { name: label, email: 'work-spatial-' + unique + '@voorbeeld.test',
    phone: '0612345678', password: 'geheim12345', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
  const status = await api(base, '/api/onboarding/status', {}, account.token);
  await api(base, '/api/onboarding/teken', { naam: label, akkoord: true, contractVersion: status.contract.versie }, account.token);
  return account.token;
}

async function linkWorkspace(base, token) {
  const made = await api(base, '/api/bedrijf/werkruimte/maak', { naam: 'Atlas Werkbedrijf', land: 'NL' });
  const joined = await api(base, '/api/bedrijf/lid/aanmeld', { werkruimte: made.werkruimte, naam: 'Ada Werk' });
  await api(base, '/api/bedrijf/lid/besluit', { werkruimte: made.werkruimte, beheerToken: made.beheerToken,
    lidId: joined.lidId, akkoord: true });
  await api(base, '/api/bedrijf/lid/rollen', { werkruimte: made.werkruimte, beheerToken: made.beheerToken,
    lidId: joined.lidId, rollen: ['medewerker'] });
  await api(base, '/api/bedrijf/lid/koppel', { werkruimte: made.werkruimte, lidToken: joined.lidToken }, token);
  return { code: made.werkruimte, oldToken: joined.lidToken };
}

test('WorkOS Spatial activeert expliciet en sluit een gewisseld account direct uit',
  { skip: h.geenBrowser(pw) }, async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-spatial-work-'));
    const server = await h.startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1', RTG_DATA_DIR: dataDir } });
    const browser = await h.startBrowser(pw);
    try {
      const token = await member(server.base, 'Ada Werk');
      const other = await member(server.base, 'Andere gebruiker');
      const linked = await linkWorkspace(server.base, token);
      const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
      await context.addInitScript((value) => {
        localStorage.setItem('rtg_member_token', value); localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, token);
      const page = await context.newPage(); page.setDefaultTimeout(25000);
      const errors = []; h.letOpFouten(page, errors);
      let mine = 0, starts = 0;
      await page.route('**/api/bedrijf/mijn', async route => { mine++; await route.continue(); });
      await page.route('**/api/bedrijf/start', async route => { starts++; await route.continue(); });

      await page.goto(server.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
      const work = page.locator('[data-rtg-module="work"]');
      await work.locator('[data-rtg-work-action="connect"]').waitFor();
      assert.equal(mine, 0, 'module-render maakte geen verborgen WorkOS-sessie');
      assert.equal(starts, 0, 'module-render las geen bedrijfsdata');

      await work.locator('[data-rtg-work-action="connect"]').click();
      await work.getByText('Atlas Werkbedrijf', { exact: true }).waitFor();
      assert.equal(mine, 1); assert.equal(starts, 1);
      assert.match(await work.innerText(), /Ada Werk/);
      const exposure = await page.evaluate(() => ({ html: document.documentElement.innerHTML,
        storage: Object.keys(localStorage).map(key => [key, localStorage.getItem(key)]) }));
      assert.equal(exposure.html.includes(linked.oldToken), false, 'oude WorkOS-sessie staat niet in DOM');
      assert.equal(JSON.stringify(exposure.storage).includes(linked.oldToken), false, 'oude WorkOS-sessie staat niet in opslag');

      await page.evaluate(value => localStorage.setItem('rtg_member_token', value), other);
      await work.locator('[data-rtg-work-action="refresh"]').click();
      await work.getByText(/Uw account is gewijzigd/).waitFor();
      assert.equal(starts, 1, 'accountwissel deed geen verzoek met de vorige WorkOS-sessie');
      assert.equal((await work.innerText()).includes('Atlas Werkbedrijf'), false, 'oude organisatie bleef niet zichtbaar');
      assert.deepEqual(errors, []);
      await context.close();
    } finally {
      await browser.close().catch(() => {});
      await h.stop(server.child || server);
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
