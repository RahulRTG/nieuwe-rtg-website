/* Scherm-toets op het Mobility OS: leggen de twee schermen de weg werkelijk af?

   WAAROM DEZE TOETS BESTAAT

   test/mobiliteit.test.js bewijst dat de API klopt. Dat is precies wat het
   bewijst en niets meer -- niet dat de reizigersapp ook maar een regel JS
   uitvoert, en niet dat de dispatcher ooit een knop ziet. Dat gat heeft in dit
   huis al twee keer maandenlang opengestaan met alles op groen (zie
   test/blindevlek.test.js), en scripts/schermen.js telt precies de schermen
   waar geen enkele toets meer doet dan even langslopen. Twee nieuwe schermen
   toevoegen zonder deze toets zou die meter de verkeerde kant op duwen.

   WAT ER WORDT AFGELEGD, EN WAAROM JUIST DAT

   1. De REIZIGER boekt echt: bestemming kiezen uit onze eigen zaken, aanvragen,
      en daarna staat de lopende rit op het scherm. Dat laatste is de bewering
      die telt -- een app die de aanvraag wegstuurt en daarna niets toont, laat
      een mens op straat staan zonder te weten of er iets gebeurt.
   2. De DISPATCHER ziet die rit, met de REKENSOM van de matcher eronder. Dat is
      geen versiering: staat de uitleg er niet, dan gaat een planner handmatig
      toewijzen en is de motor een dure decoratie. Deze toets rekent daarom af
      op de factornamen in beeld, niet alleen op "er staat iets".
   3. Een afgewezen voertuig staat er MET zijn reden. Een lege kandidatenlijst
      zonder uitleg leest als een storing.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

const PAPIEREN_OK = { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
  taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' };

async function post(base, pad, body, token) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
    .then(r => r.json()).catch(() => ({}));
}

async function nieuwLid(base) {
  const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  const reg = await post(base, '/api/auth/register', { name: 'Reiziger', email: 'mb' + u + '@x.nl',
    phone: '06' + u.slice(0, 8), password: 'geheim123', geboortedatum: '1990-01-01',
    geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.token, 'het lid is aangemeld: ' + JSON.stringify(reg).slice(0, 160));
  return reg.token;
}

async function zaakToken(base) {
  const roster = await post(base, '/api/supplier/roster', { code: 'MKKX' });
  const m = (roster.staff || []).find(x => x.role === 'manager');
  assert.ok(m, 'de taxizaak heeft een manager');
  const login = await post(base, '/api/supplier/login', { code: 'MKKX', staffId: m.id, pin: '1234' });
  assert.ok(login.token, 'de manager logt in');
  return login.token;
}

async function open(base, url, sleutel, token) {
  const browser = await pw.chromium.launch(browserOpties(pw));
  const page = await browser.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  await page.goto(base + url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(([s, t]) => {
    localStorage.setItem(s, t);
    localStorage.setItem('rtg_cookieinfo_v1', '1');
  }, [sleutel, token]);
  await page.goto(base + url, { waitUntil: 'domcontentloaded' });
  return { browser, page, fouten };
}

test('de reizigersapp plant een reis, toont de opties en boekt er een',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const s = await open(base, '/apps/ov.html', 'rtg_member_token', token);
    browser = s.browser;
    const page = s.page;

    // de bestemmingen komen uit RTG zelf; de app vult ze bij het openen
    await page.waitForFunction(() => document.querySelector('#velNaar').options.length > 1,
      null, { timeout: 20000 });
    const opties = await page.$$eval('#velNaar option', els => els.map(e => e.textContent));
    assert.ok(opties.some(o => /restaurant|hotel|koffie|bar/i.test(o)),
      'de bestemmingslijst bevat onze eigen zaken, kreeg: ' + opties.slice(0, 5).join(' | '));

    /* Via de ZOEKBALK een bestemming ver weg kiezen. Dat is ook de echte weg:
       de eerste pagina van de lijst staat vol met wat vlakbij is, en juist wat
       je zoekt staat er dan niet in. Zonder zoeken pakte deze toets de zaak op
       nul meter afstand en kreeg hij terecht "vertrek en bestemming liggen op
       dezelfde plek". */
    await page.fill('#velZoek', 'Santa Eularia');
    await page.waitForFunction(() => {
      const els = [...document.querySelectorAll('#velNaar option')];
      return els.some(e => /Santa Eularia/i.test(e.textContent));
    }, null, { timeout: 20000 });
    const doel = await page.$$eval('#velNaar option', els =>
      (els.find(e => /Santa Eularia/i.test(e.textContent)) || {}).value || '');
    assert.ok(doel, 'zoeken vindt de bestemming');
    await page.selectOption('#velNaar', doel);
    await page.click('#velPlan');

    /* De bewering die telt: er verschijnen OPTIES met cijfers, niet een enkele
       knop. Dat is het verschil tussen een reisplanner en een bestelknop. */
    await page.waitForFunction(() => {
      const b = document.querySelector('#optieBlok');
      return b && !b.classList.contains('weg') && b.querySelectorAll('.kaart').length > 0;
    }, null, { timeout: 20000 });
    const kaarten = await page.$$eval('#opties .kaart', els => els.map(e => e.textContent));
    assert.ok(kaarten.length >= 1, 'er staat minstens een reisoptie op het scherm');
    assert.ok(kaarten.some(k => /min/.test(k) && /€/.test(k) && /CO₂/.test(k)),
      'elke optie toont tijd, prijs en uitstoot, kreeg: ' + kaarten[0].slice(0, 120));
    assert.ok(kaarten.some(k => /schatting/.test(k)),
      'en de uitstoot heet op het scherm een schatting, geen meting');

    // boeken: daarna staat de reis in beeld en is het formulier weg
    await page.click('#opties .kaart button.vol');
    await page.waitForFunction(() => {
      const k = document.querySelector('#lopendKaart');
      return k && !k.classList.contains('weg');
    }, null, { timeout: 20000 });
    assert.ok(await page.$eval('#boekBlok', el => el.classList.contains('weg')),
      'het planformulier is weg zodra er een reis loopt');
    const etappes = await page.$$eval('#lopendEtappes .rijtje', els => els.map(e => e.textContent));
    assert.ok(etappes.length >= 1, 'de etappes van de reis staan op het scherm');

    // en de server is het ermee eens
    const reizen = await post(base, '/api/mob/reis/mijn', {}, token);
    assert.ok((reizen.reizen || []).length, 'de server kent de geboekte reis ook');

    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('het OV-tabblad zegt eerlijk dat er geen kaartje te koop is, en verkoopt er wel een als het mag',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'KANTOOR-SCHERM-1' } });
  let browser;
  try {
    const token = await nieuwLid(base);
    const s = await open(base, '/apps/ov.html', 'rtg_member_token', token);
    browser = s.browser;
    const page = s.page;

    await page.evaluate(() => { document.querySelector('#tabOv').click(); });
    /* Zonder overeenkomst is er niets te koop, en dan MOET er een reden staan.
       Een leeg vak zonder uitleg leest als een storing. */
    await page.waitForFunction(() => {
      const el = document.querySelector('#kaartReden');
      return el && !/Even kijken/i.test(el.textContent) &&
        /Partnercontracten|overeenkomst|beschikbaar/i.test(el.textContent);
    }, null, { timeout: 20000 });
    const reden = await page.textContent('#kaartReden');
    assert.match(reden, /Partnercontracten|overeenkomst|beschikbaar/i,
      'het scherm legt uit waarom er niets te koop is, kreeg: ' + reden);
    assert.ok(await page.$eval('#kaartVorm', el => el.classList.contains('weg')),
      'en er staat geen koopknop bij iets dat niet te koop is');

    // nu het kantoor de module aanzet en een overeenkomst vastlegt
    const kantoor = (await post(base, '/api/office/login', { code: 'KANTOOR-SCHERM-1' })).token;
    assert.ok(kantoor, 'het kantoor logt in');
    for (const m of ['partner_contracts', 'public_transport_ticketing'])
      await post(base, '/api/office/mob/module/zet', { id: m, aan: true }, kantoor);
    const ok = await post(base, '/api/office/mob/overeenkomst', { vervoerder: 'TRANSIT',
      van: '2020-01-01', tot: '2099-12-31', producten: ['enkel'], lijnen: ['L1'],
      getekendDoor: 'J. Directeur' }, kantoor);
    assert.ok(ok.overeenkomst, 'de overeenkomst staat: ' + JSON.stringify(ok).slice(0, 120));

    /* De tab opnieuw openen zodat de app het aanbod verse ophaalt. Klikken gaat
       hier via de pagina zelf: de console van Rahul staat onderaan vast en kan
       de tabrij overlappen, en dat is geen fout in het scherm maar in de manier
       waarop de toets erop tikt. De handler is dezelfde. */
    await page.evaluate(() => { document.querySelector('#tabRit').click(); });
    await page.evaluate(() => { document.querySelector('#tabOv').click(); });
    await page.waitForFunction(() => {
      const v = document.querySelector('#kaartVorm');
      return v && !v.classList.contains('weg');
    }, null, { timeout: 20000 });

    await page.evaluate(() => { document.querySelector('#kaartKoop').click(); });
    await page.waitForFunction(() => {
      const l = document.querySelector('#kaartLijst');
      return l && /geldig/.test(l.textContent);
    }, null, { timeout: 20000 });
    const lijst = await page.textContent('#kaartLijst');
    assert.match(lijst, /Enkele reis/, 'het gekochte kaartje staat in de app');
    assert.match(lijst, /geldig/, 'en het is geldig');

    const mijn = await post(base, '/api/mob/kaart/mijn', {}, token);
    assert.ok((mijn.kaartjes || []).length, 'de server kent het kaartje ook');

    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

test('het dispatchscherm toont de openstaande rit met de rekensom van de matcher',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const lid = await nieuwLid(base);
    const zaak = await zaakToken(base);

    // een wagen die mag rijden, en een die dat niet mag: allebei moeten ze in beeld
    const goed = await post(base, '/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Wagen A',
      loc: { lat: 38.909, lng: 1.433 }, energieNiveau: 80, bestuurder: 'chauffeur-a',
      papieren: PAPIEREN_OK }, zaak);
    assert.equal(goed.asset && goed.asset.inzetbaar, true, 'Wagen A mag rijden');
    const fout = await post(base, '/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Wagen B',
      loc: { lat: 38.9091, lng: 1.4331 }, energieNiveau: 90, bestuurder: 'chauffeur-b',
      papieren: Object.assign({}, PAPIEREN_OK, { taxivergunning: '2020-01-01' }) }, zaak);
    assert.equal(fout.asset && fout.asset.inzetbaar, false, 'Wagen B heeft een verlopen vergunning');

    const rit = await post(base, '/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
      van: { lat: 38.908, lng: 1.432 }, naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, lid);
    assert.ok(rit.opdracht, 'de rit staat klaar: ' + JSON.stringify(rit).slice(0, 160));

    const s = await open(base, '/apps/dispatch.html', 'rtg_pda_token', zaak);
    browser = s.browser;
    const page = s.page;

    await page.waitForFunction(() => {
      const b = document.querySelector('#vBord');
      return b && !b.classList.contains('weg') && document.querySelectorAll('#lijstOpen .rij').length > 0;
    }, null, { timeout: 20000 });

    const open1 = await page.textContent('#lijstOpen');
    assert.match(open1, new RegExp(rit.opdracht.ref), 'de openstaande rit staat op het bord');

    /* De rekensom. Hier rekent deze toets bewust af op de FACTORNAMEN en niet op
       "er staat iets": een balkje zonder uitleg is precies het scherm dat een
       planner doet terugvallen op handmatig toewijzen. */
    await page.waitForFunction(() => document.querySelectorAll('#lijstOpen .balk').length > 0,
      null, { timeout: 20000 });
    const balken = await page.$$eval('#lijstOpen .balk', els => els.map(e => e.textContent));
    for (const factor of ['nabijheid', 'aankomsttijd', 'eerlijk'])
      assert.ok(balken.some(b => b.includes(factor)), 'de factor "' + factor + '" staat met zijn uitleg in beeld');

    // en het afgewezen voertuig staat er MET reden; niet stil weggelaten
    const uitleg = await page.$$eval('#lijstOpen .uitleg', els => els.map(e => e.textContent));
    assert.ok(uitleg.some(u => /Wagen B/.test(u) && /vergunning/.test(u)),
      'de afgewezen wagen staat erbij met zijn reden, kreeg: ' + uitleg.join(' | '));

    // de vloot toont beide wagens, met hun stand
    const vloot = await page.textContent('#lijstVloot');
    assert.match(vloot, /Wagen A/);
    assert.match(vloot, /Wagen B/);

    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

