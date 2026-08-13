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

   ================== WAT ER MET DIT BOEKJE GEBEURT ==================

   Dit bestand rekent de WIG en verder niets: van loonkosten naar vrij
   besteedbaar. Wie dat boekje voert -- en met hoeveel verschillende huishoudens
   -- staat in ./huishoudtypen.js. Die splitsing is er omdat de wig voor iedereen
   hetzelfde is (belasting is belasting) terwijl de balans dat juist niet is.

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
const VAST_DEEL = 0.45;
const WIG = [
  { post: 'werkgeverspremies', deel: 0.20, van: 'loonkosten', naar: 'overheid' },
  { post: 'loonheffing', deel: 0.30, van: 'bruto', naar: 'overheid' },
  { post: 'pensioen', deel: 0.05, van: 'bruto', naar: 'pensioenfonds' },
  /* WONEN, ENERGIE, VERZEKERING EN VERVOER IN EEN POST, en dat is nu juist het
     onderdeel dat eruit moet. Zodra huur bij een verhuurder aankomt en energie
     bij een energiebedrijf, verdubbelt het aantal kringlopen in een keer.
     Zolang dat er niet is, is dit de grootste stroom die de wereld verlaat --
     en dan hoort hij als grootste zichtbaar te zijn, niet weggemoffeld. */
  { post: 'vaste lasten', deel: VAST_DEEL, van: 'netto', naar: 'buiten de wereld' }
];

/* WAT ER VAN HET VRIJ BESTEEDBARE NIET WORDT UITGEGEVEN. Niet omdat huishoudens
   zuinig zijn maar omdat er altijd iets opzij gaat; hij is hier vast en hoort
   later af te hangen van buffer, schuld en onzekerheid (HUISHOUDEN.md 3.7). */
const SPAARQUOTE = 0.08;

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

module.exports = { WIG, VAST_DEEL, SPAARQUOTE, boekje, doelVan };
