/* Een DS-Edge draagt de bestaande Rahul-owner, zonder een tweede kopknop.
   Vier echte renders; de negatieve toestanden toetsen de presentatiegrens. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten } = require('./helper');
const { beeld } = require('./lib/ds-toets');
const pw = laadPlaywright();

test('Wonen en Studio houden één Rahul-ingang en dezelfde werkruimte op 390 en 1440',
  { skip: geenBrowser(pw) }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rahul-kop-'));
  let srv, browser;
  try {
    srv = await startServer({ env: { RTG_DATA_DIR: tmp, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE',
      RTG_EXTERNE_AI_UIT: '1', LOCAL_AI_URL: '', ANTHROPIC_API_KEY: '', OPENAI_API_KEY: '' } });
    async function post(url, body) {
      const r = await fetch(srv.base + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json(); assert.equal(r.status, 200, url); return j;
    }
    const token = (await post('/api/auth/register', { name: 'Headerproef', email: 'header@wereld.test',
      phone: '0612345678', password: 'geheim123', geboortedatum: '1980-01-01', tier: 'rtg' })).token;
    const office = (await post('/api/office/login', { code: 'RTG-OFFICE' })).token;
    assert.ok(token && office);
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const route of ['wonen', 'studio-pda']) for (const width of [390, 1440]) {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers: 'block', reducedMotion: 'reduce' });
      try {
        await ctx.addInitScript(({ token, office }) => {
          localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_office_token', office);
          localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
        }, { token, office });
        const page = await ctx.newPage(), fouten = letOpFouten(page, []);
        await page.goto(srv.base + '/apps/' + route + '.html', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.body.classList.contains('ds-rahul-eigenaar') &&
          !!window.RTGMetgezel?.rahul && !!window.RTGRahulTabHelpers && !!window.RTGRahulSession && !!window.RTGRahulApproval);
        const tab = page.locator('.ds-rahul-tab'), werk = page.locator('.ds-rahul'), edge = page.locator('body > .ds-edge');
        await page.locator('[data-ds-edge="rahul"]').waitFor();
        assert.equal(await page.locator('html[data-ds]').count(), 1);
        assert.equal(await tab.count(), 1, 'de bestaande gedragshaak blijft bestaan');
        assert.equal(await tab.isVisible(), false, route + width + ': geen dubbele kopknop');
        assert.equal(await tab.getAttribute('data-ds-actie'), 'Rahul openen');
        assert.equal(await tab.evaluate(el => el.getClientRects().length), 0, 'geen tweede koprij of overlap');
        await beeld(page, route + '-rahulkop-' + width);

        // Zonder actieve Edge of DS-owner blijft de oorspronkelijke ingang.
        await edge.evaluate(el => { el.hidden = true; });
        assert.equal(await tab.isVisible(), true);
        await edge.evaluate(el => { el.hidden = false; });
        await page.evaluate(() => document.body.classList.remove('ds-rahul-eigenaar'));
        assert.equal(await tab.isVisible(), true, 'selectorgrens, geen legacy-kwalificatie');
        await page.evaluate(() => document.body.classList.add('ds-rahul-eigenaar'));
        await page.evaluate(() => window.RTGDs.edge.modus('bericht', { verstuur() {} }));
        assert.equal(await tab.isVisible(), true, 'berichtmodus heeft geen Rahul-knop');
        await page.evaluate(() => window.RTGDs.edge.terug());
        assert.equal(await tab.isVisible(), false);

        async function openViaActies() {
          await page.locator('[data-ds-edge="acties"]').click();
          await page.locator('#dsEdgeBlad').getByRole('button', { name: 'Rahul openen', exact: true }).click();
          await werk.waitFor({ state: 'visible' });
        }
        await openViaActies();
        assert.equal(await page.evaluate(() => window.__rahulTabCommand.page === document.querySelector('.ds-rahul')), true);
        await werk.locator('.rtg-command-form input').fill('Mijn nog niet verzonden vraag');
        await werk.getByRole('button', { name: 'Terug naar werkblad', exact: true }).click();
        await werk.waitFor({ state: 'hidden' });
        await openViaActies();
        assert.equal(await werk.locator('.rtg-command-form input').inputValue(), 'Mijn nog niet verzonden vraag');
        await werk.getByRole('button', { name: 'Terug naar werkblad', exact: true }).click();
        await werk.waitFor({ state: 'hidden' });

        // Ook de lippen houden hun bestaande vraagroute naar dezelfde owner.
        await page.locator('[data-ds-edge="rahul"]').click();
        assert.equal(await tab.isVisible(), false);
        const vraag = 'Welke hulp is op dit werkblad beschikbaar?';
        const antwoord = page.waitForResponse(r => r.url().endsWith('/api/fluister') && r.request().method() === 'POST');
        await page.locator('.ds-edge__veld').fill(vraag);
        await page.locator('.ds-edge__veld').press('Enter');
        await werk.waitFor({ state: 'visible' });
        const r = await antwoord;
        assert.equal(r.status(), 200);
        assert.equal(r.request().postDataJSON().q, vraag);
        assert.ok(r.request().postDataJSON().context, 'bestaande Rahul-context blijft aangesloten');
        assert.equal(await werk.count(), 1);
        await werk.getByRole('button', { name: 'Terug naar werkblad', exact: true }).click();
        await werk.waitFor({ state: 'hidden' });
        assert.equal(await page.locator('main').isVisible(), true, route + width + ': het echte DS-werkblad blijft zichtbaar');
        assert.equal(await page.locator('body.ds-wereldwerkruimte > .wd-shell').count(), 1,
          route + width + ': precies de canonieke werkruimteschil blijft eigenaar');
        assert.equal(await page.locator('.rtg-adaptive-edge:visible,.rtg-edge-chrome:visible').count(), 0,
          route + width + ': geen legacy-Edge keert terug');
        assert.deepEqual(fouten, []);
      } finally { await ctx.close(); }
    }
  } finally {
    if (browser) await browser.close();
    if (srv) await stop(srv.child);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
