/* ============================================================================
   MUTATIECONTRACT -- het lid betaalt een bevestigde reis (een route).

   Deel van server/lib/mutatiecontracten.js; zie de kop daar voor de vorm. Een
   eigen bestand omdat deze route iets doet wat geen enkele andere reisroute
   doet: hij VERPLAATST GELD, en hij is de eerste aanroeper van de herkomstlaag
   (kern/waarde/economischeherkomst.js).

   ================== DE AFWEGING: WAAROM IDEMPOTENT EN GEEN 409 ==============

   Bij de nazorgroutes ernaast (./mutatiecontracten-reisnazorg.js) krijgt de
   tweede oproep een 409, en daar is uitgelegd waarom dat toch idempotent heet:
   de EERSTE doet het werk en de stand na twee is die na een.

   Hier is het anders, en met opzet. Een tweede betaalpoging krijgt **200 met
   `alBetaald: true`** en niet 409. De reden is de aanroeper: dit is een knop in
   de app van een lid dat net geld heeft zien weggaan, en een 409 op "betaal"
   leest voor die mens als "er is iets misgegaan" terwijl er niets misging. De
   stand is wat telt, en die is identiek: EEN boeking in het grootboek, EEN stel
   herkomstrijen, EEN saldo.

   Dat is de gevaarlijkste route van dit hele stel om fout te hebben. Een tweede
   boeking zou het lid twee keer de reissom kosten, en een tweede stel
   herkomstrijen zou de doorbelasting verdubbelen zonder dat er een euro extra
   binnenkwam -- een fout die in de bijdragebasis precies zo groot doorwerkt en
   die niemand aan een saldo ziet.

   ================== HOE HET GEMETEN IS ==================

   Over HTTP tegen een wegwerpserver (test/reisherkomst.test.js toets 13): een
   vers lid, door de KYC, wallet op 300000 cent. Ibiza-jetset aangevraagd, door
   het kantoor bevestigd, daarna twee keer /betaal met hetzelfde lijf. Na elke
   oproep het walletoverzicht opgehaald: saldo, en de regels in de geschiedenis
   met soort `reis`.

   WAT DIT NIET BETEKENT: dat er een idempotentiesleutel onder ligt. Die is er
   niet. De bescherming komt uit de STAND op de aanvraag zelf (`a.betaald`), en
   dat is een toestandscontrole die toevallig hetzelfde antwoord geeft. Wie hier
   een echte sleutel bij bouwt, verandert de weg en niet de uitkomst -- en hoort
   deze meting opnieuw te draaien in plaats van dit blok te laten staan.
   ========================================================================== */
'use strict';

const GEMETEN_OP = '2026-09-15';
const AFGETEKEND = {
  door: 'Claude (Opus 5), op grond van de gemeten dubbeltik hieronder plus de afweging in de kop ' +
    'tegen MUTATIECONTRACT.md par. 5; niet door een mens nagelezen',
  op: GEMETEN_OP
};

const CONTRACTEN = {
  /* Het lid betaalt een reis die een reisadviseur heeft bevestigd. De route int
     de reissom op EEN boeking en splitst die in herkomstrijen uit de
     commerciele samenstelling; wat aan derden toekomt wordt klaargezet en nooit
     uitgevoerd (GELD.md). Een reis zonder samenstelling wordt geweigerd. */
  'POST /api/reisbureau/betaal': {
    mutatieId: 'reisbureau.betaling.lid',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    /* De ref moet van DEZE aanvrager zijn; een ref van een ander lid geeft 404
       en niet 403 -- wie hem niet bezit, hoort niet te weten dat hij bestaat.
       Dezelfde keuze als bij de nazorgroutes ernaast. */
    toegang: { klasse: 'OBJECT_SCOPED', objectVeld: 'ref' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: '1e: 200 -> betaald 220000 cent, 6 herkomstrijen, saldo 300000 -> 80000, ' +
        '1 grootboekregel met soort `reis`. ' +
        '2e: 200 met `alBetaald: true` -> saldo blijft 80000, nog steeds 1 grootboekregel ' +
        'en geen tweede stel herkomstrijen. ' +
        'En de weigerkant: een reis ZONDER samenstelling (lissabon-nieuw) geeft 409 met de reden, ' +
        'zonder boeking en zonder herkomstrij. (Hier stond gstaad-alpien; die is op dezelfde dag ' +
        'uitgesplitst, en een gemeten bewering die naar het verkeerde geval wijst is geen bewijs.)',
      op: GEMETEN_OP
    },
    afgetekend: AFGETEKEND
  },

  /* HET KANTOOR DRAAIT EEN BETAALDE REIS TERUG. Hier is de tweede oproep WEL een
     409, anders dan bij /betaal hierboven -- en dat verschil is met opzet. Bij
     /betaal staat een lid voor de knop dat net geld heeft zien weggaan; hier
     staat een medewerker die een besluit neemt, en die hoort te LEZEN dat de reis
     al is teruggedraaid in plaats van een stille bevestiging te krijgen.

     De stand na twee oproepen is identiek aan die na een: dezelfde zes
     spiegelrijen, hetzelfde ene teruggaveRECHT, hetzelfde saldo. De bescherming
     zit in de spiegellaag zelf (kern/reisbureau-terugboeking.js weigert een rij
     die al een spiegel heeft), en niet in een idempotentiesleutel -- die is er
     niet. Een tweede ronde zou het bedrag verdubbelen terwijl er een keer is
     afgezegd, en dat is de duurste fout die deze route kan maken. */
  'POST /api/office/reisbureau/terugboeking': {
    mutatieId: 'reisbureau.terugboeking.kantoor',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: {
      gemeten: 'zonder reden: geweigerd, geen spiegelrij en geen teruggaveRECHT. ' +
        '1e met reden: 200 -> 6 spiegelrijen, 220000 cent, volledig; saldo van het lid ONVERANDERD ' +
        '(er wordt een RECHT klaargezet en geen geld verplaatst). ' +
        '2e met dezelfde ref: geweigerd -> nog steeds 6 spiegelrijen en hetzelfde saldo. ' +
        'En de waarheid klopt achteruit: doorbelasting, bijdragebasis en belasting staan na de ' +
        'volledige terugboeking alle drie op nul, niet alleen het bruto.',
      op: GEMETEN_OP
    },
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };
