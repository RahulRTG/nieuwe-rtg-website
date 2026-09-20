'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const pw = laadPlaywright();
test('a family profile never borrows an existing member identity for desktop widgets', { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer({ env: { RTG_DEMO: '0', RTG_AI_UIT: '1', SMTP_URL: '' } }); let browser;
  const post = async (path, body) => {
    const r = await fetch(srv.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); assert.equal(r.status, 200, path + JSON.stringify(j)); return j;
  };
  try {
    const n = Date.now(), member = await post('/api/auth/register', { name: 'Ouder account', email: 'parent' + n + '@e.test',
      phone: '06' + String(n).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg' });
    const f = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Gescheiden profielen', naam: 'Ouder', pin: '1234', bevoegdGezin: true, privacyAkkoord: true });
    const c = await post('/api/foundation/gezin/profiel/maak', { code: f.code, token: f.token, naam: 'Milan', rol: 'kind', geboortedatum: '2015-04-04', pin: '5678' });
    const chosen = await post('/api/foundation/gezin/profiel/kies', { code: f.code, profielId: c.profiel.id, pin: '5678' });
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block' });
    await ctx.addInitScript(({ member, f, chosen }) => {
      if (localStorage.getItem('desktop-family-fixture')) return;
      localStorage.setItem('desktop-family-fixture', '1');
      localStorage.setItem('rtg_member_token', member.token); localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtf_sessie', JSON.stringify({ code: f.code, token: chosen.token, profiel: chosen.profiel }));
    }, { member, f, chosen });
    const page = await ctx.newPage(), memberRequests = [], errors = []; letOpFouten(page, errors);
    page.on('request', r => { if (/\/api\/(comm\/inbox|auth\/me|ik\/workspace|notities\/mijn|agenda\/bereik)/.test(r.url())) memberRequests.push(r.url()); });
    await page.goto(srv.base + '/apps/foundation/index.html');
    await page.waitForSelector('body[data-rtg-desktop]');
    await page.waitForSelector('.wd-favorites [data-widget="foundation-agenda"] [data-state="ready"]');
    assert.match(await page.locator('.wd-greeting').innerText(), /Milan/);
    assert.equal(await page.locator('.wd-library [data-widget="geld"]').count(), 0);
    assert.deepEqual(memberRequests, []);
    // Logging out the family clears the old surfaces, even while the member token remains.
    await page.evaluate(() => { window.__oldDesktop = true; window.Sessie.uitloggen(); });
    await page.waitForFunction(() => !window.__oldDesktop && !!document.body.dataset.rtgDesktop);
    await page.waitForSelector('.wd-favorites [data-widget="foundation-agenda"] [data-state="guest"]');
    assert.doesNotMatch(await page.locator('.wd-greeting').innerText(), /Milan|Ouder account/);
    assert.deepEqual(memberRequests, []); assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
