/* Een echte browserproef voor de gesloten eerste minuut van PersonalOS.
   Dit is bewust geen tweede onboardingfixture: de toets bedient de bestaande
   toegangspoort, wacht op de openbare preview, laat de echte accountregistratie
   PersonalOS voltooien en opent daarna Mijn RTG vanuit het bestaande
   bedieningspaneel. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, letOpFouten, bankDeur } = require('./helper');

const pw = laadPlaywright();

test('nieuwe gebruiker ziet een preview en landt in dezelfde persoonlijke RTG',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-personalos-ui-'));
    const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: dataDir, RTG_AI_UIT: '1' } });
    let browser;
    try {
      browser = await pw.chromium.launch(browserOpties(pw));
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
      await context.addInitScript(() => {
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      });
      const page = await context.newPage();
      const fouten = [], previews = [];
      letOpFouten(page, fouten);
      page.on('response', response => {
        if (new URL(response.url()).pathname === '/api/personalos/preview') previews.push(response.status());
      });

      await page.goto(srv.base + '/apps/app.html?pas=rtg', { waitUntil: 'domcontentloaded' });
      await page.locator('#agNieuw').click();
      for (const value of ['Proefpersoon PersonalOS', 'personalos-' + Date.now() + '@example.test', '1990-05-17']) {
        await page.locator('#agIn').fill(value);
        await page.locator('#agGo').click();
      }

      await page.getByRole('button', { name: /Ondernemen/ }).click();
      await page.getByRole('button', { name: /Reizen/ }).click();
      await page.locator('#agGo').click();
      await page.locator('#agPersonalPreview').waitFor({ state: 'visible' });
      await page.waitForFunction(() => /Uw RTG begint met:/.test(document.querySelector('#agPersonalPreview').textContent));
      await page.getByRole('button', { name: /Uitgebreid/ }).click();
      await page.locator('#agGo').click();
      await page.locator('#agIn').fill('Sterk-Wachtwoord-2026');
      await page.locator('#agGo').click();

      await page.waitForFunction(() => window.RTGPersonalOS && window.RTGPersonalOS.preferences &&
        window.RTGPersonalOS.preferences.completed === true);
      const stand = await page.evaluate(() => ({
        goals: window.RTGPersonalOS.preferences.goals,
        layout: window.RTGPersonalOS.preferences.layout,
        revision: window.RTGPersonalOS.preferences.revision,
        worlds: window.RTGPersonalOS.composition.worlds.map(w => w.id),
        token: !!localStorage.getItem('rtg_member_token')
      }));
      assert.deepEqual(stand.goals, ['ondernemen', 'reizen']);
      assert.equal(stand.layout, 'advanced');
      assert.equal(stand.revision, 1);
      assert.equal(stand.worlds[0], 'travelos');
      assert.equal(stand.token, true);
      assert.ok(previews.includes(200), 'de gebruiker heeft voor accountbevestiging een geslaagde preview gezien');

      /* Accountregistratie is nog niet hetzelfde als een bereikbare werktafel:
         de bestaande juridische onboarding hoort ertussen en mag niet worden
         omzeild door PersonalOS. Bedien daarom ook die echte poort. */
      await page.waitForSelector('#onbConsentLabel:not([hidden])');
      await page.locator('#onbActies button').click();
      await page.locator('#onbConsent').check();
      await page.locator('#onbGo').click();
      await page.waitForSelector('#onbGate', { state: 'hidden' });
      await page.waitForSelector('#kanaalVraag', { state: 'visible' });
      await page.locator('#kanaalVraag [data-kanaal=""]').click();
      await page.waitForSelector('#kanaalVraag', { state: 'detached' });

      await page.waitForSelector('#rtgCommand[data-stand="open"] .cmd-leeg');
      await bankDeur(page, 'Instellingen');
      await page.locator('#osCcPersonal').click();
      await page.locator('#osPersonalScrim.open').waitFor({ state: 'visible' });
      assert.match(await page.locator('#osPersonalTitel').innerText(), /Mijn RTG aanpassen/i);
      assert.ok(await page.locator('#osPersonalGoals button[aria-pressed="true"]').count() >= 2);
      assert.deepEqual(fouten, []);
      await context.close();
    } finally {
      if (browser) await browser.close().catch(() => {});
      await stop(srv.child);
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });
