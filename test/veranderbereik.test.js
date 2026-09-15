/* ============================================================================
   HET VERANDERBEREIK -- van welke toets staat vast WELKE BRONBESTANDEN hij dekt?

   Wat dit bestand bewijst, en waarom elk stuk ervan er staat:

     1. DE KOPPELING WERKT. Een waargenomen route lost via ROUTEBRON.json op naar
        het bronbestand waarin hij wordt afgehandeld. Dat is precies de schakel
        die scripts/attributie.js in zijn eigen `nietGemeten` als tekort noemt;
        doet hij het niet, dan voegt de hele meter niets toe. En een route die
        de kaart NIET kent levert geen bereik -- verzonnen dekking is de duurste
        faalvorm die deze laag heeft.

     2. EEN MEETGAT IS GEEN UITSPRAAK OVER DE TOETS. Een toets die niet meedraaide
        heet `nietInDezeRonde` en houdt zijn volle ring; een toets die wel draaide
        en geen route raakte heet `draaideZonderRoute` en is een EIGENSCHAP. Die
        twee mogen nooit op een hoop -- dat is de vorm waarin een planner een
        toets overslaat omdat de METING ontbrak, en dan groen meldt. Zonder
        ronde-register verzint de meter dat onderscheid niet en heet alles
        eerlijk `ongemeten`.

     3. DE METER KAN UITSLAAN. Zonder journaal valt de waargenomen as naar nul en
        stijgt de schuld. Een instrument dat niet kan uitslaan is geen instrument
        (AI-CONTEXT, par. 4c van MENSNETWERK.md).

     4. DE MONTAGEWORTEL TELT APART EN WORDT NOOIT AFGETROKKEN. server/server.js
        en server/opzet/ monteren de code en gebruiken hem niet, dus ze staan in
        de omgekeerde sluiting van vrijwel elk bestand -- en server.js handelt
        zelf 18 routes af die bijna elke toets aanraakt. Gemeten groeide
        `raakt kern/pay/poort.js` daardoor van 6 naar 342 toetsen. Ze blijven in
        `samen` staan (te ruim is de veilige kant voor een bewijskeuze) maar ze
        worden apart gemeld, anders leest een breed getal als precisie.

   ALLE DRAGENDE BEWERINGEN ZIJN MET EEN MUTATIE NAGETROKKEN: een kaart die altijd
   oplost, een uitgezette volle ring, de twee standen op een hoop, een
   montagewortel die niets herkent, en de band alsnog aftrekken -- alle vijf laten
   ze hier iets zakken. Een toets die je niet hebt zien zakken is geen toets.
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { meet, raakt, alleToetsen } = require('../scripts/veranderbereik');

/* De echte routekaart, want dit hele register staat of valt met de schakel
   route -> bronbestand. Een verzonnen kaart zou de toets groen houden terwijl
   de koppeling in werkelijkheid nergens op uitkomt. */
const ROUTEBRON = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ROUTEBRON.json'), 'utf8'));
const ECHTE = ROUTEBRON.perRoute.find((r) => r.route && r.bestand && !/:/.test(r.route));

const TOETSEN = alleToetsen();
const A = TOETSEN[0];
const B = TOETSEN[1];

function schrijf(regels, naam) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vb-')), naam);
  fs.writeFileSync(p, regels.join('\n') + '\n');
  return p;
}
const journaal = (r) => schrijf(r, 'journaal.log');
const ronde = (namen) => schrijf(namen.map((n) => n + '\t10\tnormaal\tproef'), 'toetsduur');

/* ---- 1. DE KOPPELING ZELF -------------------------------------------------
   Dit is wat scripts/attributie.js in `nietGemeten` als tekort noemde. Doet
   deze schakel het niet, dan voegt deze hele meter niets toe. */
test('een waargenomen route lost op naar het bronbestand waarin hij wordt afgehandeld', () => {
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde([A]));
  assert.equal(u.per[A].routes, 1);
  assert.equal(u.per[A].bronbestanden, 1, 'route ' + ECHTE.route + ' hoort naar ' + ECHTE.bestand + ' te wijzen');
  assert.ok(['waargenomen', 'beide'].includes(u.per[A].stand));
  assert.equal(u.per[A].volleRing, false);
});

/* Een route die de kaart NIET kent mag geen bereik opleveren. Zou hij dat wel
   doen, dan verzint de meter dekking -- de duurste faalvorm die hij heeft. */
