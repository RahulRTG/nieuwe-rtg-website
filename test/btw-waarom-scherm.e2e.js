/* Schermtoets voor "Waarom dit bedrag?" -- de bewijsketen in het Kantoor.

   De endpoints zijn gedekt (test/fiscaal-herkomst.test.js), maar een gedekt
   endpoint achter een kaart die niemand ooit heeft zien tekenen is precies waar
   scripts/schermen.js over gaat: "af" is geen bewering. Deze toets opent het
   Kantoor in een echte browser, maakt een aangifte op, tikt op Vouw open, en
   eist dat de btw van de EIGEN factuur eronder staat -- met het factuurnummer
   erbij, want dat is wat deze kaart toevoegt boven het totaal dat er al stond.

   En hij eist het omgekeerde ook: zolang er niets aan de hand is, staat er GEEN
   bevinding. Dat is uitzonderingsgestuurd ontwerpen (ONTWERP.md), en het is
   toetsbaar: een scherm dat bij "alles in orde" al kleur geeft, leert de lezer
   over die kleur heen te kijken.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, browserOpties, geenBrowser } = require('./helper');
/* DE BROWSER KOMT UIT ./browser.js, en niet uit een eigen loader hier. Dat
   bestand probeert te STARTEN in plaats van te laden: een Playwright zonder
   bijbehorende Chromium laat de require lukken en pas de launch zakken, en dan
   valt de toets om op iets dat niets over de code zegt. Er stond hier eerst een
   eigen terugval op vaste paden -- dat was een 95e kopie van precies het
   probleem waarvoor ./browser.js is geschreven. */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const fs = require('fs');
const os = require('os');
const path = require('path');

const api = async (base, pad, body, token) => (await fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) })).json();

test('Kantoor: "Waarom dit bedrag?" vouwt de aangifte open tot op de factuur',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-waarom-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const login = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
    assert.ok(login.token, 'de zaak is ingelogd');
    const f = await api(base, '/api/supplier/facturen/maak',
      { omschrijving: 'Consult', aantal: 1, bedrag: 121, koperNaam: 'Klant' }, login.token);
    assert.ok(f.factuur && f.factuur.btwBedrag > 0, 'er staat een factuur met btw in het register');
    const btwOpFactuur = f.factuur.btwBedrag.toFixed(2).replace('.', ',');
    const nummer = String(f.factuur.nummer);

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(t => {
      localStorage.setItem('rtg_sup_token', t);
      localStorage.setItem('rtg_sup_station', 'kantoor');
      localStorage.setItem('rtg_lang', 'nl');
      localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, login.token);
    await page.goto(base + '/apps/leverancier.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app.active', { timeout: 20000 });
    await page.waitForSelector('[data-ksec="fin"]', { state: 'visible', timeout: 15000 });
    await page.click('[data-ksec="fin"]');
    await page.waitForSelector('#btwOp', { timeout: 15000 });

    // eerst een aangifte, want de kaart vouwt de getoonde periode open
    await page.click('#btwOp');
    await page.waitForFunction(() => {
      const k = document.querySelector('#btwOp');
      return !!(k && /Verschuldigde btw/.test(k.closest('.tkc').textContent));
    }, null, { timeout: 15000 });

    await page.waitForSelector('#btwWrm', { timeout: 15000 });
    await page.click('#btwWrm');
    await page.waitForFunction(n => {
      const k = document.querySelector('#btwWrm');
      return !!(k && k.closest('.tkc').textContent.includes(n));
    }, nummer, { timeout: 15000 });

    const blok = (await page.$eval('#btwWrm', e => e.closest('.btw-blok').textContent)).replace(/\s+/g, ' ');
    assert.match(blok, new RegExp(btwOpFactuur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'de btw van de eigen factuur staat in de opbouw');
    assert.ok(blok.includes(nummer), 'en het factuurnummer eronder -- dat is wat deze kaart toevoegt');
    assert.match(blok, /1 facturen/, 'met de verantwoording uit hoeveel facturen hij komt');
    /* De klasse van de uitkomst reist mee: een getelde opbouw is vastgesteld en
       draagt niet dezelfde slappe zin als een schatting. */
    assert.match(blok, /Vastgesteld/, 'de zekerheidsklasse staat eronder');

    /* En het omgekeerde: er is niets mis, dus er staat geen bevinding. */
    assert.ok(!/sluit niet aan/i.test(blok), 'geen valse melding dat de opbouw niet aansluit');
    assert.ok(!/niet bestond/i.test(blok), 'en geen vals vreemd tarief');

    /* ---- de afsluiting van de periode (deel 12a3) ----
       Hierboven is net een aangifte opgemaakt, dus het register en de aangifte
       zeggen hetzelfde: deze periode staat op bewezen. Dat is het GOEDE geval,
       en juist daarom toetst dit ook wat er dan NIET staat -- geen uitzondering
       en geen ontbrekende post. Een kaart die bij "alles in orde" toch iets
       roods laat zien, leert de lezer over kleur heen te kijken. */
    await page.waitForSelector('#btwAfs', { timeout: 15000 });
    await page.click('#btwAfs');
    await page.waitForFunction(() => {
      const k = document.querySelector('#btwAfs');
      return !!(k && /Ontbrekend|Bewezen/.test(k.closest('.btw-blok').textContent));
    }, null, { timeout: 15000 });

    const afs = (await page.$eval('#btwAfs', e => e.closest('.btw-blok').textContent)).replace(/\s+/g, ' ');
    assert.match(afs, /Bewezen/, 'de dekking staat er');
    assert.match(afs, new RegExp(btwOpFactuur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'en het is het bedrag van de eigen factuur');
    assert.match(afs, /dekking, geen correctheid/i, 'de kaart belooft niet meer dan hij meet');
    /* Niets roods als er niets aan de hand is. */
    assert.ok(!/Uitzondering/.test(afs), 'geen valse uitzondering');
    assert.ok(!/Ontbrekend/.test(afs), 'geen valse ontbrekende dekking');
    // de balk is er, en draagt een tekstalternatief
    assert.ok(await page.$('.afs-balk[aria-label]'), 'de dekkingsbalk heeft een aria-label');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
