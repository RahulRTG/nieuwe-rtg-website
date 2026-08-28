/* DE KLANTKANT VAN DE KOSTPRIJSLAAG, IN EEN ECHTE BROWSER.

   test/kosten.e2e.js beproeft het BORD van de boardroom; dit is de andere kant:
   wat een LID (de stand Kosten in RTG Geld) en een ZAAK
   (/apps/zaakkosten.html) te zien krijgen over wat hun gebruik van RTG kost.
   Dezelfde kern, hetzelfde tekenwerk uit /shared/kostenbeeld.js -- en de vraag
   die hier op het spel staat is niet of het er netjes uitziet maar of het
   EERLIJK is.

   Wat deze toets vastlegt, in deze volgorde:

     1. ZONDER TARIEF STAAT ER GEEN BEDRAG. Niet nul -- nul leest als "gratis",
        en dat is een andere bewering dan "niet bekend" (KOSTEN.md par. 1). Dit
        is de assertie die het hele scherm draagt: het is verleidelijk om op een
        ledenpagina altijd een cijfer te tonen, en precies daar wordt de grens
        gebroken.
     2. MET TARIEF STAAT ER WEL EEN BEDRAG, met zijn bewijsgraad ernaast.
     3. "WAAROM DIT BEDRAG" opent de keten en die eindigt eerlijk: bij de
        leveranciersfactuur, of bij de mededeling dat er geen aan hangt.
     4. De eigen verbruiksgrens komt echt op de server aan.

   Draait alleen waar Playwright beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, kantoorAlsPersoon } = require('./helper');
const { laadBrowser, browserOpties, geenBrowser } = require('./browser');
const pw = laadBrowser();

const post = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
}).then(r => r.json());

test('de stand Kosten: geen bedrag zonder tarief, wel met, en de keten opent',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer();
  const base = srv.base;
  let browser = null;
  try {
    const t = Date.now();
    const lid = await post(base, '/api/auth/register', { name: 'Kosten Lid', email: 'kl' + t + '@e.test',
      phone: '06' + String(t).slice(-8), password: 'geheim123', geboortedatum: '1984-05-05', tier: 'rtg' });
    assert.ok(lid.token, 'registreren hoort een token te geven');

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    const fouten = letOpFouten(page, []);
    await page.addInitScript((tok) => {
      try { localStorage.setItem('rtg_member_token', tok); } catch (e) {}
    }, lid.token);

    await page.goto(base + '/apps/geld.html#kosten', { waitUntil: 'networkidle' });
    await page.waitForSelector('#ksHoofd .rtg-status', { timeout: 15000 });

    /* 1. GEEN TARIEF, DUS GEEN BEDRAG. Er is nog geen enkel tarief ingevoerd in
       deze verse omgeving, dus de server rekent niets uit en de graad staat op
       'onbekend'. Dan hoort er geen euroteken in het hoofdvlak te staan.

       DE MUTATIE DIE DEZE ASSERTIE HOORT TE LATEN ZAKKEN: laat hoofd() in
       apps/geld/kosten.js de KPI ook tekenen als de graad onbekend is. Het
       scherm toont dan "EUR 0,00" en ziet er volstrekt normaal uit -- en
       beweert dat dit lid RTG niets kost. */
    const kaal = await page.textContent('#ksHoofd');
    assert.match(kaal, /Niet vast te stellen/, 'de toestand hoort eerlijk "niet vast te stellen" te zijn: ' + kaal.slice(0, 200));
    assert.ok(!/€/.test(kaal),
      'er staat een bedrag in het hoofdvlak terwijl er geen tarief is; nul leest als gratis: ' + kaal.slice(0, 200));

    /* 2. NU EEN TARIEF, door de boardroom. Serververzoeken zijn de enige soort
       waarvan dit lid er in deze toets gegarandeerd een paar heeft gemaakt: elk
       verzoek dat het scherm doet, telt er een. */
    const kantoor = await kantoorAlsPersoon(base);
    assert.ok(kantoor, 'geen boardroom-sessie; zonder eigenaar valt hier niets te zetten');
    const gezet = await post(base, '/api/office/kosten/tarief/zet',
      { soort: 'verzoek', perEenheid: 500000, bron: 'Contract hoster, augustus 2026' }, kantoor);
    assert.ok(gezet.ok, 'het tarief kon niet gezet worden: ' + JSON.stringify(gezet).slice(0, 160));

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#ksRegels .rij', { timeout: 15000 });
    const metTarief = await page.textContent('#ksHoofd');
    assert.match(metTarief, /€/, 'met een tarief hoort er wel een bedrag te staan: ' + metTarief.slice(0, 200));
    assert.match(metTarief, /gemeten/, 'het bedrag hoort zijn bewijsgraad naast zich te dragen');
    /* En het hoort te ZEGGEN wat het is. Een groot bedrag bovenaan een scherm
       leest als een rekening, terwijl dit bij de meeste passen in het
       lidmaatschap zit.

       DE MUTATIE: haal het label "wat uw gebruik ons kost" weg. Er staat dan een
       kaal bedrag boven aan het scherm van een lid dat hier niets betaalt. */
    assert.match(metTarief, /wat uw gebruik ons kost/,
      'het bedrag staat er zonder te zeggen wat het is: ' + metTarief.slice(0, 200));

    /* 3. DE KETEN. Hij eindigt eerlijk: er hangt geen leveranciersfactuur aan
       dit tarief, en dat hoort er te STAAN in plaats van weggelaten te worden. */
    await page.click('#ksRegels [data-waarom="verzoek"]');
    await page.waitForFunction(() => {
      const el = document.querySelector('#ksKeten-verzoek');
      return el && !el.hidden && !/Laden/.test(el.textContent);
    }, null, { timeout: 15000 });
    const keten = await page.textContent('#ksKeten-verzoek');
    assert.match(keten, /Contract hoster/, 'de bron van het tarief hoort in de keten te staan: ' + keten.slice(0, 200));
    assert.match(keten, /geen factuur gekoppeld/,
      'de keten hoort te zeggen waar hij ophoudt, niet stil te eindigen: ' + keten.slice(0, 200));

    /* 4. DE EIGEN GRENS komt echt aan; het scherm mag hem niet alleen
       terugtekenen. */
    await page.fill('#ksWaarschuw', '12,50');
    await page.fill('#ksPlafond', '25,00');
    await page.click('#ksGrensZet');
    await page.waitForFunction(() =>
      /12,50/.test((document.querySelector('#ksGrens') || {}).innerHTML || ''), null, { timeout: 15000 });
    const stand = await post(base, '/api/kosten/grens', {}, lid.token);
    assert.equal(stand.grens.zelf.waarschuwCenten, 1250, 'de waarschuwing staat niet op de server');
    assert.equal(stand.grens.zelf.plafondCenten, 2500, 'het plafond staat niet op de server');

    assert.deepEqual(fouten, [], 'scriptfouten op de stand Kosten');
  } finally {
    if (browser) await browser.close();
    stop(srv);
  }
});

