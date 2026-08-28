/* WAT DIT GEZIN KOST, OP HET SCHERM VAN DE BEHEERDER.

   De route was getoetst (test/kosten.test.js), het scherm niet -- en juist hier
   zit het risico niet in het bedrag maar in de VOLGORDE. De RTFoundation
   betaalt dit en er komt nooit een rekening; een blok dat met een bedrag opent
   leest als een openstaande post, hoe vriendelijk de zin eronder ook is
   (LEVEN.md: nooit sturen, altijd openen).

   Wat deze toets vastlegt:
     1. de belofte staat BOVEN het bedrag, in de volgorde van het document;
     2. zonder tarief staat er geen bedrag, en met opzet geen nul -- gratis
        omdat de stichting betaalt is iets anders dan gratis omdat het niets
        kost;
     3. met een tarief staat het bedrag er wel, met zijn bewijsgraad ernaast.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, kantoorAlsPersoon } = require('./helper');
const { laadBrowser, browserOpties, geenBrowser } = require('./browser');
const pw = laadBrowser();

const post = (base, p, b, token) => fetch(base + p, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(b || {})
}).then(r => r.json());

test('het gezinsscherm: de belofte staat boven het bedrag, en zonder tarief staat er geen',
  { skip: geenBrowser(pw) }, async () => {
  const srv = await startServer();
  const base = srv.base;
  let browser;
  try {
    const g = await post(base, '/api/foundation/gezin/maak', { gezinsnaam: 'Kostenfamilie', naam: 'Papa', pin: '1234' });
    assert.ok(g.token, 'geen gezinssessie: ' + JSON.stringify(g).slice(0, 160));

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/foundation/beheer.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((sessie) => {
      localStorage.setItem('rtf_sessie', JSON.stringify(sessie));
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, { code: g.code, token: g.token, profiel: { naam: 'Papa', beheerder: true } });
    fouten.length = 0;   // het bezoek hierboven was uitgelogd; de meting begint hieronder

    await page.goto(base + '/apps/foundation/beheer.html', { waitUntil: 'domcontentloaded' });
    /* Op de tekst wachten en niet op zichtbaarheid: deze pagina verdeelt zich
       met /shared/deelmenu.js over ingangen, dus het blok staat er wel maar
       staat pas open als je die ingang kiest. De vraag hier is wat er STAAT. */
    await page.waitForFunction(() =>
      !/Even kijken/.test((document.querySelector('#kostenUit') || {}).textContent || 'Even kijken'),
      null, { timeout: 15000 });

    /* 1. DE VOLGORDE. Niet "staat de zin er ergens", maar: staat hij ERBOVEN.
       DE MUTATIE: zet in beheer.html het bedrag boven de belofte. Alle woorden
       staan er dan nog, en het blok leest als een rekening. */
    const volgorde = await page.evaluate(() => {
      const belofte = document.querySelector('#kostenBelofte');
      const uit = document.querySelector('#kostenUit');
      return { tekst: belofte.textContent, eerst: !!(belofte.compareDocumentPosition(uit) & Node.DOCUMENT_POSITION_FOLLOWING) };
    });
    assert.match(volgorde.tekst, /RTFoundation betaalt dit/, 'de belofte hoort er letterlijk te staan');
    assert.match(volgorde.tekst, /nooit een rekening/);
    assert.ok(volgorde.eerst, 'het bedrag staat boven de belofte; dan leest dit blok als een openstaande post');

    // 2. zonder tarief geen bedrag
    const kaal = await page.textContent('#kostenUit');
    assert.ok(!/€/.test(kaal), 'er staat een bedrag terwijl er geen tarief is: ' + kaal.slice(0, 200));
    assert.match(kaal, /geen tarief/, 'de reden hoort er te staan in plaats van een nul: ' + kaal.slice(0, 200));

    // 3. met tarief wel, met de bewijsgraad erbij
    const kantoor = await kantoorAlsPersoon(base);
    assert.ok(kantoor, 'geen boardroom-sessie');
    const gezet = await post(base, '/api/office/kosten/tarief/zet',
      { soort: 'verzoek', perEenheid: 500000, bron: 'Contract hoster, gezinstoets' }, kantoor);
    assert.ok(gezet.ok, JSON.stringify(gezet).slice(0, 160));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      /€/.test((document.querySelector('#kostenUit') || {}).textContent || ''), null, { timeout: 15000 });
    const met = await page.textContent('#kostenUit');
    assert.match(met, /€/, 'met een tarief hoort er een bedrag te staan: ' + met.slice(0, 200));
    assert.match(met, /gemeten/, 'een bedrag hoort zijn bewijsgraad naast zich te dragen: ' + met.slice(0, 200));

    assert.deepEqual(fouten, [], 'scriptfouten op het gezinsscherm');
  } finally {
    if (browser) await browser.close();
    stop(srv);
  }
});
