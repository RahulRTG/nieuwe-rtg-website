/* DE VEEGHELPER ZELF, en niet een scherm dat hem gebruikt.

   veegDoor (test/helper.js) heeft twee wegen: de protocolvlucht naar Chromium,
   en een terugval in de renderer voor als de timer van lang drukken de vlucht
   heeft opgegeten. Vier gebaarproeven leunen erop, en geen van hen kon zien
   welke weg het werd -- de terugval maakte de race onschadelijk en daarmee ook
   onzichtbaar (EDGE.md par. 11, ronde 2). Deze proef meet het contract van de
   helper op een kaal vlak dat de race op bestelling naspeelt:

     vlucht    de regel pakt de eerste echte beweging op, zoals een gezonde laag;
     terugval  de regel negeert echte beweging, zoals een laag waarvan de timer
               net de actielade opende. Alleen de rendererpoging komt dan door.

   Het vlak is met opzet GEEN gebaarlaag: het schrijft alleen `data-gb` zoals
   shared/gebaar/ dat doet, want dat is het enige waar de helper naar kijkt. Wat
   de laag met een veeg doet, meten de gebaarproeven zelf.

   Draai: node --test test/helper-veegdoor.e2e.js   (slaat over zonder Playwright) */
const test = require('node:test');
const assert = require('node:assert/strict');
const { veegDoor, laadPlaywright, browserOpties, geenBrowser } = require('./helper');

const pw = laadPlaywright();

const VLAK = '<!doctype html><html><body style="margin:0">' +
  '<div class="gb-rij" id="rij" style="margin:60px 40px;height:80px;width:640px;background:#ddd">regel</div>' +
  '<script>' +
  'window.__log = []; window.__modus = "vlucht"; var neerX = null;' +
  '["pointerdown","pointermove","pointerup","pointercancel"].forEach(function (n) {' +
  '  document.addEventListener(n, function (e) {' +
  '    window.__log.push({ soort: n, echt: e.isTrusted });' +
  '    var rij = document.getElementById("rij");' +
  '    if (n === "pointerdown") neerX = e.clientX;' +
  '    else if (n === "pointermove" && (e.buttons & 1) && neerX !== null && Math.abs(e.clientX - neerX) >= 8 &&' +
  '      (window.__modus === "vlucht" || !e.isTrusted)) rij.setAttribute("data-gb", "links");' +
  '    else if (n === "pointerup" || n === "pointercancel") { neerX = null; rij.removeAttribute("data-gb"); }' +
  '  }, true);' +
  '});' +
  '</script></body></html>';

/* Wat er gebeurde NA de laatste pointerdown: dat is het gebaar dat de helper
   achterlaat. Een pointerup ervoor hoort bij een mislukte vlucht en zegt niets
   over of de knop nu nog is ingedrukt. */
const staart = (page) => page.evaluate(() => {
  const l = window.__log;
  let i = l.length - 1;
  while (i >= 0 && l[i].soort !== 'pointerdown') i--;
  return { neer: i >= 0 ? l[i] : null, erna: l.slice(i + 1).map((x) => x.soort),
    loopt: document.getElementById('rij').hasAttribute('data-gb') };
});

async function opnieuw(page, modus) {
  await page.evaluate((m) => {
    window.__log = []; window.__modus = m;
    document.getElementById('rij').removeAttribute('data-gb');
  }, modus);
  return page.locator('#rij').boundingBox();
}

test('veegDoor zegt welke weg hij nam: de vlucht of de terugval', { skip: geenBrowser(pw) }, async () => {
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
    await page.setContent(VLAK);

    const weg1 = await veegDoor(page, await opnieuw(page, 'vlucht'));
    let s = await staart(page);
    assert.equal(weg1, 'vlucht', 'een laag die de eerste echte beweging oppakt, hoort de vlucht te zijn');
    assert.equal(s.neer.echt, true, 'de vlucht hoort echte browserinput te zijn');
    assert.equal(s.erna[s.erna.length - 1], 'pointerup', 'zonder opties laat de vlucht los');

    const weg2 = await veegDoor(page, await opnieuw(page, 'terugval'));
    s = await staart(page);
    assert.equal(weg2, 'terugval',
      'een laag die de vlucht niet oppakt, hoort de terugval te zijn -- en dat hoort de aanroeper te horen');
    assert.equal(s.neer.echt, false, 'de terugval is de rendererpoging, dus synthetisch');
    assert.equal(s.erna[s.erna.length - 1], 'pointerup', 'zonder opties laat ook de terugval los');
  } finally { await browser.close(); }
});

test('met loslaten: false blijft de knop in beide wegen ingedrukt tot de proef zelf loslaat',
  { skip: geenBrowser(pw) }, async () => {
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 400 } });
    await page.setContent(VLAK);
    for (const modus of ['vlucht', 'terugval']) {
      /* Een halve veeg, zoals op het bord en de post: die kijken naar de lade
         terwijl de knop nog is ingedrukt. */
      const weg = await veegDoor(page, await opnieuw(page, modus), { afstand: 140, startFractie: 0.15, loslaten: false });
      assert.equal(weg, modus, 'de gekozen weg hoort ook met loslaten: false te kloppen');
      const s = await staart(page);
      assert.deepEqual(s.erna.filter((x) => x === 'pointerup' || x === 'pointercancel'), [],
        'in de ' + modus + ' hoort er na de laatste pointerdown geen pointerup te komen: ' + JSON.stringify(s.erna));
      assert.equal(s.loopt, true, 'het gebaar hoort in de ' + modus + ' nog te lopen');

      /* De tegenproef: loslaten met een echte muis komt WEL aan. Zonder die
         stap bewijst "geen pointerup" ook een vlak dat er nooit een ziet. */
      await page.mouse.up();
      await page.waitForFunction(() => !document.getElementById('rij').hasAttribute('data-gb'), null, { timeout: 5000 })
        .catch(() => {});
      const na = await staart(page);
      assert.equal(na.erna.includes('pointerup'), true, 'page.mouse.up() hoort in de ' + modus + ' als pointerup aan te komen');
      assert.equal(na.loopt, false, 'en daarmee het gebaar te beeindigen');
    }
  } finally { await browser.close(); }
});
