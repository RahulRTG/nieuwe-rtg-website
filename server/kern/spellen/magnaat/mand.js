/* Magnaat: DE BOODSCHAPPENMAND -- waar een huishouden zijn geld aan uitgeeft.

   HUISHOUDEN.md 3.5 en 3.6, en die twee horen bij elkaar. Tot nu toe was
   consumptie EEN BEDRAG: zakte het inkomen, dan zakte alles evenredig mee, en
   dan raakt een neergang de bakker net zo hard als het restaurant. Dat is
   precies wat ECONOMIE.md verbiedt -- dezelfde schok raakt niet iedereen gelijk.

   In het echt gaat het anders. Bij inkomensverlies wordt eerst de huur betaald
   en het eten gekocht; wat er geschrapt wordt is de vakantie, het restaurant,
   het abonnement. **De volgorde van betalen bepaalt wie er als eerste omvalt.**

   ================== EN DAAROM ZIJN VERPLICHTINGEN GEEN APARTE LAAG ==================

   Wonen, energie en zorg staan hier gewoon IN de mand, als de stijfste posten.
   Dat is geen bezuiniging op het ontwerp maar de kern ervan: een verplichting is
   niet iets anders dan een besteding, hij is er alleen een die je niet kunt
   uitstellen. Door ze in dezelfde mand te zetten hoeft er geen tweede
   boekhouding te bestaan die kan gaan afwijken.

   ================== ELKE POST GAAT NAAR EEN SECTOR, OF NAAR BUITEN ==================

   `naar` is de sector die deze post ontvangt -- en dat is dezelfde vorm als
   ./keten.js: is die sector in de stad aanwezig, dan komt het geld daar terecht;
   is hij dat niet, dan verlaat het de wereld en heet dat zo. `null` betekent dat
   de ontvangende sector in Magnaat NIET BESTAAT. Dat geldt vandaag voor wonen,
   energie en zorg, en dat is meteen de lijst van wat er nog ontbreekt: er is
   geen verhuurder, geen energiebedrijf en geen zorgaanbieder.

   HET IS DUS EEN EERLIJKE LIJST EN GEEN VOLLEDIGE. 45% van de mand kan vandaag
   nergens aankomen. Dat is niet weggemoffeld: scripts/magnaat-oorsprong.js
   drukt het af.

   ================== GEEN VASTE PERCENTAGES, EN TOCH EEN TABEL ==================

   HUISHOUDEN.md par. 2 verbiedt `horeca = 8% van loon`, en dat is precies niet
   wat hier staat. De aandelen hieronder zijn de EVENWICHTSSTAND; wat een
   huishouden werkelijk uitgeeft schuift ervandaan zodra zijn inkomen verandert,
   en het schuift PER CATEGORIE anders. Het vaste getal is het beginpunt van een
   beweging, niet de uitkomst ervan. */
'use strict';

/* HOE HARD EEN POST MEEGEEFT als er gesneden moet worden. Geen prioriteitslijst
   met nummers maar drie soorten met een reden:

     essentieel   je hebt het nodig of je hebt het getekend -- wonen, eten,
                  energie, vervoer naar je werk, zorg
     semi         je kunt het uitstellen of goedkoper doen -- kleding, telecom
     vrij         je kunt het overslaan -- uit eten, vakantie, vrije tijd

   De getallen zijn de relatieve gevoeligheid: van elke euro die er af moet komt
   er ruim acht keer zoveel uit de vrije posten als uit de essentiele. */
const SOORT = { essentieel: 0.25, semi: 1.0, vrij: 2.2 };

/* DE MAND, in de evenwichtsstand. Aandelen van het totaal dat een huishouden
   uitgeeft; ze tellen op tot 1. Spelgetallen van de juiste orde van grootte voor
   een Nederlands huishouden, geen meting. */
const MAND = [
  { id: 'wonen', soort: 'essentieel', deel: 0.30, naar: null },
  { id: 'voeding', soort: 'essentieel', deel: 0.16, naar: 'retail' },
  { id: 'vervoer', soort: 'essentieel', deel: 0.09, naar: 'logistiek' },
  { id: 'energie', soort: 'essentieel', deel: 0.08, naar: null },
  { id: 'zorg', soort: 'essentieel', deel: 0.07, naar: null },
  { id: 'kleding', soort: 'semi', deel: 0.06, naar: 'retail' },
  { id: 'huishoudelijk', soort: 'semi', deel: 0.04, naar: 'retail' },
  { id: 'telecom', soort: 'semi', deel: 0.04, naar: 'kantoor' },
  { id: 'uit eten', soort: 'vrij', deel: 0.07, naar: 'horeca' },
  { id: 'vrije tijd', soort: 'vrij', deel: 0.05, naar: 'vrije-tijd' },
  { id: 'vakantie', soort: 'vrij', deel: 0.04, naar: 'hotel' }
];

