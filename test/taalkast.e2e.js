/* WAT DE 114 TALEN KOSTTEN, EN WAAROM DAT NIET MEER ZO IS.

   De automatische vertaallaag bewaarde zijn vertalingen in een Map in de scope
   van de pagina. Die is bij elke navigatie weg. Elk van de 313 schermen vroeg de
   server dus opnieuw de hele wereld -- ook de balk, het menu en de knoppen die op
   ieder scherm hetzelfde zeggen. Dat is de reden dat een vertaald huis traag
   aanvoelde: niet het vertalen, maar het opnieuw vertalen van wat we al wisten.

   Deze toets meet dat in een echte browser, en meet het aan de enige kant die
   telt: WAT GAAT ER OVER DE LIJN. Bij het tweede bezoek mag een regel die we al
   kennen in geen enkel verzoeklichaam meer voorkomen, en moet hij toch vertaald
   op het scherm staan.

   WAAROM SCHOOLWOORDEN EN GEEN PAGINATEKST. Zonder AI-sleutel geeft de server
   een onbekende zin onvertaald terug, en een onvertaalde regel wordt met opzet
   nooit bewaard (dat zou een storing van vandaag vastzetten als het antwoord van
   morgen). De dertig kernwoorden uit translate/woordenboek/wereld.js vertalen
   wel zonder model, dus daarmee is de kast te meten zonder een sleutel en zonder
   een modelaanroep in een toets.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, wachtTot } = require('./helper');

const pw = laadPlaywright();
/* Woorden die het wereldwoordenboek zonder model kan, met hun Japanse vorm. */
const WOORDEN = ['school', 'huiswerk', 'toets', 'les', 'klas'];
const PAGINA = '/site/werelden/livingos.html';

test('een tweede pagina vraagt niet nog eens wat het toestel al weet', { skip: geenBrowser(pw) }, async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-taalkast-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dataDir } });
  const browser = await pw.chromium.launch(browserOpties());
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    /* De lichamen van elk UI-vertaalverzoek, zodat we kunnen aanwijzen WAT er
       gevraagd is en niet alleen hoe vaak. */
    const gevraagd = [];
    page.on('request', r => {
      if (r.method() === 'POST' && r.url().includes('/api/vertaal/ui')) gevraagd.push(String(r.postData() || ''));
    });
    const vroegOm = (woord) => gevraagd.filter(b => b.includes('"' + woord + '"')).length;

    async function bezoek() {
      await page.goto(srv.base + PAGINA, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.RTGi18n);
      // dezelfde woorden op elke pagina: dit is de gedeelde schil in het klein
      await page.evaluate((woorden) => {
        const p = document.createElement('p');
        p.id = 'proefwoorden';
        /* Elk woord een eigen tekstknoop. De laag vertaalt per KNOOP, en de
           terugval zonder model antwoordt alleen op een HELE boodschap: zet je
           ze in een zin, dan is de bron "school · huiswerk · ..." en dekt geen
           enkel woordenboek hem. Dat is geen kunstgreep maar precies hoe een
           scherm eruitziet -- een knop draagt een woord, geen alinea. */
        woorden.forEach((woord) => {
          const s = document.createElement('span');
          s.className = 'proefwoord';
          s.textContent = woord;
          p.appendChild(s);
          p.appendChild(document.createTextNode(' '));
        });
        document.body.appendChild(p);
      }, WOORDEN);
    }

    // ---- eerste bezoek: de kast is leeg, dus dit MOET over de lijn ----
    await bezoek();
    await page.evaluate(() => window.RTGi18n.set('ja'));
    await wachtTot(page, () => {
      const el = document.getElementById('proefwoorden');
      return !!el && el.textContent.includes('\u5bbf\u984c');
    }, undefined, { wat: 'de eerste pagina vertaalt de schoolwoorden naar het Japans' });
    assert.ok(vroegOm('huiswerk') > 0, 'het eerste bezoek vraagt het wel degelijk op');

    // de kast schrijft write-behind; een navigatie mag dat niet opeten
    await page.evaluate(() => window.RTGVertaalKast.bewaarNu());

    // ---- tweede bezoek: een NIEUW document, dus een lege scope ----
    gevraagd.length = 0;
    await bezoek();
    await wachtTot(page, () => {
      const el = document.getElementById('proefwoorden');
      return !!el && el.textContent.includes('\u5bbf\u984c');
    }, undefined, { wat: 'de tweede pagina staat er alsnog vertaald op' });

    const opnieuw = WOORDEN.filter(w => vroegOm(w) > 0);
    assert.deepEqual(opnieuw, [],
      'geen enkel woord dat we al kenden ging een tweede keer over de lijn');

    const tekst = await page.textContent('#proefwoorden');
    for (const jp of ['学校', '宿題', 'テスト']) assert.ok(tekst.includes(jp), jp + ' staat er');
  } finally {
    await browser.close();
    await stop(srv);
  }
});
