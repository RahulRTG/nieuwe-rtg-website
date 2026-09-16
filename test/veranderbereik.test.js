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

/* EEN TOETS ZONDER STATISCH BEREIK, gekozen uit een ECHTE meting en niet uit de
   sorteervolgorde. TOETSEN[0] was zo'n toets tot de bronmappen op 16 september
   2026 werden verbreed van server/ naar server+scripts+public; toen verschoof
   hij stil naar de stand `statisch` en kon de besturingsproef hieronder niets
   meer aantonen -- hij bleef groen omdat de schuld niet MEER kon stijgen, niet
   omdat de meter werkte. Een fixture die op een index leunt, verliest zijn
   eigenschap zodra de meter verandert, en doet dat zonder iets te zeggen. */
const NULMETING = meet([], null);
const BLIND = TOETSEN.find((t) => NULMETING.per[t].statisch === false);
assert.ok(BLIND, 'er is een toets zonder statisch bereik om mee te proeven');

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
  /* BLIND en niet A: bij een toets die al statisch bereik heeft, verandert het
     wegvallen van het journaal niets aan de SCHULD -- dan meet deze proef of de
     meter stilstaat in plaats van of hij uitslaat. */
  const met = meet([journaal(['TOETS ' + ECHTE.route + ' ' + BLIND])], ronde([BLIND]));
  const zonder = meet([], ronde([BLIND]));
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
  const opEenNa = TOETSEN.filter((t) => t !== BLIND);
  const metVreemde = ronde([...opEenNa, 'zz-bestaat-niet.test.js']);  // zelfde aantal, ander lidmaatschap
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + B])], metVreemde);
  assert.equal(u.gemeten.toetsenInDezeRonde, TOETSEN.length, 'het aantal klopt namelijk wel');
  assert.equal(u.gemeten.rondeVolledig, false, 'maar er ontbreekt een echt toetsbestand');
  assert.equal(u.gemeten.rondeGemist, 1);
  assert.equal(u.gemeten.rondeVreemdeNamen, 1);
  /* BLIND en niet A: een toets MET statisch bereik heet `statisch` ook als hij
     niet meedraaide -- de stand is een mengsel van beide assen. Alleen bij een
     toets zonder enig bereik is `nietInDezeRonde` zichtbaar. */
  assert.equal(u.per[BLIND].stand, 'nietInDezeRonde');
});

test('een volledige ronde heet volledig, ook met een vreemde naam erbij', () => {
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde([...TOETSEN, 'zz-weg.test.js']));
  assert.equal(u.gemeten.rondeVolledig, true);
  assert.equal(u.gemeten.rondeGemist, 0);
  assert.equal(u.gemeten.rondeVreemdeNamen, 1);
});

/* ---- 7. KENNIS EN RONDE ZIJN TWEE OBJECTEN --------------------------------
   Het register mag nooit een halve ronde als duurzame waarheid presenteren. Dat
   is geen stijlregel maar de reden dat deze splitsing bestaat: `zonderBereik`
   telt bij een halve ronde te veel volle ringen, en wie dat getal in een
   document als "wat dit huis weet" leest, leest een tekort van de METING als
   een uitspraak over de toetsen.

   De dragende proef is de onderste: twee totaal verschillende waarnemingen over
   DEZELFDE code moeten een byte voor byte gelijke KENNIS opleveren. Dat is de
   enige vorm die een `{ ...u }` in kennisVan() betrapt -- een lijst velden
   nakijken doet dat niet, want een spread levert de juiste velden ook. */
const { kennisVan, rondeVan } = require('../scripts/veranderbereik');

test('KENNIS draagt alleen wat uit de code volgt -- een gesloten lijst, geen doorsnede', () => {
  const u = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde([A]));
  const k = kennisVan(u);
  assert.deepEqual(Object.keys(k.gemeten).sort(),
    ['blindeVlekStatisch', 'statischBereik', 'toetsbestanden']);
  assert.deepEqual(Object.keys(k.per[A]), ['statisch'],
    'een rij in KENNIS kent alleen de statische as');
  assert.equal(k.bronnen, undefined, 'KENNIS noemt geen journaal -- dat is een waarneming');
  assert.equal(k.soort, 'kennis');
});

test('RONDE draagt de waarneming EN zegt welke bronnen hij las', () => {
  const j = journaal(['TOETS ' + ECHTE.route + ' ' + A]);
  const r = rondeVan(meet([j], ronde([A])));
  assert.equal(r.soort, 'waarneming');
  assert.ok(r.bronnen.journalen.length >= 1 && r.bronnen.rondeRegisters.length >= 1,
    'zonder te weten WELKE ronde het was betekent zonderBereik niets');
  assert.ok('zonderBereik' in r.gemeten && 'rondeVolledig' in r.gemeten);
  assert.ok('stand' in r.per[A], 'de stand van een toets hangt aan de ronde');
});

