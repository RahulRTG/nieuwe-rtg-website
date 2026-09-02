/* DE BUURTRUIL (/apps/foundation/buurtruil.html) IN EEN ECHTE BROWSER.

   test/rtfos-gift-ruil-routes.test.js bewijst dat de zes ruilroutes hun
   grenzen hebben: alleen in een stad die open is, een aanbod aan een codenaam,
   belangstelling als signaal dat alleen de eigenaar ophaalt. Dat zegt niets
   over het scherm -- of het de dichte stad werkelijk niet aanbiedt, of de
   codenaam op het scherm staat en de naam niet, en of de eigenaar op zijn
   tabblad ziet WIE er belangstelling had. scripts/schermen.js eist daarom een
   eigen tocht door de browser.

   WAT DEZE TOETS VASTLEGT, en waarom juist dat:

   1. DE DEUR. Zonder ledensessie staat er een inlogkaart en geen app; er gaat
      geen enkel ruilverzoek de deur uit.
   2. ALLEEN EEN STAD DIE OPEN IS STAAT OP HET SCHERM. Een afdeling die nog
      niet van start is (Velsen) verschijnt niet als keuze; een open afdeling
      (Beverwijk) wel. Dat is grendel 4 uit kern/rtfos/ruil.js, op het scherm.
   3. DE KORTE TITEL WORDT GEWEIGERD VOORDAT ER IETS VERTREKT. "ab" geeft de
      zin "Wat is het?" en er gaat geen /ruil/plaats de deur uit.
   4. PLAATSEN IS EEN ECHTE HANDELING, EN HET AANBOD HANGT AAN EEN CODENAAM.
      Na de knop staat "Kinderfiets" in de lijst met de codenaam van de
      plaatser erbij; de echte naam en het e-mailadres staan nergens op het
      scherm. De eigenaar ziet zijn eigen knoppen ("Het is weg", "Intrekken")
      en niet de belangstellingsknop.
   5. BELANGSTELLING IS EEN SIGNAAL DAT DE EIGENAAR OPHAALT. Een tweede lid
      toont via de API belangstelling; op het tabblad "Van mij" staat dan
      "1 met belangstelling" MET de codenaam van dat lid -- en zonder zijn naam.
   6. SLUITEN HAALT HET AANBOD UIT DE BUURTLIJST. Na "Het is weg" is de lijst
      van de stad weer leeg, en de server zegt hetzelfde.

   Wat NIET is beproefd: melden (de browser vraagt daar een prompt() voor) en
   de rem op twintig open aanbiedingen -- die zijn op de route beproefd.

   Draai los: node --test test/buurtruil-scherm.e2e.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser,
  kantoorAlsPersoon, wachtTot, wachtOpTekst, tekstVan } = require('./helper');

const pw = laadPlaywright();
const SCHERM = '/apps/foundation/buurtruil.html';
const OFFICE_CODE = 'BUURTRUIL-SCHERM';

test('Buurtruil: de deur, alleen een open stad, plaatsen op codenaam, belangstelling voor de eigenaar, en sluiten',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-buurtruil-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE } });
    const post = async (pad, body, token) => {
      const r = await fetch(base + pad, { method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' },
          token ? { Authorization: 'Bearer ' + token } : {}),
        body: JSON.stringify(body || {}) });
      return { status: r.status, body: await r.json().catch(() => ({})) };
    };
    const lid = async (naam) => {
      const u = String(Date.now()).slice(-9) + String(Math.floor(Math.random() * 90) + 10);
      const reg = await post('/api/auth/register', { name: naam, email: 'x' + u + '@x.nl',
        phone: '06' + u.slice(-8), password: 'geheim12345', geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, naam + ' is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      return { token: reg.body.token, codenaam: reg.body.state.user.codename, naam, email: 'x' + u + '@x.nl' };
    };
    let browser;
    try {
      const kantoor = await kantoorAlsPersoon(base, OFFICE_CODE);
      assert.ok(kantoor, 'geen kantoorsessie; de steden komen daar vandaan');
      const open = await post('/api/rtfos/stad/maak', { naam: 'Beverwijk' }, kantoor);
      assert.equal(open.status, 200, JSON.stringify(open.body).slice(0, 160));
      const STAD = open.body.stad.id;
      const act = await post('/api/rtfos/stad/status', { id: STAD, status: 'actief' }, kantoor);
      assert.equal(act.status, 200, JSON.stringify(act.body).slice(0, 160));
      /* Een tweede afdeling die met opzet NIET wordt geopend. */
      const dicht = await post('/api/rtfos/stad/maak', { naam: 'Velsen' }, kantoor);
      assert.equal(dicht.status, 200, JSON.stringify(dicht.body).slice(0, 160));

      const A = await lid('Aafke Buur');
      const B = await lid('Bram Buur');

      browser = await pw.chromium.launch(browserOpties(pw));

      /* 1. De deur: zonder sessie een inlogkaart, en geen ruilverzoek. */
      const gast = await browser.newContext({ viewport: { width: 900, height: 900 } });
      await gast.addInitScript(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); localStorage.setItem('rtg_lang', 'nl'); });
      const deur = await gast.newPage();
      const deurVerzoeken = [];
      deur.on('request', (r) => { try { deurVerzoeken.push(new URL(r.url()).pathname); } catch (e) { /* geen url */ } });
      await deur.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });
      await wachtTot(deur, () => { const p = document.querySelector('#poort'); return p && !p.classList.contains('verborgen'); },
        null, { wat: 'de inlogkaart zonder sessie' });
      assert.ok(await deur.locator('#app').evaluate((el) => el.classList.contains('verborgen')),
        'zonder sessie stond de app toch open');
      assert.ok(await deur.locator('#poort a[href="/apps/app.html"]').count() > 0, 'de inlogkaart wijst niet naar het inlogscherm');
      assert.ok(!deurVerzoeken.some((p) => p.startsWith('/api/rtfos/ruil/')),
        'zonder sessie ging er toch een ruilverzoek de deur uit: ' + deurVerzoeken.filter((p) => p.startsWith('/api/')).join(', '));
      await gast.close();

      /* Het lid zelf. */
      const ctx = await browser.newContext({ viewport: { width: 900, height: 900 } });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_member_token', token);
        localStorage.setItem('rtg_lang', 'nl');
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, A.token);
      const page = await ctx.newPage();
      const fouten = [];
      letOpFouten(page, fouten);
      const verzoeken = [];
      page.on('request', (r) => { try { verzoeken.push(new URL(r.url()).pathname); } catch (e) { /* geen url */ } });
      await page.goto(base + SCHERM, { waitUntil: 'domcontentloaded' });

      /* 2. Alleen de open stad staat op het scherm. */
      await page.waitForSelector('#steden [data-stad]', { state: 'visible', timeout: 20000 });
      const steden = await page.locator('#steden [data-stad]').allTextContents();
      assert.ok(steden.some((s) => /Beverwijk/.test(s)), 'de open afdeling staat niet als keuze: ' + steden.join(' | '));
      assert.ok(!steden.some((s) => /Velsen/.test(s)), 'een afdeling die nog niet open is stond als keuze op het scherm');

      await page.locator('#steden [data-stad="' + STAD + '"]').click();
      await wachtTot(page, () => { const i = document.querySelector('#inhoud'); return i && !i.classList.contains('verborgen'); },
        null, { wat: 'de inhoud na het kiezen van een stad' });
      await wachtOpTekst(page, /Nog niets in deze stad/, { in: '#lijst' });
      assert.equal(await page.locator('#steden [data-stad="' + STAD + '"]').getAttribute('aria-pressed'), 'true');

      /* 3. De korte titel: geweigerd op het scherm, en er vertrekt niets. */
      const voorPlaats = verzoeken.filter((p) => p === '/api/rtfos/ruil/plaats').length;
      await page.locator('#nTitel').fill('ab');
      await page.locator('#plaats').click();
      await wachtOpTekst(page, /Wat is het\? Een paar woorden is genoeg/, { in: '#melding' });
      assert.equal(verzoeken.filter((p) => p === '/api/rtfos/ruil/plaats').length, voorPlaats,
        'een titel van twee tekens ging toch naar de server');

      /* 4. Plaatsen: een echte handeling, en het aanbod hangt aan een codenaam. */
      await page.locator('#nTitel').fill('Kinderfiets');
      await page.locator('#nWat').fill('Blauw, 16 inch');
      await page.locator('#nStaat').fill('gebruikt');
      const geplaatst = page.waitForResponse((r) => r.url().endsWith('/api/rtfos/ruil/plaats'), { timeout: 15000 });
      await page.locator('#plaats').click();
      assert.equal((await geplaatst).status(), 200, 'plaatsen via het scherm lukt');
      await wachtOpTekst(page, /Staat erbij/, { in: '#melding' });
      await wachtOpTekst(page, /Kinderfiets/, { in: '#lijst' });
      const lijst = await tekstVan(page, '#lijst');
      assert.match(lijst, /weg te geven/i, 'het soort van het aanbod staat er niet bij');
      assert.match(lijst, /Blauw, 16 inch/, 'de toelichting staat er niet bij');
      assert.ok(lijst.includes(A.codenaam), 'de codenaam van de plaatser staat niet bij het aanbod: ' + lijst.slice(0, 200));
      const heleTekst = await tekstVan(page, 'body');
      assert.ok(!heleTekst.includes(A.naam), 'de echte naam van de plaatser stond op het scherm');
      assert.ok(!heleTekst.includes(A.email), 'het e-mailadres van de plaatser stond op het scherm');
      assert.ok(await page.locator('#lijst [data-sluit]').count() === 1, 'de eigenaar ziet zijn "Het is weg"-knop niet');
      assert.ok(await page.locator('#lijst [data-intrek]').count() === 1, 'de eigenaar ziet zijn "Intrekken"-knop niet');
      assert.equal(await page.locator('#lijst [data-int]').count(), 0, 'de eigenaar kreeg een belangstellingsknop op zijn eigen aanbod');
      assert.equal(await page.locator('#nTitel').inputValue(), '', 'het titelveld is na het plaatsen niet leeggemaakt');

      /* Het staat ook op de server, op de codenaam uit de SESSIE. */
      const opServer = await post('/api/rtfos/ruil/lijst', { stad: STAD }, B.token);
      assert.equal(opServer.status, 200, JSON.stringify(opServer.body).slice(0, 160));
      const rij = (opServer.body.ruil || []).find((r) => r.titel === 'Kinderfiets');
      assert.ok(rij, 'het aanbod staat niet in de lijst van de buurt');
      assert.equal(rij.van, A.codenaam);

      /* 5. Belangstelling: een signaal dat de eigenaar ophaalt, met de codenaam. */
      const interesse = await post('/api/rtfos/ruil/interesse', { id: rij.id }, B.token);
      assert.equal(interesse.status, 200, JSON.stringify(interesse.body).slice(0, 160));
      await page.locator('#tabs [data-tab="mijn"]').click();
      await wachtOpTekst(page, /1 met belangstelling/, { in: '#lijst' });
      const mijn = await tekstVan(page, '#lijst');
      assert.ok(mijn.includes(B.codenaam), 'de eigenaar ziet niet WIE er belangstelling had (codenaam): ' + mijn.slice(0, 200));
      assert.ok(!mijn.includes(B.naam), 'de echte naam van de belangstellende stond op het scherm van de eigenaar');

      /* 6. Sluiten haalt het aanbod uit de buurtlijst. */
      const gesloten = page.waitForResponse((r) => r.url().endsWith('/api/rtfos/ruil/sluit'), { timeout: 15000 });
      await page.locator('#lijst [data-sluit="' + rij.id + '"]').click();
      assert.equal((await gesloten).status(), 200, 'sluiten via het scherm lukt');
      await wachtOpTekst(page, /Afgerond/, { in: '#melding' });
      await page.locator('#tabs [data-tab=""]').click();
      await wachtOpTekst(page, /Nog niets in deze stad/, { in: '#lijst' });
      const naSluiten = await post('/api/rtfos/ruil/lijst', { stad: STAD }, B.token);
      assert.ok(!(naSluiten.body.ruil || []).some((r) => r.id === rij.id), 'een gesloten aanbod stond nog in de buurtlijst van de server');

      assert.deepEqual(fouten, [], 'geen JS-fouten op de buurtruil: ' + fouten.join(' | '));
      await ctx.close();
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