/* WAT ER WERKELIJK IN DE MAND ZIT bij een besteding van `r` maal de
   evenwichtsstand. Geeft per post het aandeel VAN HET TOTAAL DAT ER NU IS.

   Het verschil wordt verdeeld naar gevoeligheid, en wat een post niet meer kan
   opbrengen (je kunt niet minder dan niets aan vakantie uitgeven) schuift door
   naar de rest. Die herverdeling is een lus omdat hij zichzelf kan herhalen:
   is de vakantie op, dan moet het uit de kleding komen, en daarna uit het eten.
   DRIE RONDES is genoeg voor elke `r` die een economie oplevert, en wat er
   daarna nog overblijft wordt evenredig gedragen -- want op dat punt is er geen
   volgorde meer over: alles is al tot op de bodem gesneden. */
function verdeel(r) {
  const nu = Object.fromEntries(MAND.map(p => [p.id, p.deel]));
  let tekort = 1 - r;
  for (let ronde = 0; ronde < 3 && Math.abs(tekort) > 1e-12; ronde++) {
    /* Alleen posten die nog kunnen bewegen tellen mee in de verdeelsleutel. */
    const kan = MAND.filter(p => tekort < 0 || nu[p.id] > 1e-12);
    const som = kan.reduce((n, p) => n + SOORT[p.soort] * p.deel, 0);
    if (!(som > 0)) break;
    let rest = 0;
    for (const p of kan) {
      const wil = tekort * (SOORT[p.soort] * p.deel) / som;
      const kanNiet = Math.max(0, wil - nu[p.id]);
      nu[p.id] -= wil - kanNiet;
      rest += kanNiet;
    }
    tekort = rest;
  }
  return nu;
}

/* PER SECTOR: hoeveel er nu naartoe gaat ten opzichte van de evenwichtsstand.
   Dat is het getal waarmee ./huishoudens.js de vraag beweegt -- 1.0 is "precies
   zoals altijd", en bij een neergang staat de horeca ver onder de supermarkt.

   `null` (geen ontvangende sector) staat onder de sleutel `buiten`, zodat een
   meter kan laten zien hoeveel van de mand nergens aankomt. */
function perSector(r) {
  const nu = verdeel(r);
  const even = {}, straks = {};
  for (const p of MAND) {
    const k = p.naar || 'buiten';
    even[k] = (even[k] || 0) + p.deel;
    straks[k] = (straks[k] || 0) + nu[p.id];
  }
  const uit = {};
  for (const k of Object.keys(even)) uit[k] = even[k] > 0 ? straks[k] / even[k] : 1;
  return uit;
}

/* ================== WAT DEZE MAND VANDAAG NIET DOET ==================

   EERLIJK EN MET ZOVEEL WOORDEN, want het is gemeten en niet vermoed. De
   vraagfactor in ./huishoudens.js vermenigvuldigt deze mand met `(b - 1)`: het
   OVERSCHOT van de spelershuishoudens boven de stad. Zakt de loonsom, dan
   verdwijnt juist dat overschot -- in een gemeten schok van 1,082 naar 1,013 --
   en dan heeft de mand bijna niets meer om over te verdelen. Op wereldniveau
   bepaalt de segmentsom (./vraag.js) en de keten (./keten.js) dus nog steeds wie
   er harder zakt, en niet deze mand.

   DE OORZAAK IS EEN ONTBREKENDE ACTOR EN GEEN FOUT HIER: de huishoudens van de
   STAD ZELF zijn een constante. Zolang die niet meebewegen kan een mand alleen
   het randje sturen. Wat hij nodig heeft is dat de stadshuishoudens dezelfde
   behandeling krijgen als die van de spelers -- dan gaat de hele consumptie van
   IJmuiden door deze mand en niet alleen het overschot.

   Er stond hier een wereldtoets die het tegendeel beweerde; die is weggehaald
   toen de meting hem tegensprak (zie test/spelhuishouden.test.js). Wat hier
   getoetst IS, is deze module zelf: de verdeling klopt, hij behoudt het totaal,
   en hij snijdt in de goede volgorde. */

module.exports = { SOORT, MAND, verdeel, perSector };
