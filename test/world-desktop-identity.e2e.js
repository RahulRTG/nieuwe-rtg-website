'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { gezinAanAccount } = require('./gezinaccount');
const pw = laadPlaywright();
test('family widgets use the selected profile: parent without lesson preview, child with real lesson data, no member borrowing', { skip: geenBrowser(pw) }, async () => {
  // het gezin hangt aan een gekeurd ouderaccount (test/gezinaccount.js); de keuring vraagt de demo
  const srv = await startServer({ env: { RTG_MAGNAAT_TEST: '1', RTF_GEZIN_ACCOUNTPLICHT: '1', RTG_AI_UIT: '1', SMTP_URL: '' } }); let browser;
  const post = async (path, body) => {
    const r = await fetch(srv.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json(); assert.equal(r.status, 200, path + JSON.stringify(j)); return j;
  };
  try {
    const n = Date.now(), member = await post('/api/auth/register', { name: 'Ouder account', email: 'parent' + n + '@e.test',
      phone: '06' + String(n).slice(-8), password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg' });
    const f = await gezinAanAccount(srv.base, { gezinsnaam: 'Gescheiden profielen', kind: { naam: 'Milan', geboortedatum: '2015-04-04' } });
    const chosen = f;
    assert.equal(f.kind.profiel.rol, 'kind');
    assert.equal(f.kind.profiel.leeftijdBevestigd, true, 'server bevestigt de leeftijd van de echte kindfixture');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1050 }, serviceWorkers: 'block' });
    await ctx.addInitScript(({ member, f, chosen }) => {
      if (localStorage.getItem('desktop-family-fixture')) return;
      localStorage.setItem('desktop-family-fixture', '1');
      localStorage.setItem('rtg_member_token', member.token); localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtf_sessie', JSON.stringify({ code: f.code, token: chosen.token, profiel: chosen.profiel }));
    }, { member, f, chosen });
    const page = await ctx.newPage(), memberRequests = [], lessonRequests = [], errors = []; letOpFouten(page, errors);
    page.on('request', r => { if (/\/api\/(comm\/inbox|auth\/me|ik\/(workspace|beelden)|bestanden\/|notities\/mijn|agenda\/bereik)/.test(r.url())) memberRequests.push(r.url()); });
    page.on('request', r => { if (new URL(r.url()).pathname === '/api/rtf/leerling/dag') lessonRequests.push(r); });
    await page.goto(srv.base + '/apps/foundation/index.html');
    await page.waitForSelector('body[data-rtg-desktop]');
    // V4 houdt de voormalige bureaubladaccessoires bewust uit de zichtbare
    // magazineschil. Hun brondata blijft wel actief en moet dezelfde
    // tenant-/profielisolatie behouden.
    await page.waitForSelector('.wd-favorites [data-widget="foundation-agenda"] [data-state="ready"]', { state: 'attached' });
    assert.match(await page.locator('.wd-greeting').innerText(), /Ouder/);
    assert.equal(await page.locator('.wd-favorites [data-widget="foundation-leren"]').count(), 0,
      'ouder krijgt geen automatische leerlingpreview');
    assert.equal(lessonRequests.length, 0, 'de ouderagenda is klaar zonder een leerlingverzoek');
    // Presentatie verandert de serverpoort niet: dezelfde echte ouder blijft
    // geweigerd wanneer hij het leerlingendpoint rechtstreeks probeert.
    const denied = await fetch(srv.base + '/api/rtf/leerling/dag', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: f.code, token: f.token }) });
    assert.equal(denied.status, 403); await denied.arrayBuffer();

    const childResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/rtf/leerling/dag' &&
      r.request().method() === 'POST' && r.request().postDataJSON().token === f.kind.token);
    await page.evaluate(({ code, kind }) => {
      window.__oldDesktop = true;
      window.Sessie.zet({ code, token: kind.token, profiel: kind.profiel });
    }, { code: f.code, kind: f.kind });
    await page.waitForFunction(() => !window.__oldDesktop && !!document.body.dataset.rtgDesktop);
    const lesson = await childResponse;
    assert.equal(lesson.status(), 200, 'bevestigd kind bereikt het echte leerlingendpoint');
    assert.equal(lesson.request().postDataJSON().code, f.code);
    assert.ok(Array.isArray((await lesson.json()).stukken), 'echte leerlinginhoud, geen gemockt succes');
    await page.waitForSelector('.wd-favorites [data-widget="foundation-leren"] [data-state="ready"]', { state: 'attached' });
    await page.waitForSelector('.wd-favorites [data-widget="foundation-agenda"] [data-state="ready"]', { state: 'attached' });
    assert.match(await page.locator('.wd-greeting').innerText(), /Milan/);
    assert.ok(lessonRequests.length > 0);
    assert.ok(lessonRequests.every(r => r.postDataJSON().token === f.kind.token), 'alle leerlingverzoeken dragen het geselecteerde kindprofiel');

    const beforeParent = lessonRequests.length;
    await page.evaluate(({ code, token, profiel }) => {
      window.__oldDesktop = true; window.Sessie.zet({ code, token, profiel });
    }, { code: f.code, token: f.token, profiel: f.profiel });
    await page.waitForFunction(() => !window.__oldDesktop && !!document.body.dataset.rtgDesktop);
    await page.waitForSelector('.wd-favorites [data-widget="foundation-agenda"] [data-state="ready"]', { state: 'attached' });
    assert.match(await page.locator('.wd-greeting').innerText(), /Ouder/);
    assert.doesNotMatch(await page.locator('.wd-greeting').innerText(), /Milan/);
    assert.equal(await page.locator('.wd-favorites [data-widget="foundation-leren"]').count(), 0, 'geen kindpreview na terugwisselen');
    assert.equal(lessonRequests.length, beforeParent, 'ouderwissel hergebruikt geen kindaanvraag');
    assert.equal(await page.locator('.wd-library [data-widget="geld"]').count(), 0);
    assert.deepEqual(memberRequests, []);
    // Logging out the family clears the old surfaces, even while the member token remains.
    await page.evaluate(() => { window.__oldDesktop = true; window.Sessie.uitloggen(); });
    await page.waitForFunction(() => !window.__oldDesktop && !!document.body.dataset.rtgDesktop);
    await page.waitForSelector('.wd-favorites [data-widget="foundation-agenda"] [data-state="guest"]', { state: 'attached' });
    assert.doesNotMatch(await page.locator('.wd-greeting').innerText(), /Milan|Ouder account/);
    assert.deepEqual(memberRequests, []); assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); await stop(srv.child); }
});
