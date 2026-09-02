/* ============================================================================
   HET ONDERZOEKSNUMMER -- één naam voor één onderzoek, door het hele systeem.

   WAAROM HIJ NIET IS UITGEVONDEN MAAR GEVONDEN. Op tafel lag één `research_id`
   die van een buurtvraag tot een publicatie meereist, over tien stations. Dat is
   precies de vorm waarin `Asset` hier een keer sneuvelde: een begrip dat over de
   domeinen heen wordt VERKLAARD in plaats van erin gevonden. Dus is het eerst
   gemeten (`scripts/onderzoeksketen.js`, ONDERZOEKSKETEN.json), en de uitkomst
   was streng en geruststellend tegelijk:

     zeven van de tien stations hangen al aan DEZELFDE studie -- ethiek,
     waarnemingen, bewijs, apparatuur, de uitgangen, de vraag uit de buurt en het
     grootboek. Het is geen ketting maar een ster, en de spil bestaat al.

   Er hoefde dus geen identiteit dwars door tien domeinen te worden gelegd; wat
   ontbrak was een NAAM voor de spil die ook buiten de software bestaat. Een
   interne sleutel (`rid()`, acht tekens hex) is prima om mee te zoeken en
   onbruikbaar in een subsidieaanvraag, op een poster in de buurt of in een
   verwijzing van een gemeente.

   DE VORM, EN WAT ELK STUK DOET:

       RTF-IJM-2026-0042
        |   |    |    |
        |   |    |    volgnummer binnen dat lab en dat jaar
        |   |    het jaar waarin het onderzoek begon
        |   drie letters van de stad van het lab
        de stichting: dit onderzoek is van de RTFoundation

   DRIE REGELS DIE HIER VASTLIGGEN.

   1. HIJ VERANDERT NOOIT. Ook niet als het lab verhuist, de titel wijzigt of het
      onderzoek van soort verandert. Een nummer dat meebeweegt met de gegevens is
      geen nummer maar een samenvatting.

   2. HIJ IS GEEN SLEUTEL. Zoeken en koppelen gaat binnen de software op de
      interne id; dit nummer is voor mensen. Zou het systeem erop zoeken, dan is
      een botsing (twee labs, dezelfde stadsafkorting) ineens een fout in plaats
      van een lelijkheid.

   3. HIJ ZEGT NIETS OVER DE INHOUD. Geen soort, geen thema, geen status. Wat er
      in het nummer staat, staat er voorgoed in -- en een onderzoek dat van
      richting verandert (wat het hoort te kunnen) zou dan een naam dragen die
      niet meer klopt.
   ========================================================================== */
'use strict';
const klok = require('../../lib/klok');

const VOORVOEGSEL = 'RTF';

/* Drie letters uit de stad. Diakritieken eraf, alles wat geen letter is eruit,
   en dan de eerste drie: Zurich wordt ZUR, 's-Hertogenbosch wordt SHE. Dat
   laatste is lelijk en het blijft zo -- een uitzonderingenlijst voor mooie
   afkortingen is een tweede plek waar een naam vandaan komt, en het nummer hoeft
   niet mooi te zijn maar vast. Is er geen bruikbare stad, dan staat er XXX: een
   leesbaar teken dat er iets ontbreekt, in plaats van een verzonnen plaats. */
function stadsdeel(stad) {
  const t = String(stad || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z]/g, '');
  return t.length >= 3 ? t.slice(0, 3) : (t ? (t + 'XX').slice(0, 3) : 'XXX');
}

/* Het volgnummer telt binnen LAB en JAAR, en wordt geteld uit de studies die er
   al staan -- niet uit een teller die apart wordt bijgehouden. Een losse teller
   loopt uit de pas zodra er een studie wordt verwijderd of hersteld, en dan
   krijgen twee onderzoeken hetzelfde nummer. */
function volgnummer(studies, labId, jaar) {
  let hoogste = 0;
  for (const s of studies || []) {
    if (!s || s.labId !== labId) continue;
    const n = ontleed(s.nummer);
    if (n && n.jaar === jaar && n.volg > hoogste) hoogste = n.volg;
  }
  return hoogste + 1;
}

const VORM = /^RTF-([A-Z]{3})-(\d{4})-(\d{4})$/;

function ontleed(nummer) {
  const m = VORM.exec(String(nummer || ''));
  return m ? { stad: m[1], jaar: Number(m[2]), volg: Number(m[3]) } : null;
}

/* Geeft het nummer voor een NIEUWE studie. `at` is het moment waarop het
   onderzoek begint; het jaar komt daaruit en niet uit de systeemklok, zodat een
   toets een jaarwissel kan naspelen. */
function nieuw({ lab, studies, at }) {
  const jaar = Number(String(at || '').slice(0, 4)) || klok.datum().getUTCFullYear();
  const volg = volgnummer(studies, lab && lab.id, jaar);
  return [VOORVOEGSEL, stadsdeel(lab && lab.stad), String(jaar),
    String(Math.min(9999, volg)).padStart(4, '0')].join('-');
}

module.exports = { nieuw, ontleed, stadsdeel, volgnummer, VORM, VOORVOEGSEL };
