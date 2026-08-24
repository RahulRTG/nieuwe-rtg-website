/* VENUE EDGE OP DE PDA, met de lijn er echt uit: /apps/horeca-pda.html.

   De serverkant staat vast in test/horeca-edge.test.js. Wat hier bewezen wordt
   is het deel dat een groene API-toets niet ziet: dat een bediening zónder
   verbinding een bestelling kan opnemen, en dat die er daarna ook werkelijk
   komt.

   1. DE KAART IS ER ZONDER LIJN. Hij wordt bewaard zodra er wel verbinding is;
      zonder kaart is de offline-rij een vangnet onder een trapeze die er niet is.
   2. DE BESTELLING BLIJFT OP HET TOESTEL, en dat staat luid op het scherm. Een
      wachtrij die zwijgt, laat iemand denken dat het verstuurd is.
   3. ZODRA DE LIJN TERUG IS GAAT HIJ ALSNOG WEG, met zijn ALLERGIE, en hij
      staat als "besteld" op de rekening -- niet als geserveerd.
   4. HET ANTWOORD DAT ONDERWEG VERDWEEN LEVERT GEEN TWEEDE BESTELLING OP. Het
      verzoek KWAM aan en werd verwerkt, maar de PDA zag het antwoord nooit;
      daarna stuurt de rij hem opnieuw. Zonder een clientId die bij het OPNEMEN
      is gemaakt en meereist, staat er dan twee keer een bestelling.
   5. EEN BETAALDE BESTELLING GAAT NOOIT DE RIJ IN. Offline betalen is een eigen
      besluit en geen bijvangst van het opnemen.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-edge-e2e-'));

const post = (base, pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de PDA neemt een bestelling op zonder lijn, en hij komt er alsnog',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  let browser;
  try {
    const roster = (await post(base, '/api/supplier/roster', { code: 'KIKUNOI' })).body;
    const mgr = (roster.staff || []).find(x => x.role === 'manager') || roster.staff[0];
    const tok = (await post(base, '/api/supplier/login', { code: 'KIKUNOI', staffId: mgr.id, pin: '1234' })).body.token;
    const H = (pad, body) => post(base, pad, body, tok);

    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    await page.goto(base + '/apps/horeca-pda.html', { waitUntil: 'load' });
    await page.evaluate(t => {
      localStorage.setItem('rtg_cookieinfo_v1', '1');
      localStorage.setItem('rtg_sup_token', t);
      localStorage.removeItem('rtg_horeca_edge');
      localStorage.removeItem('rtg_horeca_edge-vast');
      localStorage.removeItem('rtg_pda_kaart');
    }, tok);

    /* ---- 1. eerst één keer mét lijn, zodat de kaart bewaard wordt ---- */
    const rek = (await H('/api/supplier/horeca/rekening/open', { kanaal: 'tafel', tafel: 'EDGE-WARM', gasten: 2 })).body.rekening;
    await page.goto(base + '/apps/horeca-pda.html', { waitUntil: 'load' });
    await page.waitForTimeout(900);
    await page.click('#pTafels');
    await page.waitForTimeout(700);
    await page.click('[data-tafel]');
    await page.waitForTimeout(900);
    assert.ok(await page.evaluate(() => {
      try { return (JSON.parse(localStorage.getItem('rtg_pda_kaart') || 'null') || []).length > 0; }
      catch (e) { return false; }
    }), 'de kaart is op het toestel bewaard');
    await page.click('#tTerug');
    await page.waitForTimeout(600);

    /* ---- 2. nu de lijn eruit, en toch opnemen ---- */
    let lijnDicht = true;
    await page.route('**/api/supplier/horeca/offline/sync', async (route) => {
      if (lijnDicht) return route.abort('failed');
      return route.continue();
    });

    await page.click('#pLokaal');
    await page.waitForTimeout(600);
    const kaartKnop = await page.$('#lKaart [data-litem]');
    assert.ok(kaartKnop, 'de bewaarde kaart staat op het offline-scherm');

    await page.fill('#lTafel', 'EDGE-KOUD');
    await page.fill('#lGasten', '4');
    await page.fill('#lAllergie', 'schaaldieren');
    await page.selectOption('#lGang', '2');
    await kaartKnop.click();
    await page.waitForTimeout(400);
    assert.match(await page.evaluate(() => document.getElementById('lLijst').innerText),
      /schaaldieren/, 'de allergie staat bij de opgenomen regel');

    await page.click('#lOpnemen');
    await page.waitForTimeout(900);
    assert.equal(await page.evaluate(() => RTGHorecaEdge.rij().length), 1,
      'de bestelling staat op het toestel');
    const strook = await page.evaluate(() => ({
      verborgen: !!document.getElementById('pEdgeStrook').hidden,
      tekst: document.getElementById('pEdgeStrook').textContent }));
    assert.equal(strook.verborgen, false, 'en dat staat luid op het scherm');
    assert.match(strook.tekst, /op dit toestel/, strook.tekst);

    const tussen = (await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen;
    assert.equal(tussen.find(x => x.tafel === 'EDGE-KOUD'), undefined,
      'bij de server staat nog niets');

    /* EEN NETWERKFOUT IS GEEN WEIGERING. Nog eens proberen terwijl de lijn weg
       is, laat de bestelling STAAN -- hij verhuist niet naar "vastgelopen".
       Zonder dat onderscheid gooit een storing van tien seconden het werk van
       een hele avond op de vastgelopen-stapel. */
    await page.evaluate(() => RTGHorecaEdge.leeg());
    await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => RTGHorecaEdge.rij().length), 1,
      'hij staat er nog steeds');
    assert.equal(await page.evaluate(() => RTGHorecaEdge.vastgelopen().length), 0,
      'en is niet vastgelopen: de lijn was weg, de server heeft niets gezegd');

    /* ---- 3. de lijn terug ---- */
    lijnDicht = false;
    await page.evaluate(() => RTGHorecaEdge.leeg());
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => RTGHorecaEdge.rij().length), 0, 'de rij is leeg');
    assert.equal(await page.evaluate(() => RTGHorecaEdge.vastgelopen().length), 0, 'en niets liep vast');

    const lijst = (await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen;
    const kort = lijst.find(x => x.tafel === 'EDGE-KOUD');
    assert.ok(kort, 'de bestelling staat nu bij de server');
    const vol = (await H('/api/supplier/horeca/rekening', { rekeningId: kort.id })).body.rekening;
    assert.equal(vol.gasten, 4);
    assert.equal(vol.regels.length, 1);
    assert.equal(vol.regels[0].stand, 'besteld', 'de keuken moet hem nog maken');
    assert.equal(vol.regels[0].allergie, 'schaaldieren', 'en de allergie is meegereisd');
    assert.equal(vol.regels[0].gang, 2);
    assert.ok(!vol.regels[0].vrijAt, 'er is niets vrijgegeven: dat blijft een tik van de zaal');

    /* ---- 4. het antwoord dat onderweg verdween ----
       Het verzoek gaat er WEL doorheen (route.fetch doet het echt), alleen het
       antwoord bereikt de pagina niet. Dat is de storing die een naieve rij
       laat verdubbelen. */
    let slikAntwoord = true;
    await page.unroute('**/api/supplier/horeca/offline/sync');
    await page.route('**/api/supplier/horeca/offline/sync', async (route) => {
      if (!slikAntwoord) return route.continue();
      await route.fetch();           // de server verwerkt hem echt
      return route.abort('failed');  // maar de PDA ziet een netwerkfout
    });

    await page.click('#pLokaal');
    await page.waitForTimeout(500);
    await page.fill('#lTafel', 'EDGE-LOST');
    await page.fill('#lGasten', '2');
    const knop2 = await page.$('#lKaart [data-litem]');
    await knop2.click();
    await page.waitForTimeout(300);
    await page.click('#lOpnemen');
    await page.waitForTimeout(900);
    assert.equal(await page.evaluate(() => RTGHorecaEdge.rij().length), 1,
      'de PDA denkt dat het misging en zet hem in de rij');
    const naVerlies = (await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen
      .filter(x => x.tafel === 'EDGE-LOST').length;
    assert.equal(naVerlies, 1, 'terwijl de server hem wel degelijk verwerkte');

    slikAntwoord = false;
    await page.evaluate(() => RTGHorecaEdge.leeg());
    await page.waitForTimeout(1200);
    assert.equal((await H('/api/supplier/horeca/rekeningen', { status: 'open' })).body.rekeningen
      .filter(x => x.tafel === 'EDGE-LOST').length, 1,
      'de herhaling levert GEEN tweede bestelling op');
    assert.equal(await page.evaluate(() => RTGHorecaEdge.rij().length), 0, 'en de rij is leeg');

    /* ---- 5. een betaalde bestelling gaat nooit de rij in ----
       De schermen bouwen er vandaag geen, maar neemOp is een deur die openstaat.
       Offline betalen raakt geld en een tweede weg waarlangs het beweegt; dat is
       een eigen besluit en geen bijvangst van het opnemen. */
    await page.unroute('**/api/supplier/horeca/offline/sync');
    await page.route('**/api/supplier/horeca/offline/sync', (route) => route.abort('failed'));
    const betaaldUit = await page.evaluate(() =>
      RTGHorecaEdge.neemOp({ clientId: 'edge-betaald', kanaal: 'bar', tafel: 'EDGE-PAID',
        betaald: true, wijze: 'contant', regels: [{ naam: 'Bier', centen: 500, aantal: 1 }] })
        .then(() => 'gewacht', (e) => 'geweigerd: ' + e.message));
    assert.match(betaaldUit, /geweigerd/, 'een betaalde bestelling wacht niet: ' + betaaldUit);
    assert.equal(await page.evaluate(() => RTGHorecaEdge.rij().length), 0, 'en de rij blijft leeg');

    assert.deepEqual(fouten, [], 'geen scriptfouten op de PDA');
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    if (child) try { child.kill('SIGKILL'); } catch (e) {}
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
