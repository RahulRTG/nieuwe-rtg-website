/* BEDIENBAAR MEET HET SCHERM, NIET DE SCHIL -- in een echte browser.

   Een synthetisch scherm met de gedeelde schil erop (30 knoppen onder
   .rtg-edge-chrome, plus de toetsknop van het veeggebaar die met opzet buiten
   beeld staat) en drie eigen knoppen, waarvan een op vier kaarten staat. De
   proef hoort:
     1. alleen de eigen knoppen te tellen, en elke knop een keer (noemer 3);
     2. de schil apart te melden, en er niets van aan te tikken;
     3. de toetsknop niet als "niet aan te tikken" te melden;
     4. een eigen knop die de schil HELEMAAL bedekt als bedekt te melden -- de
        tabbalk van Decision Room lag zo onder de Edge, en de proef noemde dat
        "niet aan te tikken" in plaats van een defect.
   Voor 27 september 2026 telde de noemer 30 + 1 + 6 = 37 en tikte de proef de
   eerste 14 aan, allemaal schil: 111 van 112 rijen bleven NIET_GETEST. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { browserOpties, geenBrowser } = require('./helper');
const { laadBrowser } = require('./browser');
const pw = laadBrowser();

const schil = '<div class="rtg-edge-chrome">' +
  Array.from({ length: 30 }, (_, i) => '<button type="button" onclick="window.schilGetikt=(window.schilGetikt||0)+1">Schil ' + i + '</button>').join('') +
  '</div><button type="button" class="rnd-toets" style="position:absolute;left:-9999px">Instellingen openen</button>' +
  '<button type="button" data-ds-zoek onclick="window.schilGetikt=(window.schilGetikt||0)+1">Spring naar een functie</button>' +
  '<div class="ds-edge"><button type="button" onclick="window.schilGetikt=(window.schilGetikt||0)+1">Vraag Rahul</button></div>' +
  '<div class="rtgsprong"><button type="button" onclick="window.schilGetikt=(window.schilGetikt||0)+1">Globale sprong</button></div>';
const kaart = '<div class="kaart"><button type="button" onclick="window.eigen=(window.eigen||0)+1">Bekijken</button></div>';
const SCHERM = '<!doctype html><html><body><main>' +
  '<button type="button" onclick="window.eigen=(window.eigen||0)+1">Vernieuwen</button>' +
  '<button type="button" onclick="window.eigen=(window.eigen||0)+1">Filter</button>' +
  kaart + kaart + kaart + kaart + '</main>' + schil + '</body></html>';

/* Een eigen vaste tab onder een vaste balk van de schil, en een die half vrij
   ligt: alleen de eerste is bedekt. */
const BEDEKT = '<!doctype html><html><body><main><p>x</p></main>' +
  '<nav style="position:fixed;bottom:10px;left:0;width:400px;height:50px;display:flex">' +
  '<button type="button" style="width:200px">Onder de balk</button><button type="button" style="width:200px">Half vrij</button></nav>' +
  '<div class="rtg-edge-chrome" style="position:fixed;bottom:0;left:0;width:300px;height:80px;z-index:9;background:#000"></div></body></html>';

/* Elke knop vervangt de hele stand. Een meter die na de eerste tik alleen de
   nieuwe stand bekijkt, rapporteert 1/6 terwijl alle zes knoppen afzonderlijk
   gewoon werken. Heropenen moet de oorspronkelijke stand terugbrengen zonder
   een klik administratief als geslaagd te tellen. */
const STANDWISSEL = '<!doctype html><html><body><main id="vlak">' +
  Array.from({ length: 6 }, (_, i) => '<button type="button" onclick="document.querySelector(\'main\').innerHTML=\'<p>Stand ' + i + '</p>\';window.gedaan=' + (i + 1) + '">Stand ' + i + '</button>').join('') +
  '</main></body></html>';

/* De eerste bediening laat bewust een niet-sluitende laag achter. De overige
   knoppen zijn op de schone ingang wel bereikbaar. Dit onderscheidt een door
   de meetvolgorde veroorzaakte blokkade van een echte overlap in het product. */
const ACHTERGEBLEVEN_LAAG = '<!doctype html><html><body><main>' +
  '<button type="button" onclick="document.body.insertAdjacentHTML(\'beforeend\',\'<div id=&quot;achtergebleven&quot; style=&quot;position:fixed;inset:0;z-index:99;background:#fff&quot;></div>\')">Open laag</button>' +
  Array.from({ length: 5 }, (_, i) => '<button type="button" onclick="window.gedaan=(window.gedaan||0)+1">Actie ' + i + '</button>').join('') +
  '</main></body></html>';

/* Een app-eigen dialoog is geen schil: de opener is pas de ingang naar de
   bediening die gekwalificeerd moet worden. De sluitknop staat bewust voor de
   zes dialoogacties in de DOM; na de eerste heropening moet de meter de al
   beproefde sluitknop overslaan en de inhoud werkelijk doorlopen. */