test('een route die ROUTEBRON niet kent levert geen bronbestand en wordt geteld', () => {
  const u = meet([journaal(['TOETS GET /api/deze-route-bestaat-niet-xyz ' + A])], ronde([A]));
  assert.equal(u.per[A].routes, 1);
  assert.equal(u.per[A].bronbestanden, 0);
  assert.ok(u.gemeten.routesZonderBronbestand >= 1);
});

/* ---- 2. DE REGEL DIE ERTOE DOET -------------------------------------------
   Een toets waarover niets is gemeten, mag nooit gelden als "raakt niets aan".
   Dat is precies de vorm waarin een planner een toets overslaat omdat de
   METING ontbrak, en dan groen meldt. */
test('een toets die niet meedraaide heet nietInDezeRonde en houdt zijn volle ring', () => {
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde([A]));
  const stil = TOETSEN.find((t) => u.per[t].stand === 'nietInDezeRonde');
  assert.ok(stil, 'er hoort minstens een toets buiten deze ronde te vallen');
  assert.equal(u.per[stil].volleRing, true);
  assert.equal(u.per[stil].bronbestanden, 0);
});

/* En de andere helft van die splitsing: draaien zonder route te raken is een
   EIGENSCHAP (een in-proces toets) en geen meetgat. Ze mogen nooit op een
   hoop, maar allebei houden ze hun volle ring -- het onderscheid maakt de
   meting eerlijker, niet de versmalling ruimer. */
test('draaide-zonder-route en niet-gedraaid zijn twee standen, en allebei een volle ring', () => {
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde([A, B]));
  assert.equal(u.per[B].stand === 'draaideZonderRoute' || u.per[B].stand === 'statisch', true);
  if (u.per[B].stand === 'draaideZonderRoute') {
    assert.equal(u.per[B].volleRing, true);
    assert.ok(u.gemeten.draaideZonderRoute >= 1);
    assert.notEqual(u.per[B].stand, 'nietInDezeRonde');
  }
});

/* Zonder ronde-register mag de meter dat onderscheid NIET verzinnen. */
test('zonder ronde-register heet alles eerlijk ongemeten', () => {
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], '/bestaat/niet/toetsduur');
  assert.equal(u.gemeten.toetsenInDezeRonde, null);
  assert.equal(u.gemeten.draaideZonderRoute, 0);
  assert.equal(u.gemeten.nietInDezeRonde, 0);
  const stil = TOETSEN.find((t) => u.per[t].stand === 'ongemeten');
  assert.ok(stil && u.per[stil].volleRing === true);
});

/* ---- 3. DE BESTURINGSPROEF ------------------------------------------------
   Een instrument dat niet kan uitslaan is geen instrument (AI-CONTEXT, par. 4c).
   Zonder journaal hoort de waargenomen as naar nul te vallen en de schuld te
   stijgen; blijft hij staan, dan meet deze meter iets anders dan hij zegt. */
test('zonder journaal valt de waargenomen as naar nul en stijgt de schuld', () => {
  const met = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde([A]));
  const zonder = meet([], ronde([A]));
  assert.ok(met.gemeten.waargenomenBereik >= 1);
  assert.equal(zonder.gemeten.waargenomenBereik, 0);
  assert.ok(zonder.gemeten.zonderBereik > met.gemeten.zonderBereik,
    'de schuld hoort te stijgen als de waarneming wegvalt');
  assert.equal(zonder.gemeten.gedichtDoorWaarneming, 0);
});

/* ---- 4. DE OMGEKEERDE VRAAG -----------------------------------------------
   Waar dit voor bedoeld is: als DIT bestand verandert, welke toetsen hebben er
   dan aantoonbaar iets mee te maken -- en hoeveel toetsen zeggen niets. */
test('--raakt vindt de toets langs de waargenomen as, en meldt de volle ringen erbij', () => {
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde([A]));
  const r = raakt(u, ECHTE.bestand);
  assert.ok(r.langsWaarneming.includes(A), A + ' raakte ' + ECHTE.route + ' in ' + ECHTE.bestand);
  assert.ok(r.samen.includes(A));
  assert.ok(r.inSluiting >= 1);
  /* Zolang dit getal niet nul is, dekt `samen` de vraag niet. Dat het MEE komt
     is het halve punt van deze laag. */
  assert.equal(typeof r.volleRing, 'number');
  assert.ok(r.volleRing > 0, 'vandaag hoort dit getal groot te zijn, en zichtbaar');
});

/* De schuld is een ABSOLUUT getal en geen percentage: een percentage daalt ook
   als er toetsen bijkomen die niets bewijzen. */
