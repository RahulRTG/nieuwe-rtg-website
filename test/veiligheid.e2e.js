/* RTG Veilig in een echte browser: vier standen op een scherm.

   De server-toetsen (test/veiligheid.test.js) bewijzen dat de keten werkt. Wat
   die niet kunnen zien: of de schermen ook echt staan, of er geen JS-fout op de
   pagina knalt, en of de dingen die er ALTIJD moeten staan er ook staan --
   met name de eerlijke grens ("dit is geen alarmcentrale"), want dat is de zin
   die een gebruiker beschermt tegen valse geruststelling.

   Dit was tot voor kort een toets op VIER apps (thuiswacht, codewoord, vitaal,
   thuisrust). Die zijn een app met vier standen geworden, en dat verplaatst de
   vraag: niet meer "staat elk scherm er", maar "brengt elke stand zijn eigen
   scherm mee, en overleeft wat boven de standen uit gaat het wisselen".
   Daarom loopt hij de standen na elkaar af binnen dezelfde pagina, en gaat hij
   daarna terug naar de eerste -- want een teller die na het wisselen doortikt op
   een paneel dat er niet meer staat, is precies de fout die je hier maakt.

   Draait alleen waar een browser beschikbaar is; anders overgeslagen.
   Draai: npm run e2e */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop, letOpFouten } = require('./helper');
const fs = require('fs');
const os = require('os');
const path = require('path');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

/* [stand-id, naam in de balk, tekst die alleen deze stand opbouwt, oud pad] */
const STANDEN = [
  ['wacht', 'Thuiswacht', 'Start de wacht', '/apps/thuiswacht.html'],
  ['codewoord', 'Codewoord', 'Instellen', '/apps/codewoord.html'],
  ['vitaal', 'Vitaal', 'Zet de check-in aan', '/apps/vitaal.html'],
  ['rust', 'Thuisrust', 'Zet aan', '/apps/thuisrust.html']
];

