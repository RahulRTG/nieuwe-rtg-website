/* Scherm-test voor de routedekking in het RTG Kantoor.

   De server-kant staat in test/routedekking.test.js; dit gaat over wat een
   personeelslid ziet. Drie dingen zijn alleen hier te toetsen:

   - HET SCHERM LIEGT NIET. Wat er in beeld staat is hetzelfde getal als wat de
     API teruggeeft. Een dekkingsscherm dat een eigen som maakt, is precies het
     soort tweede waarheid waarvoor deze hele meting bestaat (LAT.md regel 4).
   - DE LIJST IS ER ECHT. De routes zitten achter het derde deel van het
     deelmenu (shared/deelmenu.js maakt van de drie koppen tabbladen). "Uitzien"
     is de opdracht, dus moet die lijst na een klik ook werkelijk in beeld staan
     -- niet alleen in de HTML aanwezig zijn.
   - DE STAND LEUNT NIET OP KLEUR. Naast de kleur hoort er een teken te staan,
     voor wie kleur niet ziet en voor een zwart-witte afdruk (ONTWERP.md par. 5).

   Draai los: node --experimental-sqlite --test test/routedekking.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, kantoorAlsPersoon } = require('./helper');
const fs = require('fs'); const os = require('os'); const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

test('het dekkingsscherm toont het cijfer van de server, en de routes zijn door te bladeren',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-dekking-e2e-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'SCHERMDEKKING1' } });
  let browser;
  try {
    const token = await kantoorAlsPersoon(base);
    assert.ok(token, 'het kantoor logt in');
    /* HET ANTWOORD VAN DE SERVER EERST. Dat is de maat waar het scherm straks
       tegen aan wordt gelegd; zou dit uit het scherm zelf komen, dan vergeleek
       deze toets twee keer hetzelfde getal. */
    const api = await fetch(base + '/api/office/routedekking', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ limiet: 50 })
    }).then(r => r.json());
    assert.ok(api.totaal > 1000, 'de server kent zijn routes (' + api.totaal + ')');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1100, height: 900 } });
    /* HET TOKEN ZETTEN ZONDER EERST EEN ANDERE PAGINA TE OPENEN, en dat is geen
       stijlkeuze maar een meetkwestie.

       Hier stond: ga naar /apps/app.html, zet het token in localStorage, ga dan
       naar het dekkingsscherm. Dat werkte -- maar app.html registreert de service
       worker, en die pakt de VOLGENDE navigatie op en haalt de pagina zelf met
       fetch() op. De server ziet dan geen `Sec-Fetch-Mode: navigate` meer, en
       server/routelog.js schrijft `nevenverzoek` in plaats van `navigatie`. Voor
       scripts/schermen.js is dat het verschil tussen "een toets heeft deze app
       echt geopend" en niets: het scherm zou als ongetoetst blijven staan
       terwijl deze toets hem afliep.

       Met addInitScript staat het token er vóór het eerste script van de pagina,
       dus is de EERSTE navigatie meteen die van het dekkingsscherm -- geen
       service worker die ertussen kan komen. */
    await context.addInitScript(t => {
      try { localStorage.setItem('rtg_office_token', t); } catch (e) { /* dan stuurt het scherm naar de inlog */ }
    }, token);
    const page = await context.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/routedekking.html', { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => {
      const e = document.querySelector('#cTotaal');
      return e && e.textContent && e.textContent !== '-' && e.textContent !== '--';
    }, null, { timeout: 15000 });

    // 1) het scherm zegt hetzelfde als de server
    const getal = (t) => Number(String(t).replace(/[^\d]/g, ''));
    assert.equal(getal(await page.textContent('#cTotaal')), api.totaal, 'het aantal routes komt van de server');
    assert.equal(getal(await page.textContent('#cGedekt')), api.gedekt, 'en het aantal beproefde routes ook');
    assert.equal(await page.textContent('#cPct'), api.pct + '%', 'en het percentage');
    assert.equal(getal(await page.textContent('#cOngedekt')), api.ongedekt);

    // 2) de stand draagt een TEKEN en niet alleen een kleur
    const stand = await page.evaluate(() => {
      const e = document.querySelector('#stand');
      return { sig: e.dataset.sig, teken: e.dataset.teken, woord: e.textContent.trim() };
    });
    assert.ok(stand.teken && stand.teken.length, 'de stand draagt een teken uit data-teken');
    assert.ok(stand.woord.length, 'en een woord, niet alleen een kleur: ' + JSON.stringify(stand));
    assert.equal(stand.sig, api.stand === 'in orde' ? 'gezond' : stand.sig,
      'bij een goede stand staat het signaal op gezond');

    /* 3) DE ROUTES ZIJN TE ZIEN. shared/deelmenu.js maakt van de drie koppen
       tabbladen en toont er een; de lijst staat achter "Alle routes". Zonder de
       klik zou deze toets alleen bewijzen dat de rijen in de HTML staan, en dat
       is niet hetzelfde als kunnen inzien. */
    const tab = page.locator('.rtgdeel-balk button', { hasText: /alle routes/i });
    if (await tab.count()) await tab.first().click();
    await page.waitForSelector('#lijst .rij', { state: 'visible', timeout: 10000 });
    assert.equal(await page.locator('#lijst .rij').count(), api.lijst.resultaten.length,
      'evenveel rijen op het scherm als in het antwoord');
    const eerste = (await page.locator('#lijst .rij').first().textContent()).replace(/\s+/g, ' ').trim();
    assert.ok(eerste.includes(api.lijst.resultaten[0].methode), 'de methode staat in de rij: ' + eerste);
    assert.ok(eerste.includes(api.lijst.resultaten[0].pad), 'en het patroon ook: ' + eerste);

    // 4) zoeken werkt, en het scherm vindt zijn eigen route
    await page.fill('#zoek', 'routedekking');
    await page.click('#zoeken');
    await page.waitForFunction(() => {
      const r = document.querySelectorAll('#lijst .rij');
      return r.length > 0 && r.length < 40;
    }, null, { timeout: 10000 });
    const gevonden = await page.locator('#lijst .rij').allTextContents();
    assert.ok(gevonden.some(t => t.includes('/api/office/routedekking')),
      'het scherm vindt zijn eigen route terug: ' + JSON.stringify(gevonden).slice(0, 200));

    assert.deepEqual(fouten, [], 'geen paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
