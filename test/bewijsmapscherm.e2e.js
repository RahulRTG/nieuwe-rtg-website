/* SCHERMTOETS VOOR /apps/bewijsmap.html -- wat een lid met RTG kan aantonen.

   WAAROM DIT EEN BROWSER NODIG HEEFT. test/rtgid-bewijs.test.js dekt de module
   en test/opvangroute.test.js de route; allebei kijken ze naar JSON. Dit scherm
   maakt van dat JSON drie beslissingen die geen van beide toetsen ziet:

     1. `bron: false` moet een MELDING worden en geen lege lijst. Een lege lijst
        leest als "u heeft niets", terwijl het antwoord "wij konden het niet
        nagaan" is. Dat onderscheid is de enige reden dat de server een
        `bron`-vlag meestuurt, en het is hier dat het waar of niet waar wordt.
     2. bij "Nu niet" hoort de REDEN op het scherm te staan: dat is het enige
        waar een mens zelf iets mee kan.
     3. het blok "waar deze lijst ophoudt" staat er even groot bij als de lijst.
        Een bewijsmap die alleen toont wat er KAN, leest als een belofte over wat
        er MAG.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - de `if (!d.bron)`-tak uit teken() gehaald -> "geen bron is geen lege lijst"
     ZAKT (RAAK: het scherm toont dan nul rijen zonder melding)
   - de reden-regel uit de rij gehaald -> "bij nu niet staat een reden" ZAKT (RAAK)
   - GRENZEN leeggemaakt -> "de grenzen staan op het scherm" ZAKT (RAAK)

   Draait alleen waar Playwright beschikbaar is. Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('Bewijsmap: de eisen staan er met een reden, en de grenzen staan er even groot bij',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bewijsmap-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    /* EEN ECHT ACCOUNT, want RTG iD laat een demo-persona niet toe. Dat is geen
       tekort van deze toets maar de poort die werkt; zie test/opvangroute.test.js. */
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Bewijs Lid', email: 'bewijsmap.scherm@example.test',
        password: 'Bewijsmap-2026!', geboortedatum: '1990-04-12' })
    }).then(r => r.json());
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);

    await page.goto(base + '/apps/bewijsmap.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const e = document.getElementById('lijst');
      return e && !/Laden/.test(e.textContent);
    }, null, { timeout: 15000 });

    /* De lijst komt van de server en is niet leeg: de eisen zijn afgeleid uit
       kern/persoonseis-lijst.js. Een leeg scherm hier zou betekenen dat de
       koppeling weg is, en dat is precies wat deze toets moet vangen. */
    const rijen = await page.evaluate(() =>
      [...document.querySelectorAll('#lijst .bw')].map(el => ({
        naam: el.querySelector('.naam') ? el.querySelector('.naam').textContent.trim() : '',
        stand: el.querySelector('.stand') ? el.querySelector('.stand').textContent.trim() : '',
        reden: el.querySelector('.reden') ? el.querySelector('.reden').textContent.trim() : ''
      })));
    assert.ok(rijen.length >= 5, 'de eisen komen niet op het scherm: ' + rijen.length);
    assert.ok(rijen.every(r => r.naam), 'elke rij hoort een leesbare naam te dragen');

    /* Een vers account heeft niets, dus elke rij staat op "Nu niet" EN draagt
       een reden. Zou er een rij op "Aan te tonen" staan, dan klopt de bron niet
       en zegt deze toets dat met zoveel woorden. */
    assert.ok(rijen.every(r => r.stand === 'Nu niet'),
      'een vers account kan niets aantonen; er staat een rij op "Aan te tonen"');
    assert.ok(rijen.every(r => r.reden),
      'bij "Nu niet" hoort een reden te staan -- dat is het enige waar een mens iets mee kan');

    /* Het nummer verlaat de server niet, en het staat dus ook niet op het
       scherm. Er wordt op een echte cijferreeks getoetst en niet op het woord
       "nummer": dat staat in de uitlegtekst van een eis, en een toets die zijn
       eigen uitleg vangt bewijst niets. */
    const alles = await page.textContent('#inhoud');
    assert.ok(!/[A-Z]{2,}-?\d{6,}|\d{8,}/.test(alles),
      'er hoort geen registratienummer op dit scherm te staan');

    const grenzen = await page.evaluate(() =>
      [...document.querySelectorAll('#grenzen .grens b')].map(b => b.textContent.trim()));
    assert.ok(grenzen.length >= 5, 'het blok "waar deze lijst ophoudt" is leeg');
    assert.ok(grenzen.some(g => /controleert niets/i.test(g)),
      'de grens dat RTG niets bij een register controleert, ontbreekt op het scherm');
    assert.ok(grenzen.some(g => /nummer/i.test(g)),
      'de grens over het registratienummer ontbreekt op het scherm');

    /* GEEN BRON IS GEEN LEGE LIJST. Het antwoord van de server wordt hier
       vervangen door de storingsvorm, zodat de tak die een mens redt ook
       werkelijk een keer wordt afgelegd -- en niet alleen in de code staat. */
    await page.route('**/api/rtgid/bewijzen', route => route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, bron: false, eisen: [],
        uitleg: 'De bewijzenlaag is niet gekoppeld.' })
    }));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#lijst .storing', { timeout: 15000 });
    assert.match(await page.textContent('#lijst .storing'), /niet gekoppeld/,
      'zonder bron hoort er een melding te staan en geen lege lijst');
    assert.equal(await page.locator('#lijst .bw').count(), 0,
      'zonder bron horen er geen rijen te staan die suggereren dat er gemeten is');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de bewijsmap');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