/* De QR-keten in beeld: het lid TOONT een vervoerbewijs als scanbare code, en
   de conducteur controleert hem op zijn eigen scherm. Dit is precies het stuk
   dat een API-toets niet kan zien -- daar is een code een string, hier moet er
   een leesbare QR staan en moet een tweede scherm er een oordeel over geven. */
test('het lid toont zijn kaartje als QR en de conducteur keurt hem op de PDA',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '', OFFICE_CODE: 'KANTOOR-QR-1' } });
  let browser;
  try {
    // kaartverkoop mogelijk maken en een kaartje kopen
    const token = await nieuwLid(base);
    const kantoor = (await post(base, '/api/office/login', { code: 'KANTOOR-QR-1' })).token;
    for (const m of ['partner_contracts', 'public_transport_ticketing'])
      await post(base, '/api/office/mob/module/zet', { id: m, aan: true }, kantoor);
    await post(base, '/api/office/mob/overeenkomst', { vervoerder: 'TRANSIT',
      van: '2020-01-01', tot: '2099-12-31', producten: ['enkel'], lijnen: ['L1'],
      getekendDoor: 'J. Directeur' }, kantoor);
    const koop = await post(base, '/api/mob/kaart/koop', { vervoerder: 'TRANSIT', lijnId: 'L1',
      van: 'h-stad', naar: 'h-tal', product: 'enkel', idem: 'qr1' }, token);
    assert.ok(koop.kaartje, 'het kaartje staat: ' + JSON.stringify(koop).slice(0, 140));

    const s = await open(base, '/apps/ov.html', 'rtg_member_token', token);
    browser = s.browser;
    const page = s.page;
    await page.evaluate(() => { document.querySelector('#tabOv').click(); });
    await page.waitForFunction(() => {
      const l = document.querySelector('#kaartLijst');
      return l && /geldig/.test(l.textContent);
    }, null, { timeout: 20000 });

    /* De toonknop moet een ECHTE afbeelding opleveren. Een leeg src-attribuut
       of een verborgen beeld betekent dat de reiziger niets te tonen heeft, en
       dan is de hele scanketen een dode letter. */
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#kaartLijst button')].find(x => x.textContent === 'Toon');
      if (b) b.click();
    });
    await page.waitForFunction(() => {
      const sc = document.querySelector('#qrScherm');
      return sc && sc.classList.contains('zien');
    }, null, { timeout: 20000 });
    const qr = await page.$eval('#qrBeeld', el => ({ src: el.src, verborgen: el.hidden, breed: el.naturalWidth }));
    assert.ok(qr.src.startsWith('data:image/png'), 'de QR is een echte afbeelding, kreeg: ' + qr.src.slice(0, 40));
    assert.equal(qr.verborgen, false, 'en hij staat in beeld');
    assert.ok(qr.breed > 40, 'met een leesbaar formaat (' + qr.breed + 'px)');
    // de code staat er ook als tekst bij: zonder camera moet het nog kunnen
    const tekst = await page.textContent('#qrCode');
    assert.equal(tekst, koop.kaartje.code, 'de code staat er in leesbare tekens onder');

    /* En dan de andere kant: de conducteur op de dienst-PDA. Hij tikt dezelfde
       code in en krijgt een oordeel -- met het bewijs erbij en niet de persoon. */
    const roster = await post(base, '/api/supplier/roster', { code: 'TRANSIT' });
    const ch = (roster.staff || []).find(x => x.role !== 'manager');
    const pda = (await post(base, '/api/supplier/login', { code: 'TRANSIT', staffId: ch.id, pin: '5678' })).token;
    assert.ok(pda, 'de chauffeur logt in op de PDA');
    /* Eerst een dienst starten. Het controleblok zit in de LOPENDE dienst, en
       dat is geen toevalligheid van de opmaak: je controleert kaartjes terwijl
       je rijdt, en de lijn waarop je rijdt bepaalt of een kaartje hier geldt. */
    const dienst = await post(base, '/api/staff/ov/dienst', { lijnId: 'L1', voertuigNaam: 'Bus 4' }, pda);
    assert.ok(!dienst.error, 'de dienst loopt: ' + JSON.stringify(dienst).slice(0, 120));

    const d = await open(base, '/apps/ovdienst.html', 'rtg_pda_token', pda);
    const pg = d.page;
    try {
      await pg.waitForFunction(() => {
        const v = document.querySelector('#bewijsVeld');
        return v && v.offsetParent !== null;
      }, null, { timeout: 20000 });
      await pg.fill('#bewijsVeld', koop.kaartje.code);
      await pg.evaluate(() => { document.querySelector('#bewijsForm').requestSubmit(); });
      await pg.waitForFunction(() => {
        const u = document.querySelector('#bewijsUit');
        return u && !u.classList.contains('weg') && /Geldig|Niet geldig/.test(u.textContent);
      }, null, { timeout: 20000 });
      const uit = await pg.textContent('#bewijsUit');
      assert.match(uit, /^Geldig/, 'de conducteur ziet dat het bewijs deugt, kreeg: ' + uit.slice(0, 120));
      assert.match(uit, /Kustlijn 1/, 'met de lijn erbij');
      assert.ok(!/@/.test(uit), 'en geen e-mailadres: hij controleert een kaartje, geen persoon');

      // een tweede keer is het enkeltje op, en dat zegt hij ook
      await pg.fill('#bewijsVeld', koop.kaartje.code);
      await pg.evaluate(() => { document.querySelector('#bewijsForm').requestSubmit(); });
      await pg.waitForFunction(() => /Niet geldig/.test(document.querySelector('#bewijsUit').textContent),
        null, { timeout: 20000 });
      assert.match(await pg.textContent('#bewijsUit'), /gebruikt/,
        'en hij zegt waarom niet: het enkeltje was op');

      assert.deepEqual(d.fouten, [], 'paginafouten op de PDA: ' + d.fouten.join(' | '));
    } finally { await d.browser.close(); }

    assert.deepEqual(s.fouten, [], 'paginafouten in de leden-app: ' + s.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

/* De werkgeverskant op het scherm. Waarom dit een EIGEN toets is: de API-toets
   (test/zakelijkvervoer.test.js) bewijst dat een rit boven de drempel wacht en
   dat een besluit hem loslaat. Wat hij NIET bewijst is dat er ooit een mens bij
   kan -- en een goedkeuring die alleen via curl te geven is, betekent dat de
   rit blijft liggen tot de medewerker belt. Dat is precies de situatie die een
   drempel had moeten voorkomen. */
test('de werkgever zet zijn beleid, ziet de aanvraag en geeft akkoord',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    // een lid dat ECHT bij het hotel werkt: uitnodiging + aanmelden met eigen account
    const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
    const mail = 'zw' + u + '@x.nl';
    const reg = await post(base, '/api/auth/register', { name: 'Medewerker', email: mail,
      phone: '06' + u.slice(0, 8), password: 'geheim123', geboortedatum: '1990-01-01',
      geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
    assert.ok(reg.token, 'het lid is aangemeld');

    const roster = await post(base, '/api/supplier/roster', { code: 'HOSHI' });
    const m = (roster.staff || []).find(x => x.role === 'manager');
    const baas = (await post(base, '/api/supplier/login', { code: 'HOSHI', staffId: m.id, pin: '1234' })).token;
    assert.ok(baas, 'de manager van het hotel logt in');
    const inv = await post(base, '/api/supplier/staff/invite', { name: 'Nora Vermeer', role: 'staff' }, baas);
    const join = await post(base, '/api/supplier/staff/join', { bedrijf: 'Aguamarina Ibiza',
      kassacode: inv.invite.kassacode, login: mail, password: 'geheim123' });
    assert.ok(join.ok, 'de medewerker is in dienst: ' + JSON.stringify(join).slice(0, 120));

    const s = await open(base, '/apps/zakelijk.html', 'rtg_pda_token', baas);
    browser = s.browser;
    const page = s.page;

    // het beleid op het scherm zetten: een drempel van vijf euro
    await page.evaluate(() => { document.querySelector('#tabs button[data-tab="beleid"]').click(); });
    await page.waitForFunction(() => !document.querySelector('#tBeleid').classList.contains('weg'),
      null, { timeout: 20000 });
    await page.fill('#bDrempel', '5');
    await page.evaluate(() => { document.querySelector('#bBewaar').click(); });
    /* De spiegel is de bewering die telt: de werkgever ziet in dezelfde
       beweging welke ZIN zijn medewerker straks leest. */
    await page.waitForFunction(() => /drempel|gaat de rit eerst langs u/i.test(
      document.querySelector('#beleidSpiegel').textContent), null, { timeout: 20000 });
    const spiegel = await page.textContent('#beleidSpiegel');
    assert.match(spiegel, /wordt niet geweigerd/, 'de spiegel zegt dat een drempel geen verbod is, kreeg: ' + spiegel.slice(0, 140));
    await page.waitForFunction(() => /Laatst gewijzigd/.test(document.querySelector('#bStand').textContent),
      null, { timeout: 20000 });

    /* Een gekozen dag moet je ZIEN, en dat is niet hetzelfde als een class die
       er staat: de huisregel `.aan` hangt aan `.tabs > button` en deed buiten
       die rij niets. Er stonden zeven identieke pillen boven een beleid dat op
       werkdagen stond. Deze toets rekent daarom af op de KLEUR. */
    /* Niet aannemen welke dagen het geladen beleid al aan heeft staan. Zet via
       de echte knoppen zondag bewust aan en zaterdag bewust uit. */
    await page.evaluate(() => {
      let knoppen = [...document.querySelectorAll('#bDagen button')];
      if (knoppen[0].getAttribute('aria-pressed') !== 'true') knoppen[0].click();
      knoppen = [...document.querySelectorAll('#bDagen button')];
      if (knoppen[6].getAttribute('aria-pressed') !== 'false') knoppen[6].click();
    });
    await page.waitForFunction(() => {
      const knoppen = [...document.querySelectorAll('#bDagen button')];
      return knoppen.length === 7 && knoppen[0].getAttribute('aria-pressed') === 'true' &&
        knoppen[6].getAttribute('aria-pressed') === 'false';
    }, null, { timeout: 20000 });
    const dagKleur = await page.evaluate(() => {
      const knoppen = [...document.querySelectorAll('#bDagen button')];
      const kleur = b => getComputedStyle(b).backgroundColor;
      return { aan: kleur(knoppen[0]), uit: kleur(knoppen[6]) };
    });
    assert.notEqual(dagKleur.aan, dagKleur.uit,
      'de gekozen dag ziet er anders uit dan een niet-gekozen dag, kreeg: ' + JSON.stringify(dagKleur));

    // en de naam van het bedrijf staat in beeld, niet zijn partnercode
    assert.match(await page.textContent('#zaakNaam'), /Aguamarina/,
      'de werkgever ziet zijn eigen naam, geen code');

    // de medewerker vraagt een rit op rekening van het hotel
    const rit = await post(base, '/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
      van: { lat: 38.908, lng: 1.432, label: 'Hotel' }, naar: { lat: 38.978, lng: 1.536, label: 'Luchthaven' },
      stad: 'Ibiza', namensOrganisatie: 'HOSHI', betaler: 'organisatie' }, reg.token);
    assert.equal(rit.opdracht.goedkeuring.status, 'wacht', 'de rit wacht op akkoord');

    // en die staat op het scherm van de werkgever, met de naam die hij kent
    await page.evaluate(() => { document.querySelector('#tabs button[data-tab="akkoord"]').click(); });
    await page.waitForFunction(() => /Nora Vermeer/.test(document.querySelector('#lijstWacht').textContent),
      null, { timeout: 20000 });
    const wacht = await page.textContent('#lijstWacht');
    assert.match(wacht, /Luchthaven/, 'met de bestemming erbij');
    assert.match(wacht, /€/, 'en het bedrag waar het om gaat, kreeg: ' + wacht.slice(0, 140));

    await page.evaluate(() => {
      const knop = [...document.querySelectorAll('#lijstWacht button')].find(b => b.textContent === 'Akkoord');
      knop.click();
    });
    await page.waitForFunction(() => /wacht niets|Er wacht niets/.test(
      document.querySelector('#lijstWacht').textContent), null, { timeout: 20000 });

    // de server is het ermee eens, en de rit is nu wel te zien op een planbord
    const mijn = await post(base, '/api/mob/mijn', {}, reg.token);
    assert.equal(mijn.lopend.goedkeuring.status, 'akkoord', 'de rit is goedgekeurd');
    const taxi = await zaakToken(base);
    const bord = await post(base, '/api/supplier/mob/dispatch', {}, taxi);
    assert.ok((bord.open || []).some(o => o.ref === rit.opdracht.ref),
      'en pas nu ligt hij op de markt van de vervoerder');

    assert.deepEqual(s.fouten, [], 'paginafouten: ' + s.fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});
