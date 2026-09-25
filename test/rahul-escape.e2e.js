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
const { laadScherm, startServer, stop, browserOpties, geenBrowser, letOpFouten, wachtTot } = require('./helper');

const pw = laadScherm();

test('Escape sluit het Rahul-paneel, net als de sluitknop', { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rahul-escape-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const r = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Escape Lid', email: 'escape' + process.pid + '@x.nl',
        phone: '0612345788', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }) });
    const reg = await r.json();
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
    await wachtTot(page, () => !!window.RTGRahulTabHelpers && !!document.querySelector('.rtg-rahul-tab'),
      null, { wat: 'de Rahul-tab uit de gedeelde schil' });

    const open = () => page.evaluate(() => { const p = document.querySelector('.rtg-rahul-page'); return !!p && !p.hidden; });
    await page.locator('.rtg-rahul-tab').click();
    await wachtTot(page, () => { const p = document.querySelector('.rtg-rahul-page'); return !!p && !p.hidden; },
      null, { wat: 'het Rahul-paneel open' });

    await page.keyboard.press('Escape');
    await wachtTot(page, () => { const p = document.querySelector('.rtg-rahul-page'); return !!p && p.hidden; },
      null, { wat: 'het Rahul-paneel dicht na Escape' }).catch(() => {});
    assert.equal(await open(), false, 'Escape sloot het paneel niet');

    // opnieuw open, en de sluitknop blijft ook werken
    await page.locator('.rtg-rahul-tab').click();
    await wachtTot(page, () => { const p = document.querySelector('.rtg-rahul-page'); return !!p && !p.hidden; },
      null, { wat: 'het Rahul-paneel opnieuw open' });
    await page.locator('.rtg-command-close').click();
    assert.equal(await open(), false, 'de sluitknop sloot het paneel niet');

    // Escape zonder open paneel doet niets bijzonders
    await page.keyboard.press('Escape');
    assert.equal(await open(), false);
    assert.deepEqual(fouten, [], 'geen consolefouten');
  } finally {
    if (browser) await browser.close();
    await stop(child);
  }
});
