/* ============================================================================
   HET GEDEELDE SCHERM IN EEN ECHTE BROWSER.

   De serverkant is los nagemeten (test/spelprojectie.test.js): een scherm krijgt
   uitsluitend `zicht.publiek`, en bij 30 Seconden zit de kaart daar niet in.
   Wat daarmee nog niet vaststaat is of de PAGINA zich ook zo gedraagt -- en dat
   is precies het stuk dat nieuw geschreven is.

   Twee dingen worden hier afgelegd, en het tweede is de belangrijkste:

   1. De weg werkt: een speler opent een kamer, het scherm neemt de code aan en
      toont de stand van het potje. Zonder inlog, want dat is de hele opzet.
   2. DE KAART KOMT ER NIET OP -- en dat wordt op TWEE hoogten gemeten, want de
      eerste versie van deze toets keek alleen naar de DOM en dat bleek niets
      te bewijzen. `spelscherm.html` rendert `kaart` namelijk nergens, dus ook als
      de server hem wel zou meesturen bleef het beeld schoon: de mutatie "zet
      de kaart terug in zicht.publiek" liet deze toets gewoon slagen.

      Daarom nu ook DE LIJN: elk antwoord van /api/projectie/kijk wordt onderschept
      en nagelopen. Wat niet over de lijn gaat kan een scherm niet tonen, ook
      niet na een verbouwing van de pagina -- en dat is de belofte waarop 30
      Seconden op een televisie mag.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-scherm-e2e-'));

const raw = (base, pad, body, tok) => fetch(base + '/api' + pad, { method: 'POST',
  headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}),
  body: JSON.stringify(body || {}) });
const json = async (base, pad, body, tok) => (await raw(base, pad, body, tok)).json();

let teller = 0;
async function nieuwLid(base, naam) {
  const u = Date.now().toString().slice(-7) + (teller++) + Math.floor(Math.random() * 90 + 10);
  const r = await json(base, '/auth/register', { name: naam, email: 'sc' + u + '@x.nl', phone: '06' + u.slice(0, 8),
    password: 'geheim12345', geboortedatum: '1980-03-03', tier: 'rtg' });
  assert.ok(r.token, 'lid aangemeld: ' + JSON.stringify(r).slice(0, 160));
  return { tok: r.token, cn: r.state.user.codename };
}
// a en b bevriend maken via de zoeker, precies zoals de app het doet
async function bevriend(base, a, b) {
  await raw(base, '/member/connections', {}, a.tok);
  await raw(base, '/member/connections', {}, b.tok);
  const zoek = await json(base, '/member/find', { q: b.cn }, a.tok);
  const bKey = (zoek.results.find(r => r.codename === b.cn) || {}).key;
  assert.ok(bKey, 'de codenaam van ' + b.cn + ' is vindbaar');
  await raw(base, '/member/connect', { key: bKey }, a.tok);
  const vz = await json(base, '/member/connections', {}, b.tok);
  const verzoek = (vz.requests || [])[0];
  assert.ok(verzoek, 'het vriendschapsverzoek staat klaar');
  await raw(base, '/member/connect/respond', { key: verzoek.key, action: 'accept' }, b.tok);
}
const api = (base, token, actie, body) => json(base, '/member/spel/' + actie, body, token);

test('een potje 30 Seconden op het gedeelde scherm, zonder inlog en zonder de kaart',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const legacy = await fetch(base + '/api/projectie/DEADBEEF');
    assert.equal(legacy.status, 410, 'de oude 32-bits URL-deur blijft hard gesloten');
    assert.match(legacy.headers.get('cache-control') || '', /no-store/);

    /* Vier leden die elkaars vriend zijn: 30 Seconden speel je met twee teams
       van twee, en uitnodigen kan alleen binnen je kring. */
    const leden = [];
    for (const naam of ['Aster', 'Bries', 'Cirrus', 'Duin']) leden.push(await nieuwLid(base, naam));
    const t = leden.map(l => l.tok);
    for (let i = 1; i < 4; i++) await bevriend(base, leden[0], leden[i]);

    const nieuw = await api(base, t[0], 'nieuw', { soort: 'seconden', grootte: 4,
      codenamen: leden.slice(1).map(l => l.cn) });
    assert.ok(nieuw.id, 'het potje is aangemaakt: ' + JSON.stringify(nieuw).slice(0, 200));
    for (let i = 1; i < 4; i++) await api(base, t[i], 'antwoord', { id: nieuw.id, akkoord: true });
    // een kaart op tafel; pas dan valt er iets te verbergen
    await api(base, t[0], 'zet', { id: nieuw.id, zet: { actie: 'kaart' } });

    const staat = await api(base, t[0], 'staat', { id: nieuw.id });
    const kaart = staat.potje && staat.potje.staat && staat.potje.staat.kaart;
    assert.ok(kaart && kaart.length, 'de omschrijver ziet wel degelijk een kaart met woorden');

    const kamer = await api(base, t[0], 'projectie-open', {
      id: nieuw.id, idem: 'spelprojectie-e2e-' + 'a'.repeat(32)
    });
    assert.ok(kamer.code, 'de gastheer krijgt een code: ' + JSON.stringify(kamer).slice(0, 160));

    /* Het scherm heeft geen LEDENtoken. De eenmalige code uit het fragment
       wordt voor de eerste request uit de adresbalk gehaald en atomair
       ingewisseld voor een aparte schermsessie. */
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    /* Alles wat de projectie-ingang terugstuurt, ruw. De DOM zegt wat de pagina
       TOONT; dit zegt wat het scherm KRIJGT, en dat tweede is de eigenlijke
       belofte -- een pagina kan morgen anders tekenen. */
    const overDeLijn = [], projectieUrls = [];
    page.on('response', async (r) => {
      if (!/\/api\/projectie\/(koppel|kijk)$/.test(r.url())) return;
      projectieUrls.push(r.url());
      try { overDeLijn.push(await r.text()); } catch (e) { /* afgebroken antwoord */ }
    });

    const paginaAntwoord = await page.goto(base + '/apps/spelscherm.html#' + kamer.code,
      { waitUntil: 'domcontentloaded' });
    assert.equal(paginaAntwoord.headers()['referrer-policy'], 'no-referrer',
      'ook de HTTP-kop voorkomt dat een gedeeld scherm ooit een adres doorstuurt');
    await page.waitForFunction(() => /30 Seconden/.test(document.body.textContent || ''), null, { timeout: 15000 });

    const tekst = await page.evaluate(() => document.body.innerText);
    const html = await page.evaluate(() => document.body.innerHTML);
    const schermToken = await page.evaluate(() => sessionStorage.getItem('rtg_spelprojectie_sessie_v1'));
    assert.equal(new URL(page.url()).hash, '', 'de koppeling is voor de eerste request uit de URL gehaald');
    assert.match(schermToken, /^SCREEN\.[A-F0-9]{32}$/);
    assert.ok(!html.includes(kamer.code), 'de eenmalige koppeling blijft niet in de DOM staan');
    assert.ok(!html.includes(schermToken), 'de schermsessie komt niet in de DOM');
    for (const url of projectieUrls)
      assert.ok(!/[?&](code|token)=/i.test(url), 'geen credential reist in een URL');

    /* 1) de stand staat er: het spel en wie er raadt. Hoofdletterongevoelig,
          want de merkregel zet de kop in kapitalen (text-transform) en
          `innerText` geeft de GERENDERDE tekst terug. */
    assert.match(tekst, /30 seconden/i, 'het scherm noemt het spel');
    assert.match(tekst, /raadt/i, 'en wie er raadt');

    /* 2) DE KAART STAAT ER NIET. Elk woord van de kaart wordt apart nagelopen,
          in de zichtbare tekst EN in de ruwe HTML -- verborgen in een attribuut
          is net zo lek als zichtbaar in beeld. */
    assert.ok(overDeLijn.length, 'het scherm heeft de projectie-ingang ook echt bevraagd');
    const lijn = overDeLijn.join('\n');
    for (const woord of kaart) {
      assert.ok(!new RegExp(woord, 'i').test(tekst),
        'het woord "' + woord + '" van de kaart staat op het gedeelde scherm');
      assert.ok(!new RegExp(woord, 'i').test(html),
        'het woord "' + woord + '" van de kaart zit in de HTML van het gedeelde scherm');
      assert.ok(!new RegExp(woord, 'i').test(lijn),
        'het woord "' + woord + '" van de kaart gaat over de lijn naar het scherm');
    }

    assert.deepEqual(fouten, [], 'geen paginafouten op het scherm');
  } finally {
    if (browser) await browser.close().catch(() => {});
    child.kill();
    /* HET OPRUIMEN LIET DE TOETS ZAKKEN TERWIJL DE METING KLOPTE: ENOTEMPTY op
       /tmp/rtg-scherm-e2e-*. `child.kill()` stuurt een signaal en komt meteen
       terug; de server schrijft ondertussen zijn sqlite-journaal nog weg, en dan
       loopt rmSync tegen een map die zich tijdens het lopen weer vult. `force`
       helpt daar niet tegen -- dat gaat over een pad dat ER NIET IS.

       Zelfde reparatie als in geld.e2e.js en levenspas.e2e.js, die er eerder
       tegenaan liepen: een paar herhaalpogingen met een tel ertussen. Geen
       try/catch eromheen, want een map die ook na vijf pogingen niet leeg raakt
       is geen ruis maar iets dat blijft draaien. */
    fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