const VERVOLGDIALOOG = '<!doctype html><html><body><main>' +
  '<button type="button" id="open" onclick="document.querySelector(\'dialog\').showModal()">Open instellingen</button>' +
  '<dialog><button type="button" onclick="this.closest(\'dialog\').close()">Sluiten</button>' +
  Array.from({ length: 6 }, (_, i) => '<button type="button" onclick="window.gedaan=(window.gedaan||0)+1">Keuze ' + i + '</button>').join('') +
  '</dialog></main></body></html>';

const MODULEBEREIK = '<!doctype html><html><body><main>' +
  Array.from({ length: 8 }, (_, i) => '<button type="button">Andere module ' + i + '</button>').join('') +
  '<section data-view="doel"><button type="button">Doel een</button><button type="button">Doel twee</button></section>' +
  '</main></body></html>';

test('bedienbaar telt de eigen knoppen, een keer elk, en laat de schil liggen', { skip: geenBrowser(pw) }, async () => {
  const { bedien } = require('../scripts/appwerkt');
  const srv = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html');
    res.end(req.url.startsWith('/apps/bedekt') ? BEDEKT :
      (req.url.startsWith('/apps/standwissel') ? STANDWISSEL :
        (req.url.startsWith('/apps/achtergebleven') ? ACHTERGEBLEVEN_LAAG :
          (req.url.startsWith('/apps/vervolg') ? VERVOLGDIALOOG :
            (req.url.startsWith('/apps/module') ? MODULEBEREIK : SCHERM))))); });
  await new Promise((k) => srv.listen(0, '127.0.0.1', k));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await pw.chromium.launch(browserOpties(pw));
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const b = await bedien(ctx, base, '/apps/x.html');
    assert.equal(b.gevonden, 3, 'drie eigen knoppen; vier keer "Bekijken" is een handeling');
    assert.equal(b.geklikt, 3, 'en alle drie zijn aangetikt');
    assert.equal(b.schil, 34, 'de generieke en Design-Systemschil worden apart gemeld');
    assert.deepEqual(b.nietKlikbaar, [], 'de toetsknop buiten beeld is geen bevinding over dit scherm');
    assert.ok(b.geklikt * 2 >= b.gevonden, 'met deze noemer is BEWEZEN haalbaar');
    assert.deepEqual(b.bedekt, [], 'niets van het scherm ligt onder de schil');

    const d = await bedien(ctx, base, '/apps/bedekt.html');
    assert.equal(d.bedekt.length, 1, 'de tab onder de balk is bedekt: ' + JSON.stringify(d.bedekt));
    assert.match(d.bedekt[0], /^Onder de balk onder div\.rtg-edge-chrome/);

    const s = await bedien(ctx, base, '/apps/standwissel.html');
    assert.equal(s.gevonden, 6, 'de oorspronkelijke stand bevat zes eigen handelingen');
    assert.equal(s.geklikt, 6, 'iedere handeling is na een schone heropening werkelijk aangetikt');
    assert.ok(s.instrument.some((x) => /oorspronkelijke stand/.test(x)), 'de meting verantwoordt haar heropeningen');
    assert.deepEqual(s.crash.concat(s.serverfout), [], 'de standwissels bleven zonder browser- of serverfout');

    const a = await bedien(ctx, base, '/apps/achtergebleven.html');
    assert.equal(a.gevonden, 6, 'de schone ingang bevat zes eigen handelingen');
    assert.equal(a.geklikt, 6, 'een achtergebleven laag blokkeert de overige tegenproeven niet');
    assert.deepEqual(a.nietKlikbaar, [], 'een uitsluitend door de vorige proefstand geblokkeerde knop is opnieuw getoetst');
    assert.ok(a.instrument.some((x) => /schone ingang/.test(x)), 'de herhaalde tegenproef is verantwoord');

    const v = await bedien(ctx, base, '/apps/vervolg.html');
    assert.equal(v.gevonden, 8, 'de opener, sluitroute en zes app-eigen dialoogacties zijn zichtbaar gemeten');
    assert.equal(v.geklikt, 8, 'de sluitroute en alle zeven unieke handelingen zijn werkelijk aangetikt');
    assert.deepEqual(v.nietKlikbaar, [], 'de dialooginhoud bleef bereikbaar');

    const { meetIngang } = require('../scripts/appwerkt');
    const meet = meetIngang({ functie: 'tab:doel' }, {
      'tab:doel': { ingang: '/apps/module.html', via: '#tab=doel', bereik: '[data-view="doel"]' }
    });
    assert.equal(meet.bereik, '[data-view="doel"]', 'het modulecontract draagt zijn expliciete meetbereik');
    const m = await bedien(ctx, base, meet);
    assert.equal(m.gevonden, 2, 'alleen de bediening van de bedoelde interne module telt');
    assert.equal(m.geklikt, 2, 'beide modulehandelingen zijn aangetikt');
    await ctx.close();
  } finally {
    await browser.close(); srv.close();
  }
});

