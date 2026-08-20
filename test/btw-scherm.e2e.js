/* Schermtoets voor de btw-aangifte in het Kantoor van de zaak.

   Waarom deze er is: de aangifte-endpoints zijn met toetsen gedekt
   (test/btw-aangifte.test.js), maar een gedekt endpoint achter een kaart die
   niemand ooit heeft zien tekenen is precies de vorm waar scripts/schermen.js
   over gaat -- "af" is geen bewering. Deze toets opent het Kantoor in een echte
   browser, tikt op Opmaken, en eist dat er cijfers uit de EIGEN factuur op het
   scherm staan.

   Dat de zaak hier op het lopende kwartaal uitkomt is geen toevalligheid maar de
   afspraak: opmaken mag altijd, indienen pas als de periode voorbij is. De toets
   eist die tussenstand-melding dan ook letterlijk.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
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

/* Een browser KIEZEN door hem te starten, niet door hem te laden: zie de
   kop van ./browser.js. Dit bestand droeg nog een eigen kopie van de oude
   lader, en die zakte op 'Executable doesn't exist' zodra het pakket er wel
   was en de bijbehorende Chromium niet -- een rode toets die niets over zijn
   onderwerp zei. */
const api = async (base, pad, body, token) => (await fetch(base + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {}) })).json();

test('Kantoor: de btw-aangifte tekent zich en rekent met de eigen factuur',
  { skip: pw ? false : 'playwright niet beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-btwscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const login = await api(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
    assert.ok(login.token, 'de zaak is ingelogd');
    const f = await api(base, '/api/supplier/facturen/maak',
      { omschrijving: 'Consult', aantal: 1, bedrag: 121, koperNaam: 'Klant' }, login.token);
    assert.ok(f.factuur && f.factuur.btwBedrag > 0, 'er staat een factuur met btw in het register');
    const btwOpFactuur = f.factuur.btwBedrag.toFixed(2).replace('.', ',');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    /* Het Kantoor is een werkplek achter de gate. `rtg_sup_station` is de sleutel
       waarmee de app zelf een herstart opvangt (leverancier-06.js), dus dat is de
       eerlijke manier om er te komen: geen omweg om de poort heen. */
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

    // het lopende kwartaal staat voorgeselecteerd en wordt opgemaakt
    await page.click('#btwOp');
    await page.waitForFunction(() => {
      const k = document.querySelector('#btwOp');
      return !!(k && /Verschuldigde btw/.test(k.closest('.tkc').textContent));
    }, null, { timeout: 15000 });

    const kaart = (await page.$eval('#btwOp', e => e.closest('.tkc').textContent)).replace(/\s+/g, ' ');
    assert.match(kaart, new RegExp('Verschuldigde btw.{0,20}' + btwOpFactuur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'de btw van de eigen factuur staat als verschuldigd op het scherm');
    assert.match(kaart, /1 verkoopfacturen/, 'en de aangifte verantwoordt uit hoeveel facturen hij komt');
    assert.match(kaart, /Dit is een tussenstand; indienen kan pas als de periode voorbij is/,
      'het lopende kwartaal wordt als tussenstand gepresenteerd');
    /* Geen indienknop zolang de periode loopt: de weigering staat op de server,
       maar een knop die altijd afketst is een knop die niet had moeten staan. */
    assert.equal(await page.$('#btwDien'), null, 'geen indienknop op een lopende periode');

    assert.deepEqual(fouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* opruimen mag falen */ }
  }
});
