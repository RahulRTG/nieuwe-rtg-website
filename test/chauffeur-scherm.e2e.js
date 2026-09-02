/* DE CHAUFFEURS-PDA IN EEN ECHTE BROWSER: van ritaanvraag tot afgeronde dienst.

   WAAROM DEZE TOETS BESTAAT

   test/mobiliteit.test.js bewijst de keten aan de API, en
   test/mobiliteitscherm.e2e.js legt de reiziger en de dispatcher af. De PDA van
   de chauffeur (/apps/chauffeur.html) legde nog geen enkele toets af:
   scripts/schermen.js telde hem als scherm zonder eigen toets. Dat is precies
   het scherm waar een mens langs de weg op leunt, en "de pagina laadt" zegt
   daar niets over.

   WAT DIT VASTLEGT, EN WELKE GRENS

   1. DE DEUR. Zonder personeelssessie zegt de PDA dat je niet bent AANGEMELD,
      met de weg naar de personeelslogin -- en niet dat de verbinding stuk is.
      Dat onderscheid staat met naam in chauffeur.js (laad()): een chauffeur
      langs de weg gaat anders zijn netwerk zoeken in plaats van inloggen.
   2. DE RIT. De chauffeur van de vervoerder ziet de aanvraag van een lid,
      neemt hem aan via het dialoogvenster en loopt daarna de keten af met de
      ene knop op de kaart: onderweg, aangekomen, aan boord, rijdt, voltooid.
      Elke stap is een echte aanroep van /api/staff/mob/status. De VOLGORDE
      bepaalt de server (kern/mobiliteit/keten.js) en niet het scherm: een
      sprong wordt geweigerd met de reden erbij, en daarom staat er maar een
      knop.
   3. DE POSITIE. "Deel huidige positie" (#deelPositie) is dood zonder levende
      rit, stuurt tijdens de rit de echte browserlocatie naar
      /api/staff/mob/positie, en is na afronding weer dood. Dat is de
      privacyregel onder de knop, nagemeten in plaats van gelezen.
   4. VANDAAG. #verversVandaag haalt /api/staff/mob/mijn opnieuw op, en de
      afgeronde rit staat daarna in het ritlog met het aantal op 1.

   NIET BEPROEFD: apparaatmeldingen en voorlezen (Notification en
   speechSynthesis zijn er niet in een headless browser), het incident en de
   Magnaat-trainingskopie (die heeft zijn eigen ingang en raakt de API niet).

   Draai los: node --test test/chauffeur-scherm.e2e.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

const PAPIEREN_OK = { kenteken: '2030-01-01', verzekering: '2030-01-01', apk: '2030-01-01',
  taxivergunning: '2030-01-01', boordcomputer: '2030-01-01' };
/* De locatie die de browser "meet". Een echt getal, zodat de toets kan
   nagaan dat wat de server kreeg de browserlocatie is en niet een vast punt
   uit het scherm. */
const HIER = { latitude: 38.9102, longitude: 1.4347 };

