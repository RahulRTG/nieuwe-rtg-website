/* Scherm-test voor de GPS-schakelaar van het OS-menu (rtg_os_gps).

   De schakelaar bestond, maar geen enkele locatie-aanroep las hem: wie hem op
   "uit" zette werd alsnog om de twintig seconden om een positie gevraagd (de
   ontmoet-lus), en flits/ov/navigatie begonnen bij het openen meteen een
   watchPosition. Deze toets legt het contract vast met een geteld stubje op
   navigator.geolocation: staat de schakelaar op '0', dan raakt een pagina die
   ongevraagd om locatie vraagt de API NIET aan; staat hij op '1', dan wel.
   Beide kanten, want een poort die nooit opengaat is ook stuk.

   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

// telt elke aanraking van de geolocation-API voordat de pagina zelf laadt
const STUB = `(function () {
  window.__gpsAanrakingen = 0;
  const teller = { getCurrentPosition: function () { window.__gpsAanrakingen++; },
                   watchPosition: function () { window.__gpsAanrakingen++; return 1; },
                   clearWatch: function () {} };
  Object.defineProperty(navigator, 'geolocation', { get: function () { return teller; } });
})();`;

async function aanrakingen(page, base, stand) {
  await page.goto(base + '/apps/flits.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(s => { localStorage.setItem('rtg_os_gps', s); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, stand);
  await page.goto(base + '/apps/flits.html', { waitUntil: 'domcontentloaded' });
  // de aanroep gebeurt bij het laden, niet later: wachten tot het laden klaar is
  await wachtOpRust(page);
  return page.evaluate(() => window.__gpsAanrakingen);
}

test('GPS-schakelaar: uit is uit, aan is aan',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    await volgVerzoeken(page);
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(STUB);

    /* uit: flits.html start zijn snelheids-watch normaal meteen; met de
       schakelaar op '0' mag de API niet aangeraakt worden */
    const uit = await aanrakingen(page, base, '0');
    assert.equal(uit, 0, 'schakelaar op uit, maar de pagina raakte geolocation ' + uit + ' keer aan');

    /* aan: dezelfde pagina hoort de watch dan WEL te starten -- anders staat
       hier een poort die nooit opengaat en bewijst de eerste helft niets */
    const aan = await aanrakingen(page, base, '1');
    assert.ok(aan >= 1, 'schakelaar op aan, maar de pagina raakte geolocation nooit aan');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});


/* ---------------------------------------------------------------------------
   TWEE GATEN DIE DE TOETS HIERBOVEN NIET ZAG.

   De toets hierboven meet de POORT: staat de schakelaar op uit, dan blijft de
   API onaangeraakt. Die kant klopte. Wat hij niet meet, is of de schakelaar
   ooit OPEN kan. En dat kon hij niet:

   1. `rtg_os_gps` werd door zeven plekken gelezen en door niemand gezet. De
      tegel in het bedieningspaneel bestond niet, en shared/osmenu.js -- waar
      elk commentaar naar verwijst -- bestaat evenmin. Voor elk vers profiel
      stond de schakelaar dus voor altijd op uit.
   2. flits.html, ov.html en ovdienst.html roepen RTGPlek aan om het in dat
      geval te VRAGEN, maar geen van drieën laadde /shared/plek.js. window
      .RTGPlek was er nooit, de vraag verscheen nooit, en alle drie vielen stil
      terug op "uit is uit". Alleen navigatie.html laadde het script wel.

   Samen: de gps deed het nergens, en niets legde uit waarom. Deze twee toetsen
   leggen de andere helft van het contract vast -- dat de deur ook opengaat.
   --------------------------------------------------------------------------- */

const APPS_MET_VRAAG = ['/apps/navigatie.html', '/apps/flits.html', '/apps/ov.html', '/apps/ovdienst.html'];

test('Locatie: de vier apps die een positie nodig hebben, vragen erom',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);

    for (const app of APPS_MET_VRAAG) {
      // een vers profiel: de sleutel is er niet, en dat leest als uit
      await page.goto(base + app, { waitUntil: 'domcontentloaded' });
      await page.evaluate(() => { localStorage.removeItem('rtg_os_gps'); localStorage.setItem('rtg_cookieinfo_v1', '1'); });
      await page.goto(base + app, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(600);
      const uit = await page.evaluate(() => ({
        plek: typeof window.RTGPlek,
        vraag: !!document.querySelector('.rtgplek')
      }));
      assert.equal(uit.plek, 'object', app + ' laadt /shared/plek.js niet: window.RTGPlek is ' + uit.plek);
      assert.ok(uit.vraag, app + ' vraagt niet om je locatie, hij zwijgt erover');
    }

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
  }
});

