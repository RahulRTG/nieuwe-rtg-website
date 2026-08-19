/* Schermtoets voor RTG Command: de app komt beveiligd op met een kantoortoken,
   tekent het Command Center, laat de operator een plan maken en opent een
   objectdossier -- alles zonder onopgevangen JS-fouten.

   WAAROM DIT EEN SCHERMTOETS NODIG HEEFT en de API-toets niet volstaat: deze
   app tekent elke werkplek uit een eigen functie in een gebundeld script. Een
   knip op de verkeerde plek levert een ReferenceError op precies één werkplek
   op, en die is op de server niet te zien -- daar is alles groen. De toets
   loopt daarom de werkplekken langs en eist na elke stap dat er nog steeds
   geen paginafout is gevallen.

   Draait alleen waar Playwright (of onze eigen CDP-driver) beschikbaar is.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { laadScherm, startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Een browser die er ECHT is; zie laadScherm() in test/helper.js voor wat
   hier tweeendertig keer misging. */
const pw = laadScherm();

test('RTG Command: het Command Center, de operator en een objectdossier komen op',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-cmd-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'RTG-OFFICE' } });
  let browser;
  try {
    const login = await (await fetch(base + '/api/office/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'RTG-OFFICE' })
    })).json();
    assert.ok(login.token, 'de kantoorinlog geeft een token');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((t) => {
      localStorage.setItem('rtg_office_token', t);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, login.token);

    await page.goto(base + '/apps/command.html', { waitUntil: 'load' });

    /* Het Command Center is er als de rail is getekend en de stand niet meer
       "laden" zegt. Dat laatste is het bewijs dat /api/command/start echt is
       beantwoord en niet alleen aangevraagd. */
    await page.waitForSelector('#rail button[data-w="puls"]', { timeout: 15000 });
    await page.waitForFunction(() => !/laden/i.test(document.querySelector('#stand').textContent), null, { timeout: 10000 });
    const werkplekken = await page.evaluate(() => document.querySelectorAll('#rail button[data-w]').length);
    assert.ok(werkplekken >= 10, 'alle werkplekken staan in de rail (' + werkplekken + ')');
    assert.match(await page.textContent('main'), /Global Command Center/);

    /* Elke werkplek tekenen. Een werkplek die op een ReferenceError stukloopt,
       laat de titel weg -- en de foutenlijst vangt hem alsnog. */
    /* ALLE werkplekken, ook de lagen die er later bij kwamen. Die laatste
       tekenen elk uit een eigen deelbestand van de bundel, en juist een knip op
       de verkeerde plek levert daar een ReferenceError op precies één werkplek
       op -- op de server is dan alles groen. Dit is de enige toets die dat
       ziet, dus hij hoort compleet te zijn en niet bij de eerste tien te
       stoppen. */
    for (const w of ['zoek', 'operator', 'zaken', 'herstel', 'beleid', 'simulatie', 'toezicht', 'werk',
      'journaal', 'werkplek', 'kwaliteit', 'graaf', 'herkomst', 'mdm', 'slo', 'sonde', 'alarm',
      'canary', 'zandbak', 'overname', 'apipoort', 'land', 'stad']) {
      await page.click('#rail button[data-w="' + w + '"]');
      await page.waitForFunction(() => {
        /* De app-titel is de <h1> in de kop (die de iOS-laag tot navigatiebalk
           ombouwt); de werkplek zelf zet zijn naam in .ckop. Wachten op die
           laatste is dus wachten tot DEZE werkplek echt is getekend. */
        const h = document.querySelector('main .ckop');
        return h && h.textContent.trim().length > 0;
      }, null, { timeout: 8000 });
      assert.deepEqual(paginaFouten, [], 'geen JS-fout op werkplek ' + w);

      /* EERST WACHTEN TOT HET OPHALEN KLAAR IS. De kop staat er meteen (die
         wordt synchroon gezet), maar de inhoud komt uit een api()-aanroep. Wie
         direct daarna de tekst leest, leest de wachtmelding -- en ziet dus ook
         niet wat er daarna misging. Precies daardoor overleefde een mutatie de
         eerste versie van deze toets. */
      await page.waitForFunction(() => {
        const m = document.querySelector('main');
        return m && !/Ophalen…|Meten…/.test(m.textContent);
      }, null, { timeout: 12000 });

      /* EN DAN DE TEKST ZELF NAKIJKEN, want de kop alleen is niet genoeg. Elke
         werkplek haalt zijn gegevens op met api().then(...).catch(...), en die
         catch is er voor een echte serverfout -- maar hij vangt net zo goed een
         ReferenceError uit de tekenfunctie en zet die als nette melding op het
         scherm. Dan staat de kop er, is de foutenlijst leeg, en is de werkplek
         toch stuk. */
      const tekst = await page.textContent('main');
      for (const gaatMis of ['is not defined', 'is not a function', 'Cannot read properties']) {
        assert.ok(!tekst.includes(gaatMis),
          'werkplek ' + w + ' toont een JS-fout als melding: ' + tekst.slice(0, 200));
      }
    }

    // De operator: een vraag stellen en een gemeten antwoord terugkrijgen.
    await page.click('#rail button[data-w="operator"]');
    await page.waitForSelector('#opq', { timeout: 8000 });
    await page.fill('#opq', 'wat kan er nu veilig hersteld worden?');
    await page.click('#opGa');
    await page.waitForFunction(() => {
      const e = document.querySelector('#opuit');
      return e && /Het antwoord/.test(e.textContent);
    }, null, { timeout: 15000 });

    /* De zoekbalk staat in de kop en werkt vanuit elke werkplek. 'HOSHI' is een
       zaak uit de startdata; de treffer moet als dossier te openen zijn. */
    await page.fill('#q', 'HOSHI');
    await page.press('#q', 'Enter');
    await page.waitForSelector('#zuit [data-t]', { timeout: 10000 });
    await page.click('#zuit [data-t]');
    await page.waitForFunction(() => /Wat er kan/.test(document.querySelector('main').textContent), null, { timeout: 10000 });
    assert.match(await page.textContent('main'), /Hangt hieraan/, 'het dossier toont de afhankelijkheden');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het hele scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
