'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const pw = laadPlaywright({ eigenDriver: false });

async function api(base, pad, body) {
  const r = await fetch(base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}) });
  return r.json();
}

test('lege familiekaarten openen direct hun bestaande invullaag', { skip: geenBrowser(pw) }, async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-familie-leeg-'));
  const server = await startServer({ env: { RTG_DATA_DIR: map, SMTP_URL: '' } });
  let browser;
  try {
    const lid = await api(server.base, '/api/auth/register', { name: 'Familie Lid',
      email: 'familie-leeg-' + process.pid + '@x.nl', phone: '0612345788', password: 'geheim123',
      geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(lid.token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
    await context.addInitScript(token => {
      localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, lid.token);
    await context.route('**/api/comm/inbox', route => route.fulfill({ status: 200,
      contentType: 'application/json', body: JSON.stringify({ gesprekken: [], laden: [], ongelezen: 0 }) }));

    const berichten = await context.newPage();
    await berichten.goto(server.base + '/apps/comm.html', { waitUntil: 'domcontentloaded' });
    const leeg = berichten.locator('#gesprekken .rtg-leeg-vlak--actie');
    await leeg.waitFor({ state: 'visible' });
    assert.equal(await leeg.getAttribute('role'), 'button');
    await leeg.click();
    await berichten.locator('#bladWaas.open #blad').getByRole('heading', { name: 'Nieuw gesprek' }).waitFor();

    const reizen = await context.newPage();
    await reizen.goto(server.base + '/apps/reizen.html#rahul', { waitUntil: 'domcontentloaded' });
    const rahulVraag = reizen.locator('[data-blad="rahul"]:not([hidden]) #rahulVraag');
    await rahulVraag.waitFor({ state: 'visible' });
    assert.equal(await rahulVraag.isEnabled(), true);
    assert.equal(await reizen.locator('[data-tab="rahul"]').getAttribute('aria-current'), 'page');
  } finally {
    if (browser) await browser.close();
    stop(server.child);
  }
});
