/* Schermtoets voor het samengevoegde RTG Leven: één controleerbaar Moment in
   plaats van losse reserveringen. Hij bewaakt dat de gebruiker de opdracht
   zelf geeft, dat het resultaat concreet en controleerbaar is, en dat partners
   uitsluitend hun eigen onderdeel ontvangen. Daarnaast blijven scores,
   voortgangsbalken en terugkom-lokkertjes verboden.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

test('RTG Leven maakt één controleerbaar Moment zonder score of aansporing',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
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

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
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
    await page.waitForSelector('.lv-moment[data-app], .lv-moment', { timeout: 15000 });

    const beeld = await page.evaluate(() => ({
      balk: !!document.querySelector('progress, [role="progressbar"]'),
      tekst: (document.querySelector('.lv-app').innerText || '').toLowerCase(),
      composer: !!document.querySelector('[data-composer]')
    }));

    assert.ok(beeld.composer, 'de gebruiker kan zelf sfeer, tijd, gezelschap en budget bepalen');
    assert.equal(beeld.balk, false, 'geen voortgangsbalk over een leven');

    /* par. 2.9 en 2.4, op de getoonde tekst. "van de 10" vangt de teller die
       een levenslijn ongemerkt in een score verandert. */
    for (const woord of ['streak', 'op rij', 'dagdoel', 'badge', 'punten', 'score',
      'van de 10', '% voltooid', 'beter dan']) {
      assert.equal(beeld.tekst.includes(woord), false,
        'het scherm hoort geen "' + woord + '" te tonen (LEVEN.md par. 2.4 en 2.9)');
    }

    await page.fill('[data-composer] input[name="sfeer"]', 'rustig diner en veilig naar huis');
    await page.fill('[data-composer] input[name="personen"]', '3');
    await page.fill('[data-composer] input[name="budget"]', '175');
    await page.click('[data-composer] button');
    await page.waitForSelector('[data-contract]:not([hidden])', { timeout: 15000 });
    const contract = await page.evaluate(() => ({
      tekst: document.querySelector('[data-contract]').innerText,
      tijdlijn: document.querySelector('[data-tijdlijn]').innerText,
      aanvragen: !!document.querySelector('[data-contract] [data-aanvraag]')
    }));
    assert.match(contract.tekst, /MOMENT CONTRACT/i, 'het voorstel wordt een herkenbaar contract');
    assert.match(contract.tekst, /3\s*gasten/i, 'het contract draagt het gekozen gezelschap');
    const raming = /€\s*(\d+)/.exec(contract.tekst);
    assert.ok(raming && Number(raming[1]) > 0 && Number(raming[1]) <= 175,
      'de raming blijft concreet en onder het gekozen plafond van € 175: ' + contract.tekst);
    assert.match(contract.tekst, /uitsluitend zijn eigen onderdeel/i,
      'partners ontvangen niet het hele privéplan');
    assert.ok(contract.aanvragen, 'de gebruiker houdt het expliciete akkoord op aanvragen');
    assert.match(contract.tijdlijn, /Live regietafel/i, 'de samenhang blijft na het voorstel zichtbaar');

    const echteFouten = fouten.filter((f) => !/favicon/i.test(f));
    assert.deepEqual(echteFouten, [], 'het scherm hoort zonder consolefouten te draaien');
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
