/* DE WINKEL VAN DE RTFOUNDATION (/apps/foundation/winkel.html) IN EEN ECHTE
   BROWSER.

   kern/rtfos/winkel.js draagt vier grendels en test/rtfos-gift-ruil-routes.test.js
   beproeft ze over de draad: geen voorraad geen verkoop, de prijs komt nooit uit
   de browser, het geld landt bij de stichting, en een aankoop is geen gift. Dat
   zegt niets over het scherm: of het de zin "geen giftbewijs" toont VOORDAT er
   gekocht wordt, of het alleen (artikelId, aantal) de deur uit stuurt, en of een
   weigering van de server op het scherm terechtkomt in plaats van in een lege
   plek. scripts/schermen.js eist daarom een eigen tocht door de browser.

   WAT DEZE TOETS VASTLEGT, en waarom juist dat:

   1. DE DEUR. Zonder ledensessie een inlogkaart, geen etalage-aanroep en geen
      "wat je hebt gekocht".
   2. DE ETALAGE ZEGT WAT HET IS. De zin boven de winkel is letterlijk `uitleg`
      van de server en zegt dat een aankoop geen aftrekbare gift is en er geen
      giftbewijs komt; de prijs en de voorraad op de kaart zijn die van de server.
   3. ZONDER POSITIE VAN DE STICHTING WORDT ER NIETS AFGEREKEND. Op een verse
      server heeft de stichting geen walletcode; kopen geeft een 409 met "geen
      positie in RTG Pay" op het scherm, en er staat daarna geen bestelling.
   4. DE WINKEL IS GEEN GIFTWEG. De boardroom zet alleen de ONTVANGER; de
      giftstand blijft dicht -- en de winkel verkoopt dan wel. Twee walletcodes
      naast elkaar zou betekenen dat een boek ergens anders binnenkomt dan een
      gift; een dichte giftstand die de winkel sluit zou betekenen dat een
      aankoop een gift is.
   5. DE VOORRAAD IS EINDIG, EN DAT ZEGT DE SERVER. Vijf willen bij twee op
      voorraad geeft "Er zijn er nog 2" op het scherm en geen bestelling.
   6. DE PRIJS KOMT VAN DE SERVER. Het verzoek dat het scherm stuurt bevat
      alleen artikelId en aantal (geen euro, geen centen); na de koop staat op
      het scherm de melding van de server met "geen giftbewijs", de voorraad op
      de kaart is een lager, en "wat je hebt gekocht" toont de prijs van de
      server met de stand `klaar` -- de stand die een mens verder zet, niet de
      software.

   Wat NIET is beproefd: het kantoor dat een bestelling op verstuurd of
   opgehaald zet (kantoorscherm), en RTG Pay zelf -- wat hier telt is dat het
   scherm langs die ene betaalweg gaat en er niets omheen bouwt.

   Draai los: node --test test/winkel-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  kantoorAlsPersoon, wachtTot, wachtOpTekst, tekstVan } = require('./helper');

const pw = laadPlaywright();
const SCHERM = '/apps/foundation/winkel.html';
const OFFICE_CODE = 'WINKEL-SCHERM';

test('Winkel: de deur, de etalage zegt "geen giftbewijs", zonder positie geen koop, de winkel is geen giftweg, de voorraad is eindig en de prijs komt van de server',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-winkel-scherm-'));
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
      const kantoor = await kantoorAlsPersoon(base, OFFICE_CODE);
      assert.ok(kantoor, 'geen kantoorsessie; het artikel komt daar vandaan');
      const art = await post('/api/rtfos/winkel/artikel/zet', { naam: 'Katoenen tas', euro: 12.5, voorraad: 2, doel: 'Taalcafe' }, kantoor);
      assert.equal(art.status, 200, JSON.stringify(art.body).slice(0, 160));
      const ARTIKEL = art.body.artikel.id;

      const u = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90) + 10);
      const reg = await post('/api/auth/register', { name: 'Koos Koper', email: 'x' + u + '@x.nl',
        phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, 'het lid is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      const LID = reg.body.token;
      const etalage = await post('/api/rtfos/winkel', {}, LID);
      assert.equal(etalage.status, 200, JSON.stringify(etalage.body).slice(0, 160));

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
      assert.ok(await deur.locator('#mijnKaart').evaluate((el) => el.classList.contains('verborgen')), 'zonder sessie stond "wat je hebt gekocht" open');
      assert.equal(await deur.locator('[data-koop]').count(), 0, 'zonder sessie stond er een koopknop');
      assert.ok(!deurVerzoeken.some((p) => p.startsWith('/api/rtfos/winkel')),
        'zonder sessie ging er toch een winkelverzoek de deur uit: ' + deurVerzoeken.filter((p) => p.startsWith('/api/')).join(', '));
      await gast.close();

      /* Het lid. */
      const ctx = await browser.newContext({ viewport: { width: 900, height: 1000 } });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, LID);
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      /* Wat het scherm bij een koop de deur uit stuurt -- de hele body, want de
         bewering is dat er GEEN bedrag in staat. */
      const koopLijven = [];
      page.on('request', (r) => { if (r.url().endsWith('/api/rtfos/winkel/koop')) koopLijven.push(r.postData() || ''); });
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-koop="' + ARTIKEL + '"]', { state: 'visible', timeout: 20000 });

      /* 2. De etalage zegt wat het is. */
      const wuitleg = await tekstVan(page, '#wuitleg');
      assert.equal(wuitleg, etalage.body.uitleg, 'de zin boven de winkel is niet de zin van de server');
      assert.match(wuitleg, /geen giftbewijs/, 'de etalage zegt niet dat er geen giftbewijs komt');
      assert.match(wuitleg, /geen aftrekbare gift/);
      const kaart = await tekstVan(page, '#winkelIn');
      assert.match(kaart, /Katoenen tas/i); // de kop is met CSS in kapitalen gezet
      assert.match(kaart, /€ 12,50/, 'de prijs op de kaart is niet die van de server');
      assert.match(kaart, /nog 2 beschikbaar/, 'de voorraad op de kaart is niet die van de server');
      assert.match(kaart, /Opbrengst gaat naar: Taalcafe/);
      await wachtOpTekst(page, /nog niets gekocht/, { in: '#mijnIn' });

      /* 3. Zonder positie van de stichting wordt er niets afgerekend. */
      const zonder = page.waitForResponse((r) => r.url().endsWith('/api/rtfos/winkel/koop'), { timeout: 15000 });
      await page.locator('[data-koop="' + ARTIKEL + '"]').click();
      assert.equal((await zonder).status(), 409, 'zonder walletcode van de stichting werd er toch afgerekend');
      await wachtOpTekst(page, /geen positie in RTG Pay/, { in: '#melding' });
      assert.match(await tekstVan(page, '#melding'), /niets afgerekend/);
      const nogNiets = await post('/api/rtfos/winkel/mijn', {}, LID);
      assert.deepEqual(nogNiets.body.bestellingen, [], 'er stond een bestelling klaar zonder betaling');
      assert.equal(await page.locator('[data-koop="' + ARTIKEL + '"]').isDisabled(), false, 'na de weigering bleef de koopknop uitgeschakeld');

      /* 4. De winkel is geen giftweg: alleen de ontvanger, de giftstand blijft dicht. */
      const ontvanger = await post('/api/rtfos/gift/stand/zet', { ontvanger: { soort: 'wallet', code: 'RTF-WALLET' } }, kantoor);
      assert.equal(ontvanger.status, 200, JSON.stringify(ontvanger.body).slice(0, 160));
      assert.equal(ontvanger.body.stand, 'dicht', 'de giftstand ging open door alleen een ontvanger te zetten');
      const giftDicht = await post('/api/rtfos/gift/voorbereid', { euro: 10 }, LID);
      assert.equal(giftDicht.status, 409, 'de giftweg stond open terwijl alleen de winkel een positie nodig had');

      /* 5. De voorraad is eindig, en dat zegt de server. */
      await page.locator('[data-aantal="' + ARTIKEL + '"]').fill('5');
      const teveel = page.waitForResponse((r) => r.url().endsWith('/api/rtfos/winkel/koop'), { timeout: 15000 });
      await page.locator('[data-koop="' + ARTIKEL + '"]').click();
      assert.equal((await teveel).status(), 409, 'vijf kopen bij twee op voorraad kwam erdoor');
      await wachtOpTekst(page, /Er zijn er nog 2/, { in: '#melding' });
      assert.deepEqual((await post('/api/rtfos/winkel/mijn', {}, LID)).body.bestellingen, [], 'een geweigerde koop liet een bestelling achter');

      /* 6. De prijs komt van de server. */
      await page.locator('[data-aantal="' + ARTIKEL + '"]').fill('1');
      const koop = page.waitForResponse((r) => r.url().endsWith('/api/rtfos/winkel/koop'), { timeout: 15000 });
      await page.locator('[data-koop="' + ARTIKEL + '"]').click();
      const koopAntwoord = await koop;
      assert.equal(koopAntwoord.status(), 200, 'kopen via het scherm lukt: ' + (await koopAntwoord.text()).slice(0, 160));
      const koopLijf = await koopAntwoord.json();
      assert.ok(koopLijven.length >= 1, 'er is geen koopverzoek gezien');
      for (const lijf of koopLijven) {
        const gestuurd = JSON.parse(lijf);
        assert.deepEqual(Object.keys(gestuurd).sort(), ['aantal', 'artikelId'],
          'het scherm stuurde meer dan (artikelId, aantal) mee: ' + lijf);
      }
      assert.equal(koopLijf.meegestuurd, null, 'de server meldde een meegestuurd bedrag');
      /* De zin komt van de server (kern/rtfos/winkel.js) en zegt het bedrag
         zoals de kaart het zegt ("€ 12,50"). Hij schreef het eerst als kaal
         getal ("voor 12.5."), gevonden door deze toets op 2 september 2026;
         het scherm zet er zelf niets bij, dit is de zin van de server. */
      await wachtOpTekst(page, /Gekocht: Katoenen tas voor € 12,50\./, { in: '#melding' });
      assert.equal(await tekstVan(page, '#melding'), koopLijf.zegt.join(' '),
        'de melding na de koop is niet letterlijk wat de server zei');
      const melding = await tekstVan(page, '#melding');
      assert.match(melding, /geen giftbewijs/, 'na de koop staat er niet dat dit geen gift is');
      assert.match(melding, /zet een mens van de stichting dat hier/, 'het scherm belooft meer dan de server: wie de stand zet');
      assert.ok(await page.locator('#melding .melder.goed').count() === 1, 'een gelukte koop stond niet als gelukt op het scherm');
      await wachtOpTekst(page, /nog 1 beschikbaar/, { in: '#winkelIn' });
      await wachtOpTekst(page, /Katoenen tas/, { in: '#mijnIn' });
      const mijn = await tekstVan(page, '#mijnIn');
      assert.match(mijn, /€ 12,50/, 'de prijs in "wat je hebt gekocht" is niet die van de server');
      assert.match(mijn, /klaar/, 'de stand van de bestelling is niet "klaar" -- de software zette hem zelf verder');
      assert.ok(!/verstuurd|opgehaald/.test(mijn), 'de winkel vinkte zelf af dat er iets verstuurd of opgehaald is');
      const opServer = await post('/api/rtfos/winkel/mijn', {}, LID);
      assert.equal(opServer.body.bestellingen.length, 1);
      assert.equal(opServer.body.bestellingen[0].euro, 12.5);
      assert.equal(opServer.body.bestellingen[0].stand, 'klaar');

      assert.deepEqual(fouten, [], 'geen JS-fouten op de winkel: ' + fouten.join(' | '));
      await ctx.close();
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
