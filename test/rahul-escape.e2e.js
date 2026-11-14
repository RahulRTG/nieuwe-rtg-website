'use strict';
/* ESCAPE SLUIT HET RAHUL-PANEEL.

   Gevonden door APPWERKT (24 september 2026): na elke tik drukt de meter nu
   Escape, zoals een mens een geopende laag sluit. Elke gedeelde laag ging dicht
   (de sprong, de taalkeuze, de lade, de uitvoerlaag) -- behalve het paneel van
   Rahul, dat vast over het hele werkblad ligt. Daaronder bleven 109 knoppen
   onbereikbaar. De sluitknop werkte; Escape deed niets. GRAMMATICA.md belooft
   "ik kan bijna altijd terug", en dat hoort voor elke laag hetzelfde te werken.

   MUTATIE GEZIEN ZAKKEN: de keydown-luisteraar in shared/rahul-tab/helpers.js
   weghalen laat de tweede assert zakken ("Escape sloot het paneel niet"). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { laadScherm, startServer, stopHard, browserOpties, geenBrowser, letOpFouten, wachtTot } = require('./helper');

const pw = laadScherm();

test('Escape sluit het Rahul-paneel, net als de sluitknop', { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rahul-escape-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const r = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Escape Lid', email: 'escape' + process.pid + '@x.nl',
        phone: '0612345788', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'guest' }) });
    const reg = await r.json();
    assert.equal(r.status, 200);
    assert.equal(reg.state.user.tier, 'guest', 'de gedeelde assistent vereist geen betaalde testpersona');
    assert.ok(reg.token, 'lid-registratie geeft een token');
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((t) => {
      try {
        localStorage.setItem('rtg_member_token', t);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    const fouten = letOpFouten(page, []);
    await page.goto(base + '/apps/mijn-neigingen.html', { waitUntil: 'domcontentloaded' });
    await wachtTot(page, () => !!window.RTGRahulTabHelpers &&
      !!document.querySelector('.rtg-adaptive-bar [data-rtg-adaptive-action="ai"]'),
      null, { wat: 'Rahul in de ene gedeelde Edge' });

    const open = () => page.evaluate(() => { const p = document.querySelector('.rtg-rahul-page'); return !!p && !p.hidden; });
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await require('./helper').edgeRahul(page);
      await wachtTot(page, () => { const p = document.querySelector('.rtg-rahul-page'); return !!p && !p.hidden; },
        null, { wat: 'het Rahul-paneel open' });
      // Ook de late annotatieronde mag de globale laag nooit als scherminhoud
      // markeren: die inhoudsregel overschreef vervolgens het hidden-attribuut.
      await page.evaluate(() => window.RTGHeritageComponents.annotate());
      assert.deepEqual(await page.locator('.rtg-rahul-page').evaluate(p => ({
        globaal: p.parentNode === document.body, inhoud: p.hasAttribute('data-rtg-screen-root')
      })), { globaal: true, inhoud: false });

      await page.keyboard.press('Escape');
      await wachtTot(page, () => { const p = document.querySelector('.rtg-rahul-page'); return !!p && p.hidden; },
        null, { wat: 'het Rahul-paneel dicht na Escape' }).catch(() => {});
      assert.equal(await open(), false, 'Escape sloot het paneel niet');
      assert.equal(await page.locator('.rtg-rahul-page').isVisible(), false, 'hidden is ook visueel en voor hit-testing gesloten');

      // opnieuw open, en de sluitknop blijft ook werken
      await require('./helper').edgeRahul(page);
      await wachtTot(page, () => { const p = document.querySelector('.rtg-rahul-page'); return !!p && !p.hidden; },
        null, { wat: 'het Rahul-paneel opnieuw open' });
      await page.locator('.rtg-command-close').click();
      assert.equal(await open(), false, 'de sluitknop sloot het paneel niet');
      assert.equal(await page.locator('.rtg-rahul-page').isVisible(), false);

      // Escape zonder open paneel doet niets bijzonders
      await page.keyboard.press('Escape');
      assert.equal(await open(), false);
    }
    assert.deepEqual(fouten, [], 'geen consolefouten');
  } finally {
    if (browser) await browser.close();
    await stopHard(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