test('het zaakscherm: dezelfde eerlijkheid, op de sessie van de zaak',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer();
  const base = srv.base;
  let browser = null;
  try {
    const lg = await post(base, '/api/supplier/login', { username: 'rahul', password: 'Imran' });
    assert.ok(lg.token, 'geen zaak-sessie: ' + JSON.stringify(lg).slice(0, 160));

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    const fouten = letOpFouten(page, []);
    await page.addInitScript((tok) => {
      try { localStorage.setItem('rtg_sup_token', tok); } catch (e) {}
    }, lg.token);

    /* ZONDER TARIEF GEEN BEDRAG, ook hier. Deze assertie staat twee keer in dit
       bestand en dat is met opzet: het lid en de zaak delen het tekenwerk, maar
       een scherm dat de gedeelde laag omzeilt en zelf een getal neerzet, zou
       alleen hier opvallen. */
    await page.goto(base + '/apps/zaakkosten.html', { waitUntil: 'networkidle' });
    await page.waitForSelector('#ksHoofd .rtg-status', { timeout: 15000 });
    const kaal = await page.textContent('#ksHoofd');
    assert.match(kaal, /Niet vast te stellen/, 'de toestand hoort eerlijk te zijn: ' + kaal.slice(0, 200));
    assert.ok(!/€/.test(kaal), 'er staat een bedrag terwijl er geen tarief is: ' + kaal.slice(0, 200));

    const kantoor = await kantoorAlsPersoon(base);
    assert.ok(kantoor, 'geen boardroom-sessie');
    const gezet = await post(base, '/api/office/kosten/tarief/zet',
      { soort: 'verzoek', perEenheid: 400000, bron: 'Contract hoster, augustus 2026' }, kantoor);
    assert.ok(gezet.ok, 'het tarief kon niet gezet worden: ' + JSON.stringify(gezet).slice(0, 160));

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#ksRegels .rij', { timeout: 15000 });
    const metTarief = await page.textContent('#ksHoofd');
    assert.match(metTarief, /€/, 'met een tarief hoort er een bedrag te staan: ' + metTarief.slice(0, 200));
    /* De zin is die van een ONDERNEMER en niet die van een lid: dezelfde
       gedeelde laag, een andere aanspreekvorm. Zou dat verschil wegvallen, dan
       staat er "Alles loopt zoals verwacht" op een zakelijk scherm. */
    assert.match(metTarief, /Uw zaak draait normaal/, 'de zakelijke zin hoort hier te staan: ' + metTarief.slice(0, 200));

    await page.click('#ksRegels [data-waarom="verzoek"]');
    await page.waitForFunction(() => {
      const el = document.querySelector('#ksKeten-verzoek');
      return el && !el.hidden && !/Laden/.test(el.textContent);
    }, null, { timeout: 15000 });
    const keten = await page.textContent('#ksKeten-verzoek');
    assert.match(keten, /Contract hoster/, 'de bron hoort in de keten te staan: ' + keten.slice(0, 200));

    assert.deepEqual(fouten, [], 'scriptfouten op het zaakscherm');
  } finally {
    if (browser) await browser.close();
    stop(srv);
  }
});
