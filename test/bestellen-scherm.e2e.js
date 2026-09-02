/* HET BESTELSCHERM (/apps/bestellen.html) IN EEN ECHTE BROWSER.

   test/gastfoodcourt.test.js bewijst dat een mandje bij twee loketten twee
   rekeningen wordt, elk bij zijn eigen zaak. test/eten.test.js bewijst dat de
   drie ingangen hetzelfde resultaatcontract dragen. Geen van beide bewijst dat
   het scherm die weg werkelijk aflegt: dat zoeken de zoekroute raakt en het
   treffer-gerecht toont, dat een gerecht met alcohol GEEN plusknop krijgt, dat
   een foodcourt-mandje van twee loketten uit een klik op Bestellen ook echt bij
   /api/gast/foodcourt/bestel uitkomt, en dat de bestelling daarna onder
   "Mijn bestellingen" staat. scripts/schermen.js eist daarom een eigen tocht.

   WAT DEZE TOETS VASTLEGT, en waarom juist dat:

   1. ZOEKEN ZOEKT ECHT. Een gerechtnaam in de zoekbalk gaat naar
      /api/gast/eten/zoeken en het scherm toont alleen de zaak waar dat gerecht
      op de kaart staat, met het gerecht als treffer erbij.
   2. ALCOHOL LOOPT VIA EEN MEDEWERKER. Op de kaart krijgt een gerecht met
      alcohol geen plusknop en wel de zin die zegt waarom; de andere gerechten
      krijgen die knop wel. Dat is een grens van het scherm en geen versiering:
      een plusknop op de cava zou een bestelling klaarzetten die de keuken niet
      mag aannemen.
   3. IN DE FOODCOURT-STAND BLIJFT HET MANDJE VAN HET ANDERE LOKET STAAN.
      Twee gerechten bij twee zaken geven "2 x gekozen bij 2 loketten".
   4. BESTELLEN IS EEN ECHTE HANDELING MET EEN ECHTE UITKOMST. De klik gaat
      naar /api/gast/foodcourt/bestel, het scherm toont per loket een code, het
      mandje is leeg, het tabblad "Mijn bestellingen" gaat open met het mandje
      erin, en de API kent datzelfde mandje met twee delen.

   Wat NIET is beproefd: bezorgen en afhalen (die gaan langs de serverbevestigde
   checkout en een betaalkeuze, en dat is een eigen weg), de 428 van de
   gegevenspoort (het lid registreert met een telefoonnummer) en de concierge.

   Draai los: node --test test/bestellen-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

test('Bestellen: zoeken vindt het gerecht, alcohol krijgt geen plusknop, en een foodcourt-mandje van twee loketten wordt echt besteld',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bestellen-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    const post = async (pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    let browser;
    try {
      const u = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90) + 10);
      const reg = await post('/api/auth/register', { name: 'Besteller', email: 'x' + u + '@x.nl',
        phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, 'het lid is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      const LID = reg.body.token;

      /* De opstelling komt uit de zaaiset en wordt hier NAGEKEKEN in plaats van
         aangenomen: twee zaken met een kaart, waarvan er een een gerecht met
         alcohol draagt. Zonder die opstelling toetst dit bestand niets, en dan
         hoort het te zakken en niet stil door te gaan. */
      const kaartA = (await post('/api/gast/bezorg/kaart', { zaak: 'KIKUNOI' }, LID)).body.kaart || [];
      const kaartB = (await post('/api/gast/bezorg/kaart', { zaak: 'PONTO' }, LID)).body.kaart || [];
      const alcohol = kaartA.find((m) => m.alcohol);
      const gewoonA = kaartA.find((m) => !m.alcohol && !m.uitverkocht && !(m.opties || []).length);
      const gewoonB = kaartB.find((m) => !m.alcohol && !m.uitverkocht && !(m.opties || []).length);
      assert.ok(alcohol && gewoonA && gewoonB, 'de zaaiset draagt de opstelling voor deze toets');

      browser = await pw.chromium.launch(browserOpties(pw));
      const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, LID);
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      await page.goto(base + '/apps/bestellen.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.querySelectorAll('#zaken .zaakknop').length > 0, null, { timeout: 20000 });

      const tekst = (s) => page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? String(el.textContent || '').replace(/\s+/g, ' ').trim() : '';
      }, s);
      const verborgen = (s) => page.evaluate((sel) => {
        const el = document.querySelector(sel); return !el || el.hidden;
      }, s);

      /* ---- 1. zoeken ---- */
      await page.locator('[data-ingang="zoeken"]').click();
      await page.locator('#zoek').fill(gewoonA.naam);
      const gezocht = page.waitForResponse((r) => r.url().endsWith('/api/gast/eten/zoeken') &&
        String(r.request().postData() || '').includes(gewoonA.naam), { timeout: 20000 });
      await page.locator('#bZoek').click();
      assert.equal((await gezocht).status(), 200, 'de zoekknop raakt de zoekroute');
      await page.waitForFunction((naam) => {
        const knoppen = [...document.querySelectorAll('#zaken .zaakknop')];
        return knoppen.length === 1 && knoppen[0].getAttribute('data-zaak') === 'KIKUNOI' &&
          /Past bij je vraag/.test(knoppen[0].textContent) && knoppen[0].textContent.includes(naam);
      }, gewoonA.naam, { timeout: 15000 });
      assert.match(await tekst('#zaakAantal'), /^1 zaak$/, 'de telling zegt een zaak');

      /* ---- 2. de kaart en de foodcourt-stand ----
         De keuze "hoe wil je het hebben" staat in het detailpaneel en dat gaat
         pas open bij een zaak; dus eerst de zaak, dan de stand. */
      const kaart1 = page.waitForResponse((r) => r.url().endsWith('/api/gast/bezorg/kaart'), { timeout: 20000 });
      await page.locator('#zaken .zaakknop[data-zaak="KIKUNOI"]').click();
      assert.equal((await kaart1).status(), 200);
      await page.waitForFunction((n) => document.querySelectorAll('#kaartLijst .item').length === n,
        kaartA.length, { timeout: 15000 });
      await page.selectOption('#modus', 'foodcourt');
      assert.equal(await verborgen('#adresVak'), true, 'de foodcourt vraagt geen bezorgadres');
      assert.equal(await tekst('#zakenKop'), 'Kies meerdere loketten');
      const alcoholRij = page.locator('#kaartLijst .item', { hasText: alcohol.naam });
      assert.equal(await alcoholRij.count(), 1, 'het gerecht met alcohol staat op de kaart');
      assert.equal(await alcoholRij.locator('[data-plus]').count(), 0, 'alcohol krijgt geen plusknop');
      assert.match(await alcoholRij.locator('.waarschuw').textContent(), /Alcohol: dit loopt via een medewerker/);
      assert.equal(await page.locator('#kaartLijst [data-plus="' + gewoonA.id + '"]').count(), 1,
        'een gewoon gerecht krijgt de plusknop wel');

      /* ---- 3. twee loketten in een mandje ---- */
      await page.locator('#kaartLijst [data-plus="' + gewoonA.id + '"]').click();
      await page.waitForFunction(() => !document.querySelector('#mand').hidden, null, { timeout: 10000 });
      assert.equal(await tekst('#mandTekst'), '1 × gekozen');
      assert.equal(await page.locator('#bBestel').isDisabled(), false, 'met iets in het mandje mag er besteld worden');

      const ontdekt = page.waitForResponse((r) => r.url().endsWith('/api/gast/eten/ontdekken'), { timeout: 20000 });
      await page.locator('[data-ingang="ontdekken"]').click();
      assert.equal((await ontdekt).status(), 200);
      /* WACHTEN TOT DE LIJST KLAAR IS, NIET TOT DE KNOP ER EVEN STAAT.
         laadResultaten() zet #zaken eerst op skeletten en vult hem pas in de
         .then(), dus het antwoord van /ontdekken is er voor de lijst getekend
         is. De skelet-eis maakt van "de knop staat er" een "de lijst is af".

         Dit dekt het GEVOLG af; de oorzaak lag in het scherm en is daar
         gerepareerd. Het zoekveld zette een debounce van 280 ms klaar die na
         de klik op Ontdekken alsnog afliep, INGANG terugzette op 'zoeken' en
         het ontdek-antwoord met het oude zoekwoord filterde -- gemeten in een
         gezakte ronde: knoppen ["KIKUNOI"], groepsknoppen verborgen, #zoek nog
         "Gazpacho de sandia". bestellen.html wist die timer nu en negeert een
         antwoord dat niet meer bij de laatste lading hoort. */
      await page.waitForFunction(() => !document.querySelector('#zaken .skelet') &&
        !!document.querySelector('#zaken .zaakknop[data-zaak="PONTO"]'), null, { timeout: 15000 });
      const kaart2 = page.waitForResponse((r) => r.url().endsWith('/api/gast/bezorg/kaart'), { timeout: 20000 });
      await page.locator('#zaken .zaakknop[data-zaak="PONTO"]').click();
      assert.equal((await kaart2).status(), 200);
      /* Zelfde reden als hierboven: laadKaart() zet ook #kaartLijst eerst op
         skeletten, dus de kaart is er voordat de rijen er zijn. */
      await page.waitForFunction((id) => !document.querySelector('#kaartLijst .skelet') &&
        !!document.querySelector('#kaartLijst [data-plus="' + id + '"]'), gewoonB.id, { timeout: 15000 });
      await page.locator('#kaartLijst [data-plus="' + gewoonB.id + '"]').click();
      await page.waitForFunction(() => /bij 2 loketten/.test(document.querySelector('#mandTekst').textContent),
        null, { timeout: 10000 });
      assert.equal(await tekst('#mandTekst'), '2 × gekozen bij 2 loketten',
        'in de foodcourt-stand blijft het mandje van het andere loket staan');
      assert.equal(await tekst('#mandBedrag'), '€ ' + ((gewoonA.centen + gewoonB.centen) / 100).toFixed(2).replace('.', ','),
        'het bedrag is de som van beide loketten');

      /* ---- 4. bestellen ---- */
      const besteld = page.waitForResponse((r) => r.url().endsWith('/api/gast/foodcourt/bestel'), { timeout: 20000 });
      await page.locator('#bBestel').click();
      const b = await besteld;
      assert.equal(b.status(), 200, 'de foodcourt-bestelling lukt: ' + (await b.text()).slice(0, 200));
      const uit = await b.json();
      assert.equal(uit.gelukt, 2, 'beide loketten kregen hun deel');
      await page.waitForFunction(() => /Je codes:/.test((document.querySelector('#melding') || {}).textContent || ''),
        null, { timeout: 15000 });
      const melding = await tekst('#melding');
      for (const deel of uit.mandje.delen) {
        assert.ok(melding.includes(deel.naam + ': ' + deel.afhaalcode),
          'de code van ' + deel.naam + ' staat in de melding: ' + melding);
      }
      assert.equal(await verborgen('#mand'), true, 'na het bestellen is het mandje leeg');
      assert.equal(await verborgen('[data-paneel="lopend"]'), false, 'het tabblad Mijn bestellingen gaat open');
      await page.waitForFunction(() => /Foodcourt/.test(document.querySelector('#lopendLijst').textContent),
        null, { timeout: 15000 });
      assert.match(await tekst('#lopendLijst'), /2 loketten/, 'het lopende mandje toont zijn twee loketten');

      const mijn = await post('/api/gast/foodcourt/mijn', {}, LID);
      const mandje = (mijn.body.mandjes || []).find((m) => m.mandjeId === uit.mandjeId);
      assert.ok(mandje, 'het mandje van het scherm staat op de server');
      assert.equal(mandje.delen.length, 2, 'met twee delen');

      assert.deepEqual(fouten, [], 'geen JS-fouten op het bestelscherm: ' + fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
