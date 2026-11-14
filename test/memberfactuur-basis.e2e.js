/* Echte gratis registratie en echte onboarding; geen vervanging van HTTP-state.
   De betaalview moet ook zonder betaalde pas renderen. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stopNet, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();
test('gratis account opent eigen betaaltab; betaalde tabs en demo-gast blijven begrensd',
  { skip: geenBrowser(pw) }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-basis-browser-'));
  let srv, browser;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: dir, SMTP_URL: '' } });
    const api = async (pad, body = {}, token) => {
      const r = await fetch(srv.base + pad, { method: 'POST', headers: {
        'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {})
      }, body: JSON.stringify(body) });
      return { status: r.status, body: await r.json() };
    };
    const reg = await api('/api/auth/register', { name: 'Basis Browser', email: 'basis@example.test',
      password: 'geheim123', geboortedatum: '1990-01-01', tier: 'guest', pasApp: 'rtg' });
    assert.equal(reg.status, 200); assert.equal(reg.body.state.user.tier, 'guest');
    assert.equal(reg.body.state.trip, undefined);
    const token = reg.body.token;
    const st = (await api('/api/onboarding/status', {}, token)).body;
    const sign = await api('/api/onboarding/teken', {
      naam: 'Basis Browser', akkoord: true, contractVersion: st.contract.versie
    }, token);
    assert.equal(sign.status, 200); assert.equal(sign.body.klaar, true);
    assert.equal((await api('/api/vak/offerte/vraag', {}, token)).status, 403);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await ctx.addInitScript(tok => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.removeItem('rtg_actieve_tab');
    }, token);
    const page = await ctx.newPage();
    const fouten = []; letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/app.html?pas=rtg#tab=betalen', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.view.active[data-view="betalen"]', { state: 'visible', timeout: 20000 });
    await page.waitForSelector('#payList #dlOverzicht', { state: 'visible', timeout: 20000 });
    assert.deepEqual(fouten, []);
    for (const tab of ['reizen', 'ai', 'assets']) {
      assert.equal(await page.evaluate(t => document.querySelector('.tabbar button[data-tab="' + t + '"]').style.display, tab), 'none');
      await page.goto(srv.base + '/apps/app.html?pas=rtg#tab=' + tab, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(t => document.querySelector('.tabbar button[data-tab="' + t + '"]')?.style.display === 'none'
        && !!document.querySelector('.view.active'), tab, { timeout: 20000 });
      assert.notEqual(await page.evaluate(() => document.querySelector('.view.active').dataset.view), tab);
    }
    assert.deepEqual(fouten, []);
    await ctx.close();
    const gast = (await api('/api/login', { tier: 'guest' })).body.token;
    assert.ok(gast);
    const demo = await browser.newContext();
    await demo.addInitScript(tok => {
      localStorage.setItem('rtg_member_token', tok); localStorage.setItem('rtg_lang', 'nl');
    }, gast);
    const dp = await demo.newPage();
    await dp.goto(srv.base + '/apps/app.html?pas=rtg#tab=betalen', { waitUntil: 'domcontentloaded' });
    await dp.waitForFunction(() => document.querySelector('.tabbar button[data-tab="betalen"]')?.style.display === 'none'
      && !!document.querySelector('.view.active'), null, { timeout: 20000 });
    assert.notEqual(await dp.evaluate(() => document.querySelector('.view.active').dataset.view), 'betalen');
    assert.equal(await dp.evaluate(() => document.querySelector('.tabbar button[data-tab="betalen"]').style.display), 'none');
    await demo.close();
  } finally {
    if (browser) await browser.close();
    if (srv) await stopNet(srv.child);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
