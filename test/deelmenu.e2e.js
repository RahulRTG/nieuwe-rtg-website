/* Scherm-test voor het deelmenu (shared/deelmenu.js): een app met veel
   delen wordt een menu met een deel tegelijk, in plaats van een lange rol.

   Het contract, op de eerste pagina die meedoet (rtgschool.html):
   1. de menubalk staat er, met de delen van de pagina als knoppen;
   2. er is EEN deel zichtbaar en de rest is echt weg (niet alleen kleiner);
   3. een klik op een knop wisselt het beeld en zet de hash;
   4. een deep-link (#deel-...) opent dat deel direct;
   5. dit alles zonder paginafouten.
   Draait alleen waar een browser is. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, letOpFouten } = require('./helper');
const bundel = require('../scripts/bundel');

/* Eén browserkeuze voor alle schermtoetsen: ./browser.js. Die probeert te
   STARTEN in plaats van te laden -- een Playwright zonder bijbehorende Chromium
   liet elke schermtoets anders omvallen op "Executable doesn't exist". */
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

test('deelmenu: een deel tegelijk, wisselen werkt, deep-link werkt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Menulid', email: 'dm' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/rtgschool.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/rtgschool.html', { waitUntil: 'domcontentloaded' });

    /* 1. de balk met de delen van deze pagina */
    await page.waitForSelector('.rtgdeel-balk button', { timeout: 8000 });
    const knoppen = await page.$$eval('.rtgdeel-balk button', bs => bs.map(b => b.textContent));
    assert.ok(knoppen.length >= 3, 'minstens drie delen in het menu, kreeg: ' + knoppen.join(', '));

    /* 2+3. het eerste deel toont, de rest is weg; wisselen draait dat om */
    await page.evaluate(() => RTGDeel.open('het-paspoort'));
    const voor = await page.evaluate(() => ({
      paspoort: !!document.getElementById('paspoort').offsetParent,
      examen: !!document.getElementById('examenKies').offsetParent
    }));
    assert.equal(voor.paspoort, true, 'het paspoort-deel is zichtbaar');
    assert.equal(voor.examen, false, 'het toetsing-deel is dan echt weg');
    await page.click('.rtgdeel-balk button:nth-child(3)');
    const na = await page.evaluate(() => ({
      paspoort: !!document.getElementById('paspoort').offsetParent,
      examen: !!document.getElementById('examenKies').offsetParent,
      hash: location.hash
    }));
    assert.equal(na.paspoort, false, 'na de wissel is het paspoort weg');
    assert.equal(na.examen, true, 'en staat toetsing in beeld');
    assert.equal(na.hash, '#deel-toetsing-en-advies', 'de hash draagt het deel');

    /* 4. deep-link: de hash opent het deel direct */
    await page.goto(base + '/apps/rtgschool.html#deel-bijles', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rtgdeel-balk button', { timeout: 8000 });
    const diep = await page.evaluate(() => ({
      bijles: !!document.getElementById('bijlesLog').offsetParent,
      paspoort: !!document.getElementById('paspoort').offsetParent
    }));
    assert.equal(diep.bijles, true, 'de deep-link opent het bijles-deel');
    assert.equal(diep.paspoort, false, 'en de rest blijft weg');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

/* De tweede vorm, en de reden dat de eerste uitrol de helft van de apps
   moest overslaan: een app die zijn scherm pas NA een fetch neerzet, diep
   in main (main > wrap > vPay), met de kopjes als BROER van de kaarten
   (<h3 class="sec">) in plaats van erin. Op pay.html komt dat alle drie
   samen. Zonder de wacht (subtree), de laag-afdaling en de losse-kop-regel
   blijft het menu daar leeg -- alle drie zijn hier met een mutatie
   nagetrokken. */
test('deelmenu: ook een app die zijn scherm pas na een fetch bouwt',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Paylid', email: 'pm' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    await page.goto(base + '/apps/pay.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/pay.html', { waitUntil: 'domcontentloaded' });

    // het menu verschijnt vanzelf zodra de app zijn schermen heeft gezet
    await page.waitForSelector('.rtgdeel-balk button', { timeout: 12000 });
    const knoppen = await page.$$eval('.rtgdeel-balk button', bs => bs.map(b => b.textContent));
    assert.ok(knoppen.length >= 3, 'het menu vindt de delen: ' + knoppen.join(', '));
    const actief = await page.$$eval('.rtgdeel-balk button[aria-current="true"]', bs => bs.length);
    assert.equal(actief, 1, 'precies een deel actief');

    // en wisselen doet echt iets: het tweede deel komt op, het eerste gaat weg
    const eerste = await page.$$eval('.rtgdeel-balk button', bs => bs[0].textContent);
    await page.click('.rtgdeel-balk button:nth-child(2)');
    const na = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.rtgdeel-balk button')];
      return { tweedeAan: b[1].getAttribute('aria-current') === 'true',
        eersteUit: b[0].getAttribute('aria-current') !== 'true' };
    });
    assert.ok(na.tweedeAan && na.eersteUit, 'wisselen werkt (van "' + eerste + '" af)');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

/* Derde geval, en de reden dat het er is: een menuknop die niets opent.
   rtgid.html markeert zijn delen (<div class="deel">Toegang</div>) en zet er
   meteen zijn eigen kop onder (<h2>Actieve toegang</h2>). Dat werden twee
   delen, waarvan het eerste alleen zijn eigen kop als lid had -- en die kop
   verbergt open() hoe dan ook, dus die knop toonde een leeg scherm: acht
   knoppen, vier leeg, twee paren met dezelfde naam. De bewering hieronder is
   daarom niet "er zijn minstens drie knoppen" (dat slaagt bij acht knoppen
   waarvan vier leeg net zo vrolijk) maar: ELKE knop toont minstens een
   element dat niet op alle standen staat, en GEEN knop zet zijn eigen tekst
   er nog eens als kop onder.

   Waarom de losse delen over de bundel heen worden geserveerd: de pagina's
   laden public/shared/deelmenu.js, en dat bestand is bouwuitvoer -- de bron
   staat in public/shared/deelmenu/. bundel() geeft byte-voor-byte wat de
   build daarvan maakt (check.js regel 6 bewaakt dat de ingecheckte bundel
   daaraan gelijk is), dus deze toets gaat over de BRON en kan niet slagen op
   een bundel die achterloopt. Het aantal onderscheppingen wordt geteld en
   beweerd: bedient de service worker het script alsnog uit zijn cache, dan
   zakt de toets in plaats van stilletjes de bundel te meten. */
const METER = function (html) {
  var main = document.querySelector('main');
  if (html) { main.innerHTML = html; window.RTGDeel.herscan(); }
  var balk = main.querySelector('.rtgdeel-balk');
  if (!balk) return { tabs: 0, regels: [] };
  var host = balk.parentElement;
  var knoppen = [].slice.call(balk.querySelectorAll('button'));
  var kids = [].slice.call(host.children).filter(function (e) { return e !== balk; });
  // per knop: wat is er zichtbaar? Wat op ELKE stand staat is vaste inhoud
  // (de intro, een KPI-rij) en hoort bij geen enkel deel.
  var per = knoppen.map(function (b) { b.click(); return kids.map(function (e) { return e.getClientRects().length > 0; }); });
  var altijd = kids.map(function (e, j) { return per.every(function (v) { return v[j]; }); });
  return { tabs: knoppen.length, regels: knoppen.map(function (b, i) {
    var eigen = kids.filter(function (e, j) { return per[i][j] && !altijd[j]; });
    return { naam: b.textContent, eigen: eigen.length,
      dubbel: eigen.length > 0 && eigen[0].textContent.trim() === b.textContent.trim() };
  }) };
};

test('deelmenu: geen knop opent een leeg scherm, geen knop herhaalt zijn eigen naam',
  { skip: pw ? false : 'geen browser beschikbaar in deze omgeving' }, async () => {
  const { child, base } = await startServer({ env: { SMTP_URL: '' } });
  let browser;
  try {
    const u = Date.now().toString().slice(-8);
    const reg = await fetch(base + '/api/auth/register', { method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'iDlid', email: 'id' + u + '@x.nl', phone: '06' + u,
        password: 'geheim123', geboortedatum: '1990-01-01', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' }) }).then(r => r.json());

    browser = await pw.chromium.launch({ args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const fouten = [];
    letOpFouten(page, fouten);
    /* HIER STOND EEN ONDERSCHEPPING, en die kon niet meer aankomen.

       Deze toets ving /shared/deelmenu.js op en serveerde in plaats daarvan de
       som van de losse delen, zodat hij zeker de BRON mat en niet een bundel
       die achterloopt. Sindsdien voegt de server uitgestelde scripts samen tot
       een verzoek (server/middleware/scriptbundel.js), dus vraagt de pagina dat
       pad helemaal niet meer op -- de onderschepping vuurde nooit, en de
       controle erachter ("onderschept > 0") zakte.

       De vervanging is geen versoepeling maar een verplaatsing. Dat de bundel
       gelijk is aan zijn delen is nu een eis in de gewone suite
       (test/bundeldelen.test.js, met een ijking die hem laat uitslaan bij een
       byte verschil). Wat de server hier uitserveert IS dus de som van de
       delen, en deze toets hoeft dat niet nog eens langs een andere weg te
       bewijzen. Een tweede bewijs op de verkeerde plek is geen extra zekerheid;
       het is een toets die stuk gaat om iets waar hij niet over gaat. */
    bundel.controleer();
    await page.goto(base + '/apps/rtgid.html', { waitUntil: 'domcontentloaded' });
    await page.evaluate(t => { localStorage.setItem('rtg_member_token', t); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, reg.token);
    await page.goto(base + '/apps/rtgid.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.rtgdeel-balk button', { timeout: 8000 });

    /* 1. rtgid.html zoals hij op de plank ligt: vier delen, vier knoppen. */
    const id = await page.evaluate(METER, null);
    assert.deepEqual(id.regels.map(r => r.naam), ['Inloggen', 'Toegang', 'Machtigingen', 'Inzagelog'],
      'de vier markers van de pagina zijn de vier knoppen');
    assert.deepEqual(id.regels.filter(r => r.eigen === 0).map(r => r.naam), [],
      'geen knop opent een leeg scherm');
    assert.deepEqual(id.regels.filter(r => r.dubbel).map(r => r.naam), [],
      'geen knop met zijn eigen naam er nog eens als kop onder');

    /* 2. En niet alleen op deze pagina: dezelfde eis op de andere vormen die
       een kop zonder eigen inhoud opleveren -- een slotkop, en een kop die
       alleen door vaste laag wordt gevolgd. Het echte component, dezelfde
       herscan die de apps gebruiken. */
    const vormen = [
      ['marker met eigen kop eronder',
        '<div class="deel">Een</div><h2>Kop een</h2><div class="kaart">inhoud een</div>' +
        '<div class="deel">Twee</div><h2>Kop twee</h2><div class="kaart">inhoud twee</div>' +
        '<div class="deel">Drie</div><h2>Kop drie</h2><div class="kaart">inhoud drie</div>'],
      ['slotkop zonder inhoud eronder',
        '<div class="deel">Een</div><div class="kaart">inhoud een</div>' +
        '<div class="deel">Twee</div><div class="kaart">inhoud twee</div>' +
        '<div class="deel">Drie</div><div class="kaart">inhoud drie</div><div class="deel">Vier</div>'],
      ['kop die alleen door vaste laag wordt gevolgd',
        '<div class="deel">Een</div><div class="kaart">inhoud een</div>' +
        '<div class="deel">Twee</div><div class="kaart">inhoud twee</div>' +
        '<div class="deel">Drie</div><div class="rtgdeel-vast">altijd zichtbaar</div>' +
        '<div class="deel">Vier</div><div class="kaart">inhoud vier</div>']
    ];
    const slot = [];
    for (const [naam, html] of vormen) {
      const v = await page.evaluate(METER, html);
      assert.equal(v.tabs, 3, naam + ': drie knoppen, want er zijn drie delen met inhoud');
      assert.deepEqual(v.regels.filter(r => r.eigen === 0).map(r => r.naam), [],
        naam + ': geen knop opent een leeg scherm');
      assert.deepEqual(v.regels.filter(r => r.dubbel).map(r => r.naam), [],
        naam + ': geen knop herhaalt zijn eigen naam');
      slot.push(v.regels[2].eigen);
    }
    /* De slotkop draagt geen knop, dus zijn tekst hoort nergens door een knop
       vervangen te worden: hij blijft gewone inhoud bij het deel erboven (twee
       eigen elementen daar) en verhuist niet naar de vaste laag, want dan zou
       hij op elke stand meestaan. */
    assert.equal(slot[1], 2, 'de slotkop blijft in beeld bij het deel erboven');

    assert.deepEqual(fouten, [], 'paginafouten: ' + fouten.join(' | '));
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});
