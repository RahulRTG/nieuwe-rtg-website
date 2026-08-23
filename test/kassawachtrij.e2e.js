/* DE KASSA ZONDER LIJN, in een echte browser.

   HORECA.md eist dat elke locatie blijft werken zonder internet. Deze toets
   bewijst dat voor de kassa, en vooral bewijst hij het GEVAARLIJKE deel: een
   wachtrij is iets dat opnieuw verstuurt, en opnieuw versturen mag nooit twee
   keer omzet opleveren.

   Drie beweringen, in oplopende scherpte:

   1. ZONDER LIJN GAAT DE BON NIET VERLOREN. Hij komt in de wachtrij van dit
      toestel en dat staat op het scherm -- niet in een hoekje, maar in een
      strook boven het werkvlak.
   2. MET DE LIJN TERUG GAAT HIJ ALSNOG WEG, en dan staat er precies EEN bon in
      het dagrapport.
   3. HET ANTWOORD DAT ONDERWEG VERDWEEN LEIDT NIET TOT EEN TWEEDE BON. Dit is
      het echte geval: het verzoek KWAM aan en werd verwerkt, maar de kassa zag
      het antwoord nooit. Hier wordt dat nagebootst door het verzoek zelf door
      te laten en pas de terugweg af te kappen. Zonder de idem-sleutel die bij
      het AFREKENEN is gemaakt en meereist in de wachtrij, staat er daarna twee
      keer omzet.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-kassawachtrij-'));

async function zaakToken(base) {
  const post = (pad, body) => fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const roster = await post('/api/supplier/roster', { code: 'KIKUNOI' });
  const mgr = (roster.staff || []).find(x => x.role === 'manager') || (roster.staff || [])[0];
  assert.ok(mgr, 'de demozaak heeft personeel');
  const inlog = await post('/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' });
  assert.ok(inlog.token, 'de zaak-inlog werkt: ' + JSON.stringify(inlog).slice(0, 120));
  return inlog.token;
}

test('de kassa verliest geen bon zonder lijn en verdubbelt er geen bij het herstellen',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    const token = await zaakToken(base);
    const rapport = () => fetch(base + '/api/supplier/kassa/dagrapport', { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: '{}' }).then(r => r.json());

    await page.goto(base + '/apps/kassa.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_sup_token', t);
      localStorage.removeItem('rtg_kassa_wachtrij');
      localStorage.removeItem('rtg_kassa_vastgelopen');
    }, token);

    /* ---- 1. de lijn is weg ---- */
    let lijnDicht = true;
    await page.route('**/api/supplier/pos/sale', async (route) => {
      if (lijnDicht) return route.abort('failed');
      return route.continue();
    });
    await page.goto(base + '/apps/kassa.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);

    const knop = await page.$('.art');
    assert.ok(knop, 'er staan artikelknoppen op de kassa');
    await knop.click();
    await page.click('#payContant');
    await page.waitForTimeout(500);

    let strook = await page.evaluate(() => {
      const el = document.getElementById('wachtStrook');
      return { verborgen: !!el.hidden, tekst: el.innerText };
    });
    assert.equal(strook.verborgen, false, 'de wachtstrook staat in beeld');
    assert.match(strook.tekst, /1 bon wacht/, 'en zegt hoeveel er wachten: ' + strook.tekst);
    const rijLengte = await page.evaluate(() => RTGKassaWachtrij.rij().length);
    assert.equal(rijLengte, 1, 'de bon staat in de wachtrij van dit toestel');
    const voor1 = await rapport();
    assert.equal(voor1.bonnen, 0, 'en bij de server staat er nog niets');

    /* ---- 1b. RTG Pay wacht NOOIT ----
       Contant geld ligt in de la en pin gaat buiten ons om: die zijn echt
       gebeurd en mogen later aankomen. Een RTG-betaalcode moet op het moment
       zelf gecontroleerd worden -- een bon "afgerekend" noemen terwijl niemand
       weet of de code geldig was, is een belofte die we niet waarmaken. */
    const knopB = await page.$('.art');
    await knopB.click();
    await page.click('#payRtg');
    await page.fill('#payCode', 'ABC123');
    await page.click('#payOk');
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => RTGKassaWachtrij.rij().length), 1,
      'de RTG Pay-bon komt NIET in de wachtrij; er staat er nog steeds maar een');
    const rtgUit = await page.evaluate(() => document.getElementById('uitkomst').innerText);
    assert.match(rtgUit, /verbinding/i, 'en de kassa zegt dat het niet ging: ' + rtgUit);
    const bonNog = await page.evaluate(() => document.getElementById('bon').innerText);
    assert.doesNotMatch(bonNog, /Nog leeg/, 'de bon blijft staan, want er is niets afgerekend');
    await page.click('#bonLeeg');

    /* ---- 2. de lijn is terug ---- */
    lijnDicht = false;
    await page.click('#wachtNu');
    await page.waitForTimeout(900);
    strook = await page.evaluate(() => ({ verborgen: !!document.getElementById('wachtStrook').hidden,
      rij: RTGKassaWachtrij.rij().length, vast: RTGKassaWachtrij.vastgelopen().length }));
    assert.equal(strook.rij, 0, 'de wachtrij is leeg');
    assert.equal(strook.vast, 0, 'en er is niets vastgelopen');
    assert.equal(strook.verborgen, true, 'de strook is weer weg');
    const na1 = await rapport();
    assert.equal(na1.bonnen, 1, 'er staat precies EEN bon bij de server');

    /* ---- 3. het antwoord dat onderweg verdween ---- */
    /* Het verzoek gaat er WEL doorheen (route.fetch doet het echt), alleen het
       antwoord bereikt de pagina niet. Dat is de storing die een naieve
       wachtrij laat verdubbelen. */
    let slikAntwoord = true;
    await page.unroute('**/api/supplier/pos/sale');
    await page.route('**/api/supplier/pos/sale', async (route) => {
      if (!slikAntwoord) return route.continue();
      await route.fetch();           // de server verwerkt hem echt
      return route.abort('failed');  // maar de kassa ziet een netwerkfout
    });
    const knop2 = await page.$('.art');
    await knop2.click();
    await page.click('#payContant');
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => RTGKassaWachtrij.rij().length), 1,
      'de kassa denkt dat het misging en zet de bon in de wachtrij');
    const tussen = await rapport();
    assert.equal(tussen.bonnen, 2, 'terwijl de server hem wel degelijk verwerkte');

    slikAntwoord = false;
    await page.click('#wachtNu');
    await page.waitForTimeout(900);
    const eind = await rapport();
    assert.equal(eind.bonnen, 2, 'de herhaling levert GEEN derde bon op');
    assert.equal(await page.evaluate(() => RTGKassaWachtrij.rij().length), 0, 'en de wachtrij is leeg');
    assert.equal(await page.evaluate(() => RTGKassaWachtrij.vastgelopen().length), 0,
      'de herhaling is geen fout en loopt dus niet vast');

    /* ---- 4. een bon die de server WEIGERT loopt vast, hij gaat niet rond ----
       Het verschil tussen "de lijn is weg" en "deze bon deugt niet" is het
       verschil tussen wachten en vastlopen. Zonder dat onderscheid blijft een
       geweigerde bon eeuwig opnieuw verstuurd worden, en ziet niemand ooit
       waarom hij niet aankomt. */
    await page.unroute('**/api/supplier/pos/sale');
    let stand = 'weiger';
    await page.route('**/api/supplier/pos/sale', async (route) => {
      if (stand === 'weiger') return route.fulfill({ status: 400, contentType: 'application/json',
        body: JSON.stringify({ error: 'Deze kassa is afgesloten voor vandaag.' }) });
      // een tussenlaag die 503 zegt: de kassalaag heeft de bon nooit gezien
      if (stand === 'poort') return route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>503</h1>' });
      if (stand === 'door') return route.continue();
      return route.abort('failed');
    });
    /* Eerst: een weigering AAN DE KASSA gaat ook niet de wachtrij in. De rij is
       voor een lijn die weg is, niet voor een bon waar de server iets van
       vindt -- die hoort de bediening meteen te zien. */
    const knopW = await page.$('.art');
    await knopW.click();
    await page.click('#payContant');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => RTGKassaWachtrij.rij().length), 0,
      'een geweigerde bon komt niet in de wachtrij terecht');
    const weigerUit = await page.evaluate(() => document.getElementById('uitkomst').innerText);
    assert.match(weigerUit, /afgesloten voor vandaag/, 'de bediening ziet de reden meteen: ' + weigerUit);
    await page.click('#bonLeeg');

    /* Een 503 van een tussenlaag is een storing en geen oordeel: de kassalaag
       heeft de bon nooit gezien, dus die hoort te wachten en niet vast te lopen. */
    stand = 'poort';
    const knopP = await page.$('.art');
    await knopP.click();
    await page.click('#payContant');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => RTGKassaWachtrij.rij().length), 1,
      'een 503 van de poort laat de bon wachten');
    assert.equal(await page.evaluate(() => RTGKassaWachtrij.vastgelopen().length), 0,
      'en loopt hem niet vast');
    stand = 'door';
    await page.click('#wachtNu');
    await page.waitForTimeout(900);
    assert.equal(await page.evaluate(() => RTGKassaWachtrij.rij().length), 0, 'na de poort gaat hij alsnog weg');
    assert.equal((await rapport()).bonnen, 3, 'en telt dan als EEN bon');

    stand = 'af';
    const knop3 = await page.$('.art');
    await knop3.click();
    await page.click('#payContant');
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => RTGKassaWachtrij.rij().length), 1, 'de bon wacht weer');

    stand = 'weiger';
    await page.click('#wachtNu');
    await page.waitForTimeout(900);
    const eindstand = await page.evaluate(() => ({
      rij: RTGKassaWachtrij.rij().length, vast: RTGKassaWachtrij.vastgelopen().length,
      strook: document.getElementById('wachtStrook').innerText
    }));
    assert.equal(eindstand.rij, 0, 'een geweigerde bon blijft niet in de rij rondgaan');
    assert.equal(eindstand.vast, 1, 'maar staat apart als vastgelopen');
    assert.match(eindstand.strook, /1 vastgelopen/, 'en dat staat op het scherm: ' + eindstand.strook);
    await page.click('#wachtVast');
    await page.waitForTimeout(300);
    const reden = await page.evaluate(() => document.getElementById('infoIn').innerText);
    assert.match(reden, /afgesloten voor vandaag/, 'met de reden van de server erbij: ' + reden);
    const naWeigering = await rapport();
    assert.equal(naWeigering.bonnen, 3, 'en er kwam geen omzet bij');

    assert.deepEqual(fouten, [], 'geen scriptfouten op het kassascherm');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
