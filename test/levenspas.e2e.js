/* De levenspas aan de GEZINSKANT (/apps/foundation/mijnbanden.html), in een
   echte browser.

   Twee dingen bewaakt deze toets, en ze bestaan allebei alleen op dit niveau.

   1. BESLUIT 1 STAAT OP HET SCHERM, AAN ALLEBEI DE KANTEN. Een ouder vraagt
      een band met zijn kind; op het scherm van het KIND staat een knop, en pas
      na die knop bestaat de band. De route-toets meet dat de server het
      afdwingt; deze toets meet dat een mens er ook echt bij kan -- een regel
      die je nergens kunt uitoefenen is geen regel.

      EN DE ANDERE HELFT, die eerst ontbrak: bij een band die het kind ZELF
      vroeg, hoort er GEEN bevestigknop te staan. Zonder die helft meet de
      toets alleen "er is een knop", en dat blijft waar als het scherm de knop
      aan iedereen geeft -- de mutatie die precies dat deed, overleefde de
      eerste versie van deze toets. Een knop die de server toch weigert, is
      erger dan geen knop: hij belooft iets dat niet kan.

   2. GEEN U-VORM IN HET DEEL DAT HET KIND LEEST. De namen van de deelbare
      stukken komen van de server, en die stonden in de u-vorm ("waar u goed in
      bent") -- prima aan de ledenkant, maar op dit scherm stond een kind
      ineens vousvoyerend naar zijn eigen talenten te kijken. Gemeten op de
      GERENDERDE tekst en niet op de bron, want een regel die je op de broncode
      toetst overleeft geen herschrijving.

      Het blok "Voor ouders" valt er met opzet buiten: dat spreekt een ouder
      aan en hoort de u-vorm te hebben.

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

test('de levenspas van het kind: de ouder wacht op HEM, en niets spreekt hem met u aan',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-levenspas-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  const post = (p, b) => fetch(base + p, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}) })
    .then((r) => r.json().catch(() => ({})));
  try {
    const g = await post('/api/foundation/gezin/maak', { gezinsnaam: 'Huis', naam: 'Ouder', pin: '1234' });
    const kind = await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Sem', rol: 'kind', groep: 'po', geboortedatum: '2016-04-12' });
    const kies = await post('/api/foundation/gezin/profiel/kies', { code: g.code, profielId: kind.profiel.id });
    assert.ok(kies.token, 'het kind kan inloggen op zijn profiel');

    /* De OUDER vraagt de band. Dat is precies het geval waar besluit 1 over
       gaat: wie de gezinscode heeft, hangt zichzelf niet aan een kind. */
    const v = await post('/api/rtf/leven/band/vraag', { code: g.code, token: g.token, codenaam: kind.profiel.codenaam, soort: 'ouder' });
    assert.equal(v.ok, true, 'de ouder mag vragen: ' + JSON.stringify(v));

    /* En een tweede band die het KIND zelf vraagt, zodat dit scherm allebei de
       kanten van besluit 1 tegelijk laat zien. Zonder deze band meet de toets
       hieronder alleen de helft die een knop hoort te hebben. */
    const zus = await post('/api/foundation/gezin/profiel/maak', { code: g.code, token: g.token, naam: 'Noor', rol: 'kind', groep: 'po', geboortedatum: '2017-06-18' });
    const eigen = await post('/api/rtf/leven/band/vraag', { code: g.code, token: kies.token, codenaam: zus.profiel.codenaam, soort: 'familie' });
    assert.equal(eigen.ok, true, 'het kind mag zelf ook vragen: ' + JSON.stringify(eigen));

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await ctx.addInitScript((s) => {
      try {
        localStorage.setItem('rtf_sessie', JSON.stringify(s));
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      } catch (e) {}
    }, { code: g.code, token: kies.token, profiel: kies.profiel, gezin: kies.gezin });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/foundation/mijnbanden.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.lp-rij', { timeout: 15000 });

    /* Besluit 1, op het scherm, in beide richtingen tegelijk: er staan TWEE
       openstaande banden en precies EEN bevestigknop -- bij de band die de
       ouder vroeg, en niet bij de band die het kind zelf vroeg. */
    assert.equal(await page.locator('.lp-rij[data-staat="gevraagd"]').count(), 2,
      'twee openstaande banden: een gevraagd door de ouder, een door het kind zelf');
    const knop = page.locator('.lp-rij[data-staat="gevraagd"] button[data-ja]');
    assert.equal(await knop.count(), 1,
      'precies EEN bevestigknop -- wie zelf vroeg, krijgt er geen (LEVEN.md par. 2.8, besluit 1)');
    assert.equal(await knop.locator('xpath=ancestor::article').locator('.lp-wie').innerText(),
      g.profiel.codenaam, 'en die knop hoort bij de band die de OUDER vroeg');

    await knop.click();
    await page.waitForFunction(() => document.querySelectorAll('.lp-rij[data-staat="gevraagd"]').length === 1,
      null, { timeout: 10000 });

    /* En nu de band staat: nog steeds NIETS te zien, want er is niets gegeven.
       Dat is besluit 2, en het scherm zegt het met zoveel woorden. */
    const beeld = await page.evaluate(() => ({
      vak: document.getElementById('mbVak').innerText,
      keuzes: [...document.querySelectorAll('#mbVak [data-stuk] option')].map((o) => o.textContent),
      stukken: [...document.querySelectorAll('#mbVak .lp-stuk')].length
    }));
    assert.equal(beeld.stukken, 0, 'een verse band geeft uit zichzelf niets te zien (LEVEN.md par. 2.8)');
    assert.ok(beeld.keuzes.length > 0, 'maar het kind kan wel per stuk geven -- anders is besluit 2 een dode letter');

    /* De u-vorm, op de gerenderde tekst van het kinddeel. `\bu\b` raakt geen
       "ouder" en geen "jullie"; het raakt precies de aanspreekvorm. */
    const teksten = [beeld.vak].concat(beeld.keuzes)
      .concat(await page.locator('#mbVorm').innerText());
    for (const t of teksten) {
      assert.equal(/\b(u|uw|uzelf)\b/i.test(t), false,
        'het kinddeel hoort geen u-vorm te bevatten: ' + JSON.stringify(t.slice(0, 160)));
    }

    const echteFouten = fouten.filter((f) => !/favicon|manifest/i.test(f));
    assert.deepEqual(echteFouten, [], 'het scherm hoort zonder consolefouten te draaien');
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill();
    fs.rmSync(TMP, { recursive: true, force: true });
  }
});