test('RTG Veilig: de vier standen staan echt', { skip: pw ? false : 'geen browser beschikbaar' }, async (t) => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-veilig-e2e-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(srv.base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Veilig Tester', email: 'vt' + u + '@x.nl', phone: '062' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg'
      })
    }).then(r => r.json());
    assert.ok(reg.token, 'het lid moet een token krijgen');

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 430, height: 900 } });
    // ingelogd doen alsof, net als de app zelf
    await ctx.addInitScript((tok) => { try { localStorage.setItem('rtg_member_token', tok); } catch (e) {} }, reg.token);

    /* Een teller die na het wisselen doortikt, is niet te zien en geeft geen
       fout: schrijven naar een losgekoppelde DOM-knoop mag gewoon. Daarom
       wordt hij hier GETELD in plaats van afgewacht. setInterval en
       clearInterval houden samen bij welke tellers er leven; de toets verderop
       kijkt of het er na het verlaten van een stand weer evenveel zijn als
       ervoor.

       Dit staat als initScript en niet als evaluate(): de standen zetten hun
       teller op tijdens het laden, dus wie pas na load() gaat meekijken, mist
       precies de teller waar het om gaat. */
    await ctx.addInitScript(() => {
      window.__levendeTellers = new Map();   // id -> tikduur in ms
      const zet = window.setInterval, weg = window.clearInterval;
      window.setInterval = function (fn, ms) {
        const id = zet.apply(this, arguments);
        window.__levendeTellers.set(id, ms);
        return id;
      };
      window.clearInterval = function (id) { window.__levendeTellers.delete(id); return weg.call(this, id); };
      window.__tellersMet = (ms) => [...window.__levendeTellers.values()].filter((x) => x === ms).length;
    });

    /* Een pagina voor alle standen samen: het wisselen is nu onderdeel van wat
       getoetst wordt, dus elke stand een verse pagina geven zou juist de fout
       verbergen die deze samenvoeging kan maken. */
    const page = await ctx.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    page.on('console', (m) => { if (m.type() === 'error') fouten.push('console: ' + m.text()); });

    await page.goto(srv.base + '/apps/veilig.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#grens .grens', { timeout: 15000 });

    for (const [id, naam, knop] of STANDEN) {
      await t.test('stand ' + naam, async () => {
        await page.click('#standen button[data-id="' + id + '"]');

        // 1. deze stand staat aan, en precies deze
        await page.waitForFunction(
          (x) => document.querySelectorAll('#standen button[aria-current="true"]').length === 1 &&
                 document.querySelector('#standen button[aria-current="true"]').dataset.id === x,
          id, { timeout: 15000 });

        // 2. het bedieningselement van deze stand is echt opgebouwd (dus de
        //    fetch naar de server is gelukt en het paneel is niet leeg)
        await page.waitForFunction(
          (tekst) => document.querySelector('#paneel').innerText.includes(tekst),
          knop, { timeout: 15000 });

        // 3. de grens staat er op ELKE stand, en zegt wat het NIET is
        const grens = await page.textContent('#grens .grens');
        assert.match(grens, /geen alarmcentrale/i, naam + ': de grens hoort op het scherm te staan');
        assert.match(grens, /alarmnummer/i, naam + ': en moet naar het alarmnummer wijzen');

        // 4. de kring staat er nog en is geladen (gedeelde laag, een keer
        //    getekend en dus ook na het wisselen niet verdwenen of teruggezet
        //    op "Laden...")
        const kring = await page.textContent('#kring');
        assert.ok(!/Laden\.\.\./.test(kring), naam + ': de kring bleef hangen op laden');

        // 5. het adres draagt de stand, zodat een link erheen kan wijzen
        assert.equal(new URL(page.url()).hash, '#' + id, naam + ': de hash hoort de stand te dragen');
      });
    }

    // 6. geen JS-fouten over de hele rit
    await t.test('geen JS-fout op de pagina', async () => {
      assert.deepEqual(fouten.filter(f => !/favicon|manifest|Failed to load resource/i.test(f)), [],
        'er hoort geen JS-fout te knallen');
    });
    await page.close();

    /* DE TELLER MOET STOPPEN BIJ HET WISSELEN.

       Eerst een lopende wacht, want zonder lopende wacht maakt de Thuiswacht
       helemaal geen teller aan -- het invulscherm heeft er geen. Precies daarop
       liep de eerste versie van deze toets stuk: hij zette stop() uit, zag
       groen, en bewees dus niets. Een toets die je niet hebt zien zakken is
       geen toets (LAT.md regel 2), en een toets die iets anders meet dan zijn
       commentaar zegt, is erger dan geen toets.

       Waarom tellen en niet wachten op een fout: schrijven naar een
       losgekoppelde DOM-knoop gooit niet. Een achtergebleven teller is dus
       volledig stil -- tot hij bij nul laad() aanroept en in een paneel schrijft
       dat er niet meer staat. Dat kan uren later zijn. Het aantal levende
       tellers is de enige meting die er meteen bij is.

       DE MUTATIE DIE HEM HOORT TE LATEN ZAKKEN: vervang in
       apps/veilig/wacht.js de regel `stop: function () { clearInterval(tik);
       tik = null; }` door een lege functie. Zelfde voor vitaal.js. */
    await t.test('een teller stopt zodra je de stand verlaat', async () => {
      const kring = await fetch(srv.base + '/api/veiligheid/kring/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
        body: JSON.stringify({ adres: 'teller' + u + '@x.nl' })
      }).then(r => r.json());
      assert.ok(kring.ok, 'de kring moet gevuld zijn voor een wacht kan: ' + JSON.stringify(kring));

      const gestart = await fetch(srv.base + '/api/veiligheid/wacht/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
        body: JSON.stringify({ soort: 'thuis', minuten: 90, marge: 10, label: 'tellertoets' })
      }).then(r => r.json());
      assert.ok(gestart.wacht, 'er moet een wacht lopen: ' + JSON.stringify(gestart));

      const p = await ctx.newPage();
      // op een stand ZONDER seconde-teller beginnen, zodat de nulmeting klopt
      await p.goto(srv.base + '/apps/veilig.html#rust', { waitUntil: 'domcontentloaded' });
      await p.waitForFunction(() => document.querySelector('#paneel').innerText.includes('Zet aan'), null, { timeout: 15000 });
      assert.equal(await p.evaluate(() => window.__tellersMet(1000)), 0,
        'de stand Thuisrust hoort geen seconde-teller te hebben');

      // naar de Thuiswacht: die loopt nu, dus daar hoort de klok te tikken
      await p.click('#standen button[data-id="wacht"]');
      await p.waitForFunction(() => document.querySelector('#paneel').innerText.includes('Ik ben thuis'), null, { timeout: 15000 });
      assert.equal(await p.evaluate(() => window.__tellersMet(1000)), 1,
        'een lopende wacht hoort precies een seconde-teller te hebben');

      // en weg ervan: de klok hoort opgeruimd te zijn
      await p.click('#standen button[data-id="rust"]');
      await p.waitForFunction(() => document.querySelector('#paneel').innerText.includes('Zet aan'), null, { timeout: 15000 });
      assert.equal(await p.evaluate(() => window.__tellersMet(1000)), 0,
        'na het verlaten van de Thuiswacht hoort de seconde-teller gestopt te zijn');

      /* En wat juist NIET mag stoppen: het levensteken. shared/veiligheid.js
         geeft elke twee minuten uw plek door zolang er een wacht loopt, en die
         wacht loopt op de SERVER -- niet op het scherm waar u toevallig naar
         kijkt. Zou het wisselen van stand dat stilzetten, dan zou het alarm
         afgaan met een plek van een uur oud omdat u ondertussen naar Thuisrust
         had gekeken. Dat is precies het soort stilte dat deze app niet mag
         hebben, en het is een fout die je maakt door bij het opruimen van
         tellers te ruim te maaien. */
      assert.equal(await p.evaluate(() => window.__tellersMet(120000)), 1,
        'het levensteken van twee minuten hoort door te lopen zolang de wacht loopt');
      await p.close();
    });

    /* De vier oude paden. Er kan van buiten naar gelinkt zijn -- uit een
       alarmmail, uit een bladwijzer, vanaf een geinstalleerde PWA -- en die
       links moeten uitkomen op de stand die ze beloofden, niet op de app in het
       algemeen. De querystring hoort de omleiding te overleven en VOOR de hash
       terecht te komen; andersom is hij geen query meer maar een stuk hash, en
       dat is een fout die je alleen ziet door hem te meten. */
    await t.test('de vier oude paden leiden naar hun eigen stand', async () => {
      for (const [id, naam, , oud] of STANDEN) {
        const p = await ctx.newPage();
        await p.goto(srv.base + oud + '?ref=mail', { waitUntil: 'domcontentloaded' });
        await p.waitForFunction((x) => location.pathname === '/apps/veilig.html' && location.hash === '#' + x,
          id, { timeout: 15000 });
        const url = new URL(p.url());
        assert.equal(url.pathname, '/apps/veilig.html', naam + ': het oude pad hoort naar RTG Veilig te leiden');
        assert.equal(url.hash, '#' + id, naam + ': en naar zijn eigen stand');
        assert.equal(url.searchParams.get('ref'), 'mail',
          naam + ': de querystring hoort de omleiding te overleven (en dus voor de hash te staan)');
        await p.close();
      }
    });

    // Het codewoord mag NERGENS op het scherm terugkomen nadat het is gezet.
    await t.test('het codewoord komt na het instellen nooit meer op het scherm', async () => {
      /* EERST EEN KRING, WANT ZONDER KRING WEIGERT DE SERVER TERECHT.

         codewoordZetten geeft 400 als er niemand te waarschuwen valt: "een
         noodsignaal zonder ontvanger is geen noodsignaal", en het instellen is
         het enige moment waarop je dat nog kunt zeggen -- valt het codewoord
         eenmaal, dan is het stil met opzet. Deze toets registreerde een vers
         lid en zette meteen een zin; die werd geweigerd, de kaart bleef op het
         invulscherm staan en de toets liep in zijn timeout. Niet de app was
         stuk maar de opzet, en dat kostte 15 seconden zwijgen om te zien.

         Een e-mailadres is de kortste geldige kring (kringLeeg telt contacten
         EN mails). Een tweede lid zou ook kunnen, maar dan moet je ze eerst in
         de Salon met elkaar verbinden -- drie stappen extra voor dezelfde
         voorwaarde. */
      const kring = await fetch(srv.base + '/api/veiligheid/kring/mail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + reg.token },
        body: JSON.stringify({ adres: 'kring' + u + '@x.nl' })
      }).then(r => r.json());
      assert.ok(kring.ok, 'de kring moet gevuld zijn voor een codewoord kan: ' + JSON.stringify(kring));

      const p = await ctx.newPage();
      await p.goto(srv.base + '/apps/veilig.html#codewoord', { waitUntil: 'domcontentloaded' });
      await p.waitForSelector('#zin', { timeout: 15000 });
      await p.fill('#zin', 'staat de blauwe fiets nog buiten');
      await p.click('#zet');
      await p.waitForFunction(() => /woorden/.test(document.querySelector('#zinKaart').innerText), null, { timeout: 15000 });
      const hele = await p.content();
      assert.ok(!/staat de blauwe fiets nog buiten/i.test(hele),
        'de zin mag na het instellen nergens meer in de pagina staan');

      /* En ook niet nadat je van stand wisselt en terugkomt: de schil gooit het
         paneel weg en bouwt het opnieuw op uit de server, die alleen het AANTAL
         woorden teruggeeft. Zou een stand zijn eigen laatste invoer vasthouden,
         dan stond de zin er na het terugwisselen weer. */
      await p.click('#standen button[data-id="rust"]');
      await p.waitForFunction(() => document.querySelector('#paneel').innerText.includes('Zet aan'), null, { timeout: 15000 });
      await p.click('#standen button[data-id="codewoord"]');
      await p.waitForFunction(() => /woorden/.test(document.querySelector('#zinKaart').innerText), null, { timeout: 15000 });
      assert.ok(!/staat de blauwe fiets nog buiten/i.test(await p.content()),
        'de zin mag ook na het wisselen van stand nergens in de pagina staan');
      await p.close();
    });
  } finally {
    if (browser) try { await browser.close(); } catch (e) {}
    stop(srv && srv.child);
  }
});
