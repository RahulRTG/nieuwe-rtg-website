/* GEVEN AAN DE RTFOUNDATION (/apps/foundation/geven.html) IN EEN ECHTE BROWSER.

   GIFT.md zegt het met zoveel woorden: er is met opzet GEEN doneerknop. De
   giftstand is een positie die de boardroom zet, standaard dicht, en zolang
   hij dicht staat weigert /api/rtfos/gift/voorbereid met de reden erbij
   (test/rtfos-gift-ruil-routes.test.js, toets 7). Dat bewijst de route. Dit
   bestand bewijst het SCHERM: dat een lid die dichte stand LEEST in de zin
   van de server en niet in een grijze knop, dat er dan geen rekenknop en geen
   bevestigknop op het scherm staat, en dat -- als de boardroom hem heeft
   opengezet -- het voornemen letterlijk de zinnen van de server toont en er
   niets beweegt. scripts/schermen.js eist daarom een eigen tocht.

   WAT DEZE TOETS VASTLEGT, en waarom juist dat:

   1. DE DEUR. Zonder ledensessie een inlogkaart; er gaat geen giftverzoek de
      deur uit.
   2. DE DICHTE STAND IS EEN SCHERM EN GEEN GRIJZE KNOP. Met de standaardstand
      staat de kaart "Geven kan hier nog niet" met de uitleg van de server
      ("RTG neemt geen giften aan. Dit is geen storing maar een stand ..."),
      de app met #reken en #bevestig staat NIET op het scherm, en er is geen
      /voorbereid en geen /bevestig verstuurd.
   3. NA HET BESLUIT VAN DE BOARDROOM: het voornemen komt van de server. Het
      bedrag in beeld is het bedrag uit het antwoord, de gevolgen zijn de
      zinnen uit `zegt` (gift zonder tegenprestatie, direct naar de stichting,
      niet aftrekbaar want de ANBI is nog aangevraagd), en onder het voornemen
      staat `nietGedaan`: er is niets betaald en niets vastgelegd.
   4. DE TEGENPRESTATIE VERANDERT WAT HET IS. Met het vinkje "er staat iets
      tegenover" zegt het voornemen sponsoring, factuur en geen giftbewijs.
   5. ER BEWEEGT GEEN GELD. Bevestigen wordt hier met opzet NIET aangeraakt:
      de knop is pas zichtbaar na het voornemen, en in de hele tocht is er
      geen enkel verzoek aan /api/rtfos/gift/bevestig geweest.

   Wat NIET is beproefd: /api/rtfos/gift/bevestig zelf (de enige plek waar
   geld beweegt), het meerjarige plan en de machtiging -- die staan op de
   route beproefd, en een schermtoets die geld laat bewegen omdat de knop er
   staat, is precies wat GIFT.md niet wil.

   Draai los: node --test test/geven-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  kantoorAlsPersoon, wachtTot, wachtOpTekst, tekstVan } = require('./helper');

const pw = laadPlaywright();
const SCHERM = '/apps/foundation/geven.html';
const OFFICE_CODE = 'GEVEN-SCHERM';

test('Geven: de deur, de dichte stand met reden en zonder knop, en daarna een voornemen van de server waar niets bij beweegt',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-geven-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
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
      const reg = await post('/api/auth/register', { name: 'Gijs Gever', email: 'x' + u + '@x.nl',
        phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, 'het lid is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      const LID = reg.body.token;

      /* De stand zoals hij op een verse server staat -- hier wordt niets aan
         gezet; dat is de bewering. */
      const stand = await post('/api/rtfos/gift/stand', {}, LID);
      assert.equal(stand.status, 200, JSON.stringify(stand.body).slice(0, 160));
      assert.equal(stand.body.stand, 'dicht', 'de giftstand staat op een verse server niet dicht');

      browser = await pw.chromium.launch(browserOpties(pw));

      /* 1. De deur. */
      const gast = await browser.newContext({ viewport: { width: 900, height: 1000 } });
      await gast.addInitScript(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl'); });
      const deur = await gast.newPage();
      const deurVerzoeken = [];
      deur.on('request', (r) => { try { deurVerzoeken.push(new URL(r.url()).pathname); } catch (e) { /* geen url */ } });
      await deur.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await wachtTot(deur, () => { const p = document.querySelector('#poort'); return p && !p.classList.contains('verborgen'); },
        null, { wat: 'de inlogkaart zonder sessie' });
      assert.ok(await deur.locator('#app').evaluate((el) => el.classList.contains('verborgen')), 'zonder sessie stond de app open');
      assert.ok(await deur.locator('#dicht').evaluate((el) => el.classList.contains('verborgen')), 'zonder sessie stond de dichte-stand-kaart open');
      assert.ok(!deurVerzoeken.some((p) => p.startsWith('/api/rtfos/gift/')),
        'zonder sessie ging er toch een giftverzoek de deur uit: ' + deurVerzoeken.filter((p) => p.startsWith('/api/')).join(', '));
      await gast.close();

      /* 2. De dichte stand, gelezen door een lid. */
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
      await wachtTot(page, () => { const d = document.querySelector('#dicht'); return d && !d.classList.contains('verborgen'); },
        null, { wat: 'de kaart "Geven kan hier nog niet"' });
      const dichtzin = await tekstVan(page, '#dichtzin');
      assert.equal(dichtzin, stand.body.uitleg, 'de reden op het scherm is niet de zin van de server');
      assert.match(dichtzin, /geen giften aan/i);
      assert.match(dichtzin, /geen storing/i, 'een dichte knop leest als een storing');
      assert.ok(await page.locator('#app').evaluate((el) => el.classList.contains('verborgen')), 'de app stond open terwijl de stand dicht is');
      assert.equal(await page.locator('#reken').isVisible(), false, 'de rekenknop stond op het scherm terwijl de stand dicht is');
      assert.equal(await page.locator('#bevestig').isVisible(), false, 'de bevestigknop stond op het scherm terwijl de stand dicht is');
      assert.ok(await page.locator('#dicht a[href="os-donateur.html"]').count() > 0, 'de dichte kaart wijst niet naar het donateursoverzicht');
      assert.ok(!verzoeken.includes('/api/rtfos/gift/voorbereid'), 'bij een dichte stand ging er toch een voornemen de deur uit');
      assert.ok(!verzoeken.includes('/api/rtfos/gift/bevestig'), 'bij een dichte stand ging er toch een bevestiging de deur uit');

      /* 3. De boardroom neemt de besluiten en zet de stand om. Dat is geen
         omweg om de grens heen: het IS de grens -- de knop wordt door een mens
         gezet en door niemand anders. */
      const kantoor = await kantoorAlsPersoon(base, OFFICE_CODE);
      assert.ok(kantoor, 'geen kantoorsessie; de giftstand komt daar vandaan');
      const besluiten = await post('/api/rtfos/gift/stand/zet', {
        ontvanger: { soort: 'wallet', code: 'RTF-WALLET' },
        vormen: ['eenmalig', 'geoormerkt', 'periodiek'], anbi: 'aangevraagd' }, kantoor);
      assert.equal(besluiten.status, 200, JSON.stringify(besluiten.body).slice(0, 160));
      assert.equal(besluiten.body.stand, 'dicht', 'het invullen van de besluiten opende de knop vanzelf');
      const open = await post('/api/rtfos/gift/stand/zet', { stand: 'open' }, kantoor);
      assert.equal(open.status, 200, JSON.stringify(open.body).slice(0, 160));
      assert.equal(open.body.stand, 'open');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#reken', { state: 'visible', timeout: 20000 });
      assert.ok(await page.locator('#dicht').evaluate((el) => el.classList.contains('verborgen')), 'de dichte kaart bleef staan nadat de stand open ging');
      assert.equal(await page.locator('#vorm option').count(), 3, 'de vormen komen niet van de server');
      assert.equal(await page.locator('#bevestig').isVisible(), false, 'de bevestigknop stond er al voordat er een voornemen was');
      assert.ok(await page.locator('#planKaart').isVisible(), 'de vorm periodiek staat open maar het meerjarige plan staat niet op het scherm');

      await page.locator('#bedragen [data-bedrag="25"]').click();
      assert.equal(await page.locator('#euro').inputValue(), '25');
      const voornemen = page.waitForResponse((r) => r.url().endsWith('/api/rtfos/gift/voorbereid'), { timeout: 15000 });
      await page.locator('#reken').click();
      const antwoord = await voornemen;
      assert.equal(antwoord.status(), 200, 'het voornemen komt van de server');
      const lijf = await antwoord.json();
      await wachtTot(page, () => { const v = document.querySelector('#voornemen'); return v && !v.classList.contains('verborgen'); },
        null, { wat: 'het voornemen op het scherm' });
      assert.equal(await tekstVan(page, '#vBedrag'), '€ 25,00');
      assert.equal(lijf.voornemen.euro, 25);
      const gevolgen = await page.locator('#vGevolgen .gevolg').allTextContents();
      assert.deepEqual(gevolgen.map((g) => g.trim()), lijf.zegt, 'de gevolgen op het scherm zijn niet letterlijk de zinnen van de server');
      assert.ok(gevolgen.some((g) => /Dit is een gift: er staat niets tegenover/.test(g)));
      assert.ok(gevolgen.some((g) => /direct naar de stichting/.test(g)));
      assert.ok(gevolgen.some((g) => /niet aftrekbaar/.test(g)), 'een aangevraagde ANBI las als aftrekbaar');
      assert.equal(await tekstVan(page, '#vNiets'), lijf.nietGedaan);
      assert.match(await tekstVan(page, '#vNiets'), /niets betaald en niets vastgelegd/);
      assert.match(await tekstVan(page, '#vKosten'), /transactiekosten/, 'de kosten staan niet VOORAF bij het voornemen');
      assert.ok(await page.locator('#bevestig').isVisible(), 'na het voornemen hoort de bevestigknop er te staan -- anders zegt de grens hierna niets');

      /* 4. De tegenprestatie verandert wat het is. */
      await page.locator('#tegen').check();
      const spons = page.waitForResponse((r) => r.url().endsWith('/api/rtfos/gift/voorbereid'), { timeout: 15000 });
      await page.locator('#reken').click();
      assert.equal((await spons).status(), 200);
      await wachtOpTekst(page, /sponsoring/, { in: '#vGevolgen' });
      const sponsTekst = await tekstVan(page, '#vGevolgen');
      assert.match(sponsTekst, /factuur/, 'bij een tegenprestatie staat er geen factuur in het voornemen');
      assert.match(sponsTekst, /geen giftbewijs/, 'bij een tegenprestatie staat er niet dat er geen giftbewijs komt');
      assert.ok(!/Dit is een gift: er staat niets tegenover/.test(sponsTekst), 'sponsoring heette op het scherm nog een gift');

      /* 5. Er beweegt geen geld: in de hele tocht is er niet bevestigd. */
      assert.ok(!verzoeken.includes('/api/rtfos/gift/bevestig'), 'er ging een bevestiging de deur uit terwijl niemand bevestigde');
      const overzicht = await post('/api/rtfos/gift/plan/mijn', {}, LID);
      assert.equal(overzicht.status, 200);
      assert.deepEqual(overzicht.body.plannen, [], 'er stond een meerjarig plan terwijl er alleen een voornemen is gevraagd');

      assert.deepEqual(fouten, [], 'geen JS-fouten op het geverscherm: ' + fouten.join(' | '));
      await ctx.close();
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
