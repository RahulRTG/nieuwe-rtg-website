/* Scherm-test voor het RTF Living Lab: het kantoorscherm (/apps/livinglab.html)
   en het bewonersscherm (/apps/labpas.html).

   WAAROM DEZE TOETS ER IS. De servertoetsen in test/livinglab.test.js bewijzen
   dat de poorten kloppen -- niet dat de pagina die ze gebruikt ook maar één
   regel JS uitvoert. Bij het bouwen van deze twee schermen zijn er precies daar
   drie fouten gevonden die geen enkele servertoets ooit had gezien:

   1. een generator liet een losse `\n` in drie scriptbestanden achter, waardoor
      ze niet parsten (keuringsregel 12 kijkt alleen naar INLINE scripts);
   2. RTGiOS.blad() geeft `{ sluit, element }` terug en geen DOM-knoop, dus het
      dossier ging stil niet open -- de fout werd door een .catch een toast;
   3. datzelfde blad zet een STRING met textContent neer, waardoor het hele
      dossier als platte tekst met &lt;div&gt; in beeld kwam. Zichtbaar fout,
      zonder één foutmelding.

   Alle drie gaven groen licht op de server. Vandaar dat deze toets de schermen
   ECHT bedient, en niet alleen kijkt of ze laden.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

function laadBrowser() {
  for (const p of [undefined, '/opt/node22/lib/node_modules', '/usr/lib/node_modules', '/usr/local/lib/node_modules']) {
    try { return require(p ? require.resolve('playwright', { paths: [p] }) : 'playwright'); } catch (e) { /* volgende */ }
  }
  try { const eigen = require('../server/lib/browser'); if (eigen.beschikbaar()) return eigen; } catch (e) { /* geen browser */ }
  return null;
}
const pw = laadBrowser();

const api = async (base, pad, body, token) => (await fetch(base + pad, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {})
})).json();