async function post(base, pad, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(base + pad, { method: 'POST', headers, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('RTG Chauffeur: de PDA weigert zonder personeelssessie, neemt een rit aan en loopt de keten af',
  { skip: geenBrowser(pw) }, async () => {
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-chauffeur-scherm-'));
    const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
    let browser;
    try {
      /* ---- de sessies: een reiziger, de centrale, en de chauffeur ---- */
      const u = Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
      const reg = await post(base, '/api/auth/register', { name: 'Reiziger', email: 'ch' + u + '@x.nl',
        phone: '06' + u.slice(0, 8), password: 'geheim12345', geboortedatum: '1990-03-03',
        tier: 'rtg', pasApp: 'rtg' });
      assert.ok(reg.body.token, 'het lid is aangemeld: ' + JSON.stringify(reg.body).slice(0, 160));
      const lid = reg.body.token;

      const roster = await post(base, '/api/supplier/roster', { code: 'MKKX' });
      const manager = (roster.body.staff || []).find(s => s.role === 'manager');
      const chauffeur = (roster.body.staff || []).find(s => s.role !== 'manager');
      assert.ok(manager && chauffeur, 'de taxizaak heeft een centrale en een chauffeur');
      const zaak = (await post(base, '/api/supplier/login', { code: 'MKKX', staffId: manager.id, pin: '1234' })).body.token;
      assert.ok(zaak, 'de centrale logt in');
      /* De wagen staat op naam van de chauffeur: de PDA koppelt het voertuig
         aan de aangemelde persoon, en zonder eigen wagen kan hij niets aannemen. */
      const wagen = await post(base, '/api/supplier/mob/voertuig', { categorie: 'taxi', naam: 'Wagen van de dienst',
        loc: { lat: 38.909, lng: 1.433 }, energieNiveau: 80, bestuurder: chauffeur.name, papieren: PAPIEREN_OK }, zaak);
      assert.equal(wagen.body.asset && wagen.body.asset.inzetbaar, true, 'de wagen mag rijden: ' + JSON.stringify(wagen.body).slice(0, 160));
      const pda = (await post(base, '/api/supplier/login', { code: 'MKKX', staffId: chauffeur.id, pin: '5678' })).body.token;
      assert.ok(pda, 'de chauffeur logt in op de PDA');

      const rit = await post(base, '/api/mob/vraag', { ritsoort: 'direct', categorie: 'taxi',
        van: { lat: 38.908, lng: 1.432, label: 'Marina Botafoch' }, naar: { zaak: 'KIKUNOI' }, stad: 'Ibiza' }, lid);
      const ref = rit.body.opdracht && rit.body.opdracht.ref;
      assert.ok(ref, 'het lid heeft een rit aangevraagd: ' + JSON.stringify(rit.body).slice(0, 160));

      browser = await pw.chromium.launch(browserOpties(pw));

      /* ---- 1. de deur: zonder sessie is het AANMELDEN, geen storing ---- */
      {
        const ctx = await browser.newContext({ viewport: { width: 420, height: 860 } });
        await ctx.addInitScript(() => { localStorage.setItem('rtg_cookieinfo_v1', '1'); });
        const page = await ctx.newPage();
        const fouten = letOpFouten(page, []);
        await page.goto(base + '/apps/chauffeur.html', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#werkstapel .foutkaart', { state: 'visible', timeout: 20000 });
        const kaart = await page.locator('#werkstapel .foutkaart').textContent();
        assert.match(kaart, /AANMELDEN NODIG/, 'de kaart zegt dat er aangemeld moet worden: ' + kaart.slice(0, 160));
        assert.match(kaart, /U bent niet aangemeld als chauffeur/);
        assert.doesNotMatch(kaart, /VERBINDING NODIG|PROBEER OPNIEUW/, 'niet aangemeld is geen storing, en krijgt geen knop die niets oplost');
        assert.equal(await page.locator('#werkstapel .foutkaart a.hoofdactie').getAttribute('href'),
          '/apps/leverancier.html', 'de uitweg is de personeelslogin');
        assert.match(await page.locator('#verbinding').textContent(), /AANMELDEN/,
          'de verbindingschip zegt AANMELDEN en niet STORING');
        assert.equal((await page.locator('#sessieStand').textContent()).trim(), 'Niet aangemeld');
        assert.deepEqual(fouten, [], 'geen JS-fouten op de dichte deur: ' + fouten.join(' | '));
        await ctx.close();
      }

      /* ---- 2. de rit, met de aangemelde chauffeur ---- */
      const ctx = await browser.newContext({ viewport: { width: 420, height: 860 },
        geolocation: HIER, permissions: ['geolocation'] });
      await ctx.addInitScript((token) => {
        localStorage.setItem('rtg_pda_token', token);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
      }, pda);
      const page = await ctx.newPage();
      const fouten = letOpFouten(page, []);
      await page.goto(base + '/apps/chauffeur.html', { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#werkstapel .ritkaart.nieuw', { state: 'visible', timeout: 20000 });

      const aanvraag = await page.locator('#werkstapel .ritkaart.nieuw').textContent();
      assert.match(aanvraag, /NIEUWE RITAANVRAAG/);
      assert.match(aanvraag, /Marina Botafoch/, 'het vertrekpunt van het lid staat op de kaart');
      assert.match(aanvraag, /Sal de Mar/, 'en de bestemming');
      assert.match(aanvraag, /€/, 'met de ritprijs, uit de server');
      assert.match(await page.locator('#groet').textContent(),
        new RegExp(chauffeur.name.split(/\s+/)[0].toUpperCase()), 'de PDA groet de aangemelde chauffeur bij zijn voornaam');
      assert.equal((await page.locator('#modusLabel').textContent()).trim(), 'LIVE', 'dit is de echte PDA en geen trainingskopie');
      assert.equal(await page.locator('#deelPositie').isDisabled(), true, 'zonder levende rit is de positieknop dood');

      // bekijken, en aannemen via het dialoogvenster
      await page.locator('#werkstapel .ritkaart.nieuw button.hoofdactie').click();
      await page.waitForSelector('#ritDialoog[open]', { timeout: 10000 });
      assert.match(await page.locator('#dialoogFeiten').textContent(), new RegExp(ref), 'het dialoogvenster toont de referentie van deze rit');
      const toegewezen = page.waitForResponse(r => r.url().endsWith('/api/supplier/mob/toewijzen'));
      await page.locator('#accepteerRit').click();
      assert.equal((await toegewezen).status(), 200, 'aannemen via het scherm lukt');
      await page.waitForSelector('#werkstapel .ritkaart.actief', { state: 'visible', timeout: 20000 });
      assert.equal((await page.locator('#rittenTitel').textContent()).trim(), 'RIT TOEGEWEZEN');
      assert.equal((await page.locator('#werkstapel .statuschip').textContent()).trim(), 'Rit aangenomen');
      assert.equal(await page.locator('#pda').getAttribute('data-ritfase'), 'geaccepteerd');

      /* DE VOLGORDE IS VAN DE SERVER. Het scherm toont een knop; dat het er
         maar een is, komt doordat de keten een sprong weigert -- met de reden
         en met wat er wel mag. */
      const sprong = await post(base, '/api/staff/mob/status', { ref, status: 'voltooid' }, pda);
      assert.equal(sprong.status, 409, 'van aangenomen meteen naar voltooid wordt geweigerd: ' + JSON.stringify(sprong.body));
      assert.match(sprong.body.error || '', /onderweg/, 'en de weigering noemt wat er wel mag');

      /* ---- 3. de positie: alleen tijdens een levende rit ---- */
      await page.locator('.pda-nav [data-naar="navigatie"]').click();
      await page.waitForSelector('section[data-blad="navigatie"]:not([hidden])', { timeout: 10000 });
      assert.equal(await page.locator('#deelPositie').isDisabled(), false, 'met een levende rit leeft de positieknop');
      assert.match(await page.locator('#navigatiekaart').textContent(), /Marina Botafoch/, 'het routebeeld komt uit de actieve rit');
      const gedeeld = page.waitForResponse(r => r.url().endsWith('/api/staff/mob/positie'));
      await page.locator('#deelPositie').click();
      const positie = await gedeeld;
      assert.equal(positie.status(), 200, 'de positie is aangenomen');
      const posBody = await positie.json();
      assert.ok(posBody.positie && Math.abs(posBody.positie.lat - HIER.latitude) < 1e-6
        && Math.abs(posBody.positie.lng - HIER.longitude) < 1e-6,
      'de gedeelde positie is de echte browserlocatie en geen vast punt: ' + JSON.stringify(posBody));
      await page.waitForFunction(() => /Huidige positie veilig gedeeld/.test(document.querySelector('#toast').textContent),
        null, { timeout: 10000 });

      /* ---- 4. de keten, stap voor stap met de ene knop op de kaart ---- */
      await page.locator('.pda-nav [data-naar="ritten"]').click();
      const STAPPEN = [['VERTREK NAAR KLANT', 'onderweg'], ['IK BEN BIJ DE KLANT', 'aangekomen'],
        ['KLANT AAN BOORD', 'ingestapt'], ['START DE RIT', 'rijdt'], ['RIT VOLTOOID', 'voltooid']];
      for (const [label, status] of STAPPEN) {
        const knop = page.locator('#werkstapel .ritkaart.actief button.hoofdactie', { hasText: label });
        await knop.waitFor({ state: 'visible', timeout: 20000 });
        assert.equal(await page.locator('#werkstapel .ritkaart.actief button.hoofdactie').count(), 1,
          'er staat precies een volgende stap op de kaart, en dat is ' + label);
        const gezet = page.waitForResponse(r => r.url().endsWith('/api/staff/mob/status'));
        await knop.click();
        const antwoord = await gezet;
        assert.equal(antwoord.status(), 200, 'stap "' + status + '" via het scherm');
        assert.equal((await antwoord.json()).opdracht.status, status, 'de server zette de rit op ' + status);
        if (status === 'aangekomen') {
          await page.waitForSelector('#werkstapel .passagierkaart', { state: 'visible', timeout: 20000 });
          assert.match(await page.locator('#werkstapel .passagierkaart').textContent(), /PASSAGIER/,
            'bij de klant verschijnt de passagierskaart, met de codenaam en niet een naam');
        }
      }
      await page.waitForFunction(() => document.querySelector('#rittenTitel').textContent.trim() === 'U BENT BESCHIKBAAR',
        null, { timeout: 20000 });
      assert.match(await page.locator('#werkstapel').textContent(), /Geen open aanvragen/, 'na de rit is de werkvloer leeg');
      assert.equal(await page.locator('#deelPositie').isDisabled(), true, 'na afronding is de positieknop weer dood');
      assert.match(await page.locator('#navigatiekaart').textContent(), /GEEN ACTIEVE ROUTE/);

      /* ---- 5. vandaag: verversen haalt de dienst opnieuw op ---- */
      await page.locator('.pda-nav [data-naar="vandaag"]').click();
      const ververst = page.waitForResponse(r => r.url().endsWith('/api/staff/mob/mijn'));
      await page.locator('#verversVandaag').click();
      assert.equal((await ververst).status(), 200, 'verversen vraagt de dienst opnieuw aan de server');
      await page.waitForFunction(() => /Ritoverzicht bijgewerkt/.test(document.querySelector('#toast').textContent),
        null, { timeout: 15000 });
      assert.equal((await page.locator('#cijferRitten').textContent()).trim(), '1', 'een rit afgerond');
      assert.match(await page.locator('#ritlog').textContent(), new RegExp(ref), 'en hij staat in het ritlog');

      // en de server is het ermee eens
      const mijn = await post(base, '/api/staff/mob/mijn', {}, pda);
      assert.ok((mijn.body.klaar || []).some(o => o.ref === ref && o.status === 'voltooid'),
        'de server kent de rit als voltooid: ' + JSON.stringify((mijn.body.klaar || []).map(o => [o.ref, o.status])));
      assert.equal((mijn.body.lopend || []).length, 0, 'en er loopt niets meer');

      assert.deepEqual(fouten, [], 'geen JS-fouten op de chauffeurs-PDA: ' + fouten.join(' | '));
    } finally {
      if (browser) await browser.close();
      await stop(child);
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* weg is weg */ }
    }
  });
