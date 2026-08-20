/* ============================================================================
   DE TWEEDE RONDE VAN HET DEELMENU: WAT ER GEBEURT ALS DE APP HERTEKENT.

   test/deelmenuwacht.e2e.js bewaakt de EERSTE ronde: komt er een menu zodra de
   app zijn schermen neerzet. Deze toets gaat over alles daarna. Een app die
   main opnieuw opbouwt (een bank bij een saldo-melding, een scherm dat uit een
   eigen momentopname terugkomt) laat het menu een tweede, derde, tiende ronde
   draaien, en juist daar zaten vier fouten die geen enkele toets kon zien:

   1. bouw() hing bij ELKE ronde een hashchange-luisteraar op window en niets
      ruimde de oude op. De luisteraar van ronde 1 schreef met zijn eigen delen
      via history.replaceState de hash over, en dan kwam een deep-link op het
      verkeerde deel uit;
   2. een MISLUKTE hertekening (minder dan drie delen over) liet window.RTGDeel
      op de dode ronde staan: delen() antwoordde alsof er een menu was en open()
      verborg kaarten die zonder balk niemand meer terughaalt;
   3. de wacht vroeg alleen OF er een balk stond, niet of het de onze was. Een
      app die een kopie van de balk terugzet hield daarmee een menu waarvan geen
      enkele knop nog iets deed;
   4. en herscan() ruimde maar EEN balk op. Bleef er een tweede staan, dan zette
      bouw() er telkens een nieuwe bij en herbouwde de wacht elke 120 ms door,
      eindeloos.

   OPSTELLING. Dezelfde vorm als de wacht-toets: een kale proefpagina die alleen
   shared/deelmenu.js laadt, door de browser onderschept en op de eigen herkomst
   geleverd, zodat er geen scherm bijkomt in scripts/schermen.js.

   WAAROM OOK HET SCRIPT ONDERSCHEPT WORDT. public/shared/deelmenu.js is
   bouwuitvoer; de bron staat opgeknipt in public/shared/deelmenu/. Deze toets
   levert de aaneengeplakte DELEN, want dat is wat er gerepareerd is -- dat de
   bundel daarna gelijk is aan zijn delen bewaakt scripts/check.js punt 6, en
   dat hoort daar en niet hier.

   Draait alleen waar een browser is.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, letOpFouten, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const { bundel } = require('../scripts/bundel');

const pw = laadPlaywright();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-deelronde-'));

const PROEFPAD = '/apps/zz-deelmenu-ronde-proef.html';
const SCRIPT = '/shared/deelmenu.js';

/* main > #laag > drie kaarten: precies de vorm die de meeste apps hier hebben
   (de kaarten staan niet los in main maar in een opmaaklaag erbinnen). */
const DRIE_KAARTEN =
  '<div class="kaart"><h2>Alfa</h2><p>een</p></div>' +
  '<div class="kaart"><h2>Bravo</h2><p>twee</p></div>' +
  '<div class="kaart"><h2>Charlie</h2><p>drie</p></div>';
const pagina = (inhoud) => '<!doctype html><html lang="nl"><head><meta charset="utf-8">' +
  '<title>proef deelmenu-ronde</title></head><body>' +
  '<main id="main"><div id="laag">' + inhoud + '</div></main>' +
  '<script src="' + SCRIPT + '"></script></body></html>';

// wat de app bij zijn hertekening neerzet: drie ANDERE delen
const RONDE2 =
  '<div class="kaart"><h2>Delta</h2><p>een</p></div>' +
  '<div class="kaart"><h2>Echo</h2><p>twee</p></div>' +
  '<div class="kaart"><h2>Foxtrot</h2><p>drie</p></div>';

/* De hashchange-luisteraars tellen. Dit staat er als initscript in, dus voor
   deelmenu.js draait: anders zou de eerste registratie al gemist zijn. */
function telLuisteraars() {
  window.__hashTeller = 0;
  var echt = window.addEventListener;
  window.addEventListener = function (soort) {
    if (soort === 'hashchange') window.__hashTeller++;
    return echt.apply(this, arguments);
  };
}

/* De opstelling. Met `inhoud` leeg begint de pagina zonder delen: dan hoort er
   geen menu te staan en wachten we op de module in plaats van op de balk. */
