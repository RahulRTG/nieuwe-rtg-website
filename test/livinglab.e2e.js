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
const { startServer, stop, letOpFouten, wachtTot, wachtOpTekst, wachtOpVerandering, wachtOpRust,
  volgVerzoeken, klikEnWacht, tekstVan } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
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
    await volgVerzoeken(page);

    // eerst uitgelogd: de deur hoort in beeld te komen, niet een lege pagina
    await page.goto(base + '/apps/livinglab.html', { waitUntil: 'domcontentloaded' });
    await wachtOpTekst(page, /inlog|aanmeld|personeel|kantoor/i, { in: '#main' });
    assert.match(await page.textContent('#main'), /inlog|aanmeld|personeel|kantoor/i,
      'zonder kantoorsessie staat de deur op de app zelf');

    await page.evaluate((tok) => {
      localStorage.setItem('rtg_office_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, login.token);
    await page.goto(base + '/apps/livinglab.html', { waitUntil: 'domcontentloaded' });
    /* De schil is er pas als het deelmenu is opgebouwd; daarvoor valt er niets
       open te klikken. */
    await wachtTot(page, () => !!window.RTGDeel, null, { wat: 'het deelmenu van de labpagina' });

    /* De pagina wordt door shared/deelmenu.js een menu met EEN deel tegelijk;
       een gebruiker klikt eerst een deel open, dus deze toets doet dat ook.
       RTGDeel.open doet zijn werk zonder server, dus er valt daarna niets te
       wachten -- de velden eronder wachten zelf op hun element. */
    await page.evaluate(() => window.RTGDeel && RTGDeel.open('nieuw-onderzoek'));

    // de twaalf projectsoorten komen van de server en worden niet in het scherm
    // nagebouwd; staan ze er niet, dan is de kader-route stuk
    assert.equal(await page.locator('#nSoort option').count(), 12, 'twaalf projectsoorten uit het kader');
    assert.ok((await page.locator('#labKies option').count()) > 0, 'het lab staat in de keuzelijst');

    await page.fill('#nTitel', 'Water op straat bij zware regen');
    await page.fill('#nVraag', 'Kan deze straat tijdens zware regen beter omgaan met water?');
    await page.selectOption('#nSoort', 'leefomgeving');
    await klikEnWacht(page, '#nMaak', '/api/lab2/');
    /* Het antwoord op het aanmaken is niet het scherm: het blad wordt daarna
       opgehaald en getekend. Wachten op het antwoord alleen liet de toets in het
       gat daartussen kijken. */
    await wachtTot(page, () => !!document.querySelector('.uitdaging'),
      null, { wat: 'het geopende dossier met de uitdaging' });
    assert.ok((await page.locator('.uitdaging').count()) > 0, 'het dossier opent met de uitdaging in beeld');
    assert.ok((await page.locator('.ios-blad .route .stap').count()) >= 10 ||
      (await page.locator('.route .stap').count()) >= 10, 'de route van tien stappen staat er');
    assert.match(await page.textContent('body'), /Volgende stap/i, 'het scherm zegt wat de volgende stap is');

    /* De hypothese ZONDER tegendeel: de server weigert, en het scherm hoort dus
       gewoon te blijven staan met het veld erin. Dit is de kant die bewijst dat
       de poort ook in de browser echt bijt. */
    await page.fill('[data-hyp]', 'Doorlatende bestrating verlaagt de plasvorming.');
    await klikEnWacht(page, '[data-hypzet]', '/api/lab2/');
    assert.ok((await page.locator('[data-hyp]').count()) > 0,
      'zonder tegendeel blijft het hypotheseveld staan: de poort bijt ook hier');

    await page.fill('[data-hyp]', 'Doorlatende bestrating verlaagt de plasvorming.');
    await page.fill('[data-hypteg]', 'Als de plasduur na de ingreep gelijk blijft.');
    await klikEnWacht(page, '[data-hypzet]', '/api/lab2/');
    await wachtTot(page, () => !!document.querySelector('[data-stap]'),
      null, { wat: 'de stapknop na de aangenomen hypothese' });

    // de cyclus schuift niet vanzelf op; de stap is een eigen handeling
    assert.ok((await page.locator('[data-stap]').count()) > 0, 'de stapknop staat klaar');
    await klikEnWacht(page, '[data-stap]', '/api/lab2/');
    await wachtTot(page, () => !!document.querySelector('[data-m]'),
      null, { wat: 'de methodenkeuze na de stap' });
    assert.ok((await page.locator('[data-m]').count()) > 0, 'na de stap staat de methodenkeuze er');

    /* Het methode-advies rekent live mee, uit DEZELFDE regel als de poort. Een
       enquête vraagt dertig deelnemers; staat dat er niet, dan rekent het scherm
       iets anders uit dan de server straks eist. */
    await page.locator('[data-m][value="enquete"]').check();
    await wachtOpTekst(page, /30/, { in: '[data-advies]' });
    assert.match(await page.textContent('[data-advies]'), /30/,
      'het advies noemt de ondergrens die de server straks ook eist');

    /* ---------- het bewonersscherm ---------- */
    const bew = await browser.newPage();
    const bewFouten = [];
    letOpFouten(bew, bewFouten);
    await volgVerzoeken(bew);
    await bew.goto(base + '/apps/labpas.html', { waitUntil: 'domcontentloaded' });
    await wachtTot(bew, () => !!window.RTGDeel, null, { wat: 'het deelmenu van het bewonersscherm' });

    /* Ook dit scherm is een menu met één deel tegelijk (shared/deelmenu.js),
       dus openen wat je nodig hebt -- net als een bewoner zou doen. */
    const bewDeel = async (n) => { await bew.evaluate(x => window.RTGDeel && RTGDeel.open(x), n); };

    await bewDeel('vragen-uit-de-buurt');
    assert.ok((await bew.locator('#bLab option').count()) > 0, 'de bewoner ziet welke labs er zijn');
    await bew.fill('#bVraag', 'Kan de speeltuin veiliger tijdens het spitsuur?');
    await klikEnWacht(bew, '#bStuur', '/api/lab2/');
    await wachtOpTekst(bew, /speeltuin/i, { in: '#bLijst' });
    assert.match(await bew.textContent('#bLijst'), /speeltuin/i,
      'een bewoner draagt een onderzoeksvraag aan zonder account');

    /* Het publieke onderzoeksoverzicht: de BUITENSTE ring. De studie die deze
       toets hierboven aanmaakte staat erin, met haar vraag -- want die is niet
       gescheiden. Deelnemers en ruwe data horen er juist NIET in te staan. */
    await bewDeel('wat-er-in-dit-lab-onderzocht-wordt');
    await wachtOpTekst(bew, /Water op straat/i, { in: '#oLijst' });
    const publiek = await bew.textContent('#oLijst');
    assert.match(publiek, /Water op straat/i, 'de bewoner ziet waar het lab aan werkt');
    assert.ok(!/BW-/.test(publiek), 'maar geen deelnemers: dat is de buitenste ring');

    // het labpaspoort: aanmaken levert een code die de drager zelf houdt
    await bewDeel('uw-labpaspoort');
    await bew.fill('#paspNaam', 'Sam');
    await klikEnWacht(bew, '#paspMaak', '/api/lab2/');
    await wachtOpTekst(bew, /LABPAS-/, { in: '#pasp' });
    assert.match(await bew.textContent('#pasp'), /LABPAS-/, 'het labpaspoort krijgt een eigen code');

    // een onbekende pas geeft een nette melding en geen stilte
    await bewDeel('uw-labpas');
    await bew.fill('#pasVeld', 'LABPAS-ZZZZZZZ');
    await klikEnWacht(bew, '#pasOpen', '/api/lab2/');
    await wachtOpTekst(bew, /labpas/i, { in: '#pasFout' });
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
    await volgVerzoeken(page);
    page.on('dialog', d => d.accept('Toetsstad'));

    await page.goto(base + '/apps/livinglab.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate((tok) => {
      localStorage.setItem('rtg_office_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, login.token);
    await page.goto(base + '/apps/livinglab.html', { waitUntil: 'domcontentloaded' });
    await wachtTot(page, () => !!window.RTGDeel, null, { wat: 'het deelmenu van de labpagina' });

    const deel = async (n) => { await page.evaluate(x => window.RTGDeel && RTGDeel.open(x), n); };
    /* HET BOVENSTE BLAD, niet het eerste. Er kunnen er twee tegelijk in de DOM
       staan (het oude blad blijft even hangen), en dan vult '.ios-blad [x]' het
       VERKEERDE: de toets typte in een blad dat niemand meer ziet, en de server
       kreeg een leeg veld. Zo zag "Wat heeft u waargenomen?" eruit terwijl het
       veld aantoonbaar gevuld was. */
    const blad = () => page.locator('.ios-blad').last();
    /* Een stap zetten is een verzoek EN een hertekening: de server antwoordt en
       daarna bouwt het blad zichzelf opnieuw op. Wachten op alleen het antwoord
       is dus te vroeg -- vandaar het element waar de volgende handeling op
       staat te wachten. */
    /* Elke knop IN het blad doet hetzelfde: een verzoek, en daarna tekent het
       blad zichzelf opnieuw met de nieuwe stand. Wachten op alleen het antwoord
       liet de volgende handeling in een blad grijpen dat nog de oude stand
       toonde -- zo bleef er van drie tekenbevoegden een over, en bleef de
       ethiekpoort blokkeren terwijl alle vijf de waarborgen waren gezet. */
    const bladActie = async (sel) => {
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/api/lab2/') && r.request().method() !== 'GET'),
        blad().locator(sel.replace('.ios-blad ', '')).click()
      ]);
      await wachtOpRust(page);
    };
    /* VULLEN EN DAN PAS KLIKKEN, MET DE VELDEN NAGEKEKEN. Het blad tekent
       zichzelf na elk antwoord opnieuw, en een hertekening WIST wat er net is
       ingetypt. Wie tussen die twee in klikt, stuurt lege velden mee: de server
       weigert, het blad verandert (dus een wacht op verandering merkt niets), en
       drie stappen verder blokkeert een poort op iets wat er zogenaamd al stond.
       Precies daar liep deze toets vast toen de klokken eruit gingen; de vaste
       wachttijden hadden dat toevallig afgedekt. */
    const vulEnKlik = async (velden, knop) => {
      for (let poging = 0; poging < 3; poging++) {
        for (const [sel, waarde] of velden) {
          const veld = blad().locator(sel);
          const tag = await veld.evaluate((e) => e.tagName);
          if (tag === 'SELECT') await veld.selectOption(waarde);
          else await veld.fill(waarde);
        }
        const blijftStaan = await blad().evaluate((root, v) => v.every(([sel, waarde]) => {
          const el = root.querySelector(sel);
          return !!el && el.value === waarde;
        }), velden);
        if (blijftStaan) return bladActie(knop);
      }
      throw new Error('de velden voor ' + knop + ' bleven niet staan: het blad hertekende steeds opnieuw');
    };
    const stap = async (wachtOp) => {
      await bladActie('[data-stap]');
      if (wachtOp) await wachtTot(page, (sel) => !!document.querySelector(sel), wachtOp,
        { wat: wachtOp + ' na het zetten van de stap' });
    };

    // 1. een lab, en de tekenbevoegden -- zonder die twee kan er niets getekend worden
    await klikEnWacht(page, '#labNieuw', '/api/lab2/');
    /* Een lab aanmaken is DRIE verzoeken: maken, de labs opnieuw halen, en dan
       het lab laden. Pas na dat laatste hangt het beheerpaneel aan het NIEUWE
       lab; wie eerder klikt, praat nog tegen het vorige. Het anker is dus de
       keuzelijst die op het nieuwe lab staat, niet het bestaan van een veld. */
    await wachtTot(page, () => {
      const k = document.querySelector('#labKies');
      const gekozen = k && k.options[k.selectedIndex];
      return !!gekozen && /Toetsstad/.test(gekozen.textContent || '');
    }, null, { wat: 'de keuzelijst die op het nieuwe lab staat' });
    await deel('labbeheer');
    let tekenaars = 0;
    for (const [naam, rol, onaf] of [['Dr. Vermeer', 'professional', false], ['Prof. Aziz', 'reviewer', true], ['M. de Wit', 'toezichthouder', false]]) {
      await page.fill('#beheer [data-tknaam]', naam);
      await page.selectOption('#beheer [data-tkrol]', rol);
      if (onaf) await page.locator('#beheer [data-tkonaf]').check();
      await klikEnWacht(page, '#beheer [data-tkbij]', '/api/lab2/');
      /* Wachten tot deze er ECHT bij staat, en niet tot het antwoord binnen is:
         de lijst wordt na het antwoord opnieuw getekend, en de volgende ronde
         vult ondertussen dezelfde velden. Met alleen een wacht op het antwoord
         bleef er van drie tekenbevoegden een over. */
      tekenaars++;
      await wachtTot(page, (k) => document.querySelectorAll('#beheer [data-tk]').length === k, tekenaars,
        { wat: tekenaars + ' tekenbevoegde(n) in de lijst' });
    }
    assert.equal(await page.locator('#beheer [data-tk]').count(), 3, 'drie tekenbevoegden via het scherm');

    // 2. een sociaal onderzoek: het onderwerp tilt de risicoklasse vanzelf omhoog
    await deel('nieuw-onderzoek');
    await page.fill('#nTitel', 'Buurttuin en eenzaamheid');
    await page.fill('#nVraag', 'Vermindert een gezamenlijke buurttuin de eenzaamheid in de Kerkstraat?');
    await page.selectOption('#nSoort', 'cohesie');
    await klikEnWacht(page, '#nMaak', '/api/lab2/');
    await wachtTot(page, () => !!document.querySelector('.ios-blad [data-hyp]'),
      null, { wat: 'het dossierblad met het hypotheseveld' });

    await vulEnKlik([['[data-hyp]', 'Wekelijks samen tuinieren verlaagt de ervaren eenzaamheid.'], ['[data-hypteg]', 'Als de score na drie maanden gelijk blijft aan de vergelijkingsstraat.']], '.ios-blad [data-hypzet]');
    await stap('.ios-blad [data-m]');
    await page.locator('.ios-blad [data-m][value="enquete"]').check();
    await wachtTot(page, () => !!document.querySelector('.ios-blad [data-doel]'),
      null, { wat: 'het doelveld dat bij de gekozen methode hoort' });
    await vulEnKlik([['[data-doel]', 'De eenzaamheidsscore voor en na drie maanden vergelijken']], '.ios-blad [data-planzet]');
    await stap('.ios-blad [data-eklassezet]');

    /* 3. DE ETHIEK -- hier liep de app dood. Alle vijf de waarborgen worden nu
       met de knoppen in het blad gezet; de klasse-keuzelijst staat daarbij op de
       HUIDIGE klasse, want anders is één klik een poging tot verlagen. */
    assert.ok(await blad().locator('[data-eklassezet]').count(), 'het ethiekblok staat in het dossier');
    await bladActie('.ios-blad [data-eklassezet]');
    await vulEnKlik([['[data-eroordeel]', 'akkoord']], '.ios-blad [data-erzet]');
    await vulEnKlik([['[data-pvelden]', 'leeftijdsgroep, eenzaamheidsscore'],
      ['[data-pgrond]', 'Toestemming van de deelnemer zelf'],
      ['[data-pweg]', 'Geen naam, geen adres, geen inkomen']], '.ios-blad [data-pzet]');
    await vulEnKlik([['[data-tregime]', 'schriftelijk'],
      ['[data-ttekst]', 'U doet mee aan een onderzoek naar samen tuinieren. U kunt altijd stoppen.']],
      '.ios-blad [data-tzet]');
    await vulEnKlik([['[data-sctekst]', 'Bij een deelnemer die zich slechter voelt door deelname stoppen we direct.']],
      '.ios-blad [data-sczet]');
    await wachtTot(page, () => !/Hiervoor moet nog/.test(String((document.querySelector('.ios-blad') || {}).innerText || '')),
      null, { wat: 'een dossier waar de ethiekpoort niet meer blokkeert' });

    const naEthiek = await blad().innerText();
    assert.ok(!/Hiervoor moet nog/.test(naEthiek),
      'na de vijf waarborgen blokkeert de poort niet meer -- dit was het dode spoor:\n' + naEthiek.slice(0, 400));
    await stap('.ios-blad [data-mbij]');

    // 4. deelnemers: het plan vraagt er dertig, en de labpas komt in beeld
    assert.ok(await blad().locator('[data-mbij]').count(), 'het deelnemersblok staat er');
    for (let i = 0; i < 30; i++) await bladActie('.ios-blad [data-mbij]');
    await wachtTot(page, () => /^LABPAS-/.test(String((document.querySelector('.ios-blad [data-mnieuw] h2') || {}).textContent || '')),
      null, { wat: 'de labpas van de laatste deelnemer' });
    assert.match(await blad().locator('[data-mnieuw] h2').innerText(), /^LABPAS-/,
      'de labpas van de laatste deelnemer staat groot in beeld');

    /* Sluiten is puur scherm: geen verzoek, dus ook niets om op te wachten
       behalve het blad dat weg is. */
    await page.click('.ios-blad [data-dicht]');
    await wachtTot(page, () => !document.querySelector('.ios-blad'), null, { wat: 'een gesloten blad' });
    await deel('onderzoeken');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/lab2/') && r.request().method() !== 'GET'),
      page.locator('[data-open]').first().click()
    ]);
    await wachtTot(page, () => !!document.querySelector('.ios-blad [data-stap]'),
      null, { wat: 'het geopende dossier met zijn stapknop' });
    await stap();  // experiment
    await stap('.ios-blad [data-obs]');  // observaties

    // 5. materiaal verzamelen
    await vulEnKlik([['[data-obs]', 'Nulmeting: gemiddelde eenzaamheidsscore 6,4'],
      ['[data-obsm]', 'enquete']], '.ios-blad [data-obszet]');
    await vulEnKlik([['[data-dsnaam]', 'Eenzaamheidsscores meetmoment 1 en 2'], ['[data-dsrijen]', '60']], '.ios-blad [data-dszet]');
    await stap('.ios-blad [data-rs]');  // reflectie
    await page.selectOption('.ios-blad [data-rs]', 'misging');
    await vulEnKlik([['[data-rt]', 'Meetmoment 2 viel in de vakantie; acht deelnemers waren weg.']], '.ios-blad [data-rzet]');
    await stap('.ios-blad [data-conc]');  // resultaten

    // 6. de conclusie en het bewijs eronder
    await vulEnKlik([['[data-conc]', 'Samen tuinieren verlaagt de ervaren eenzaamheid in deze straat.']], '.ios-blad [data-conczet]');
    /* Het bewijsblok bestaat pas ZODRA er een conclusie is; het blad tekent dat
       in een tweede ronde bij. Wachten op de tekst die verandert is dus niet
       genoeg -- wachten op het blok zelf wel. */
    await wachtTot(page, () => !!document.querySelector('.ios-blad [data-bkoppel]'),
      null, { wat: 'het bewijsblok onder de conclusie' });
    assert.ok(await blad().locator('[data-bkoppel]').count(), 'het bewijsblok staat er');

    for (const soort of ['dataset', 'observatie', 'interview']) {
      const waarden = await blad().locator('[data-bsoort]').first().locator('option')
        .evaluateAll(os => os.map(o => o.value));
      const val = waarden.find(v => v.indexOf(soort + ':') === 0);
      assert.ok(val, 'de drager ' + soort + ' staat in de keuzelijst (gevonden: ' + waarden.join(', ') + ')');
      const velden = [['[data-bsoort]', val]];
      if (val === 'interview:') velden.push(['[data-bvrij]', 'Acht gesprekken met bewoners in mei']);
      await vulEnKlik(velden, '.ios-blad [data-bkoppel]');
      await wachtOpTekst(page, new RegExp(soort), { in: '.ios-blad [data-crij]' });
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

    await vulEnKlik([['[data-ggraad]', 'indicatie']], '.ios-blad [data-gzet]');
    assert.notEqual(await graadNu(), 'indicatie',
      'zonder handtekening blijft de conclusie onder de indicatie; er staat: ' + (await graadNu()));

    await vulEnKlik([['[data-ggraad]', 'indicatie'], ['[data-gdoor]', 'Dr. Vermeer']], '.ios-blad [data-gzet]');
    await wachtOpTekst(page, /indicatie/i, { in: '.ios-blad [data-crij] .graad' });
    assert.equal(await graadNu(), 'indicatie',
      'met de handtekening van een professional staat de conclusie op indicatie');

    // 7. het besluit en de uitgang naar echte verandering
    await stap('.ios-blad [data-bs]');  // besluit
    await vulEnKlik([['[data-bs]', 'opschalen'],
      ['[data-bd]', 'Dr. Vermeer'], ['[data-br]', 'De indicatie is sterk genoeg om het in twee straten te herhalen.']], '.ios-blad [data-bzet]');

    await wachtTot(page, () => !!document.querySelector('.ios-blad [data-umaak]'),
      null, { wat: 'het uitgangblok na het besluit' });
    assert.ok(await blad().locator('[data-umaak]').count(), 'het uitgangblok staat er');
    await vulEnKlik([['[data-unieuw]', 'pilot'],
      ['[data-utitel]', 'Pilot buurttuin in twee straten'], ['[data-uoms]', 'Herhaling in de Kerkstraat en de Lindelaan']], '.ios-blad [data-umaak]');
    await wachtOpTekst(page, /Pilot buurttuin/, { in: '.ios-blad' });
    assert.match(await blad().innerText(), /Pilot buurttuin/, 'de pilot staat als uitgang in het dossier');

    await stap();  // vervolg -- de cyclus is rond
    await wachtOpTekst(page, /Vervolg/, { in: '.ios-blad' });
    assert.match(await blad().innerText(), /Vervolg/, 'de cyclus is rond');

    const echt = fouten.filter(f => !/Failed to load resource/i.test(String(f)));
    assert.deepEqual(echt, [], 'geen JS-fouten tijdens de hele cyclus');
  } finally {
    if (browser) await browser.close();
    stop(srv && srv.child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
