/* ============================================================================
   WAT KOST EEN TOETSBESTAND DAT NIEMAND HEEFT GEMETEN?

   ./delen.js verdeelt de scherven op gemeten duur uit TOETSDUUR.json. Een
   bestand dat daar niet in staat heeft geen duur, en toch moet er een getal
   komen -- anders valt hij uit de verdeling of wordt hij stilzwijgend gratis.
   De hoofdregel van KEURING.md staat hier in een regel code: onzekerheid mag
   nooit snelheid afdwingen, dus ongemeten telt als DUUR.

   DE PRIJS IS TWEE KEER VERLAAGD, EN ALLEBEI DE KEREN OM DEZELFDE REDEN: hij
   werd bepaald door een bestand dat niets met de vrager te maken had.

   1. HET MAXIMUM (weg op 1 september 2026). Elk ongemeten bestand kreeg 1272s
      toebedeeld, want ast-grens.test.js is in zijn eentje 14% van al het werk.
      Dat is geen maat maar een uitschieter -- 27 keer de p99.

   2. DE p99 OVER ALLES (weg op 2 september 2026). Beter, en nog steeds de
      verkeerde verzameling: een ongemeten SCHERMTOETS werd geprijsd op een
      p99 waar in de modus `dekking` geen enkele schermtoets in zit. Gemeten op
      het register van die dag:

        modus dekking    unit n=1268  p50 5,3s  p95 15,4s  p99 45,6s
        modus dekking    e2e  n=0     -- er is geen enkele meting
        modus onbekend   unit n=1257  p50 7,0s  p95 15,2s  p99 50,6s
        modus onbekend   e2e  n=179   p50 6,5s  p95 32,3s  p99 97,1s

      Een schermtoets heeft een andere staart dan een unit-toets: zijn p95 is
      twee keer zo hoog en zijn p99 bijna twee keer. Een ongemeten schermtoets
      kreeg 60,5s (de p99 over alles) waar zijn eigen klasse 97,1s zegt -- hij
      werd dus TE GOEDKOOP ingeboekt, en dat is de verkeerde kant om te gokken.

   DUS: de p99 VAN DE EIGEN KLASSE. Twee klassen, want dat zijn er twee in dit
   huis: `.e2e.js` draait een echte browser, `.test.js` niet. Dat is geen
   indeling die hier wordt verzonnen -- de keten heeft er twee aparte lopers
   voor (scripts/e2e.js en scripts/test-runner.js) met elk hun eigen modus.

   WAAROM MINSTENS HONDERD METINGEN. Onder de honderd IS de p99 het maximum, en
   dan zijn we terug bij fout 1 -- alleen binnen een kleinere verzameling, wat
   hem erger maakt en niet beter. Reken het na: de index is
   ceil(n * 0,99) - 1, dus bij n = 50 is dat 49 (het hoogste), bij n = 100 is
   dat 98 (er ligt er een boven), bij n = 200 ligt er twee boven. Een klasse
   met te weinig metingen krijgt daarom de p99 over ALLES, en dat staat in de
   uitslag als `algemeen` -- geen stille terugval.

   WAT DEZE PRIJS NIET OPLOST, en dat hoort er even groot bij te staan.

   De aanleiding was dat elf nieuwe toetsbestanden bestaande toetsen tussen
   scherven verplaatsten en daarmee een bestaande gevoeligheid blootlegden
   (test/kycspoor.test.js telt een journaal na 400ms, test/grammatica.e2e.js
   meet binnen een venster van 1400ms). De verleiding is dan om de prijs te
   verlagen tot die verplaatsing weggaat. Dat werkt niet, en dat is GEMETEN op
   het echte register van 1268 bestanden -- een bestand toevoegen en alleen
   zijn gewicht varieren:

     100ms, gewoon gemeten     294 van 1268 verplaatst  (23%)
     p50   (5,3s)              472                      (37%)
     p95   (15,4s)             933                      (74%)
     p99   (45,6s)             923                      (73%)
     maximum (1272s)           956                      (75%)

   Twee dingen staan daarin. Er is een BODEM van 23%: ook een perfect gemeten
   bestand van 100ms verplaatst een kwart van de suite. En boven de p50 is de
   curve VLAK -- p95 verplaatst niet minder dan p99. De prijs verlagen koopt dus
   geen stabiliteit; het maakt alleen de schatting slechter.

   DIE BODEM HOORT BIJ DE METINGEN EN NIET BIJ HET ALGORITME, en dat is apart
   nagemeten omdat de eerste verklaring ("de greedy leidt elke plaatsing opnieuw
   af") te makkelijk was. Op een REGELMATIGE kaart van 400 bestanden, waar de
   gewichten exact samenvallen, verplaatst datzelfde gemeten bestand er NUL en
   een ongemeten er 295. De bodem komt dus van bijna-gelijke echte duren:
   daardoor slaat "de minst belaste bak" telkens om. Wie hem weg wil hebben,
   heeft niets aan een andere prijs en niets aan gelijkmatiger metingen -- alleen
   aan een verdeling die bestaande bestanden op hun scherf laat staan.

   De echte oplossingen liggen elders en staan hier opgeschreven zodat niemand
   ze voor gedaan aanziet: een verdeling die bestaande bestanden op hun scherf
   LAAT staan en alleen nieuwe plaatst (dan is de prijs alleen nog een
   looptijdvraag), of toetsen die niet meer van hun buren afhangen. Dat tweede
   is het echte gebrek: een verplaatsing is alleen schadelijk omdat sommige
   toetsen binnen een venster van milliseconden meten.
   ========================================================================== */