async function opstelling(inhoud) {
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  const browser = await pw.chromium.launch(browserOpties(pw));
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const fouten = [];
  letOpFouten(page, fouten);
  await page.route('**' + PROEFPAD, route =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: pagina(inhoud === undefined ? DRIE_KAARTEN : inhoud) }));
  await page.route('**' + SCRIPT, route =>
    route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: bundel('shared/deelmenu.js').toString('utf8') }));
  await page.addInitScript(telLuisteraars);
  await page.goto(base + PROEFPAD, { waitUntil: 'domcontentloaded' });
  if (inhoud === undefined) await page.waitForSelector('.rtgdeel-balk button', { timeout: 8000 });
  else await page.waitForFunction(() => !!window.RTGDeel, null, { timeout: 8000 });
  return { page, fouten, sluit: async () => { try { await browser.close(); } finally { child.kill(); } } };
}

// de stand van het scherm in een oogopslag, zonder $$eval (die kent de eigen driver niet)
function stand() {
  var knoppen = Array.prototype.slice.call(document.querySelectorAll('.rtgdeel-balk button'));
  return {
    balken: document.querySelectorAll('.rtgdeel-balk').length,
    knoppen: knoppen.map(function (b) { return b.textContent.trim(); }),
    open: knoppen.filter(function (b) { return b.getAttribute('aria-current') === 'true'; })
      .map(function (b) { return b.textContent.trim(); }),
    verborgen: document.querySelectorAll('.rtgdeel-weg').length,
    delen: window.RTGDeel && window.RTGDeel.delen ? window.RTGDeel.delen() : null,
    luisteraars: window.__hashTeller
  };
}

