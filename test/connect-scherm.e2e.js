/* ONTDEKKEN (/apps/connect.html) IN EEN ECHTE BROWSER.

   test/connect.test.js beproeft de MODULES, test/connect-routes.e2e.js de
   DEUREN. Geen van beide legt de weg van het scherm af, en dat is geen detail:
   `scripts/schermen.js` zag /apps/connect.html als "zonder eigen toets" terwijl
   het bestand wel werd OPGEHAALD -- door de service-worker-lijst waar ik hem
   zelf op heb gezet. De regel die daar staat is scherp en klopt: *een cache die
   een pagina ophaalt is geen toets die hem aflegt*.

   WAT DEZE TOETS VASTLEGT, en waarom juist dat -- het zijn vier beweringen uit
   CONNECT.md die je alleen op het SCHERM kunt zien:

   1. DE DEUR. Zonder ledensessie komt er geen ontdekking in beeld; wat er staat
      is de weigering van de server, niet een leeg vak dat als "niets gevonden"
      leest.
   2. DE MOTOREN MELDEN HARDOP DAT ZE NIET KIJKEN. De mixer verdeelt PLEKKEN en
      geen punten, en vijf van de acht motoren hebben geen bron. Die reden hoort
      in WOORDEN op het scherm te staan (KAARTEN.md par. 6: "hier is geen
      gebied" is niet "hier is geen motor"). Een motor die stil niets teruggeeft
      is niet te onderscheiden van een motor die stuk is.
   3. DE PLAATS WORDT GEVRAAGD EN NERGENS AFGELEID. Zonder plaats staat de zin
      van de server erbij in plaats van een stilzwijgend lege buurtlijst.
   4. HET WERK BIJWERKEN IS EEN HANDELING EN GEEN LEZING. Bij het openen van het
      scherm gaat er GEEN /api/connect/werk de deur uit -- pas als de mens
      drukt. Dat staat zo in de kop van kern/connect/werkbij.js, en het is
      precies het soort belofte dat stil sneuvelt zodra iemand hem "even" in
      laad() zet.

   WAT DEZE TOETS NIET BEWIJST: het leerdossier vult zich hier niet (daarvoor
   moet er echt iets gedaan zijn -- dat staat op de modules beproefd), en er
   wordt met opzet geen naklank gegeven: wat een TWEEDE mens in zijn dossier
   krijgt, hoort niet door een schermtoets te worden geschreven.

   Draai los: node --test test/connect-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  wachtTot, tekstVan } = require('./helper');

const pw = laadPlaywright();
const SCHERM = '/apps/connect.html';

test('Ontdekken: de deur, motoren die zeggen dat ze niet kijken, een gevraagde plaats, en werk bijwerken als handeling',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-connect-scherm-'));
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
      const reg = await post('/api/auth/register', { name: 'Kees Kijker', email: 'k' + u + '@x.nl',
        phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1990-05-05',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, 'het lid is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      const LID = reg.body.token;

      /* Twee onderwerpen, met opzet in OMGEKEERDE alfabetische volgorde
         genoteerd. Zou ik ze op alfabet invoeren, dan bewijst een antwoord op
         alfabet niets -- het kan dan net zo goed de invoervolgorde zijn. */
      for (const onderwerp of ['koken', 'breuken']) {
        const n = await post('/api/connect/noteer', { trede: 'begrepen', onderwerp }, LID);
        assert.equal(n.status, 200, 'noteren van "' + onderwerp + '": ' + JSON.stringify(n.body).slice(0, 160));
      }

      browser = await pw.chromium.launch(browserOpties(pw));

      /* 1. DE DEUR. */
      const gast = await browser.newContext({ viewport: { width: 900, height: 1000 } });
      await gast.addInitScript(() => {
        localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl');
      });
      const deur = await gast.newPage();
      await deur.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await wachtTot(deur, () => {
        const l = document.querySelector('#lijst');
        return l && l.textContent.trim().length > 0;
      }, null, { wat: 'de weigering zonder sessie' });
      assert.equal(await deur.locator('#lijst [data-id]').count(), 0,
        'zonder sessie stonden er toch ontdekkingen op het scherm');
      assert.ok((await tekstVan(deur, '#lijst')).trim().length > 0,
        'zonder sessie stond er een leeg vak; dat leest als "niets gevonden" in plaats van als een dichte deur');
      await gast.close();

      /* 2-4. HET LID. */
      const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, LID);
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      const verzoeken = [];
      page.on('request', (r) => { try { verzoeken.push(new URL(r.url()).pathname); } catch (e) { /* geen url */ } });
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await wachtTot(page, () => {
        const m = document.querySelector('#motoren');
        return m && m.querySelectorAll('.stilmotor').length > 0;
      }, null, { wat: 'de motorenlijst' });

      /* DIT SCHERM IS EEN TABBLADENSCHERM, en dat is precies waarom een
         schermtoets iets anders bewijst dan een routetoets. shared/deelmenu.js
         maakt van elke <section> met een kop een tabblad en toont er EEN
         tegelijk; de motoren en de plaats staan dus in het document maar zijn
         voor een mens niet te zien tot hij het tabblad opent. Een toets die
         alleen `textContent` leest, leest een verborgen tabblad en merkt nooit
         dat de knop onbereikbaar is -- zo viel de eerste versie van deze toets
         om op een klik die 56 keer opnieuw probeerde. */
      await page.waitForSelector('nav.rtgdeel-balk button', { timeout: 30000 });
      const tab = (naam) => page.locator('nav.rtgdeel-balk button').filter({ hasText: naam }).first();

      /* Het antwoord van de server ernaast, zodat het scherm wordt vergeleken
         met de BRON en niet met zichzelf. */
      const ontdek = await post('/api/connect/ontdek', {}, LID);
      assert.equal(ontdek.status, 200, JSON.stringify(ontdek.body).slice(0, 160));
      const motoren = ontdek.body.motoren || [];
      assert.ok(motoren.length >= 8, 'de mixer hoort acht motoren te noemen, kreeg ' + motoren.length);
      const zonderBron = motoren.filter((m) => !m.aangesloten);
      assert.ok(zonderBron.length >= 1,
        'geen enkele motor staat als niet-aangesloten; dan bewijst deze toets niets over het hardop melden');

      await tab('Waarom dit?').click();
      await page.locator('#motoren').waitFor({ state: 'visible', timeout: 20000 });
      assert.equal(await page.locator('#motoren .stilmotor').count(), motoren.length,
        'het scherm toont een ander aantal motoren dan de server noemt');

      /* DE TELLING EN NIET DE TEKST. Alle motoren zonder bron dragen dezelfde
         zin, dus `includes(reden)` zou na de eerste treffer voor alle vijf
         "slagen" -- een toets die niet kan uitslaan. Het scherm zet de reden in
         een <i> en alleen bij een motor die niet kijkt; dat AANTAL is dus de
         bewering, en die zakt zodra er een reden stil wegvalt. */
      assert.equal(await page.locator('#motoren .stilmotor i').count(), zonderBron.length,
        'het scherm toont ' + (await page.locator('#motoren .stilmotor i').count()) + ' redenen terwijl ' +
        zonderBron.length + ' motoren niet kijken; een motor die stil niets teruggeeft is niet te ' +
        'onderscheiden van een motor die stuk is');
      assert.ok((await tekstVan(page, '#motoren')).includes(zonderBron[0].reden),
        'de reden van een motor zonder bron staat niet letterlijk op het scherm');

      /* 3. DE PLAATS WORDT GEVRAAGD -- op het tabblad waar een mens hem ziet. */
      await tab('Jij').click();
      await page.locator('#plaats').waitFor({ state: 'visible', timeout: 20000 });
      assert.ok(ontdek.body.plaatsGevraagd,
        'zonder plaats hoort de server te zeggen dat hij er een nodig heeft');
      assert.equal(await tekstVan(page, '#plaatsNoot'), ontdek.body.plaatsGevraagd,
        'de zin over de plaats op het scherm is niet die van de server');
      assert.equal(await page.locator('#plaats').inputValue(), '',
        'er stond een plaats ingevuld die niemand heeft opgegeven -- die hoort nergens uit te worden afgeleid');

      /* 4. WERK BIJWERKEN IS EEN HANDELING. */
      assert.ok(!verzoeken.includes('/api/connect/werk'),
        'het scherm haalde het eigen werk op bij het openen; dat hoort een handeling te zijn en geen lezing');
      /* Ruim de tijd, en met de verzoeken in de melding. Deze toets draait in
         CI naast drie andere scherfprocessen; een krappe grens meet dan de
         drukte van de machine en niet de belofte van het scherm. */
      const werk = page.waitForResponse((r) => r.url().endsWith('/api/connect/werk'), { timeout: 60000 })
        .catch(() => null);
      await page.locator('#werkBij').click();
      const antwoord = await werk;
      assert.ok(antwoord, 'de knop "werk bijwerken" bereikte /api/connect/werk niet; wel gezien: ' +
        verzoeken.filter((p) => p.startsWith('/api/')).join(', '));
      assert.equal(antwoord.status(), 200, 'de knop "werk bijwerken" bereikt de route niet');

      /* HET DOSSIER IS GEEN NIVEAU.

         Wat hier NIET de bewering is: het veld `totaal`. Dat is de lengte van de
         lijst, nodig omdat `regels` wordt afgekapt -- een RIJTELLING en geen
         cijfer over een mens. Hier stond eerst dat `totaal` verboden was, en dat
         was een toets die het verkeerde ding mat.

         Wat het WEL is: `hoogste()` rekent intern met een `trap` per trede en
         geeft die met opzet NIET terug. Kwam hij mee, dan kan elk scherm het
         dossier alsnog op hoogte sorteren, en dan is er een ranglijst van je
         eigen leven -- precies wat CONNECT.md verbiedt. De volgorde is daarom
         het ALFABET, en dat is na te rekenen zodra er meer dan een onderwerp is. */
      const dossier = await post('/api/connect/dossier', {}, LID);
      assert.equal(dossier.status, 200);
      assert.ok(!('niveau' in dossier.body) && !('score' in dossier.body),
        'het dossier draagt een niveau of een score: ' + Object.keys(dossier.body).join(', '));
      const per = dossier.body.perOnderwerp || [];
      assert.ok(per.length >= 2,
        'minder dan twee onderwerpen in het dossier; dan zegt de volgorde niets (' + per.length + ')');
      for (const r of per) {
        assert.ok(!('trap' in r) && !('niveau' in r) && !('score' in r),
          'een dossierregel draagt de sorteersleutel mee (' + Object.keys(r).join(', ') +
          '); daarmee kan elk scherm alsnog op hoogte sorteren');
      }
      assert.deepEqual(per.map((r) => r.onderwerp),
        per.map((r) => r.onderwerp).slice().sort((a, b) => a.localeCompare(b)),
        'het dossier staat niet op alfabet; een lijst op hoogte is een ranglijst van je eigen leven');
      assert.equal(dossier.body.totaal, dossier.body.regels.length,
        '`totaal` is hier geen rijtelling maar iets anders geworden');

      assert.deepEqual(fouten, [], 'geen JS-fouten op het ontdekscherm: ' + fouten.join(' | '));
      await ctx.close();
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