/* Een geolocation die ALTIJD lukt, resp. altijd weigert. De tegel hoort het
   verschil te laten zien: bij een weigering staat er geen "aan" op een
   schakelaar die niets oplevert. */
const GPS_STUB = (lukt) => `(function () {
  const teller = {
    getCurrentPosition: function (ok, fout) {
      if (${lukt}) ok({ coords: { latitude: 52.37, longitude: 4.9, accuracy: 10 } });
      else if (fout) fout({ code: 1, message: 'geweigerd' });
    },
    watchPosition: function (ok) { if (${lukt}) ok({ coords: { latitude: 52.37, longitude: 4.9, accuracy: 10 } }); return 1; },
    clearWatch: function () {}
  };
  Object.defineProperty(navigator, 'geolocation', { get: function () { return teller; } });
})();`;

test('Locatie: de schakelaar is te bedienen vanuit het bedieningspaneel',
  { skip: geenBrowser(pw) }, async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-gps-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  let browser;
  try {
    const reg = await (await fetch(base + '/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Gps Lid', email: 'gps' + process.pid + '@x.nl', phone: '0612345788',
        password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' })
    })).json();
    assert.ok(reg.token, 'lid-registratie geeft een token');

    browser = await pw.chromium.launch(browserOpties(pw));
    const fouten = [];

    // de intake staat anders over de werktafel heen; zie appmenu.e2e.js
    const open = async (lukt) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.route('**/api/onboarding/status', (r) => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ klaar: true }) }));
      await ctx.addInitScript(GPS_STUB(lukt));
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem('rtg_member_token', t);
          localStorage.setItem('rtg_lang', 'nl');
          localStorage.setItem('rtg_cookieinfo_v1', '1');
          localStorage.removeItem('rtg_os_gps');
        } catch (e) {}
      }, reg.token);
      const page = await ctx.newPage();
      letOpFouten(page, fouten);
      await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
      // de tegel staat in de HTML maar is pas te zien als het paneel open is
      await page.waitForSelector('#osCcGps', { state: 'attached', timeout: 15000 });
      /* Blijven proberen tot het paneel echt opengaat: de knop staat in de HTML,
         maar zijn luisteraar hangt er pas als app-main geladen is, en een klik
         die daarvoor valt doet niets. Zodra de scrim open is, klikken we niet
         meer -- anders zou hij weer dichtgaan. */
      await page.waitForFunction(() => {
        const scrim = document.querySelector('#osCcScrim'), knop = document.querySelector('#osCcBtn');
        if (!scrim || !knop) return false;
        if (scrim.classList.contains('open')) return true;
        knop.click();
        return scrim.classList.contains('open');
      }, null, { timeout: 20000 });
      await page.waitForSelector('#osCcGps', { state: 'visible', timeout: 15000 });
      return page;
    };

    // het toestel geeft een plek: de tegel gaat aan en blijft aan
    const p1 = await open(true);
    assert.equal(await p1.evaluate(() => localStorage.getItem('rtg_os_gps')), null,
      'een vers profiel hoort geen schakelaar te hebben');
    await p1.click('#osCcGps');
    await p1.waitForTimeout(400);
    assert.equal(await p1.evaluate(() => localStorage.getItem('rtg_os_gps')), '1',
      'de tegel zette de schakelaar niet aan');
    assert.ok(await p1.evaluate(() => document.querySelector('#osCcGps').classList.contains('aan')),
      'de tegel toont niet dat hij aan staat');
    await p1.click('#osCcGps');                       // en weer uit
    await p1.waitForTimeout(300);
    assert.equal(await p1.evaluate(() => localStorage.getItem('rtg_os_gps')), '0',
      'de tegel kon niet meer uit');

    /* En de andere kant: weigert het toestel, dan mag de tegel niet "aan"
       blijven staan. Anders belooft het bedieningspaneel iets wat er nooit
       komt -- precies de stille storing die dit hele geval was. */
    const p2 = await open(false);
    await p2.click('#osCcGps');
    await p2.waitForTimeout(400);
    assert.equal(await p2.evaluate(() => localStorage.getItem('rtg_os_gps')), '0',
      'het toestel weigerde, maar de schakelaar bleef aan staan');
    assert.equal(await p2.evaluate(() => document.querySelector('#osCcGps').classList.contains('aan')), false,
      'het toestel weigerde, maar de tegel toont "aan"');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});

