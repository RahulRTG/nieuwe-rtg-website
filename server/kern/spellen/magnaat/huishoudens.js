/* Magnaat: LAAG 3 -- loon dat terugkomt.

   ECONOMIE.md noemt dit met zoveel woorden *de scherpste openstaande fout*:

     **Het salaris dat een fastfoodketen betaalt verdwijnt niet: het wordt huur,
     boodschappen, OV, een voetbalkaartje, spaargeld. Een loonstijging is
     tegelijk hogere kosten voor werkgevers EN meer koopkracht voor huishoudens.
     Zolang loon alleen een kostenpost is, is er geen kringloop.**

   En zo stond het er. ./stap.js regel `lonen = v.personeel * s.loon`: geld dat
   de wereld verliet zonder ooit ergens aan te komen. Precies dezelfde vorm als
   de inkooppost van voor ./keten.js -- een lek met een nette naam.

   ================== HET IS EEN LEK DAT TERUGKEERT, GEEN BRON ==================

   DIT IS DE BELANGRIJKSTE ONTWERPKEUZE VAN DIT BESTAND, en hij sluit meteen de
   enige echte uitbuiting uit. Wat hier terugkomt is uitsluitend het loon van het
   PERSONEEL -- geld dat de wereld werkelijk verliet. Een dienstverband tussen
   twee SPELERS (./dienst.js) telt niet mee, hoe hoog het loon ook is: dat geld
   ging van de ene kas naar de andere en is de wereld nooit uit geweest.

   Alleen wat weglekte kan terugkeren. Zonder die regel zouden drie spelers
   elkaar in een kring in dienst kunnen nemen -- netto nul tussen hen -- en
   samen de vraag van de hele stad opstoken. scripts/magnaat-pomp.js heeft daar
   een scenario voor (`loondienst`, verwacht neutraal), en dat scenario hoort
   neutraal te BLIJVEN.

   ================== EN ER KOMT GEEN EURO BIJ ==================

   Loon dat terugkomt landt NIET op iemands kas. Het landt op de VRAAG: de stad
   heeft meer of minder te besteden, en dat is wat er in de winkel gebeurt.
   Geen enkele post verandert, geen bedrag wordt ergens bijgeschreven -- de
   geldpomp blijft dus precies zo dicht als hij was.

   ================== DE STAD IS GROTER DAN DE SPELERS ==================

   De noemer is de loonsom van de stad ZELF (`kaart.stadsomzet`, het getal
   waaruit de Foundation al put). Dat is geen demping maar een feit: IJmuiden
   had een economie voordat er iemand een restaurant opende. Twee gevolgen, en
   ze zijn allebei gewenst:

     - IN ZIJN EENTJE KAN NIEMAND DE STAD RIJK MAKEN. Wie personeel aanneemt om
       de vraag op te stoken, betaalt honderd procent van dat loon en verschuift
       een enkele procent van een stadsloonsom die grotendeels van hem los
       staat -- en de vraag die hij koopt, komt ook bij zijn concurrenten
       terecht. Er is geen rekensom waarin dat uit kan.
     - MAAR SAMEN WEL. Sluiten er tien zaken, dan zakt de loonsom van de stad
       zichtbaar, en dat raakt iedereen die van lokale klanten leeft. Zo reist
       een faillissement (ECONOMIE.md laag 28) zonder dat er iets gescript is.

   ================== DEZELFDE SCHOK RAAKT NIET IEDEREEN GELIJK ==================

   Dat is een van de grenzen uit ECONOMIE.md, en hier volgt hij UIT DE STRUCTUUR
   en niet uit een tabel met uitzonderingen: een strandhotel leeft van toeristen
   die hun geld elders verdienden, een buurtwinkel van mensen die hier werken.
   Dezelfde daling van de loonsom doet bij die twee iets heel anders, en het
   verschil komt uit ./vraag.js `segmenten` -- de bestaande som, niet een nieuwe.

   ================== WAT ER NOG NIET IS ==================

   De wig tussen loonkost en koopkracht, de buffer en de traagheid staan in
   ./huishoudboekje.js. Wat er daarna nog ontbreekt staat in HUISHOUDEN.md par.
   3, en de twee die er het meest toe doen zijn VERPLICHTINGEN ALS GELDSTROOM
   (huur hoort bij een verhuurder aan te komen) en BEHOEFTECATEGORIEEN (een
   neergang hoort de horeca eerder te raken dan de bakker). */
'use strict';

const { SECTOREN, SECTORLIJST } = require('./sectoren');
const { segmenten } = require('./vraag');
const BOEKJE = require('./huishoudboekje');

/* WELK DEEL VAN EEN SEGMENT ZIJN GELD IN DEZE STAD VERDIENT. Geen gevoeligheid
   op een schaal van tien maar een feit over waar inkomen vandaan komt:

     gezinnen, nachtpubliek   loon uit de stad -- dit IS de kringloop
     studenten                deels bijbaan, deels studiefinanciering en thuis
     ouderen                  pensioen, en dat komt niet uit de lokale loonsom
     toeristen                inkomen van elders, net zo buitenwerelds als import
     zakelijk                 betaald door een bedrijf dat ergens anders staat

   EN DAT HEEFT EEN GEVOLG DAT NIEMAND HEEFT INGETIKT: een stad met veel ouderen
   en veel toeristen staat steviger in een neergang dan een stad die van haar
   eigen loonsom leeft. Dat hoort zo, en het staat nergens als regel. */
