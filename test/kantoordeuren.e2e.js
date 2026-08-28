/* ============================================================================
   DE KANTOOR-APPS: EEN DEUR OP DE APP ZELF, GEEN OMLEIDING.

   WAT ER MIS WAS (TAKEN 5.5)

   Acht kantoor-apps stuurden een uitgelogde bezoeker weg met een
   location.replace() naar personeel.html. Je landde daar zonder te zien welke
   app je had geopend, en na het inloggen was je kwijt waar je heen wilde. Bij
   de eenenveertig RTF-gezinsapps was dat patroon al opgelost; hier stond het
   nog. Gevonden doordat het verificatieharnas op lab.html bleef hangen.

   Er was ook een tweede, stillere kant. Een schermtoets op zo'n app landt op de
   verkeerde pagina: je meet personeel.html en denkt dat je de kassa hebt
   bekeken. Deze acht waren daardoor niet alleen onvriendelijk maar ook
   ontoetsbaar -- ze stonden in de 90 van TAKEN 4.9 en konden daar niet uit.

   WAT ER NU MOET GELDEN, en dat is precies wat deze toets aflegt:

   1. JE BLIJFT WAAR JE BENT. De app die je opvroeg is de app die je krijgt.
   2. ER STAAT EEN DEUR, geen leeg scherm en geen JS-fout. Dood is stiller dan
      stuk: een wit scherm ziet eruit als een laadprobleem, niet als een
      gesloten deur.
   3. DE DEUR VERTELT WAT DEZE APP IS. Niet "geen toegang" maar de app-gids:
      wat het is en wat je er straks doet. Dat is het verschil tussen een deur
      en een muur.
   4. EN HIJ WIJST DE WEG TERUG. De link naar de personeels-inlog draagt het
      adres van deze app mee, zodat je na het inloggen landt waar je heen wilde.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser, volgVerzoeken, wachtOpRust } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kantoordeur-'));

/* De acht die wegstuurden. kantoorpda.html staat er bewust NIET bij: dat is
   geen app maar een doorverwijsstub met een meta-refresh (zie TAKEN 5.1), en
   die hoort juist wel door te sturen. */
const APPS = [
  'architect-pda', 'hardware-pda', 'lab', 'payroll',
  'stadsdoos', 'studio-pda', 'kassa', 'kantoren'
];

test('de acht kantoor-apps tonen hun eigen deur en sturen niemand weg',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    /* DE SERVICE WORKER ERUIT. Zonder dit blokje meet deze toets iets anders
       dan hij denkt: de RTF-schil registreert een service worker die tientallen
       schermen vooruit ophaalt, en die staan daarna in het schermjournaal alsof
       DEZE toets ze heeft afgelegd. Bij rtfkinderschermen liep dat op tot 55
       schermen -- boven de veeggrens van scripts/schermen.js, waardoor de toets
       als veegtoets telde en zijn eigen acht schermen niet meer meetelden.
       test/leven.e2e.js blokkeerde ze al; hier stond het nog niet. */
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await volgVerzoeken(page);
    const fouten = [];
    letOpFouten(page, fouten);

    const stuk = [];
    for (const app of APPS) {
      const pad = '/apps/' + app + '.html';
      await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => {
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        // met opzet geen enkele sessie: dit is de uitgelogde bezoeker
        localStorage.removeItem('rtg_office_token');
        localStorage.removeItem('rtg_sup_token');
      });
      await page.goto(base + pad, { waitUntil: 'domcontentloaded' });
      // een omleiding gebeurt bij het laden: wachten tot het scherm stil is
      await wachtOpRust(page);

      const r = await page.evaluate(() => {
        const deur = document.querySelector('.rtgdeur');
        const link = deur ? deur.querySelector('a[href*="personeel.html"]') : null;
        return {
          pad: location.pathname,
          deur: !!deur,
          items: deur ? deur.querySelectorAll('li').length : 0,
          naar: link ? link.getAttribute('href') : '',
          tekst: document.body.innerText.replace(/\s+/g, ' ')
        };
      });

      // 1. je blijft waar je bent
      if (r.pad !== pad) { stuk.push(app + ': stuurt weg naar ' + r.pad); continue; }
      // 2. er staat een deur
      if (!r.deur) { stuk.push(app + ': geen deur op het scherm -- ' + r.tekst.slice(0, 120)); continue; }
      // 3. de deur vertelt wat deze app is (de gids, niet alleen een weigering)
      if (r.items < 1) stuk.push(app + ': de deur noemt niet wat je hier straks doet');
      if (r.tekst.length < 120) stuk.push(app + ': de deur zegt bijna niets (' + r.tekst.length + ' tekens)');
      // 4. en wijst de weg terug, mét het adres van deze app
      if (!r.naar) { stuk.push(app + ': geen weg naar de personeels-inlog'); continue; }
      if (!/terug=/.test(r.naar)) stuk.push(app + ': de inloglink draagt geen terug-adres (' + r.naar + ')');
      else if (!decodeURIComponent(r.naar).includes(pad)) {
        stuk.push(app + ': het terug-adres wijst niet naar deze app (' + r.naar + ')');
      }
    }
    assert.deepEqual(stuk, [], 'alle acht tonen hun eigen deur:\n  ' + stuk.join('\n  '));

    /* Paginafouten horen er niet te zijn. Juist hier is dat scherp: de apps
       startten voorheen hun laadlus ongeacht de sessie, en zonder omleiding
       zou dat een reeks 401-en geven die de deur weer overschrijven. De
       start-guard hoort dat te voorkomen, en dit is de plek waar dat blijkt. */
    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