/* OS-apps hebben geen eigen URL. De meter moet daarom dezelfde zichtbare route
   als een lid lopen (Edge -> Rahul -> opdracht), en daarna uitsluitend de
   geopende kiezer tellen. Bellen en Snaps krijgen een echt verbonden
   proefcontact; zonder contact zou een lege kiezer geen bediening bewijzen. */
test('OS-apps openen via Rahul en APPWERKT meet uitsluitend hun kiezer',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const { startServer, stop } = require('./helper');
  const { haalSessies, opslagVoor, verbindProeflid } = require('../scripts/lib/proefsessies');
  const { rijen, meetIngang, maakContext, bezoek } = require('../scripts/appwerkt');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appwerkt-os-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: data } });
  let browser;
  try {
    const { sessies } = await haalSessies(base, ['lid']);
    const contact = await verbindProeflid(base);
    assert.equal(contact.ok, true, contact.reden);
    browser = await pw.chromium.launch(browserOpties(pw));
    const ctx = await maakContext(browser, opslagVoor({
      lid: { ...sessies.lid, waarde: contact.token }
    }));
    const perFunctie = new Map(rijen().map((r) => [r.functie, r]));
    for (const functie of ['os:bellen', 'os:snaps', 'os:werk']) {
      const meet = meetIngang(perFunctie.get(functie));
      assert.equal(meet.adapter.type, 'rahul-opdracht', functie);
      const gezien = await bezoek(ctx, base, meet);
      assert.deepEqual(gezien.crash, [], functie + ': de zichtbare ingang opent niet');
      assert.equal(gezien.poort, false, functie + ': de ingang bleef achter een poort');
      const bediening = await require('../scripts/appwerkt').bedien(ctx, base, meet);
      assert.ok(bediening.gevonden >= 1, functie + ': de geopende appstand heeft geen eigen bediening');
      assert.ok(bediening.geklikt * 2 >= bediening.gevonden,
        functie + ': minder dan de helft van de appbediening werkte (' + bediening.geklikt + '/' + bediening.gevonden + ')');
      assert.deepEqual(bediening.crash.concat(bediening.serverfout), [], functie + ': de appstand veroorzaakte fouten');
      assert.equal(bediening.schil, 0, functie + ': gedeelde Edge-bediening lekte in het meetbereik');
    }
    await ctx.close();
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) {}
  }
});

test('APPWERKT opent Bord en Schrift met hun echte tabgebonden Schoolpas',
  { skip: geenBrowser(pw), timeout: 120000 }, async () => {
  const { startServer, stop } = require('./helper');
  const { haalSessies } = require('../scripts/lib/proefsessies');
  const { haalSchoolsessies, maakSchoolContext } = require('../scripts/lib/schoolproefsessies');
  const { rijen, meetIngang, maakContext, bezoek, bedien } = require('../scripts/appwerkt');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-appwerkt-school-'));
  const { child, base } = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: data } });
  let browser;
  try {
    const { sessies, overgeslagen } = await haalSessies(base, ['lid', 'gezin']);
    assert.deepEqual(overgeslagen, []);
    const school = await haalSchoolsessies(base, sessies);
    assert.ok(school, 'de echte les- en leerlingensessies moeten bestaan');
    browser = await pw.chromium.launch(browserOpties(pw));
    const perFunctie = new Map(rijen().map((r) => [r.functie, r]));
    for (const [functie, sleutel] of [['link:rtfbord', 'bord'], ['link:rtfschrift', 'schrift']]) {
      const ctx = await maakSchoolContext(browser, school[sleutel], maakContext);
      const meet = meetIngang(perFunctie.get(functie));
      const gezien = await bezoek(ctx, base, meet);
      assert.deepEqual(gezien.crash, [], functie + ': de ingang opent niet');
      assert.equal(gezien.poort, false, functie + ': de Schoolpas opende de deur niet');
      const bediening = await bedien(ctx, base, meet);
      assert.ok(bediening.gevonden >= 1, functie + ': het scherm heeft geen meetbare bediening');
      assert.ok(bediening.geklikt * 2 >= bediening.gevonden,
        functie + ': minder dan de helft van de bediening werkte (' + bediening.geklikt + '/' + bediening.gevonden + '): ' +
        JSON.stringify({ overgeslagen: bediening.overgeslagen, nietKlikbaar: bediening.nietKlikbaar,
          onderschept: bediening.onderschept, instrument: bediening.instrument }));
      assert.deepEqual(bediening.crash.concat(bediening.serverfout), [], functie + ': de bediening veroorzaakte fouten');
      await ctx.close();
    }
  } finally {
    if (browser) await browser.close();
    await stop(child);
    try { fs.rmSync(data, { recursive: true, force: true }); } catch (e) {}
  }
});
