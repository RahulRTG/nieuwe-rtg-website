/* Magnaat: HET HUISHOUDBOEKJE -- van loonkosten naar consumptie.

   HUISHOUDEN.md, onderdeel 1 tot en met 3. ./huishoudens.js liet loon terugkomen
   als bestedingskracht, en dat was een echte kringloop -- maar het was er een
   waarin een werkgever die 3.000 aan loonkosten betaalt een huishouden oplevert
   dat 3.000 kan uitgeven. Dat klopt niet, en het verschil is geen detail: het is
   het halve verhaal van elke loondiscussie die ooit gevoerd is.

   ================== ELKE AFTREKPOST HEEFT EEN BESTEMMING ==================

   Dat is de wet uit HUISHOUDEN.md par. 2, en hij is hier voor het eerst
   toegepast: geen enkele post gaat er zomaar af. Wat de wereld verlaat, verlaat
   hem NAAR IETS, en dat staat erbij (`BESTEMMING`). Vandaag zijn dat nog
   allemaal partijen buiten de wereld -- er is geen overheid en geen verhuurder
   -- en juist daarom moet het opgeschreven staan. Een lek dat een naam heeft, is
   een lek dat je kunt dichten; `keten.js` en ./huishoudens.js kwamen allebei uit
   een post die er wel was en nergens heen ging.

   ================== EN DE WIG VERANDERT DE STAND NIET ==================

   Dit is belangrijk genoeg om expliciet te maken, want het ziet eruit als een
   ingreep en het is er geen: de stad ondergaat DEZELFDE wig als de spelers, dus
   in de evenwichtsstand valt hij tegen elkaar weg en is de bestedingskracht
   precies wat hij was. Alles wat in fase A geijkt is, blijft geijkt.

   Wat hij WEL verandert is wat er te meten valt -- waar de loonmassa van een
   stad heen gaat, met zoveel woorden -- en dat is de opstap naar het onderdeel
   dat er het meest toe doet: huur die bij een verhuurder aankomt.

   ================== WAT ER WEL BEWEEGT: DE BUFFER ==================

   Een huishouden dat deze maand minder verdient, eet deze maand nog hetzelfde.
   Er zit spaargeld tussen, en dat is geen verfijning maar het verschil tussen
   een formule en een actor. Gevolg, en het is er een die niemand heeft
   ingetikt: **schade is niet meteen maximaal, en hij wordt erger naarmate hij
   langer duurt.** Zo ontstaat het verloop uit HUISHOUDEN.md par. 6 vanzelf --
   maand 1 valt mee, maand 6 niet -- zonder dat er ergens `recessie` staat. En
   herstelt het inkomen, dan herstelt de consumptie ook weer: niet omdat er een
   vlag omgaat, maar omdat er weer geld binnenkomt.

   EN NU HET DEEL DAT EERLIJK MOET STAAN, want hier stond eerst een grotere
   belofte dan de code waarmaakt. De buffer LOOPT LEEG maar RAAKT NIET OP: in
   een instorting van 200.000 naar 20.000 loonsom zakt het spaargeld van 158k
   naar 69k en stabiliseert daar. Dat komt doordat er nu EEN gemiddeld huishouden
   per stad is, en een gemiddelde buffer haalt het altijd. In het echt is dat
   precies andersom -- het zijn de dunne buffers die als eerste de bodem raken,
   en dat is waar veerkrachtverschillen vandaan komen. Zolang HUISHOUDEN.md 3.4
   (huishoudtypen) en 3.12 (vermogensverschillen) er niet zijn, IS die bodem er
   niet en hoort niemand te denken van wel.

   De begrenzing hieronder blijft dus staan als BEHOUDSREGEL en niet als
   mechaniek: je kunt niet meer uitgeven dan er binnenkomt plus wat er ligt.
   Zonder hem zou spaargeld negatief worden -- een huishouden dat geld uitgeeft
   dat niet bestaat -- en dat is precies wat HUISHOUDEN.md par. 2 verbiedt.

   ================== WAT ER NOG NIET IS ==================

   Alles wat in HUISHOUDEN.md par. 3 op een kruisje staat, en de twee die er het
   meest toe doen zijn: VERPLICHTINGEN ALS GELDSTROOM (huur gaat hier nog naar
   buiten in plaats van naar een verhuurder) en BEHOEFTECATEGORIEEN (consumptie
   is hier een bedrag, geen mand -- dus een neergang raakt de horeca nog even
   hard als de bakker). */
'use strict';

/* WAT ER TUSSEN LOONKOST EN KOOPKRACHT ZIT, en waar het heen gaat. Spelgetallen
   van de juiste orde van grootte voor Nederland, GEEN meting -- ze staan hier
   als getallen die je kunt verstellen en niet als een formule die doet alsof ze
   iets weet. Dat is dezelfde afspraak als bij `stadsomzet` in de kaart.

   De aandelen zijn met opzet uitgedrukt op de post waar ze in het echt op
   drukken: premies op de loonkost, heffing en pensioen op het bruto, vaste
   lasten op het netto. Wie er een verstelt, verstelt precies een ding. */
