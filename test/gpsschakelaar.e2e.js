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
const { startServer, letOpFouten, wachtOpRust, volgVerzoeken } = require('./helper');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

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
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
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