test('Living Lab: de onderzoekscyclus op het scherm, en de bewoner zonder account',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-livinglab-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'LIVINGLAB-E2E-1' } });
  const base = srv.base;
  let browser;
  try {
    const login = await api(base, '/api/office/login', { code: 'LIVINGLAB-E2E-1' });
    assert.ok(login.token, 'het kantoor logt in');
    const lab = await api(base, '/api/lab2/lab/maak', { stad: 'Toetsstad', naam: 'Living Lab Toetsstad' }, login.token);
    assert.ok(lab.lab, 'er is een lab');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });

    /* ---------- het kantoorscherm ---------- */
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    // eerst uitgelogd: de deur hoort in beeld te komen, niet een lege pagina
    await page.goto(base + '/apps/livinglab.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(400);
    assert.match(await page.textContent('#main'), /inlog|aanmeld|personeel|kantoor/i,
      'zonder kantoorsessie staat de deur op de app zelf');

    await page.evaluate((tok) => {
      localStorage.setItem('rtg_office_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, login.token);
    await page.goto(base + '/apps/livinglab.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);

    /* De pagina wordt door shared/deelmenu.js een menu met EEN deel tegelijk;
       een gebruiker klikt eerst een deel open, dus deze toets doet dat ook. */
    await page.evaluate(() => window.RTGDeel && RTGDeel.open('nieuw-onderzoek'));
    await page.waitForTimeout(300);

    // de twaalf projectsoorten komen van de server en worden niet in het scherm
    // nagebouwd; staan ze er niet, dan is de kader-route stuk
    assert.equal(await page.locator('#nSoort option').count(), 12, 'twaalf projectsoorten uit het kader');
    assert.ok((await page.locator('#labKies option').count()) > 0, 'het lab staat in de keuzelijst');

    await page.fill('#nTitel', 'Water op straat bij zware regen');
    await page.fill('#nVraag', 'Kan deze straat tijdens zware regen beter omgaan met water?');
    await page.selectOption('#nSoort', 'leefomgeving');
    await page.click('#nMaak');
    await page.waitForTimeout(1500);

    // het dossier opent als blad, met de uitdaging en de route van tien stappen
    assert.ok((await page.locator('.uitdaging').count()) > 0, 'het dossier opent met de uitdaging in beeld');
    assert.ok((await page.locator('.ios-blad .route .stap').count()) >= 10 ||
      (await page.locator('.route .stap').count()) >= 10, 'de route van tien stappen staat er');
    assert.match(await page.textContent('body'), /Volgende stap/i, 'het scherm zegt wat de volgende stap is');

    /* De hypothese ZONDER tegendeel: de server weigert, en het scherm hoort dus
       gewoon te blijven staan met het veld erin. Dit is de kant die bewijst dat
       de poort ook in de browser echt bijt. */
    await page.fill('[data-hyp]', 'Doorlatende bestrating verlaagt de plasvorming.');
    await page.click('[data-hypzet]');
    await page.waitForTimeout(900);
    assert.ok((await page.locator('[data-hyp]').count()) > 0,
      'zonder tegendeel blijft het hypotheseveld staan: de poort bijt ook hier');

    await page.fill('[data-hyp]', 'Doorlatende bestrating verlaagt de plasvorming.');
    await page.fill('[data-hypteg]', 'Als de plasduur na de ingreep gelijk blijft.');
    await page.click('[data-hypzet]');
    await page.waitForTimeout(1400);

    // de cyclus schuift niet vanzelf op; de stap is een eigen handeling
    assert.ok((await page.locator('[data-stap]').count()) > 0, 'de stapknop staat klaar');
    await page.click('[data-stap]');
    await page.waitForTimeout(1400);
    assert.ok((await page.locator('[data-m]').count()) > 0, 'na de stap staat de methodenkeuze er');

    /* Het methode-advies rekent live mee, uit DEZELFDE regel als de poort. Een
       enquête vraagt dertig deelnemers; staat dat er niet, dan rekent het scherm
       iets anders uit dan de server straks eist. */
    await page.locator('[data-m][value="enquete"]').check();
    await page.waitForTimeout(800);
    assert.match(await page.textContent('[data-advies]'), /30/,
      'het advies noemt de ondergrens die de server straks ook eist');

    /* ---------- het bewonersscherm ---------- */
    const bew = await browser.newPage();
    const bewFouten = [];
    letOpFouten(bew, bewFouten);
    await bew.goto(base + '/apps/labpas.html', { waitUntil: 'domcontentloaded' });
    await bew.waitForTimeout(800);

    /* Ook dit scherm is een menu met één deel tegelijk (shared/deelmenu.js),
       dus openen wat je nodig hebt -- net als een bewoner zou doen. */
    const bewDeel = async (n) => { await bew.evaluate(x => window.RTGDeel && RTGDeel.open(x), n); await bew.waitForTimeout(350); };

    await bewDeel('vragen-uit-de-buurt');
    assert.ok((await bew.locator('#bLab option').count()) > 0, 'de bewoner ziet welke labs er zijn');
    await bew.fill('#bVraag', 'Kan de speeltuin veiliger tijdens het spitsuur?');
    await bew.click('#bStuur');
    await bew.waitForTimeout(900);
    assert.match(await bew.textContent('#bLijst'), /speeltuin/i,
      'een bewoner draagt een onderzoeksvraag aan zonder account');

    /* Het publieke onderzoeksoverzicht: de BUITENSTE ring. De studie die deze
       toets hierboven aanmaakte staat erin, met haar vraag -- want die is niet
       gescheiden. Deelnemers en ruwe data horen er juist NIET in te staan. */
    await bewDeel('wat-er-in-dit-lab-onderzocht-wordt');
    await bew.waitForTimeout(600);
    const publiek = await bew.textContent('#oLijst');
    assert.match(publiek, /Water op straat/i, 'de bewoner ziet waar het lab aan werkt');
    assert.ok(!/BW-/.test(publiek), 'maar geen deelnemers: dat is de buitenste ring');

    // het labpaspoort: aanmaken levert een code die de drager zelf houdt
    await bewDeel('uw-labpaspoort');
    await bew.fill('#paspNaam', 'Sam');
    await bew.click('#paspMaak');
    await bew.waitForTimeout(900);
    assert.match(await bew.textContent('#pasp'), /LABPAS-/, 'het labpaspoort krijgt een eigen code');

    // een onbekende pas geeft een nette melding en geen stilte
    await bewDeel('uw-labpas');
    await bew.fill('#pasVeld', 'LABPAS-ZZZZZZZ');
    await bew.click('#pasOpen');
    await bew.waitForTimeout(600);
    assert.match(await bew.textContent('#pasFout'), /labpas/i, 'een onbekende pas zegt dat hij onbekend is');

    /* De JS-fouten. De 400/404 die de browser logt zijn ONZE eigen geweigerde
       verzoeken (de hypothese zonder tegendeel, de onbekende pas) en horen er
       dus te zijn; een echte pageerror hoort er niet te zijn. */
    const echt = fouten.concat(bewFouten).filter(f => !/Failed to load resource/i.test(String(f)));
    assert.deepEqual(echt, [], 'geen JS-fouten op de twee schermen');
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* DE HELE CYCLUS, UITSLUITEND VIA HET SCHERM.

   Deze toets bestaat om één reden, en het is de belangrijkste bevinding van de
   hele ronde: de server kon alles, en de APP liep dood bij stap vier. De poort
   naar `deelnemers` noemde vijf dingen die moesten gebeuren -- risicoklasse,
   review, privacytoets, toestemming, stopcriterium -- en er stond geen enkel
   bedieningselement in het scherm om ook maar één daarvan te doen. Achtenveertig
   van de zevenenzeventig endpoints waren onbereikbaar.

   Servertoetsen zien dat niet: die roepen de endpoints rechtstreeks aan. Deze
   toets doet ALLES met de muis en het toetsenbord, van het lege lab tot de
   pilot die eruit rolt. Zakt hij, dan is er ergens weer een knop verdwenen. */
test('Living Lab: een mens loopt de hele cyclus af in de app zelf',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-livinglab-heel-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'LIVINGLAB-E2E-2' } });
  const base = srv.base;
  let browser;
  try {
    const login = await api(base, '/api/office/login', { code: 'LIVINGLAB-E2E-2' });
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    page.on('dialog', d => d.accept('Toetsstad'));

    await page.goto(base + '/apps/livinglab.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok) => {
      localStorage.setItem('rtg_office_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, login.token);
    await page.goto(base + '/apps/livinglab.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(900);

    const deel = async (n) => { await page.evaluate(x => window.RTGDeel && RTGDeel.open(x), n); await page.waitForTimeout(350); };
    const blad = () => page.locator('.ios-blad');
    const stap = async () => { await page.click('.ios-blad [data-stap]'); await page.waitForTimeout(1300); };

    // 1. een lab, en de tekenbevoegden -- zonder die twee kan er niets getekend worden
    await page.click('#labNieuw');
    await page.waitForTimeout(1400);
    await deel('labbeheer');
    for (const [naam, rol, onaf] of [['Dr. Vermeer', 'professional', false], ['Prof. Aziz', 'reviewer', true], ['M. de Wit', 'toezichthouder', false]]) {
      await page.fill('#beheer [data-tknaam]', naam);
      await page.selectOption('#beheer [data-tkrol]', rol);
      if (onaf) await page.locator('#beheer [data-tkonaf]').check();
      await page.click('#beheer [data-tkbij]');
      await page.waitForTimeout(800);
    }
    assert.equal(await page.locator('#beheer [data-tk]').count(), 3, 'drie tekenbevoegden via het scherm');

    // 2. een sociaal onderzoek: het onderwerp tilt de risicoklasse vanzelf omhoog
    await deel('nieuw-onderzoek');
    await page.fill('#nTitel', 'Buurttuin en eenzaamheid');
    await page.fill('#nVraag', 'Vermindert een gezamenlijke buurttuin de eenzaamheid in de Kerkstraat?');
    await page.selectOption('#nSoort', 'cohesie');
    await page.click('#nMaak');
    await page.waitForTimeout(1500);

    await page.fill('.ios-blad [data-hyp]', 'Wekelijks samen tuinieren verlaagt de ervaren eenzaamheid.');
    await page.fill('.ios-blad [data-hypteg]', 'Als de score na drie maanden gelijk blijft aan de vergelijkingsstraat.');
    await page.click('.ios-blad [data-hypzet]');
    await page.waitForTimeout(1300);
    await stap();
    await page.locator('.ios-blad [data-m][value="enquete"]').check();
    await page.waitForTimeout(700);
    await page.fill('.ios-blad [data-doel]', 'De eenzaamheidsscore voor en na drie maanden vergelijken');
    await page.click('.ios-blad [data-planzet]');
    await page.waitForTimeout(1400);
    await stap();

    /* 3. DE ETHIEK -- hier liep de app dood. Alle vijf de waarborgen worden nu
       met de knoppen in het blad gezet; de klasse-keuzelijst staat daarbij op de
       HUIDIGE klasse, want anders is één klik een poging tot verlagen. */
    assert.ok(await blad().locator('[data-eklassezet]').count(), 'het ethiekblok staat in het dossier');
    await page.click('.ios-blad [data-eklassezet]');
    await page.waitForTimeout(1200);
    await page.selectOption('.ios-blad [data-eroordeel]', 'akkoord');
    await page.click('.ios-blad [data-erzet]');
    await page.waitForTimeout(1200);
    await page.fill('.ios-blad [data-pvelden]', 'leeftijdsgroep, eenzaamheidsscore');
    await page.fill('.ios-blad [data-pgrond]', 'Toestemming van de deelnemer zelf');
    await page.fill('.ios-blad [data-pweg]', 'Geen naam, geen adres, geen inkomen');
    await page.click('.ios-blad [data-pzet]');
    await page.waitForTimeout(1200);
    await page.selectOption('.ios-blad [data-tregime]', 'schriftelijk');
    await page.fill('.ios-blad [data-ttekst]', 'U doet mee aan een onderzoek naar samen tuinieren. U kunt altijd stoppen.');
    await page.click('.ios-blad [data-tzet]');
    await page.waitForTimeout(1200);
    await page.fill('.ios-blad [data-sctekst]', 'Bij een deelnemer die zich slechter voelt door deelname stoppen we direct.');
    await page.click('.ios-blad [data-sczet]');
    await page.waitForTimeout(1200);

    const naEthiek = await blad().innerText();
    assert.ok(!/Hiervoor moet nog/.test(naEthiek),
      'na de vijf waarborgen blokkeert de poort niet meer -- dit was het dode spoor:\n' + naEthiek.slice(0, 400));
    await stap();

    // 4. deelnemers: het plan vraagt er dertig, en de labpas komt in beeld
    assert.ok(await blad().locator('[data-mbij]').count(), 'het deelnemersblok staat er');
    for (let i = 0; i < 30; i++) { await page.click('.ios-blad [data-mbij]'); await page.waitForTimeout(200); }
    await page.waitForTimeout(600);
    assert.match(await blad().locator('[data-mnieuw] h2').innerText(), /^LABPAS-/,
      'de labpas van de laatste deelnemer staat groot in beeld');

    await page.click('.ios-blad [data-dicht]');
    await page.waitForTimeout(400);
    await deel('onderzoeken');
    await page.locator('[data-open]').first().click();
    await page.waitForTimeout(1400);
    await stap();  // experiment
    await stap();  // observaties

    // 5. materiaal verzamelen
    await page.fill('.ios-blad [data-obs]', 'Nulmeting: gemiddelde eenzaamheidsscore 6,4');
    await page.selectOption('.ios-blad [data-obsm]', 'enquete');
    await page.click('.ios-blad [data-obszet]');
    await page.waitForTimeout(1200);
    await page.fill('.ios-blad [data-dsnaam]', 'Eenzaamheidsscores meetmoment 1 en 2');
    await page.fill('.ios-blad [data-dsrijen]', '60');
    await page.click('.ios-blad [data-dszet]');
    await page.waitForTimeout(1200);
    await stap();  // reflectie
    await page.selectOption('.ios-blad [data-rs]', 'misging');
    await page.fill('.ios-blad [data-rt]', 'Meetmoment 2 viel in de vakantie; acht deelnemers waren weg.');
    await page.click('.ios-blad [data-rzet]');
    await page.waitForTimeout(1200);
    await stap();  // resultaten

    // 6. de conclusie en het bewijs eronder
    await page.fill('.ios-blad [data-conc]', 'Samen tuinieren verlaagt de ervaren eenzaamheid in deze straat.');
    await page.click('.ios-blad [data-conczet]');
    await page.waitForTimeout(1300);
    assert.ok(await blad().locator('[data-bkoppel]').count(), 'het bewijsblok staat er');

    for (const soort of ['dataset', 'observatie', 'interview']) {
      const waarden = await blad().locator('[data-bsoort]').first().locator('option')
        .evaluateAll(os => os.map(o => o.value));
      const val = waarden.find(v => v.indexOf(soort + ':') === 0);
      assert.ok(val, 'de drager ' + soort + ' staat in de keuzelijst (gevonden: ' + waarden.join(', ') + ')');
      await blad().locator('[data-bsoort]').first().selectOption(val);
      if (val === 'interview:') await page.fill('.ios-blad [data-bvrij]', 'Acht gesprekken met bewoners in mei');
      await page.click('.ios-blad [data-bkoppel]');
      await page.waitForTimeout(1200);
      assert.match(await blad().locator('[data-crij]').first().innerText(), new RegExp(soort),
        'de drager ' + soort + ' hangt onder de conclusie');
    }

    /* De graad. Bij een MENSELIJK onderwerp vraagt zelfs een indicatie een
       handtekening -- eerst zonder, dan met, zodat de grens ook in de browser
       aantoonbaar bijt. */
    /* De graad wordt uit de BADGE gelezen (.graad), niet uit de tekst van de
       rij: die rij bevat ook de keuzelijst, en daarin staat het woord
       "Indicatie" altijd als optie. Een toets die de hele rij afzoekt, slaagt
       dus ongeacht wat er werkelijk staat -- regel 9 van de lat, in het klein. */
    // kleingemaakt, want .graad staat in de CSS op text-transform: uppercase --
    // een vergelijking op 'Indicatie' slaagt of zakt dan om de verkeerde reden
    const graadNu = async () => (await blad().locator('[data-crij] .graad').first().innerText()).trim().toLowerCase();

    await blad().locator('[data-ggraad]').first().selectOption('indicatie');
    await page.click('.ios-blad [data-gzet]');
    await page.waitForTimeout(1200);
    assert.notEqual(await graadNu(), 'indicatie',
      'zonder handtekening blijft de conclusie onder de indicatie; er staat: ' + (await graadNu()));

    await blad().locator('[data-ggraad]').first().selectOption('indicatie');
    await blad().locator('[data-gdoor]').first().selectOption('Dr. Vermeer');
    await page.click('.ios-blad [data-gzet]');
    await page.waitForTimeout(1300);
    assert.equal(await graadNu(), 'indicatie',
      'met de handtekening van een professional staat de conclusie op indicatie');

    // 7. het besluit en de uitgang naar echte verandering
    await stap();  // besluit
    await page.selectOption('.ios-blad [data-bs]', 'opschalen');
    await page.fill('.ios-blad [data-bd]', 'Dr. Vermeer');
    await page.fill('.ios-blad [data-br]', 'De indicatie is sterk genoeg om het in twee straten te herhalen.');
    await page.click('.ios-blad [data-bzet]');
    await page.waitForTimeout(1400);

    assert.ok(await blad().locator('[data-umaak]').count(), 'het uitgangblok staat er');
    await page.selectOption('.ios-blad [data-unieuw]', 'pilot');
    await page.fill('.ios-blad [data-utitel]', 'Pilot buurttuin in twee straten');
    await page.fill('.ios-blad [data-uoms]', 'Herhaling in de Kerkstraat en de Lindelaan');
    await page.click('.ios-blad [data-umaak]');
    await page.waitForTimeout(1400);
    assert.match(await blad().innerText(), /Pilot buurttuin/, 'de pilot staat als uitgang in het dossier');

    await stap();  // vervolg -- de cyclus is rond
    assert.match(await blad().innerText(), /Vervolg/, 'de cyclus is rond');

    const echt = fouten.filter(f => !/Failed to load resource/i.test(String(f)));
    assert.deepEqual(echt, [], 'geen JS-fouten tijdens de hele cyclus');
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