/* HET MOMENT VAN VASTLEGGEN IS GEEN KENNIS. `stempel.op` verschilt per
   aanroep en hoort dus buiten de vergelijking; de COMMIT waar hij op slaat
   blijft er wel in staan, want die zegt wel iets over de code. */
function zonderKlok(k) {
  return { ...k, stempel: { ...k.stempel, op: '<moment>' } };
}

/* DE DRAGENDE PROEF, en twee mutaties laten zien waarom hij naast de toets
   hierboven staat en niet in plaats daarvan.

     `return { ...u, soort: 'kennis' }` in kennisVan() laat ze allebei zakken.
     `toetsbestanden: u.gemeten.toetsenInDezeRonde` -- de lijst velden blijft
     precies goed, alleen de INHOUD van een veld komt uit de ronde -- laat
     alleen DEZE zakken.

   Een lijst velden nakijken vangt de tweede vorm dus niet, en dat is de vorm
   die je in het echt krijgt: niemand schrijft een spread, iemand pakt het
   dichtstbijzijnde getal. Hij vergelijkt per sleutel in plaats van in een klap,
   zodat een verschil te LEZEN is -- een diff over 1901 rijen zegt niet welk
   veld verschoof. */
test('twee verschillende rondes over dezelfde code geven identieke KENNIS', () => {
  const vol = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A,
    'TOETS ' + ECHTE.route + ' ' + B])], ronde(TOETSEN));
  const half = meet([], ronde([A]));                    // geen journaal, halve ronde

  assert.notDeepEqual(rondeVan(vol).gemeten, rondeVan(half).gemeten,
    'de waarneming MOET verschillen, anders bewijst de vergelijking hieronder niets');

  const a = zonderKlok(kennisVan(vol));
  const b = zonderKlok(kennisVan(half));
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort(),
    'KENNIS draagt bij een andere ronde andere VELDEN -- er lekt waarneming in');
  for (const sleutel of Object.keys(a)) {
    if (sleutel === 'per') continue;
    assert.deepEqual(a[sleutel], b[sleutel],
      'KENNIS.' + sleutel + ' hangt van de ronde af, en dat mag niet');
  }
  const anders = Object.keys(a.per).filter(
    (t) => JSON.stringify(a.per[t]) !== JSON.stringify(b.per[t]));
  assert.deepEqual(anders, [],
    'deze toetsrijen in KENNIS bewegen mee met de ronde: ' + anders.slice(0, 5).join(', '));
});

/* ---- 8. DE POORT HOUDT EEN BESTAND TEGEN, NIET ALLEBEI -------------------
   Een halve ronde mag geen RONDE-register opleveren: `zonderBereik` is dan een
   tekort van de meting en geen schuld. Maar de KENNIS hangt niet aan de ronde,
   en die tegenhouden zou betekenen dat een DUURZAAM register veroudert omdat
   een UITVOERING niet af was -- waarna de volgende lezer het oude bestand
   citeert. Precies de vorm die deze splitsing moest opheffen.

   Dit draait de echte CLI in een eigen map (RTG_VERANDERBEREIK_MAP), want de
   volgorde van schrijven-en-weigeren is niet uit een functie af te leiden: hij
   zit in main(). Nagetrokken met een mutatie -- de KENNIS-schrijfregel weer
   ONDER de poort zetten laat deze toets zakken en geen enkele andere. */
test('een halve ronde levert wel KENNIS en geen RONDE, met foutcode 1', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vb-uit-'));
  const r = require('node:child_process').spawnSync(process.execPath,
    [path.join(__dirname, '..', 'scripts', 'veranderbereik.js'), '--vastleggen'],
    { env: { ...process.env, RTG_VERANDERBEREIK_MAP: map }, encoding: 'utf8' });

  assert.equal(r.status, 1, 'een halve ronde hoort een foutcode te geven');
  assert.equal(fs.existsSync(path.join(map, 'VERANDERBEREIK-KENNIS.json')), true,
    'de duurzame helft hangt niet aan de ronde en hoort geschreven te zijn');
  assert.equal(fs.existsSync(path.join(map, 'VERANDERBEREIK-RONDE.json')), false,
    'de waarneming van een halve ronde hoort NIET te worden vastgelegd');
  assert.match(r.stderr, /KENNIS hierboven staat er wel/,
    'een foutcode die niet zegt wat er WEL staat, laat iemand goed werk weggooien');
});

test('met --onvolledig komen ze er allebei, en de ronde zegt zelf dat hij half is', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vb-uit-'));
  const r = require('node:child_process').spawnSync(process.execPath,
    [path.join(__dirname, '..', 'scripts', 'veranderbereik.js'), '--vastleggen', '--onvolledig'],
    { env: { ...process.env, RTG_VERANDERBEREIK_MAP: map }, encoding: 'utf8' });

  assert.equal(r.status, 0);
  const ronde = JSON.parse(fs.readFileSync(path.join(map, 'VERANDERBEREIK-RONDE.json'), 'utf8'));
  assert.equal(ronde.gemeten.rondeVolledig, false,
    'bewust vastleggen mag, stilzwijgend niet -- het staat in het register en niet in iemands hoofd');
  const kennis = JSON.parse(fs.readFileSync(path.join(map, 'VERANDERBEREIK-KENNIS.json'), 'utf8'));
  assert.equal('rondeVolledig' in kennis.gemeten, false);
});

