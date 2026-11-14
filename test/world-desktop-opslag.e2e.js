/* Echte A→B→A-mutaties en een verloren antwoord na servercommit. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const pw = laadPlaywright();

test('iedere bewuste widgetkeuze krijgt een nieuwe sleutel; herproberen behoudt zijn opdracht',
  { skip: geenBrowser(pw) }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-workspace-idem-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', OPENAI_API_KEY: '', ANTHROPIC_API_KEY: '' } });
  let browser, token;
  async function post(pad, body) {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body || {}) });
    const j = await r.json(); assert.equal(r.status, 200, JSON.stringify(j)); return j;
  }
  async function lees(gekozen) {
    const r = await post('/api/ik/workspace', { scope: 'living' });
    assert.deepEqual(r.workspace.order, gekozen ? ['agenda', 'notities'] : ['agenda']);
  }
  try {
    token = (await post('/api/auth/register', { name: 'Widgetproef', email: 'widgetproef@example.test', phone: '0612345678', password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg' })).token;
    assert.ok(token);
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
    await page.addInitScript(t => {
      localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, token);
    const lijst = page.waitForResponse(r => r.url().endsWith('/api/ik/workspace'));
    /* wonen.html bezit inmiddels bewust de centrale DS-schil en start daarom
       geen tweede desktop-runtime. Het bestaande LivingOS-beginscherm blijft
       de zichtbare werkruimtehost en bewijst hier diens opslagcontract. */
    await page.goto(srv.base + '/apps/rtg.html'); await lijst;
    await page.waitForFunction(() => document.body.dataset.rtgDesktopState === 'ready');
    await page.locator('.wd-app-controls > summary').click(); await page.locator('#wdSearch').fill('notities');
    const card = page.locator('.wd-library [data-widget="notities"]');
    const pin = card.locator('.wd-widget-pin'), keys = [];
    for (const gekozen of [false, true, false]) {
      await card.hover(); // de rustige desktop toont de secundaire pinactie op intentie
      const [r] = await Promise.all([
        page.waitForResponse(r => r.url().endsWith('/api/ik/workspace/zet')),
        pin.click()
      ]);
      assert.equal(r.status(), 200);
      const j = await r.json(), body = r.request().postDataJSON();
      assert.match(body.idem, /^desktop-layout-[a-f0-9]{32}$/); keys.push(body.idem);
      assert.notEqual(j.herhaald, true, 'een nieuwe keuze mag geen oud succes afspelen');
      assert.equal(await pin.getAttribute('aria-pressed'), String(gekozen));
      await lees(gekozen);
    }
    assert.equal(new Set(keys).size, 3, 'A→B→A zijn drie bewuste opdrachten');

    let verlies = true; const pogingen = [];
    await page.route('**/api/ik/workspace/zet', async route => {
      pogingen.push(route.request().postDataJSON());
      if (verlies) { verlies = false; await route.fetch(); await route.abort('failed'); }
      else await route.continue();
    });
    await card.hover(); await pin.click();
    await page.locator('.wd-favorites [role="status"]').filter({ hasText: 'kon niet worden bewaard' }).waitFor();
    await lees(true); // De server verwerkte de opdracht; alleen het antwoord ging verloren.
    const retry = page.locator('.wd-favorites').getByRole('button', { name: 'Probeer opnieuw', exact: true });
    const [herhaling] = await Promise.all([
      page.waitForResponse(r => r.url().endsWith('/api/ik/workspace/zet')), retry.click()
    ]);
    assert.equal(herhaling.status(), 200); assert.equal((await herhaling.json()).herhaald, true);
    assert.equal(pogingen.length, 2); assert.deepEqual(pogingen[1], pogingen[0], 'retry bewaart sleutel én payload');
    assert.ok(!keys.includes(pogingen[0].idem), 'de nieuwe keuze na A heeft een eigen sleutel');
    await retry.waitFor({ state: 'hidden' }); await lees(true);
    assert.equal(await pin.getAttribute('aria-pressed'), 'true');
  } finally {
    if (browser) await browser.close(); stop(srv.child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