const WIG = [
  { post: 'werkgeverspremies', deel: 0.20, van: 'loonkosten', naar: 'overheid' },
  { post: 'loonheffing', deel: 0.30, van: 'bruto', naar: 'overheid' },
  { post: 'pensioen', deel: 0.05, van: 'bruto', naar: 'pensioenfonds' },
  /* WONEN, ENERGIE, VERZEKERING EN VERVOER IN EEN POST, en dat is nu juist het
     onderdeel dat eruit moet. Zodra huur bij een verhuurder aankomt en energie
     bij een energiebedrijf, verdubbelt het aantal kringlopen in een keer.
     Zolang dat er niet is, is dit de grootste stroom die de wereld verlaat --
     en dan hoort hij als grootste zichtbaar te zijn, niet weggemoffeld. */
  { post: 'vaste lasten', deel: 0.45, van: 'netto', naar: 'buiten de wereld' }
];

/* WAT ER VAN HET VRIJ BESTEEDBARE NIET WORDT UITGEGEVEN. Niet omdat huishoudens
   zuinig zijn maar omdat er altijd iets opzij gaat; hij is hier vast en hoort
   later af te hangen van buffer, schuld en onzekerheid (HUISHOUDEN.md 3.7). */
const SPAARQUOTE = 0.08;

/* HOE SNEL CONSUMPTIE MEEBEWEEGT met wat er binnenkomt. Een derde per maand:
   een huishouden past zijn leven aan, maar niet in een week. Dit is de traagheid
   uit HUISHOUDEN.md 3.2, en zonder hem is een ontslag meteen maximaal. */
const AANPASSING = 1 / 3;

/* HOEVEEL MAANDEN CONSUMPTIE ER IN DE BUFFER ZIT als de wereld begint. Drie
   maanden is de orde van grootte waarop het in het echt scheef gaat: daar
   beginnen uitgestelde aankopen en verhuizingen. */
const BUFFERMAANDEN = 3;

/* VAN LOONKOSTEN NAAR VRIJ BESTEEDBAAR, met de posten erbij. Geeft ELKE stap
   terug en niet alleen de uitkomst, want de tussenstappen zijn precies wat een
   meter en straks een scherm moeten kunnen laten zien. */
function boekje(loonkosten) {
  const stroom = [];
  const stand = { loonkosten, bruto: 0, netto: 0, besteedbaar: 0 };
  let rest = loonkosten;
  for (const w of WIG) {
    const bedrag = (w.van === 'loonkosten' ? loonkosten : stand[w.van]) * w.deel;
    rest -= bedrag;
    stroom.push({ post: w.post, bedrag, naar: w.naar });
    if (w.post === 'werkgeverspremies') stand.bruto = rest;
    if (w.post === 'pensioen') stand.netto = rest;
  }
  stand.besteedbaar = rest;
  return { stand, stroom };
}

/* HET DEEL VAN EEN LOONSOM DAT UIT EIGEN BEWEGING DE MARKT OP GAAT. De
   evenwichtsstand: waar de consumptie naartoe kruipt als er niets verandert. */
const doelVan = (loonkosten) => boekje(loonkosten).stand.besteedbaar * (1 - SPAARQUOTE);

/* EEN MAAND VOOR DE HUISHOUDENS VAN EEN STAD. Verandert de toestand in plaats,
   want dit is een actor met een balans en geen som -- dat is het hele verschil
   met wat er stond.

   IDEMPOTENT PER MAAND EN VERDER NIET: hij hoort exact een keer per spelmaand
   te draaien, net als ./cyclus.js. De wereld rekent bij, dus tien maanden in een
   keer moeten hetzelfde opleveren als tien maanden los -- daarom staat er geen
   klok in deze functie en telt hij niets zelf. */
function maand(st, loonkosten) {
  const doel = doelVan(loonkosten);
  if (!st.huishoudens) {
    /* EEN VERSE WERELD BEGINT IN EVENWICHT. Zou hij op nul beginnen en
       toegroeien, dan zou de eerste maand van elke campagne een neergang zijn
       die niemand veroorzaakt heeft. */
    st.huishoudens = { consumptie: doel, spaargeld: doel * BUFFERMAANDEN };
    return st.huishoudens;
  }
  const h = st.huishoudens;
  const besteedbaar = boekje(loonkosten).stand.besteedbaar;
  /* WAAR DE CONSUMPTIE HEEN KRUIPT, en hoe ver hij deze maand komt. */
  const wens = h.consumptie + (doel - h.consumptie) * AANPASSING;
  /* MAAR JE KUNT NIET MEER UITGEVEN DAN ER BINNENKOMT PLUS WAT ER LIGT. Zie de
     kop: dit is een BEHOUDSREGEL en geen mechaniek. Geen enkele campagne raakt
     hem vandaag -- daarvoor zijn huishoudtypen nodig -- maar zonder hem kan
     `spaargeld` negatief worden, en dat is een huishouden dat geld uitgeeft dat
     niet bestaat. De toets die hem dekt voert hem daarom rechtstreeks, met een
     buffer die te dun is om te bestaan in een echte stad. */
  h.consumptie = Math.max(0, Math.min(wens, besteedbaar + h.spaargeld));
  /* ZONDER `Math.max` EROMHEEN, en dat is geen slordigheid. De begrenzing
     hierboven zegt `consumptie <= besteedbaar + spaargeld`, en daaruit volgt dat
     dit nooit onder nul komt. Er stond een tweede wachter op dezelfde regel; een
     mutatie liet zien dat hij onbereikbaar was, en een wachter die niet kan
     afgaan verbergt alleen maar of de eerste nog werkt. */
  h.spaargeld = h.spaargeld + besteedbaar - h.consumptie;
  return h;
}

module.exports = { WIG, SPAARQUOTE, AANPASSING, BUFFERMAANDEN,
  boekje, doelVan, maand };