'use strict';

/* De twee klassen, en alles wat geen van beide is heet `overig`. Bewust geen
   uitgebreidere indeling: elke klasse moet zijn eigen honderd metingen kunnen
   halen, anders is hij een lege huls die toch op `algemeen` uitkomt. */
const KLASSE_MINIMUM = 100;

function klasseVan(naam) {
  const n = String(naam || '');
  if (n.endsWith('.e2e.js')) return 'e2e';
  if (n.endsWith('.test.js')) return 'unit';
  return 'overig';
}

/* De p99: hoger dan 99 van de 100, negen keer de mediaan. `rij` moet oplopend
   gesorteerd zijn. */
function p99(rij) {
  if (!rij.length) return 0;
  return rij[Math.min(rij.length - 1, Math.ceil(rij.length * 0.99) - 1)];
}

/* De rijen per klasse uit een gewichtenkaart, oplopend gesorteerd. */
function rijenVan(gewicht) {
  const perKlasse = new Map();
  const alles = [];
  for (const [naam, ms] of gewicht || []) {
    if (!(ms > 0)) continue;
    alles.push(ms);
    const k = klasseVan(naam);
    if (!perKlasse.has(k)) perKlasse.set(k, []);
    perKlasse.get(k).push(ms);
  }
  alles.sort((a, b) => a - b);
  for (const rij of perKlasse.values()) rij.sort((a, b) => a - b);
  return { perKlasse, alles };
}

/* DE TERUGVALLADDER, en de enige regel die er bovenuit steekt: een sport lager
   mag de prijs nooit VERLAGEN. Bewijs dat ontbreekt is geen reden om goedkoper
   te worden -- dat is de hoofdregel van KEURING.md, en zonder die klem is een
   ladder alleen maar een langere weg naar een lager getal.

     1. eigen-klasse         p99 van deze modus en deze klasse
     2. klasse-andere-modus  p99 van deze klasse in een ANDERE modus, en dan
                             hooguit als hij HOGER uitkomt dan sport 3. Een
                             andere modus is een ander kostenmodel (daar gaat
                             `vertrouwen` in ./delen.js over), dus hij mag wel
                             waarschuwen en niet geruststellen.
     3. algemeen             p99 over alle klassen van deze modus

   Sport 2 bestaat voor een geval dat hier echt voorkomt: in de modus `dekking`
   staan 1268 unit-metingen en NUL schermtoetsen. Zonder die sport wordt een
   ongemeten schermtoets daar geprijsd op 45,6s (de unit-p99) terwijl de
   schermtoetsen in de modus ernaast 97,1s zeggen. Met de klem kan diezelfde
   sport een unit-toets niet goedkoper maken dan zijn eigen modus al zei. */
function prijzen(gewicht, opties) {
  const andere = (opties && opties.andere) || [];
  const { perKlasse, alles } = rijenVan(gewicht);

  /* Zonder ook maar een meting is elk bestand even zwaar; dan valt de greedy
     samen met de oude om-en-om-verdeling en doet de waarde zelf er niet toe. */
  const algemeen = alles.length ? p99(alles) : 1;

  /* Wat de andere modi over ELKE klasse te zeggen hebben; de hoogste telt, want
     sport 2 mag alleen omhoog werken. */
  const elders = new Map();
  for (const a of andere) {
    for (const [k, rij] of rijenVan(a && a.kaart).perKlasse) {
      if (rij.length < KLASSE_MINIMUM) continue;
      const ms = p99(rij);
      const nu = elders.get(k);
      if (!nu || ms > nu.ms) elders.set(k, { ms, modus: a.modus, metingen: rij.length });
    }
  }

  const prijs = new Map();
  const grond = new Map();
  const klassen = new Set([...perKlasse.keys(), ...elders.keys()]);
  for (const k of klassen) {
    const rij = perKlasse.get(k) || [];
    if (rij.length >= KLASSE_MINIMUM) {
      prijs.set(k, p99(rij));
      grond.set(k, { sport: 1, grond: 'eigen-klasse', metingen: rij.length });
      continue;
    }
    const ver = elders.get(k);
    if (ver && ver.ms > algemeen) {
      prijs.set(k, ver.ms);
      grond.set(k, { sport: 2, grond: 'klasse-andere-modus', modus: ver.modus,
        metingen: ver.metingen, eigenMetingen: rij.length,
        waarom: 'deze klasse heeft in deze modus minder dan ' + KLASSE_MINIMUM +
          ' metingen; een andere modus zegt hoger, en hoger mag' });
      continue;
    }
    grond.set(k, { sport: 3, grond: 'algemeen', metingen: rij.length,
      waarom: rij.length >= KLASSE_MINIMUM ? 'algemeen'
        : 'minder dan ' + KLASSE_MINIMUM + ' metingen; dan is de p99 het maximum' +
          (ver ? ', en een andere modus zegt niet hoger' : '') });
  }

  const prijsVoor = (naam) => {
    const k = klasseVan(naam);
    return prijs.has(k) ? prijs.get(k) : algemeen;
  };
  /* Welke sport een NAAM betaalt, voor een meter die het per bestand wil tonen. */
  const bronVoor = (naam) => {
    const k = klasseVan(naam);
    return grond.get(k) || { sport: 3, grond: 'algemeen', metingen: 0,
      waarom: 'deze klasse komt in geen enkele modus voor' };
  };

  return { prijsVoor, bronVoor, algemeen, prijs, grond, klasseVan };
}

module.exports = { prijzen, klasseVan, p99, KLASSE_MINIMUM };