test('een deep-link komt ook NA een hertekening op het juiste deel uit',
  { skip: geenBrowser(pw) }, async () => {
  const { page, fouten, sluit } = await opstelling();
  try {
    const ronde1 = await page.evaluate(stand);
    assert.deepEqual(ronde1.delen, ['alfa', 'bravo', 'charlie'], 'ronde 1 staat er');
    assert.equal(ronde1.luisteraars, 1, 'een hashchange-luisteraar na het laden');

    // de app hertekent zijn scherm met drie ANDERE delen
    await page.evaluate(html => { document.getElementById('laag').innerHTML = html; }, RONDE2);
    /* De wacht hertekent op een DOM-wijziging, niet op een verzoek: wachten tot
       de nieuwe indeling er staat is dus wachten op precies de bewering. */
    await wachtTot(page, () => {
      const b = document.querySelector('.rtgdeel-balk');
      return !!b && [...b.querySelectorAll('button')].map(x => x.textContent.trim().toLowerCase())
        .join(',').includes('foxtrot');
    }, null, { wat: 'de opnieuw ingedeelde balk' });
    const ronde2 = await page.evaluate(stand);
    assert.deepEqual(ronde2.delen, ['delta', 'echo', 'foxtrot'], 'de wacht heeft opnieuw ingedeeld');

    /* DE BEWERING, eerst zoals de gebruiker hem merkt. Blijft de luisteraar van
       ronde 1 hangen, dan zet die eerst zijn eigen delen[0] met replaceState
       over de hash heen, en leest de luisteraar van ronde 2 daarna een hash die
       al veranderd is: de deep-link komt op het verkeerde deel uit. */
    await page.evaluate(() => { location.hash = '#deel-foxtrot'; });
    /* Wachten met DEZELFDE meting als de bewering eronder: aria-current is hoe
       dit menu "dit deel staat open" zegt (zie stand() hierboven). */
    await wachtTot(page, () => [...document.querySelectorAll('.rtgdeel-balk button')]
      .some(b => b.getAttribute('aria-current') === 'true' && /foxtrot/i.test(b.textContent)),
      null, { wat: 'het deel Foxtrot dat de deep-link opent' });
    const na = await page.evaluate(stand);
    const hash = await page.evaluate(() => location.hash);
    assert.deepEqual(na.open, ['Foxtrot'], 'de deep-link opent het gevraagde deel');
    assert.equal(hash, '#deel-foxtrot', 'en de hash blijft van de gebruiker');
    // en dan pas de oorzaak zelf, zodat een fout hier meteen te plaatsen is
    assert.equal(na.luisteraars, 1, 'nog steeds EEN luisteraar, niet een per ronde');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally { await sluit(); }
});

test('een MISLUKTE hertekening laat geen menu achter dat kaarten kan verbergen',
  { skip: geenBrowser(pw) }, async () => {
  const { page, fouten, sluit } = await opstelling();
  try {
    /* De app houdt na zijn hertekening nog maar twee delen over. Dan hoort er
       GEEN menu te zijn -- en ook geen API die nog doet alsof.
       Alles in EEN evaluate: de wacht kijkt 120 ms na de laatste verandering
       opnieuw, en die ronde zou de sporen kunnen opruimen die deze toets juist
       wil meten. Zo ligt de meting vast voor hij langskomt. */
    const meting = await page.evaluate(() => {
      var laag = document.getElementById('laag');
      laag.removeChild(laag.querySelectorAll('.kaart')[2]);
      var gelukt = window.RTGDeel.herscan();
      var delen = window.RTGDeel.delen();
      var balken = document.querySelectorAll('.rtgdeel-balk').length;
      /* En nu waar het echt om ging: open() op die stand mag niets verbergen,
         want er is geen knop meer om het terug te halen. */
      var uitkomst = window.RTGDeel.open('alfa');
      return { gelukt: gelukt, delen: delen, balken: balken,
        // undefined verdwijnt uit een JSON-antwoord, dus als woord terug
        uitkomst: uitkomst === undefined ? 'undefined' : uitkomst,
        verborgen: document.querySelectorAll('.rtgdeel-weg').length };
    });
    assert.equal(meting.gelukt, false, 'herscan meldt eerlijk dat het niet lukte');
    assert.equal(meting.balken, 0, 'er staat geen balk meer');
    assert.deepEqual(meting.delen, [], 'en RTGDeel kent geen delen meer');
    assert.equal(meting.uitkomst, null, 'open() geeft null terug als er niets te openen valt');
    assert.equal(meting.verborgen, 0, 'geen enkele kaart staat op display:none zonder balk');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally { await sluit(); }
});

test('een teruggezette KOPIE van de balk telt niet als menu: de knoppen moeten werken',
  { skip: geenBrowser(pw) }, async () => {
  const { page, fouten, sluit } = await opstelling();
  try {
    /* Een app die zijn scherm uit een eigen momentopname terugzet, zet de balk
       mee terug -- als HTML, dus zonder de klik-luisteraars. Het menu staat er
       dan wel, maar doet niets. */
    await page.evaluate(() => { var m = document.getElementById('main'); m.innerHTML = m.innerHTML; });
    await wachtTot(page, () => document.querySelectorAll('.rtgdeel-balk').length === 1,
      null, { wat: 'precies een balk na de hertekening' });
    /* Drie stille rondes, geen een: shared/deelmenu.js herbouwt pas 120 ms NA de
       laatste wijziging, en bij een polling van 100 ms is een enkele gelijke
       ronde dus nog vóór dat moment. Drie rondes overleven de wachttijd. */
    await wachtOpRust(page, null, { rondes: 3 });
    const na = await page.evaluate(stand);
    assert.equal(na.balken, 1, 'er staat precies een balk');
    assert.deepEqual(na.knoppen, ['Alfa', 'Bravo', 'Charlie'], 'met de drie delen erop');

    // DE BEWERING: die knoppen doen ook echt iets
    await page.click('.rtgdeel-balk button:nth-child(2)');
    const geklikt = await page.evaluate(stand);
    assert.deepEqual(geklikt.open, ['Bravo'], 'een klik wisselt het deel');
    assert.equal(geklikt.verborgen, 2, 'en de andere twee kaarten gaan echt weg');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally { await sluit(); }
});

test('een vreemde balk voor de onze wordt opgeruimd, niet eindeloos herbouwd',
  { skip: geenBrowser(pw) }, async () => {
  const { page, fouten, sluit } = await opstelling();
  try {
    /* De gevaarlijke vorm: een dode kopie van de balk STAAT VOOR de onze in
       documentvolgorde. Ruimt herscan() er maar een op, dan blijft het aantal
       twee, is de voorste nooit de onze, en herbouwt de wacht elke 120 ms
       opnieuw -- eindeloos, want een geslaagde herscan zet de vergeefs-teller
       telkens terug op nul. Deze teller vangt dat. */
    await page.evaluate(() => {
      window.__herbouwd = 0;
      new MutationObserver(function (rijen) {
        rijen.forEach(function (r) {
          Array.prototype.forEach.call(r.addedNodes, function (n) {
            if (n.classList && n.classList.contains('rtgdeel-balk')) window.__herbouwd++;
          });
        });
      }).observe(document.getElementById('main'), { childList: true, subtree: true });
      var m = document.getElementById('main');
      m.insertBefore(document.querySelector('.rtgdeel-balk').cloneNode(true), m.firstChild);
    });
    /* Hier wordt gewacht tot de wacht de VREEMDE balk heeft opgeruimd -- dat is
       de bewering -- en daarna tot het scherm stil is, zodat "hij herbouwt niet
       eindeloos" op een rustige stand wordt gemeten en niet middenin. */
    await wachtTot(page, () => document.querySelectorAll('.rtgdeel-balk').length === 1,
      null, { wat: 'een opgeruimde vreemde balk' });
    /* Drie stille rondes, geen een: shared/deelmenu.js herbouwt pas 120 ms NA de
       laatste wijziging, en bij een polling van 100 ms is een enkele gelijke
       ronde dus nog vóór dat moment. Drie rondes overleven de wachttijd. */
    await wachtOpRust(page, null, { rondes: 3 });

    const na = await page.evaluate(() => ({
      balken: document.querySelectorAll('.rtgdeel-balk').length,
      herbouwd: window.__herbouwd
    }));
    assert.ok(na.herbouwd <= 2, 'de wacht komt tot rust, herbouwde balken: ' + na.herbouwd);
    assert.equal(na.balken, 1, 'de vreemde balk is weg en de onze staat er, gemeten: ' + na.balken);

    // en het menu leeft nog: een klik doet wat hij belooft
    await page.click('.rtgdeel-balk button:nth-child(3)');
    const geklikt = await page.evaluate(stand);
    assert.deepEqual(geklikt.open, ['Charlie'], 'de herbouwde balk werkt');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally { await sluit(); }
});

test('een pagina die blijft muteren zonder ooit drie delen te krijgen laat de wacht los',
  { skip: geenBrowser(pw) }, async () => {
  /* De belofte boven de vergeefs-teller: een chat die berichten blijft
     aanvullen krijgt geen menu EN betaalt geen eeuwige wacht. Dat er een
     grens IS staat hier vast; welk getal die grens is, staat in de code en in
     het commit-bericht dat hem koos. Deze toets meet dus de belofte (hij laat
     los, en met de hand kan het daarna nog steeds), niet de constante -- een
     toets die zijn eigen constante terugleest bewijst niets. */
  const { page, fouten, sluit } = await opstelling('');
  try {
    /* De peiling: een knoop met .rtgdeel-weg erop. Zolang de wacht wakker is,
       veegt elke ronde die klasse weg (dat doet herscan voor hij opnieuw
       indeelt). Blijft de klasse staan, dan komt er geen ronde meer. Een
       klassewijziging is een attribuut-mutatie en wekt de observer niet, dus
       de peiling stoort de meting niet. */
    const meting = await page.evaluate(async () => {
      var laag = document.getElementById('laag');
      var peil = document.createElement('div');
      laag.appendChild(peil);
      var tik = setInterval(function () { laag.appendChild(document.createElement('p')); }, 60);
      var slaap = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
      var begonnen = Date.now(), stil = 0, losgelaten = 0, geveegd = 0;
      while (Date.now() - begonnen < 20000) {
        peil.classList.add('rtgdeel-weg');
        await slaap(300);
        if (peil.classList.contains('rtgdeel-weg')) { if (++stil >= 2) { losgelaten = Date.now() - begonnen; break; } }
        else { stil = 0; geveegd++; }
      }
      clearInterval(tik);
      return { losgelaten: losgelaten, geveegd: geveegd };
    });
    assert.ok(meting.geveegd > 0, 'de wacht was eerst wel degelijk wakker (' + meting.geveegd + ' peilingen geveegd)');
    /* De grens staat ruim (hier gemeten: 7.8 s voor veertig rondes van
       ~180 ms). Ruim genoeg voor een trage machine, krap genoeg om een wacht
       te betrappen die helemaal niet meer loslaat. */
    assert.ok(meting.losgelaten > 0 && meting.losgelaten < 20000,
      'de wacht laat binnen 20 s los, gemeten na ' + meting.losgelaten + ' ms');

    /* En nu de andere helft: hij laat ECHT los. Komen er daarna drie delen,
       dan blijft het scherm een gewone rol -- en met de hand kan het alsnog.
       Zonder die tweede helft zou deze toets ook slagen op een pagina die
       nooit een menu had kunnen krijgen. */
    await page.evaluate(html => { document.getElementById('laag').innerHTML = html; }, DRIE_KAARTEN);
    /* Een AFWEZIGHEID valt niet af te wachten met "verschijnt het?" -- dus
       wachten tot het scherm stil is, en dan pas kijken of er niets is gebouwd. */
    /* Drie stille rondes, geen een: shared/deelmenu.js herbouwt pas 120 ms NA de
       laatste wijziging, en bij een polling van 100 ms is een enkele gelijke
       ronde dus nog vóór dat moment. Drie rondes overleven de wachttijd. */
    await wachtOpRust(page, null, { rondes: 3 });
    const zonder = await page.evaluate(stand);
    assert.equal(zonder.balken, 0, 'de wacht bouwt niet meer uit zichzelf');
    const metHand = await page.evaluate(() => { window.RTGDeel.herscan(); return document.querySelectorAll('.rtgdeel-balk').length; });
    assert.equal(metHand, 1, 'RTGDeel.herscan() blijft met de hand beschikbaar');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    await sluit();
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
