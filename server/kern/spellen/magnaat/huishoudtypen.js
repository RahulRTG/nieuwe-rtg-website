/* Magnaat: HUISHOUDENS ZIJN NIET GEMIDDELD.

   HUISHOUDEN.md 3.4 en 3.12, en het is de belangrijkste stap die er lag. In
   ./huishoudboekje.js stond EEN gemiddeld huishouden per stad, en dat verbergt
   precies waar het bij een schok om gaat: wie wordt als eerste geraakt, wie kan
   bufferen, wie verandert zijn gedrag en wie niet.

   Het stond ook zo in de kop van dat bestand, als bekende tekortkoming: de
   buffer liep wel leeg maar RAAKTE NOOIT OP, want een gemiddelde buffer haalt
   het altijd. In het echt is dat andersom -- de dunne buffers raken als eerste
   de bodem, en dat IS waar veerkrachtverschillen vandaan komen. Vanaf hier
   bestaat die bodem.

   ================== HET ZIJN BALANSPROFIELEN, GEEN STEREOTYPEN ==================

   Een cohort is geen persoon en geen personage (HUISHOUDEN.md par. 2: een
   huishouden is een cohort). Wat een type onderscheidt zijn drie balansfeiten en
   verder niets: hoeveel er binnenkomt, hoe vast het eruit gaat, en hoeveel er
   ligt. Geen levensfase-bonus, geen gedragstype, geen score.

   ================== EN HET GEMIDDELDE BLIJFT PRECIES GELIJK ==================

   Dit is de eis waaronder deze laag mocht bestaan, en hij wordt hier AFGEDWONGEN
   en niet gehoopt: de gewichten en de lastenverdeling worden bij het laden
   genormaliseerd, zodat de optelsom van de cohorten in de evenwichtsstand tot op
   de bit hetzelfde is als het ene gemiddelde huishouden van hiervoor. Alles wat
   in fase A geijkt is, blijft geijkt. Wat verandert is uitsluitend wat er
   gebeurt als de wereld UIT evenwicht raakt.

   ================== VASTE LASTEN ZIJN STIJVER DAN BOODSCHAPPEN ==================

   HUISHOUDEN.md 3.2 hoorde hier meteen bij, want zonder dat betekent het eerste
   niets. Zakt het inkomen, dan zakt de huur niet mee: een contract loopt door.
   Vaste lasten kruipen daarom veel langzamer (`VAST_TRAAG`, ongeveer een jaar --
   dat is wat een huurcontract is) dan de consumptie (een derde per maand).

   DAAR KOMT DE HEFBOOM VANDAAN. Een inkomensdaling van een vijfde drukt de VRIJE
   besteding met veel meer dan een vijfde samen, want de huur gaat er eerst af.
   En dus krijgt de horeca eerder een klap dan de verhuurder -- niet omdat dat
   ergens staat, maar omdat de volgorde van betalen dat afdwingt. */
'use strict';

const { boekje, SPAARQUOTE, VAST_DEEL } = require('./huishoudboekje');

/* DE COHORTEN. `deel` is het aandeel huishoudens, `inkomen` hun inkomen ten
   opzichte van het gemiddelde, `lasten` hoe zwaar hun vaste lasten wegen, en
   `buffer` hoeveel maanden consumptie er ligt.

   Spelgetallen van de juiste orde van grootte, GEEN meting -- ze staan er zodat
   je ze kunt verstellen. De twee die er het meest toe doen zijn de buffers: een
   half maandje tegen negen maanden is het verschil tussen een huishouden dat na
   twee maanden stopt met uit eten gaan en een huishouden dat er niets van
   merkt. */
const TYPEN = [
  { id: 'krap', naam: 'laag inkomen, dunne buffer', deel: 0.22, inkomen: 0.60, lasten: 1.30, buffer: 0.7 },
  { id: 'huurder', naam: 'midden, huurder', deel: 0.30, inkomen: 0.95, lasten: 1.08, buffer: 2.0 },
  { id: 'eigenaar', naam: 'midden, eigen woning', deel: 0.24, inkomen: 1.20, lasten: 0.92, buffer: 4.5 },
  { id: 'schuld', naam: 'hoge schuld', deel: 0.10, inkomen: 1.00, lasten: 1.22, buffer: 0.4 },
  { id: 'ruim', naam: 'hoog inkomen, dikke buffer', deel: 0.09, inkomen: 2.20, lasten: 0.62, buffer: 9.0 },
  { id: 'jong', naam: 'jong, lage vaste lasten', deel: 0.05, inkomen: 0.55, lasten: 0.66, buffer: 1.2 }
];

/* HOE SNEL CONSUMPTIE MEEBEWEEGT met wat er binnenkomt: een derde per maand.
   Een huishouden past zijn leven aan, maar niet in een week. */
