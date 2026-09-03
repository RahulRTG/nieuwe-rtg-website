/* SCHERMTOETS VOOR DE TWEE VEILIGHEIDSSCHERMEN VAN DE RTFOUNDATION:
   /apps/foundation/onveilig.html en /apps/foundation/wegwijzer.html.

   WAAROM DEZE TWEE EEN BROWSER NODIG HEBBEN. test/beschermzaak.test.js dekt de
   voordeur over de lijn en test/veiligheidgrens.test.js bewaakt de vier zinnen
   over RTG Veilig. Wat geen van beide ziet, is of een mens er werkelijk komt:
   de nummers op onveilig.html worden door JavaScript uitgeschreven (CATS ->
   #cats), en de plaatsenlijst op wegwijzer.html komt van de server. Gaat een van
   die twee stuk, dan staat er een lege pagina met een geruststellende titel --
   en dat is op precies deze schermen de duurste faalvorm die dit huis kent.

   WAT ER MET OPZET WORDT GETOETST EN NIET:
     - dat 112 en 0800-2000 BOVEN de rest staan (de volgorde is het ontwerp);
     - dat de categorieen echt uit CATS komen en niet leeg blijven;
     - dat de plaatsenlijst van de server komt, en dat een verzoek een code
       oplevert die daarna op te vragen en in te trekken is;
     - NIET de inhoud van de hulplijnen: die staat in de pagina zelf en zou hier
       alleen worden overgetypt.

   MUTATIES die zijn gedraaid en welke bewering erop zakte (LAT.md regel 2):
   - de regel `document.getElementById('cats').innerHTML = ...` uit onveilig.html
     gehaald -> RAAK, op het wachten op de eerste categorie (er verschijnt er
     geen enkele meer, dus de toets komt niet eens bij zijn bewering)
   - in wegwijzer.html de vulling van #stad overgeslagen
     -> "de plaats komt van de server" ZAKT (RAAK). Let op waarom hij daar zakt
     en niet op het wachten: de pagina zet er zelf "geen plaats beschikbaar" in,
     dus het veld IS gevuld -- met precies de verkeerde inhoud.

   Draait alleen waar Playwright beschikbaar is. Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  kantoorAlsPersoon, postJson } = require('./helper');

const pw = laadPlaywright();

test('de twee veiligheidsschermen: de nummers staan er, en een mens kan zelf iets in gang zetten',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-wegwijzer-'));
  const { child, base } = await startServer({ env: {
    SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'WEGWIJZER-KEURING' } });
  let browser;
  try {
    /* EEN PLAATS MET DE MODULE AAN, want zonder plaats zet de pagina zichzelf
       terecht dicht en valt er niets te doorlopen. Dat pad heeft zijn eigen
       bewering onderaan; hier gaat het om de weg die WEL open is. */
    const post = postJson(base);
    const land = await kantoorAlsPersoon(base);
    assert.ok(land, 'geen kantoorsessie om een plaats mee aan te zetten');
    const stad = (await post('/api/rtfos/stad/maak', { naam: 'Haarlem' }, land)).stad.id;
    await post('/api/rtfos/stad/status', { id: stad, status: 'actief' }, land);
    await post('/api/rtfos/stad/module', { id: stad, vlag: 'individual_cases', aan: true }, land);

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); });

    /* ---- 1. onveilig.html: de nummerlijst ---- */
    await page.goto(base + '/apps/foundation/onveilig.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const e = document.getElementById('cats');
      return e && e.querySelectorAll('details').length > 0;
    }, null, { timeout: 15000 });

    const titels = await page.evaluate(() =>
      [...document.querySelectorAll('#cats details summary')].map(s => s.textContent.trim()));
    assert.ok(titels.length >= 8, 'de categorieen komen niet op het scherm: ' + titels.length);
    assert.ok(titels.some(t => /slaapplek/i.test(t)), 'de dakloosheidscategorie ontbreekt');

    /* DE VOLGORDE IS HET ONTWERP: wie nu gevaar loopt moet het alarmnummer
       tegenkomen voordat hij een categorie moet kiezen. Daarom geen los "staat
       112 ergens op de pagina" maar een vergelijking van de posities. */
    const posities = await page.evaluate(() => {
      const y = el => el.getBoundingClientRect().top + window.scrollY;
      return { spoed: y(document.querySelector('.spoed')), cats: y(document.getElementById('cats')) };
    });
    assert.ok(posities.spoed < posities.cats, '112 en Veilig Thuis horen boven de categorieen te staan');
    assert.match(await page.textContent('.spoed'), /112/, 'het alarmnummer staat niet in het spoedblok');
    assert.match(await page.textContent('.spoed'), /0800-2000/, 'Veilig Thuis staat niet in het spoedblok');

    /* De uitstapknop is de belofte van dit scherm; hij hoort er te STAAN, en de
       pagina zegt er zelf bij wat hij niet kan. Dat tweede is tekst en wordt
       door test/uitstap*.js bewaakt -- hier alleen dat de knop bestaat. */
    await page.waitForSelector('#rtg-uitstap', { timeout: 15000 });
    assert.match(await page.textContent('#rtg-uitstap'), /Weg hier/,
      'de knop "Weg hier" staat niet op het scherm');

    /* ---- 2. wegwijzer.html: zelf iets in gang zetten ---- */
    await page.goto(base + '/apps/foundation/wegwijzer.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const s = document.getElementById('stad');
      return s && s.options.length > 0;
    }, null, { timeout: 15000 });
    const steden = await page.evaluate(() =>
      [...document.querySelectorAll('#stad option')].map(o => o.textContent));
    assert.deepEqual(steden, ['Haarlem'], 'de plaats komt niet van de server op het scherm');
    assert.equal(await page.locator('#geenplaats').isVisible(), false,
      'met een plaats hoort het "hier kan het nu niet"-blok dicht te blijven');

    await page.click('.keus[data-veld="nuVeilig"] button[data-w="nee"]');
    await page.click('.keus[data-veld="kanMeekijken"] button[data-w="ja"]');
    await page.click('.keus[data-veld="bewaren"] button[data-w="alleen_dat"]');
    await page.click('#stuur');
    await page.waitForFunction(() => {
      const c = document.getElementById('code');
      return c && c.textContent.trim().length > 0;
    }, null, { timeout: 15000 });

    const code = (await page.textContent('#code')).trim();
    assert.match(code, /^RTFB-/, 'de code hoort herkenbaar te zijn: ' + code);
    assert.equal(await page.locator('#formulier').isVisible(), false,
      'na het versturen hoort het formulier weg te zijn');
    assert.match(await page.textContent('#klaarNiets'), /\S/,
      'de zin dat hier niemand klaarzit hoort ook NA het versturen te blijven staan');

    /* ---- 3. de code werkt: terugkijken en intrekken ---- */
    await page.fill('#mijncode', code);
    await page.click('#kijk');
    await page.waitForFunction(() => document.getElementById('standuit').textContent.trim().length > 0,
      null, { timeout: 15000 });
    const stand = await page.textContent('#standuit');
    assert.match(stand, /\S/, 'de stand van de eigen code komt niet terug');

    await page.click('#trekin');
    await page.waitForFunction((v) => {
      const e = document.getElementById('standuit');
      return e && e.textContent.trim() && e.textContent !== v;
    }, stand, { timeout: 15000 });
    assert.equal((await page.textContent('#fout2')).trim(), '',
      'intrekken met de eigen code hoort te lukken en geen fout te tonen');

    assert.deepEqual(fouten, [], 'geen JS-fouten op de twee veiligheidsschermen');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