const LOONGEVOELIG = { gezinnen: 1, nachtpubliek: 1, studenten: 0.5,
  ouderen: 0, toeristen: 0, zakelijk: 0 };

/* HET LOONAANDEEL VAN OMZET, en het is GEEN aangenomen getal maar een uitkomst
   van ./sectoren.js: loon per eenheid gedeeld door omzet per eenheid, gemiddeld
   over de sectoren. De omvang valt daarbij weg, dus er is geen referentiezaak
   nodig die iemand moet geloven.

   HIJ RUST OP TWEE AANNAMES en die staan hier hardop: volle bezetting en de
   middelste prijsstand. Werkelijke omzet ligt lager, dus de echte loonquote
   ligt HOGER -- deze schatting maakt de stadsloonsom dus eerder te klein dan te
   groot, en daarmee het gewicht van de spelers eerder te groot. Wie hem scherper
   wil, meet hem; hij is met opzet afleidbaar en niet ingetikt. */
const LOONQUOTE = SECTORLIJST.reduce((n, x) => {
  const s = SECTOREN[x];
  return n + (s.loon / s.perMedewerker) / (s.perMaand * s.prijs[1]);
}, 0) / SECTORLIJST.length;

/* De loonsom van de stad zelf: alle bedrijvigheid die geen speler in handen
   heeft. Zie de kop -- dit is de noemer, en de reden dat niemand in zijn eentje
   de vraag kan opstoken. */
const stadsLoon = (kaart) => (kaart.stadsomzet || 0) * LOONQUOTE;

/* WAT DE SPELERS DEZE MAAND AAN PERSONEEL BETALEN. Alleen het personeel; zie de
   kop voor waarom een dienstverband tussen spelers er niet in staat. */
function loonsom(st) {
  let som = 0;
  for (const rij of Object.values(st.vestigingen || {}))
    for (const v of rij) som += (v.personeel || 0) * ((SECTOREN[v.sector] || {}).loon || 0);
  return som;
}

/* DE BESTEDINGSKRACHT VAN DE STAD. 1.0 is een stad zonder spelers -- en dat is
   precies de eis: zonder deze laag rekent de wereld zoals in fase A, en met een
   lege stad doet hij dat nog steeds.

   Boven de 1 komt hij doordat er WERK is bijgekomen dat er niet was; eronder
   zakt hij als dat werk verdwijnt. Er is geen bovengrens en geen bodem behalve
   nul, want allebei zouden een getal zijn dat niets betekent.

   HIJ REKENT IN CONSUMPTIE EN NIET IN LOONSOM (./huishoudboekje.js). In de
   evenwichtsstand maakt dat geen enkel verschil -- de stad ondergaat dezelfde
   wig als de spelers, dus die valt weg -- en dat is precies de bedoeling: de
   ijking van fase A blijft staan. Wat het WEL verandert is dat de teller een
   BUFFER heeft. Zakt de loonsom, dan zakt de consumptie niet mee tot op de
   bodem maar kruipt hij, en pas als het spaargeld op is komt de hele klap.

   `st.huishoudens` bestaat nog niet voordat er een maand gerekend is; dan is de
   evenwichtsstand het antwoord, en dat is dezelfde uitkomst als voorheen. */
function bestedingskracht(st, kaart) {
  const basis = BOEKJE.doelVan(stadsLoon(kaart));
  if (!(basis > 0)) return 1;
  const eigen = st.huishoudens ? st.huishoudens.consumptie : BOEKJE.doelVan(loonsom(st));
  return (basis + eigen) / basis;
}

/* DE MAAND VAN DE HUISHOUDENS. Staat hier en niet in ../maand.js omdat de
   loonsom hier vandaan komt; wie hem daar zou uitrekenen, rekent hem twee keer. */
const bijwerken = (st, kaart) => BOEKJE.maand(st, loonsom(st)) && bestedingskracht(st, kaart);

/* WELK DEEL VAN DE VRAAG OP DEZE PLEK VAN LOKAAL VERDIEND GELD LEEFT. Uit de
   segmentsom die ./vraag.js toch al maakt, zodat er geen tweede telling van
   dezelfde klanten ontstaat. */
function loongevoelig(kaart, kavel, sector, maand) {
  const per = segmenten(kaart, kavel, sector, maand);
  let tot = 0, lokaal = 0;
  for (const [segment, n] of Object.entries(per)) {
    tot += n;
    lokaal += n * (LOONGEVOELIG[segment] || 0);
  }
  return tot > 0 ? lokaal / tot : 0;
}

/* DE FACTOR VOOR EEN VESTIGING. Staat de bestedingskracht op 1, dan is hij
   overal exact 1 en verandert er niets -- ook niet met afrondingsruis, want dan
   is dit letterlijk `1 + iets * 0`. */
function factorVoor(kaart, kavel, sector, maand, besteding) {
  const b = besteding === undefined ? 1 : besteding;
  if (b === 1) return 1;
  return Math.max(0, 1 + loongevoelig(kaart, kavel, sector, maand) * (b - 1));
}

module.exports = { LOONGEVOELIG, LOONQUOTE, stadsLoon, loonsom,
  bestedingskracht, bijwerken, loongevoelig, factorVoor };
