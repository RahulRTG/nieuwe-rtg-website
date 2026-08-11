/* Scherm-toets op de BANKKAMER van de boardroom (kantoren.html, sectie vBank).

   WAAROM DIT BESTAND ER IS. Drie ronden lang zijn er getallen aan de bank
   toegevoegd die alleen een API kende: de rail-reconciliatie (wat is geboekt
   maar niet aangekomen) en de bevoegdheidsmatrix (wat mag RTG zelf). Beide zijn
   waardeloos als niemand ze ziet, en een scherm dat ze toont is pas iets waard
   als het NIET liegt. De API-kant staat in test/bank.test.js; wat hier moet
   blijken is dat het scherm dezelfde waarheid laat zien.

   DRIE BEWERINGEN, en alle drie kunnen ze zakken:

   1. De reconciliatie op het scherm is HETZELFDE getal als de API geeft. Niet
      "er staat een getal" -- dat is de vorm van een toets die niet kan zakken.
   2. De matrix zegt WAAROM iets dicht is. "Dicht" leert een bestuurder niets;
      "hiervoor is een bankvergunning nodig" wel. Zonder vastgelegde vergunning
      moet krediet uit eigen boek dicht staan MET die reden erbij.
   3. Het formulier legt echt iets vast. Na het invullen en op Vastleggen
      drukken staat dezelfde vergunning in de API -- anders is het een scherm
      dat doet alsof.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon } = require('./helper');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

test('de bankkamer toont de reconciliatie en de bevoegdheid, en liegt daar niet over',
  { skip: pw ? false : 'geen browser beschikbaar' }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bankkamer-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-KAMER-1' } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const gedeeld = (await post('/api/office/login', { code: 'KANTOOR-KAMER-1' })).body;
    assert.ok(gedeeld.token, 'kantoor-inlog mislukt');
    /* HET SCHERM DRAAIT OP EEN PERSOON EN NIET OP DE GEDEELDE CODE, want een
       vergunning vastleggen zit achter de boardroomdeur. Dat is geen detail van
       deze toets maar de reden dat die deur er is: de gedeelde kantoorcode wijst
       niemand aan, en wat de eigen rails laat clearen hoort herleidbaar te zijn.
       De regel eronder legt dat vast, zodat het scherm het niet stilletjes kan
       omzeilen. */
    const persoon = await kantoorAlsPersoon(srv.base);
    assert.ok(persoon, 'de eigenaar staat als persoon in de backoffice');
    assert.equal((await post('/api/office/bank/vergunning', { soort: 'bank' }, gedeeld.token)).status, 403,
      'met de gedeelde kantoorcode is er geen vergunning vast te leggen');
    const kantoor = { token: persoon };

    /* Een echte openstaande betaalopdracht maken, zodat de reconciliatie een
       getal heeft dat ERGENS vandaan komt. Een scherm toetsen op een lege lijst
       bewijst niets: nul staat er ook als het scherm stuk is. */
    const lid = (await post('/api/login', { tier: 'rtg' })).body;
    await post('/api/office/bank/leden', { aan: true }, kantoor.token);
    const akk = (await post('/api/bank/akkoord', {}, lid.token)).body;
    const iban = akk.rekening.iban;
    await post('/api/bank/storten', { iban, centen: 20000, idem: 'kamer-1' }, lid.token);
    const sepa = (await post('/api/bank/sepa', { iban, centen: 7500, naarIban: 'NL91ABNA0417164300', idem: 'kamer-2' }, lid.token)).body;
    assert.ok(sepa.opdrachtId, 'er staat een betaalopdracht open');

    const gezond = (await post('/api/office/bank/gezond', {}, kantoor.token)).body;
    assert.equal(gezond.railOpen, 1, 'de API telt een openstaande opdracht');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
    await ctx.addInitScript((tok) => {
      try { localStorage.setItem('rtg_member_token', tok.lid); localStorage.setItem('rtg_office_token', tok.kantoor); } catch (e) {}
    }, { lid: lid.token, kantoor: kantoor.token });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(srv.base + '/apps/kantoren.html?kamer=bank', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#vBank:not([hidden])', { timeout: 20000 });
    await page.waitForFunction(() => {
      const b = document.querySelector('#bankBevoegd');
      return b && !b.textContent.includes('Laden');
    }, null, { timeout: 20000 });

    await t.test('de reconciliatie op het scherm is hetzelfde getal als in de API', async () => {
      const tekst = await page.$eval('#bankRail', el => el.innerText);
      assert.match(tekst, /Onderweg/, 'de tegel staat er');
      /* Het BEDRAG moet kloppen op de cent -- 75,00 en niet 7500 en niet "een
         bedrag". Precies de vorm die bij de ledenbank ook is afgedwongen. */
      assert.match(tekst, /1 × € 75,00|1 × € 75\.00/, 'een opdracht van 75 euro, zoals de API zegt: ' + tekst.slice(0, 200));
      assert.match(tekst, /aangenomen, nog niet bevestigd/, 'de status staat er in mensentaal');
      assert.doesNotMatch(tekst, /Er staat geld af dat nergens is aangekomen/, 'er is niets mislukt, dus geen alarm');
    });

    await t.test('de matrix zegt WAAROM iets dicht is, niet alleen DAT het dicht is', async () => {
      const tekst = await page.$eval('#bankBevoegd', el => el.innerText);
      assert.match(tekst, /Uitgaven-inzichten/, 'de software-regels staan erin');
      assert.match(tekst, /eigen software/, 'en met hoe ze mogen');
      assert.match(tekst, /Krediet uit eigen boek/, 'de vergunningsregel staat erin');
      assert.match(tekst, /geen vergunning vastgelegd/, 'met de reden, en niet alleen een kruisje');
      assert.match(tekst, /vraagt: Bank/, 'en met wat ervoor nodig is');
      // de rail-zin: dezelfde handeling is via een partner iets anders
      assert.match(await page.$eval('#bankBevoegd', el => el.innerText), /kaart-rails van de partner/,
        'het scherm zegt welke rail er cleart, want dat bepaalt mee wat mag');
    });

    await t.test('het formulier legt de vergunning echt vast, en de matrix draait mee', async () => {
      // vooraf: de API kent hem niet
      assert.equal((await post('/api/office/bank/bevoegdheid', {}, kantoor.token)).body.vergunning, null);

      await page.selectOption('#bkVSoort', 'bank');
      await page.fill('#bkVNr', 'NL-SCHERM-1');
      await page.fill('#bkVEnt', 'RTG Bank N.V.');
      await page.fill('#bkVLand', 'NL');
      await page.click('#bkVZet');
      /* Wachten tot de KOP de nieuwe vergunning draagt, en niet tot een zin uit
         de matrix verdwijnt. Dat laatste stond hier eerst en dekte de lading
         niet: "geen vergunning vastgelegd" bleef staan bij een regel die alleen
         over de eigen rails kan -- en dat bleek geen toetsprobleem maar een
         verkeerde reden in de code, die nu 'alleen-eigen' heet. */
      await page.waitForFunction(() => {
        const e = document.querySelector('#bankVergunning');
        return e && e.innerText.includes('NL-SCHERM-1');
      }, null, { timeout: 15000 });

      const na = (await post('/api/office/bank/bevoegdheid', {}, kantoor.token)).body;
      assert.ok(na.vergunning, 'de API kent de vergunning nu ook -- het scherm deed niet alsof');
      assert.equal(na.vergunning.soort, 'bank');
      assert.equal(na.vergunning.nummer, 'NL-SCHERM-1');
      assert.deepEqual(na.vergunning.landen, ['NL']);

      /* Krediet uit eigen boek stond dicht op "geen vergunning"; met een
         bankvergunning in huis hoort hij open te staan. De regel eronder pakt
         precies die regel en niet de hele lijst, want een andere regel mag
         gerust dicht blijven -- die heeft dan een andere reden. */
      const krediet = await page.$$eval('#bankBevoegd > div', els => {
        const r = els.find(e => e.innerText.includes('Krediet uit eigen boek'));
        return r ? r.innerText : '';
      });
      assert.match(krediet, /✓/, 'krediet uit eigen boek mag nu: ' + krediet);
      assert.match(krediet, /uit eigen boek/, 'en het scherm zegt waarlangs');
      assert.match(await page.$eval('#bankVergunning', el => el.innerText), /NL-SCHERM-1/, 'de kop toont wat er ligt');

      /* EN DE REGEL DIE NOG STEEDS DICHT IS, MOET DE JUISTE REDEN GEVEN. Eigen
         geld in omloop brengen kan alleen over de eigen rails, en die clearen
         hier niet -- de kaart-naad draait. Het scherm zei daar "geen vergunning
         vastgelegd" terwijl er een bankvergunning lag: onwaar, en precies het
         soort onwaarheid waar een bestuurder een verkeerd besluit op neemt. */
      const emissie = await page.$$eval('#bankBevoegd > div', els => {
        const r = els.find(e => e.innerText.includes('Eigen geld in omloop'));
        return r ? r.innerText : '';
      });
      assert.match(emissie, /✗/, 'eigen emissie blijft dicht in de partnerstand');
      assert.match(emissie, /alleen over de eigen rails/, 'met de echte reden: ' + emissie);
      assert.doesNotMatch(emissie, /geen vergunning vastgelegd/,
        'en niet met een reden die onwaar is zodra er wel een vergunning ligt');
    });

    /* DE RAMING EN DE UITBETALING ZIJN TWEE DINGEN, en dit deel van het scherm
       brak stil toen de server ze uit elkaar haalde: het las `v.posten.length`
       uit het antwoord, dat veld verdween, en sindsdien viel de knop "Maak
       raming" in zijn catch. Geen enkele toets opende dit stuk scherm. Nu wel,
       en de bewering is precies wat er toen misging: er komt een raming en er
       komt GEEN foutmelding. */
    await t.test('de salarissectie toont een raming, en uitbetalen vraagt om een loonrun', async () => {
      // de meldingsbalk eerst leegmaken: hij draagt nog de tekst van de vorige
      // deeltoets, en dan meet je het verkeerde moment in plaats van deze klik
      await page.evaluate(() => { document.querySelector('#melding').textContent = ''; });
      await page.fill('#bankSalZaak', 'KIKUNOI');
      await page.click('#bankSalMaak');
      await page.waitForFunction(() => {
        const e = document.querySelector('#bankSalUit');
        return e && e.innerText.trim().length > 0;
      }, null, { timeout: 15000 });

      const uit = await page.$eval('#bankSalUit', el => el.innerText);
      assert.match(uit, /uurloon/, 'de raming staat er: ' + uit.slice(0, 160));
      assert.match(uit, /bruto/, 'en zegt dat het om brutobedragen gaat');
      assert.equal(await page.$eval('#melding', el => el.textContent.trim()), '',
        'en er is geen foutmelding -- dat was het gedrag toen `posten` verdween');

      /* Er is in deze opstelling geen definitieve loonrun, dus de knop hoort
         WEG te zijn met een zin die zegt waarom. Een knop die pas bij het
         indrukken uitlegt dat hij niet kan, is geen knop maar een val. */
      assert.equal(await page.isHidden('#bankSalRun'), true, 'zonder loonrun geen uitbetaalknop');
      assert.match(uit, /nog geen definitieve loonrun/i, 'met de reden erbij');
    });

    assert.deepEqual(fouten, [], 'geen paginafouten onderweg');
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