/* ---- 9. DE BRONMAPPEN ZIJN BREDER DAN server/ -----------------------------
   De vraag die dit register beantwoordt is *als DIT bestand verandert, welk
   bewijs moet dan opnieuw* -- en die gaat over elk bestand dat kan wijzigen.
   De statische as vroeg tot 16 september 2026 naar een require-kant die in
   `server/` uitkomt, en telde daardoor 302 toetsen als BLIND die een volstrekt
   bepaalbaar bereik hebben: 224 hangen aan scripts/ en 78 aan public/. Dat is
   28% van de gemelde blinde vlek, en juist dat getal werd geciteerd als de
   schuld die versmalling tegenhoudt.

   Nagetrokken met een mutatie: BRONMAPPEN terugzetten op ['server/'] laat deze
   toets zakken. De besturingsproef hierboven zakt dan NIET -- die leidt zijn
   blinde toets sinds deze ronde af uit een echte meting, precies zodat een
   versmalling van de meter hier niet stil doorheen komt. */
test('een toets van een meter in scripts/ heeft bereik, en de meter vindt hem terug', () => {
  const u = meet([], null);
  const eigen = 'veranderbereik.test.js';
  assert.equal(u.per[eigen].statisch, true,
    'deze toets zelf hangt aan scripts/veranderbereik.js en is dus niet blind');

  const r = raakt(u, 'scripts/veranderbereik.js');
  assert.ok(r.samen.includes(eigen),
    'wie dit script wijzigt, hoort deze toets terug te krijgen');
});

test('een toets die nergens aan hangt blijft eerlijk blind', () => {
  const u = meet([], null);
  assert.equal(u.per[BLIND].statisch, false);
  assert.equal(u.per[BLIND].volleRing, true,
    'de verbreding mag geen bereik VERZINNEN waar geen require-kant is');
});

/* ---- 10. EEN GESCHEURD PAAR IS ZICHTBAAR ---------------------------------
   `ronde` en het journaal zijn twee bestanden met een EIGEN levensduur:
   `.toetsduur` groeit aan over rondes heen, een journaal wordt per ronde
   geschreven. Komen ze uit verschillende uitvoeringen, dan zegt de ronde dat
   alles draaide terwijl het journaal vrijwel niets kent -- en de meter noemt al
   die toetsen `draaideZonderRoute`. Dat is precies de stand die leest als
   "prima, een in-proces toets": een MEETGAT wordt stilletjes een EIGENSCHAP.

   ZO IS HET ECHT MISGEGAAN (16 september 2026). Een afgekapte ronde liet
   `.toetsduur` van een EERDERE volle ronde staan. De meter las 1685 gedraaid
   tegen 160 in het journaal, telde 454 `draaideZonderRoute`, en meldde 654
   volle ringen waar de echte ronde er 246 had.

   `toetsenMetJournaalregel` zet het paar op tafel. GEEN drempel en geen oordeel:
   er is geen ronde-identiteit om twee bestanden mee te vergelijken, dus de meter
   verzint er geen -- hij toont 160 naast 1685 en de lezer ziet het.

   MUTATIE: het veld vullen met `ronde.size` in plaats van met de doorsnede ->
   deze toets zakt, gedraaid. */
test('een ronde en een journaal uit verschillende uitvoeringen zijn te zien aan het paar', () => {
  /* Een journaal dat maar EEN toets noemt, tegen een ronde die de hele suite
     claimt -- de vorm van een afgekapte ronde naast een oude .toetsduur. */
  const gescheurd = meet([journaal(['TOETS ' + ECHTE.route + ' ' + A])], ronde(TOETSEN));

  assert.equal(gescheurd.gemeten.toetsenInDezeRonde, TOETSEN.length,
    'de ronde beweert dat de hele suite draaide');
  assert.equal(gescheurd.gemeten.toetsenMetJournaalregel, 1,
    'terwijl het journaal er precies een kent -- en juist dat verschil is het signaal');
  assert.ok(gescheurd.gemeten.draaideZonderRoute > 1,
    'zonder dat paar leest deze berg als een eigenschap van de suite');

  /* En de tegenproef: bij een journaal dat WEL bij de ronde hoort, lopen de
     twee getallen samen op. Anders zou het veld altijd "gescheurd" roepen. */
  const heel = meet([journaal(TOETSEN.slice(0, 3).map(
    (t) => 'TOETS ' + ECHTE.route + ' ' + t))], ronde(TOETSEN.slice(0, 3)));
  assert.equal(heel.gemeten.toetsenInDezeRonde, 3);
  assert.equal(heel.gemeten.toetsenMetJournaalregel, 3,
    'een ronde en een journaal uit DEZELFDE uitvoering lopen gelijk op');
});
