/* Schermtoets voor apps/mijn-gegevens.html.

   DE BEWERING DIE ERTOE DOET is dat "niet vast te stellen" op dit scherm een
   EIGEN gezicht heeft en niet dat van "nee". Dat is de hele reden dat deze
   kaart bestaat: een lid dat leest "RTG heeft mijn adres niet" terwijl de kluis
   niet opengaat, is verkeerd gerustgesteld. Op de server staat die regel al
   vast (test/gegevenskaart.test.js toets 3); hier wordt gekeken of hij het
   scherm haalt, want een onderscheid dat in de JSON zit en niet in de opmaak,
   bestaat voor een mens niet.

   En toets 3: de kaart draagt geen enkele WAARDE. Hier staat DAT er een
   e-mailadres is, niet welk -- dat is de grens met de AVG-uitvoer.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

const pw = laadPlaywright();

test('Gegevenskaart: soorten en geen inhoud, met onbekend als eigen uitslag',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gkscherm-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Kaart Lid', email: 'gkscherm@x.nl', phone: '0612345893',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    }).then(r => r.json());
    assert.ok(reg.token);

    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const paginaFouten = [];
    letOpFouten(page, paginaFouten);
    await page.addInitScript((tok) => {
      localStorage.setItem('rtg_member_token', tok);
      localStorage.setItem('rtg_lang', 'nl'); localStorage.setItem('rtg_cookieinfo_v1', '1');
    }, reg.token);
    await page.goto(base + '/apps/mijn-gegevens.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#lijst .rij').length > 0,
      null, { timeout: 15000 });

    /* 1. DE DRIE UITSLAGEN, elk met een eigen gezicht. */
    assert.ok(await page.locator('#lijst .vlag.ja').count() > 0, 'er staat iets dat RTG heeft');
    assert.ok(await page.locator('#lijst .vlag.nee').count() > 0, 'en iets dat RTG niet heeft');

    /* DE DERDE UITSLAG IS NIET AF TE DWINGEN MET ECHTE DATA, en dat is goed
       nieuws: bij een gezond lid is er niets onbekends. Hij moet wel gedekt --
       juist die uitslag is de reden dat deze kaart bestaat. Dus wordt hieronder
       EEN antwoord gestuurd, en alleen om te zien wat het scherm ermee doet.
       Wat de server terugstuurt is elders gedekt (test/gegevenskaart.test.js);
       hier gaat het om de opmaak, want een onderscheid dat alleen in de JSON zit
       bestaat voor een mens niet. */
    await page.route('**/api/mijn/gegevens', async (route) => {
      const antwoord = await route.fetch();
      const k = await antwoord.json();
      k.rijen[0] = Object.assign({}, k.rijen[0], { aanwezig: null, waarom: 'De laag die dit bezit is hier niet aangesloten.' });
      /* En een harde NEE met een tweede helft. Een vers lid blijkt al een
         factuur te hebben, dus deze stand is met echte data niet af te dwingen
         -- maar hij moet wel gedekt, want juist daar zegt "RTG heeft dit niet"
         maar de helft. */
      const f = k.rijen.findIndex(r => r.id === 'facturen');
      if (f >= 0) k.rijen[f] = Object.assign({}, k.rijen[f], { aanwezig: false,
        bijAfwezig: 'Er staat nu geen factuur op uw naam. Komt er een, dan valt die meteen onder de bewaartermijn hieronder.' });
      await route.fulfill({ json: k });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#lijst .rij').length > 0, null, { timeout: 15000 });

    assert.ok(await page.locator('#lijst .vlag.onbekend').count() > 0,
      'die derde uitslag moet een eigen gezicht krijgen en niet stil wegvallen');
    const kleuren = await page.evaluate(() => {
      const k = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).color : null; };
      return { ja: k('.vlag.ja'), nee: k('.vlag.nee'), onbekend: k('.vlag.onbekend') };
    });
    assert.notEqual(kleuren.onbekend, kleuren.nee,
      '"niet vast te stellen" mag er niet uitzien als "nee"; dan bestaat het onderscheid voor een mens niet');
    assert.notEqual(kleuren.onbekend, kleuren.ja, 'en ook niet als "ja"');
    assert.match(await page.textContent('#lijst .rij'), /niet aangesloten/,
      'en de reden staat bij de rij zelf, niet drie schermen verderop');
    /* EEN NEE DIE NIET ALLES ZEGT, in dezelfde gestuurde fase. */
    assert.match(await page.textContent('#lijst'), /Komt er een, dan valt die meteen onder de bewaartermijn/,
      'bij een harde nee staat de tweede helft van het antwoord erbij');

    await page.unroute('**/api/mijn/gegevens');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelectorAll('#lijst .rij').length > 0, null, { timeout: 15000 });

    /* 2. ELKE RIJ BEANTWOORDT DE VIER VRAGEN -- en niet alleen met een label.
       scripts/schermmutatie.js liet zien dat dit blok half ongedekt was: de
       labels waren gedekt, maar het ANTWOORD erachter verdween ongemerkt (het
       stuk `t.appendChild(document.createTextNode(wat))` overleefde). Een rij
       die "Waarvoor:" zegt en daarna niets, is erger dan geen rij. */
    const eerste = await page.locator('#lijst .rij').first().textContent();
    /* PER FEIT-ELEMENT en niet op de tekst van de rij. Dat laatste stond hier
       eerst, en de mutatie liet zien waarom het niets bewees: textContent plakt
       de kinderen aan elkaar, dus "Waarvoor:" gevolgd door het volgende label
       "Waar:" matchte gewoon door -- terwijl het antwoord zelf verdwenen was.
       Voor de derde keer in deze ronde dezelfde vorm: wie een container leest,
       bewijst niet welk element hij las. */
    const feiten = page.locator('#lijst .rij').first().locator('.feit');
    assert.equal(await feiten.count(), 3, 'drie feiten per rij');
    for (const [i, label] of ['Waarvoor', 'Waar', 'Hoe het bij ons kwam'].entries()) {
      const t = (await feiten.nth(i).textContent()).trim();
      assert.ok(t.startsWith(label + ':'), 'feit ' + i + ' begint met ' + label + ', maar was: ' + t.slice(0, 40));
      assert.ok(t.slice(label.length + 1).trim().length > 10,
        label + ' staat er zonder antwoord erachter; een label zonder antwoord is erger dan geen label');
    }
    assert.match(eerste, /kan niet weg|Weghalen kan/, 'en of het weg kan');
    /* De gouden streep voor elk feit is geen versiering: hij scheidt de vier
       antwoorden van elkaar. Zonder hem lopen ze in een telefoonbreedte in
       elkaar over. */
    assert.equal(await page.locator('#lijst .rij').first().locator('.feit i').count(), 3,
      'elk van de drie feiten draagt zijn eigen streep');

    /* De grond onder een gegeven dat niet weg kan, staat er in mensentaal bij.
       Ook dit stuk overleefde eerst een mutatie: "Dit kan niet weg" bleef staan
       terwijl de uitleg WAAROM verdween, en dat is precies het verschil tussen
       een mededeling en een antwoord. */
    const vast = page.locator('#lijst .rij').filter({ hasText: 'Dit kan niet weg' }).first();
    assert.match(await vast.textContent(), /verdwijnt wel als u uw account opheft|wettelijke plicht|voor u is/,
      'bij een gegeven dat niet weg kan staat de grond in mensentaal erbij');

    /* 3. GEEN INHOUD. De grens met de AVG-uitvoer. */
    const alles = await page.textContent('main');
    assert.ok(!alles.includes('gkscherm@x.nl'), 'het e-mailadres zelf staat er niet op');
    assert.ok(!alles.includes('0612345893'), 'het telefoonnummer ook niet');
    assert.ok(!alles.includes('1990-01-01'), 'en de geboortedatum niet');
    assert.match(alles, /RTG heeft dit/, 'terwijl het scherm wel zegt DAT ze er zijn');

    /* 4. HET ANTWOORD OP "KAN ALLES WEG" -- en de twee lijsten staan los. */
    const opheffen = await page.textContent('#opheffen');
    assert.match(opheffen, /facturen/i, 'de fiscale bewaarplicht staat bij wat blijft');
    const naOpheffen = await page.locator('#opheffen > .grens').allTextContents();
    assert.ok(!naOpheffen.join(' ').includes('Uw naam'),
      'uw naam hoort NIET bij wat na opheffen blijft staan -- die staat in de uitklap eronder');
    assert.match(await page.textContent('#opheffen details'), /Uw naam/,
      'en daar staat hij wel');

    /* 4b. DE TERMIJN STAAT ER ALS GETAL. "Blijft staan" zonder hoe lang laat
       een mens denken dat het altijd is -- en bij het inzagejournaal was dat
       precies de fout: het beleid veegt het na twee jaar. */
    assert.match(opheffen, /7 jaar/, 'de fiscale termijn staat er als getal');
    assert.match(opheffen, /2 jaar/, 'en die van het inzagejournaal ook, want "altijd" was onwaar');
    assert.match(await page.textContent('#lijst'), /Bewaartermijn:/,
      'en bij het gegeven zelf ook, niet alleen onderaan');

    /* 4c. DE DERDE UITKOMST. Wissen, bewaren EN anonimiseren -- die derde
       ontbrak, en dan leest "alles gaat weg" als een belofte die je later je
       eigen zin nog ziet tegenspreken. */
    /* Op het BLOK en niet op de tekst van #opheffen als geheel: die eerste
       versie matchte de inleidende zin erboven, en overleefde daardoor een
       mutatie die het blok zelf wegnam. Een toets die de verkeerde regel leest,
       staat groen om niets. */
    const derde = page.locator('#opheffen .let');
    assert.equal(await derde.count(), 1, 'de derde uitkomst heeft een eigen blok');
    assert.match(await derde.textContent(), /uw naam en uw codenaam gaan eraf/i,
      'en zegt wat er dan gebeurt: u wordt eruit gehaald, de tekst blijft staan');

    /* 4e. WAARVOOR HET GEBRUIKT MAG WORDEN, en het verschil dat ertoe doet:
       welke doelen een KEUZE zijn en welke niet. Een lijst waarin dat verschil
       niet te zien is, laat een lid denken dat alles een knop is -- en dat is
       precies de leugen waar doelbinding tegen moet beschermen. */
    const tel = page.locator('#lijst .rij').filter({ hasText: 'Uw telefoonnummer' }).first();
    const doelen = tel.locator('.doel');
    assert.ok(await doelen.count() >= 3, 'een telefoonnummer wordt voor meerdere dingen gebruikt');
    assert.ok(await tel.locator('.doel.keuze').count() >= 1, 'daarvan is er minstens een een keuze');
    assert.ok(await tel.locator('.doel:not(.keuze)').count() >= 1, 'en minstens een niet');
    const merk = await page.evaluate(() => {
      const k = s => { const e = document.querySelector(s); return e ? getComputedStyle(e).backgroundColor : null; };
      return { keuze: k('.doel.keuze i'), vast: k('.doel:not(.keuze) i') };
    });
    assert.notEqual(merk.keuze, merk.vast,
      'een keuze moet er anders uitzien dan iets dat vaststaat; anders bestaat het verschil alleen in de JSON');
    /* En de grond staat erbij: WAAROM iets niet te weigeren is, is het antwoord
       op de vraag die een lid hier stelt. */
    assert.match(await tel.locator('.doel:not(.keuze)').first().textContent(),
      /Nodig voor wat u vroeg|kan RTG niet leveren|wet schrijft/i,
      'bij een doel dat vaststaat staat de reden erbij');

    /* 5. DE RAND VAN DE KAART. */
    const grenzen = await page.textContent('#grenzen');
    assert.match(grenzen, /Zegel/, 'wat hier niet op kan komen, staat erbij');
    assert.match(grenzen, /soorten, geen inhoud/i, 'en dat dit soorten zijn en geen inhoud');

    /* 6. GEEN SAMENGESTELD CIJFER (LAT-regel 11): drie getallen naast elkaar. */
    const telling = await page.locator('#telling .telling > div').count();
    assert.equal(telling, 3, 'drie losse getallen, geen percentage eroverheen');

    assert.deepEqual(paginaFouten, [], 'geen JS-fouten tijdens het scherm');
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
