/* DE HELE KETEN IN EEN BROWSER: het reisbureau zet een reis klaar, een vreemde
   opent de link, wordt lid, en heeft zijn reis.

   WAAROM DIT ALS SCHERMTOETS BESTAAT. De serverkant staat in
   test/reisuitnodiging.test.js. Wat daar niet te zien is, is of de keten ook
   echt aan elkaar zit: of het kantoorscherm een link produceert die WERKT, en
   of de publieke pagina iemand zonder account binnenlaat zonder onderweg te
   veel te laten zien. Dat is precies de plek waar zo'n keten stukgaat -- en het
   valt niemand op, want alle losse delen doen het.

   DRIE BEWERINGEN, en alle drie kunnen ze zakken:
   1. het kantoorscherm levert een link die de publieke pagina begrijpt;
   2. die pagina toont waar en wanneer, en NIET de titels of kenmerken;
   3. wie zich daar aanmeldt, heeft daarna de reis in zijn eigen overzicht.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, kantoorAlsPersoon, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const dag = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

test('van kantoorbalie naar een nieuw lid: de link doet wat hij belooft',
  { skip: geenBrowser(pw) }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-uitnod-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'KANTOOR-REIS-1' } });
  let browser;
  const post = (pad, body, token) => fetch(srv.base + pad, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {})
  }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  try {
    const kantoor = await kantoorAlsPersoon(srv.base);
    assert.ok(kantoor, 'de eigenaar staat als persoon in de backoffice');

    browser = await pw.chromium.launch(browserOpties());

    /* ---- 1. het kantoor zet een reis klaar ---- */
    const kctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
    await kctx.addInitScript((tok) => { try { localStorage.setItem('rtg_office_token', tok); } catch (e) {} }, kantoor);
    const kpage = await kctx.newPage();
    const kfouten = [];
    letOpFouten(kpage, kfouten);
    await kpage.goto(srv.base + '/apps/kantoren.html?kamer=reisbureau', { waitUntil: 'domcontentloaded' });
    await kpage.waitForSelector('#kKlaarLees', { timeout: 20000 });

    await kpage.fill('#kKlaarTekst', 'Casa Ibiza, check-in ' + dag(40) + ', check-out ' + dag(45) + '. Boekingsnummer: QQ1234');
    await kpage.click('#kKlaarLees');
    await kpage.waitForFunction(() => {
      const el = document.querySelector('#kKlaarGelezen');
      return el && /gelezen uit/i.test(el.textContent);
    }, null, { timeout: 20000 });

    let link = null;
    await t.test('het kantoorscherm leest voor en levert een link', async () => {
      assert.equal(await kpage.inputValue('#kKlaarPlaats'), 'Ibiza', 'de bestemming is voorgelezen');
      assert.equal(await kpage.inputValue('#kKlaarVan'), dag(40), 'en de aankomstdatum ook');
      assert.equal(await kpage.inputValue('#kKlaarTitel'), 'QQ1234',
        'de naam komt uit het boekingsnummer: een tekst zegt zelf niet welke regel de naam is');
      /* De medewerker geeft het onderdeel zijn naam. Dat is geen omissie in de
         lezer maar een grens ervan: welke regel in een e-mail de naam van het
         hotel is, valt niet af te leiden zonder te gokken. */
      await kpage.fill('#kKlaarTitel', 'Casa Ibiza');
      await kpage.click('#kKlaarErbij');
      await kpage.waitForFunction(() => /Casa Ibiza/.test(document.querySelector('#kKlaarLijst').innerText), null, { timeout: 10000 });
      await kpage.click('#kKlaarZet');
      await kpage.waitForSelector('#kKlaarUit input', { timeout: 20000 });
      link = await kpage.inputValue('#kKlaarUit input');
      assert.match(link, /\/apps\/reisuitnodiging\.html\?code=[0-9a-f]{32}$/, 'een link met een echte sleutel: ' + link);
    });

    /* ---- 2. een vreemde opent hem, zonder account ---- */
    const gctx = await browser.newContext({ viewport: { width: 900, height: 1200 } });
    const gpage = await gctx.newPage();
    const gfouten = [];
    letOpFouten(gpage, gfouten);
    await gpage.goto(link, { waitUntil: 'domcontentloaded' });
    await gpage.waitForSelector('#rGo', { timeout: 20000 });

    await t.test('de pagina toont waar en wanneer, en niet wat er geboekt is', async () => {
      const tekst = await gpage.$eval('#vak', el => el.innerText);
      assert.match(tekst, /Ibiza/, 'de bestemming staat er: ' + tekst.slice(0, 200));
      assert.match(tekst, new RegExp(dag(40)), 'de periode ook');
      assert.match(tekst, /RTG-reisbureau/, 'en van wie hij komt');
      assert.doesNotMatch(tekst, /Casa Ibiza/, 'de titel van het onderdeel niet');
      assert.doesNotMatch(tekst, /QQ1234/, 'en het boekingsnummer al helemaal niet');
    });

    await t.test('wie zich aanmeldt, heeft daarna zijn reis', async () => {
      const u = Date.now().toString().slice(-8);
      await gpage.fill('#rNaam', 'Nieuwe Klant');
      await gpage.fill('#rMail', 'nk' + u + '@x.nl');
      await gpage.fill('#rTel', '06' + u);
      await gpage.fill('#rGeb', '1990-01-01');
      await gpage.fill('#rWw', 'geheim123');
      await gpage.click('#rGo');
      await gpage.waitForFunction(() => /Welkom bij RTG/i.test(document.querySelector('#vak').innerText),
        null, { timeout: 30000 });

      // niet alleen op het scherm: ook echt in zijn eigen reisoverzicht
      const tok = await gpage.evaluate(() => localStorage.getItem('rtg_member_token'));
      assert.ok(tok, 'hij heeft nu een sessie');
      const r = await post('/api/reis/reizen', {}, tok);
      assert.equal(r.body.reizen.length, 1);
      assert.equal(r.body.reizen[0].bestemming, 'Ibiza');
      assert.equal(r.body.reizen[0].onderdelen[0].titel, 'Casa Ibiza',
        'nu ziet hij wel wat er geboekt is -- het is zijn eigen reis geworden');

      // en de link is op
      const nog = await post('/api/reis/uitnodiging/open', { code: link.split('code=')[1] }, null);
      assert.equal(nog.body.uitnodiging.open, false);
    });

    assert.deepEqual(kfouten, [], 'geen scriptfouten op het kantoorscherm');
    assert.deepEqual(gfouten, [], 'geen scriptfouten op de uitnodigingspagina');
  } finally {
    if (browser) await browser.close().catch(() => {});
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