const AANPASSING = 1 / 3;
/* EN HOE SNEL VASTE LASTEN DAT DOEN: veel langzamer, want dat is wat een
   contract is. Een twaalfde per maand -- ongeveer een huurjaar. */
const VAST_TRAAG = 1 / 12;

/* HET AANDEEL VAN DE LOONSOM per cohort, genormaliseerd zodat de som exact 1 is.
   Zo wordt er geen euro loon verzonnen of kwijtgeraakt bij het verdelen. */
const somGewicht = TYPEN.reduce((n, t) => n + t.deel * t.inkomen, 0);
const GEWICHT = Object.fromEntries(TYPEN.map(t => [t.id, t.deel * t.inkomen / somGewicht]));

/* EN DE LASTENVERDELING, genormaliseerd op datzelfde loonaandeel. Hierdoor is de
   totale vaste-lastenpost van alle cohorten samen precies de post die
   ./huishoudboekje.js voor het gemiddelde huishouden rekende -- niet ongeveer,
   maar exact. Dat is de reden dat deze laag geen enkele ijking verschuift. */
const somLast = TYPEN.reduce((n, t) => n + GEWICHT[t.id] * t.lasten, 0);
const LASTEN = Object.fromEntries(TYPEN.map(t => [t.id, VAST_DEEL * t.lasten / somLast]));

/* De evenwichtsstand van een cohort bij een gegeven loonsom van de stad. */
function evenwicht(t, loonkosten) {
  const netto = boekje(loonkosten * GEWICHT[t.id]).stand.netto;
  const vast = netto * LASTEN[t.id];
  const besteedbaar = Math.max(0, netto - vast);
  return { netto, vast, besteedbaar, consumptie: besteedbaar * (1 - SPAARQUOTE) };
}

/* EEN MAAND VOOR ALLE HUISHOUDENS VAN EEN STAD. Verandert de toestand in plaats
   en houdt naast de cohorten de OPTELSOM bij, want dat is wat de vraag voedt --
   ./huishoudens.js hoeft van deze hele opsplitsing niets te weten.

   Idempotent per maand en verder niet: hij hoort exact een keer per spelmaand te
   draaien, net als ./cyclus.js. */
function maand(st, loonkosten) {
  if (!st.huishoudens || !st.huishoudens.per) {
    /* EEN VERSE WERELD BEGINT IN EVENWICHT. Zou hij op nul beginnen, dan was de
       eerste maand van elke campagne een neergang die niemand veroorzaakt had. */
    const per = {};
    for (const t of TYPEN) {
      const e = evenwicht(t, loonkosten);
      per[t.id] = { vast: e.vast, consumptie: e.consumptie, spaargeld: e.consumptie * t.buffer, krap: false };
    }
    st.huishoudens = tel(per);
    return st.huishoudens;
  }
  const per = st.huishoudens.per;
  for (const t of TYPEN) {
    const h = per[t.id];
    const netto = boekje(loonkosten * GEWICHT[t.id]).stand.netto;
    /* DE HUUR GAAT ER EERST AF, en hij beweegt nauwelijks. Zie de kop: hier komt
       de hefboom vandaan waardoor vrije besteding harder inzakt dan inkomen. */
    h.vast += (netto * LASTEN[t.id] - h.vast) * VAST_TRAAG;
    const besteedbaar = Math.max(0, netto - h.vast);
    const wens = h.consumptie + (besteedbaar * (1 - SPAARQUOTE) - h.consumptie) * AANPASSING;
    /* EN DE BODEM. Je kunt niet meer uitgeven dan er binnenkomt plus wat er
       ligt -- en anders dan bij een gemiddeld huishouden wordt die grens hier
       WERKELIJK geraakt, door de cohorten met een dunne buffer en het eerst.
       `krap` staat erbij zodat een meter kan laten zien WIE er tegen de bodem
       zit; het is een feit over deze maand en geen score. */
    const plafond = besteedbaar + h.spaargeld;
    h.krap = wens > plafond;
    h.consumptie = Math.max(0, Math.min(wens, plafond));
    h.spaargeld += besteedbaar - h.consumptie;
  }
  st.huishoudens = tel(per);
  return st.huishoudens;
}

/* De optelsom over de cohorten. Een LEZING en geen tweede voorraad: hij wordt
   elke maand opnieuw gemaakt uit `per`, zodat er niets kan gaan afwijken. */
function tel(per) {
  let consumptie = 0, spaargeld = 0;
  for (const t of TYPEN) { consumptie += per[t.id].consumptie; spaargeld += per[t.id].spaargeld; }
  return { consumptie, spaargeld, per };
}

module.exports = { TYPEN, GEWICHT, LASTEN, AANPASSING, VAST_TRAAG, evenwicht, maand };
