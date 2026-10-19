/* Rendez-vous bij een leeg antwoord (LIEGRONDE.json, link:rendezvous: "rommel in
   beeld: undefined"). Het scherm las data.kandidaten.length en
   data.matches.length zonder te kijken of het antwoord ze droeg, en toonde dan
   de kale JS-fout "Cannot read properties of undefined" aan het lid. Een
   onvolledig antwoord hoort te zeggen dat het onvolledig was -- zoals het
   profiel al doet -- en geen "uw selectie is compleet" te verzinnen.

   Draai: node --test test/rendezvous-leeg.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stopHard, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const { vindKlachten, zichtbareTekst } = require('../scripts/lib/schermleugen');

const pw = laadPlaywright();

test('Rendez-vous toont bij een leeg antwoord geen rommel en verzint geen lege selectie',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-rvleeg-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { try { localStorage.setItem('rtg_member_token', 'proef'); } catch (e) {} });
    /* De backend van Rendez-vous geeft {ok:true} en verder niets, zoals de
       liegpoort; alleen de kandidatenlijst draagt in de tweede ronde een match
       zonder velden, zodat ook de stand Matches leeg antwoord krijgt. */
    let metMatch = false;
    await ctx.route('**/api/member/rendezvous/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      const lijf = (metMatch && p.endsWith('/kandidaten')) ? { ok: true, profielAan: true, kandidaten: [{ id: 'k1', codenaam: 'Proef', status: 'match' }] } : { ok: true };
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lijf) });
    });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    const kijk = async () => {
      await page.waitForTimeout(800);
      const tekst = await zichtbareTekst(page);
      return { tekst, klachten: vindKlachten({ tekst, statisch: '', fouten }).filter((k) => !/^zekerheid/.test(k)) };
    };

    await page.goto(base + '/apps/rendezvous.html', { waitUntil: 'domcontentloaded' });
    let m = await kijk();
    assert.deepEqual(m.klachten, [], 'Today bij een leeg antwoord: ' + m.klachten.join('; '));
    assert.doesNotMatch(m.tekst, /Cannot read|selectie is voor nu compleet/, 'geen JS-fout in beeld en geen verzonnen lege selectie');
    assert.match(m.tekst, /onvolledig/, 'het scherm zegt dat het antwoord onvolledig was');

    metMatch = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    m = await kijk();
    assert.deepEqual(m.klachten, [], 'een kandidaat zonder velden: ' + m.klachten.join('; '));
    await page.click('[data-matches]');
    m = await kijk();
    assert.deepEqual(m.klachten, [], 'Matches bij een leeg antwoord: ' + m.klachten.join('; '));
    assert.doesNotMatch(m.tekst, /Cannot read|Nog geen wederzijdse match/, 'geen JS-fout in beeld en geen verzonnen lege lijst');
    assert.match(m.tekst, /onvolledig/);
  } finally {
    if (browser) await browser.close();
    await stopHard(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
