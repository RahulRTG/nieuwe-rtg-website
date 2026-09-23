/* Schermtoets voor het werkblad RTG Leven. Leven opent andere apps in panelen;
   een avond samenstellen is van avond.html (SCHERMEIGENAAR.json), dus hier wordt
   bewaakt dat Leven die eigenaar opent en haar niet opnieuw bouwt. Daarnaast
   blijven scores, voortgangsbalken en terugkom-lokkertjes verboden.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stopNet, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('RTG Leven opent de avondplanner van avond.html, zonder eigen samensteller, score of aansporing',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-leven-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const t = Date.now();
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Leven Echt', email: 'le' + t + '@e.test',
        phone: '06' + String(t).slice(-8), password: 'geheim123',
        geboortedatum: '1994-05-05', tier: 'rtg' })
    })).json();
    assert.ok(reg.token, 'registreren hoort een token te geven');

    /* De nieuwe Moment-interface vervangt de oude levenslijn op het scherm,
       maar bestaande leden en koppelingen mogen het onderliggende contract
       blijven gebruiken. Bewaak daarom ook het echte endpoint en niet alleen
       de nieuwe compositie-interface. */
    const lijnReactie = await fetch(base + '/api/leven/lijn', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
      body: '{}'
    });
    const lijn = await lijnReactie.json();
    assert.equal(lijnReactie.ok, true, 'de bestaande levenslijn blijft bereikbaar voor gekoppelde clients');
    assert.ok(Array.isArray(lijn.fasen) && lijn.fasen.length > 0,
      'de levenslijn blijft een controleerbare fasenlijst leveren');

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await ctx.addInitScript((tok) => {
      try {
        localStorage.setItem('rtg_member_token', tok);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, reg.token);
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/leven.html', { waitUntil: 'domcontentloaded' });
    /* Leven is een werkblad dat andere apps OPENT; een avond samenstellen is van
       avond.html (SCHERMEIGENAAR.json). Hier stond een tweede samensteller op
       dezelfde routes met een eigen "Moment Contract"; het eerste paneel is nu
       de eigenaar zelf. */
    await page.waitForSelector('.rv-pane iframe[src="/apps/avond.html"]', { timeout: 15000 });
    const beeld = await page.evaluate(() => ({
      balk: !!document.querySelector('progress, [role="progressbar"]'),
      tekst: (document.querySelector('.lv-app').innerText || '').toLowerCase(),
      eigenSamensteller: !!document.querySelector('[data-composer]'),
      tab: (document.querySelector('#lvTabs') || {}).innerText || ''
    }));
    assert.equal(beeld.eigenSamensteller, false, 'Leven bouwt de avond-samensteller niet opnieuw');
    assert.match(beeld.tab, /Uw avond/, 'het paneel heet naar wat het is, niet "Vandaag"');
    assert.equal(beeld.balk, false, 'geen voortgangsbalk over een leven');

    /* par. 2.9 en 2.4, op de getoonde tekst. "van de 10" vangt de teller die
       een levenslijn ongemerkt in een score verandert. */
    for (const woord of ['streak', 'op rij', 'dagdoel', 'badge', 'punten', 'score',
      'van de 10', '% voltooid', 'beter dan']) {
      assert.equal(beeld.tekst.includes(woord), false,
        'het scherm hoort geen "' + woord + '" te tonen (LEVEN.md par. 2.4 en 2.9)');
    }

    /* En in het paneel staat de echte planner, met het expliciete akkoord. */
    const kader = page.frameLocator('.rv-pane iframe[src="/apps/avond.html"]');
    await kader.locator('#bPlan').waitFor({ timeout: 15000 });
    assert.equal(await kader.locator('#bPlan').count(), 1, 'de planner van avond.html staat in het paneel');

    const echteFouten = fouten.filter((f) => !/favicon/i.test(f));
    assert.deepEqual(echteFouten, [], 'het scherm hoort zonder consolefouten te draaien');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await stopNet(child);
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
