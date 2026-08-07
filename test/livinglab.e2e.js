/* Scherm-test voor het RTF Living Lab: het kantoorscherm (/apps/livinglab.html)
   en het bewonersscherm (/apps/labpas.html).

   WAAROM DEZE TOETS ER IS. De servertoetsen in test/livinglab.test.js bewijzen
   dat de poorten kloppen -- niet dat de pagina die ze gebruikt ook maar één
   regel JS uitvoert. Bij het bouwen van deze twee schermen zijn er precies daar
   drie fouten gevonden die geen enkele servertoets ooit had gezien:

   1. een generator liet een losse `\n` in drie scriptbestanden achter, waardoor
      ze niet parsten (keuringsregel 12 kijkt alleen naar INLINE scripts);
   2. RTGiOS.blad() geeft `{ sluit, element }` terug en geen DOM-knoop, dus het
      dossier ging stil niet open -- de fout werd door een .catch een toast;
   3. datzelfde blad zet een STRING met textContent neer, waardoor het hele
      dossier als platte tekst met &lt;div&gt; in beeld kwam. Zichtbaar fout,
      zonder één foutmelding.

   Alle drie gaven groen licht op de server. Vandaar dat deze toets de schermen
   ECHT bedient, en niet alleen kijkt of ze laden.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Living Lab: de onderzoekscyclus op het scherm, en de bewoner zonder account',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-livinglab-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'LIVINGLAB-E2E-1' } });
  const base = srv.base;
  let browser;
  try {
    const login = await api(base, '/api/office/login', { code: 'LIVINGLAB-E2E-1' });
    assert.ok(login.token, 'het kantoor logt in');
    const lab = await api(base, '/api/lab2/lab/maak', { stad: 'Haarlem', naam: 'Living Lab Haarlem' }, login.token);
    assert.ok(lab.lab, 'er is een lab');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });

    /* ---------- het kantoorscherm ---------- */
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    // eerst uitgelogd: de deur hoort in beeld te komen, niet een lege pagina
    await page.goto(base + '/apps/livinglab.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    assert.match(await page.textContent('#main'), /inlog|aanmeld|personeel|kantoor/i,
      'zonder kantoorsessie staat de deur op de app zelf');

    await page.evaluate((tok) => {
      localStorage.setItem('rtg_office_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, login.token);
    await page.goto(base + '/apps/livinglab.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);

    /* De pagina wordt door shared/deelmenu.js een menu met EEN deel tegelijk;
       een gebruiker klikt eerst een deel open, dus deze toets doet dat ook. */
    await page.evaluate(() => window.RTGDeel && RTGDeel.open('nieuw-onderzoek'));
    await page.waitForTimeout(300);

    // de twaalf projectsoorten komen van de server en worden niet in het scherm
    // nagebouwd; staan ze er niet, dan is de kader-route stuk
    assert.equal(await page.locator('#nSoort option').count(), 12, 'twaalf projectsoorten uit het kader');
    assert.ok((await page.locator('#labKies option').count()) > 0, 'het lab staat in de keuzelijst');

    await page.fill('#nTitel', 'Water op straat bij zware regen');
    await page.fill('#nVraag', 'Kan deze straat tijdens zware regen beter omgaan met water?');
    await page.selectOption('#nSoort', 'leefomgeving');
    await page.click('#nMaak');
    await page.waitForTimeout(1500);

    // het dossier opent als blad, met de uitdaging en de route van tien stappen
    assert.ok((await page.locator('.uitdaging').count()) > 0, 'het dossier opent met de uitdaging in beeld');
    assert.ok((await page.locator('.ios-blad .route .stap').count()) >= 10 ||
      (await page.locator('.route .stap').count()) >= 10, 'de route van tien stappen staat er');
    assert.match(await page.textContent('body'), /Volgende stap/i, 'het scherm zegt wat de volgende stap is');

    /* De hypothese ZONDER tegendeel: de server weigert, en het scherm hoort dus
       gewoon te blijven staan met het veld erin. Dit is de kant die bewijst dat
       de poort ook in de browser echt bijt. */
    await page.fill('[data-hyp]', 'Doorlatende bestrating verlaagt de plasvorming.');
    await page.click('[data-hypzet]');
    await page.waitForTimeout(900);
    assert.ok((await page.locator('[data-hyp]').count()) > 0,
      'zonder tegendeel blijft het hypotheseveld staan: de poort bijt ook hier');

    await page.fill('[data-hyp]', 'Doorlatende bestrating verlaagt de plasvorming.');
    await page.fill('[data-hypteg]', 'Als de plasduur na de ingreep gelijk blijft.');
    await page.click('[data-hypzet]');
    await page.waitForTimeout(1400);

    // de cyclus schuift niet vanzelf op; de stap is een eigen handeling
    assert.ok((await page.locator('[data-stap]').count()) > 0, 'de stapknop staat klaar');
    await page.click('[data-stap]');
    await page.waitForTimeout(1400);
    assert.ok((await page.locator('[data-m]').count()) > 0, 'na de stap staat de methodenkeuze er');

    /* Het methode-advies rekent live mee, uit DEZELFDE regel als de poort. Een
       enquête vraagt dertig deelnemers; staat dat er niet, dan rekent het scherm
       iets anders uit dan de server straks eist. */
    await page.locator('[data-m][value="enquete"]').check();
    await page.waitForTimeout(800);
    assert.match(await page.textContent('[data-advies]'), /30/,
      'het advies noemt de ondergrens die de server straks ook eist');

    /* ---------- het bewonersscherm ---------- */
    const bew = await browser.newPage();
    const bewFouten = [];
    letOpFouten(bew, bewFouten);
    await bew.goto(base + '/apps/labpas.html', { waitUntil: 'domcontentloaded' });
    await bew.waitForTimeout(800);

    assert.ok((await bew.locator('#bLab option').count()) > 0, 'de bewoner ziet welke labs er zijn');
    await bew.fill('#bVraag', 'Kan de speeltuin veiliger tijdens het spitsuur?');
    await bew.click('#bStuur');
    await bew.waitForTimeout(900);
    assert.match(await bew.textContent('#bLijst'), /speeltuin/i,
      'een bewoner draagt een onderzoeksvraag aan zonder account');

    // een onbekende pas geeft een nette melding en geen stilte
    await bew.fill('#pasVeld', 'LABPAS-ZZZZZZZ');
    await bew.click('#pasOpen');
    await bew.waitForTimeout(600);
    assert.match(await bew.textContent('#pasFout'), /labpas/i, 'een onbekende pas zegt dat hij onbekend is');

    /* De JS-fouten. De 400/404 die de browser logt zijn ONZE eigen geweigerde
       verzoeken (de hypothese zonder tegendeel, de onbekende pas) en horen er
       dus te zijn; een echte pageerror hoort er niet te zijn. */
    const echt = fouten.concat(bewFouten).filter(f => !/Failed to load resource/i.test(String(f)));
    assert.deepEqual(echt, [], 'geen JS-fouten op de twee schermen');
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