test('de optelling klopt: elke toets valt in precies een stand', () => {
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde([A]));
  const standen = {};
  for (const t of TOETSEN) standen[u.per[t].stand] = (standen[u.per[t].stand] || 0) + 1;
  const som = Object.values(standen).reduce((a, b) => a + b, 0);
  assert.equal(som, u.gemeten.toetsbestanden);
  assert.equal(u.gemeten.zonderBereik,
    (standen.ongemeten || 0) + (standen.draaideZonderRoute || 0) + (standen.nietInDezeRonde || 0));
  assert.equal(u.gemeten.blindeVlekStatisch, u.gemeten.toetsbestanden - u.gemeten.statischBereik);
  assert.equal(u.gemeten.gedichtDoorWaarneming,
    u.gemeten.blindeVlekStatisch - u.gemeten.zonderBereik);
});

/* ---- 5. DE MONTAGEWORTEL ---------------------------------------------------
   server/server.js en server/opzet/ MONTEREN de code en gebruiken hem niet, dus
   ze staan in de omgekeerde sluiting van vrijwel elk bestand -- en server.js
   handelt zelf 18 routes af die bijna elke toets aanraakt. Zonder deze telling
   groeide `raakt kern/pay/poort.js` van 6 naar 342 toetsen en las dat als
   precisie. Ze worden NIET afgetrokken (te ruim is de veilige kant), maar ze
   worden wel apart gemeld. */
test('een toets die alleen via de montagewortel binnenkomt wordt apart geteld en niet afgetrokken', () => {
  const viaWortel = ROUTEBRON.perRoute.find((r) => /^server\/(server\.js|opzet\/)/.test(r.bestand) && !/:/.test(r.route));
  if (!viaWortel) return;   // geen montageroute in de kaart: dan valt er niets te bewijzen
  const u = meet([journaal(['TOETS ' + viaWortel.route + ' ' + A])], ronde([A]));
  const r = raakt(u, viaWortel.bestand);
  assert.ok(r.langsWaarneming.includes(A), 'hij komt binnen');
  assert.ok(r.viaMontage.includes(A), 'en hij komt alleen via de montagewortel binnen');
  assert.ok(r.samen.includes(A), 'maar hij wordt niet afgetrokken -- te ruim is de veilige kant');
});

/* De omgekeerde sluiting van een gewoon routebestand hoort NIET door de
   montagewortel te worden opgeblazen tot de hele suite. */
test('perBestand laat zien langs welk bestand een toets binnenkwam', () => {
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde([A]));
  const r = raakt(u, ECHTE.bestand);
  assert.equal(typeof r.perBestand, 'object');
  assert.ok(Object.keys(r.perBestand).length >= 1);
  assert.ok(r.perBestand[ECHTE.bestand] >= 1, ECHTE.bestand + ' hoort de band te zijn waarlangs hij binnenkwam');
});

/* ---- 6. VOLLEDIG IS LIDMAATSCHAP, GEEN AANTAL ------------------------------
   De keten meldde "1901 van 1900 toetsbestanden gedraaid": de duurregisters
   dragen een naam die niet op schijf staat (test/meterijk.test.js zet tijdens
   zijn ijking een toetsbestand neer en haalt het weer weg). Met een TELLER kan
   een ronde dus een echt bestand missen en toch volledig heten, zolang er maar
   een vreemde naam tegenover staat -- een gelijkheidstoets met een blinde vlek
   die eruitziet als succes. */
test('een ronde met het juiste AANTAL maar een ontbrekend bestand is niet volledig', () => {
  const opEenNa = TOETSEN.filter((t) => t !== A);
  const metVreemde = ronde([...opEenNa, 'zz-bestaat-niet.test.js']);  // zelfde aantal, ander lidmaatschap
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + B])], metVreemde);
  assert.equal(u.gemeten.toetsenInDezeRonde, TOETSEN.length, 'het aantal klopt namelijk wel');
  assert.equal(u.gemeten.rondeVolledig, false, 'maar er ontbreekt een echt toetsbestand');
  assert.equal(u.gemeten.rondeGemist, 1);
  assert.equal(u.gemeten.rondeVreemdeNamen, 1);
  assert.equal(u.per[A].stand, 'nietInDezeRonde');
});

test('een volledige ronde heet volledig, ook met een vreemde naam erbij', () => {
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde([...TOETSEN, 'zz-weg.test.js']));
  assert.equal(u.gemeten.rondeVolledig, true);
  assert.equal(u.gemeten.rondeGemist, 0);
  assert.equal(u.gemeten.rondeVreemdeNamen, 1);
});