/* ---------------------------------------------------------------------------
   DEZELFDE FOUT IN SPIEGELBEELD: apps/geo.js LAS de schakelaar helemaal niet.

   Zes plekken behandelen `rtg_os_gps` als de waarheid; geo.js (window.Geo)
   vroeg het toestel rechtstreeks, ongevraagd bij het tekenen van de partner-
   en vacaturelijst. De tegel kon dus op "uit" staan terwijl er gewoon om je
   locatie werd gevraagd, en de opgehaalde positie bleef daarna in localStorage
   staan. Deze toets meet beide kanten: uit is uit (en wist wat er lag), aan is
   aan.
   --------------------------------------------------------------------------- */

test('Locatie: geo.js luistert naar dezelfde schakelaar',
  { skip: geenBrowser(pw) }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.addInitScript(STUB);   // telt elke aanraking, beantwoordt niets

    // app.html laadt /apps/geo.js; de inlogpoort ervoor doet er niet toe
    const opnieuw = async (stand) => {
      await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
      await page.evaluate((s) => {
        localStorage.setItem('rtg_os_gps', s);
        localStorage.setItem('rtg_cookieinfo_v1', '1');
        // een positie die er al lag van vóór het uitzetten
        localStorage.setItem('rtg_geo', JSON.stringify({ lat: 52.37, lng: 4.9, at: Date.now() }));
      }, stand);
      await page.goto(base + '/apps/app.html', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => !!window.Geo, null, { timeout: 15000 });
    };

    await opnieuw('0');
    const uit = await page.evaluate(async () => ({
      mag: Geo.mag(),
      laatste: Geo.laatste(),
      heeft: Geo.heeft(),
      positie: await Geo.positie(),
      bewaard: localStorage.getItem('rtg_geo'),
      aanrakingen: window.__gpsAanrakingen
    }));
    assert.equal(uit.mag, false, 'schakelaar op uit, maar Geo.mag() zegt ja');
    assert.equal(uit.laatste, null, 'schakelaar op uit, maar Geo.laatste() geeft nog een plek');
    assert.equal(uit.heeft, false, 'schakelaar op uit, maar Geo.heeft() zegt ja');
    assert.equal(uit.positie, null, 'schakelaar op uit, maar Geo.positie() geeft een plek');
    assert.equal(uit.bewaard, null, 'schakelaar op uit, maar de bewaarde positie bleef staan');
    assert.equal(uit.aanrakingen, 0, 'schakelaar op uit, maar geo.js raakte geolocation ' + uit.aanrakingen + ' keer aan');

    /* De bewuste ingang MOET het wel vragen, anders is de knop "dichtstbij
       eerst" in foundation/werk.html een dode knop -- precies het defect dat
       deze hele ronde is. Geo.vraag() loopt via shared/plek.js, dus de kaart
       hoort in beeld te komen; "nu niet" geeft null en raakt niets aan. */
    const vraag = page.evaluate(() => Geo.vraag('waarom dan'));
    await page.waitForSelector('.rtgplek', { timeout: 5000 });
    await page.click('.rtgplek .nee');
    assert.equal(await vraag, null, 'na "nu niet" hoort Geo.vraag() null te geven');
    assert.equal(await page.evaluate(() => window.__gpsAanrakingen), 0,
      'na "nu niet" werd geolocation toch aangeraakt');

    /* En de andere kant, anders bewijst de eerste helft niets: met de
       schakelaar aan hoort geo.js het toestel wél te vragen. De stub antwoordt
       nooit, dus niet op de belofte wachten -- alleen op de aanraking. */
    await opnieuw('1');
    await page.evaluate(() => { localStorage.removeItem('rtg_geo'); Geo.positie(0); });
    await page.waitForTimeout(300);
    const aan = await page.evaluate(() => window.__gpsAanrakingen);
    assert.ok(aan >= 1, 'schakelaar op aan, maar geo.js raakte geolocation nooit aan');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    stop(child);
  }
});
