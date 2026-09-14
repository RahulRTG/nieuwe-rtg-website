/* ============================================================================
   MUTATIECONTRACTEN -- DE ACHTENVEERTIGSTE, EN HIJ WAS ER GEEN VAN DE 47.

   Deel van ./mutatiecontracten.js.

   HOE HIJ BOVENKWAM, want dat is het hele verhaal. Bij het herstellen van de
   afleidgang (zie ./mutatiecontracten-afleidrest.js) is `--afleiden` opnieuw
   gedraaid, en de afgeleide lijst ging van 3142 naar 3141 regels. Precies EEN
   route viel eruit: deze.

   Niet omdat er iets aan hem veranderde, maar omdat de VERSE idempotentieproef
   hem voor het eerst goed te pakken kreeg. Hij stond op BLOCKED_BY_TEST_FIXTURE
   ("de proef kwam er niet bij"), en dat klopt nu niet meer:

     stand : beschermd
     grond : opslag
     reden : "de eerste kale oproep veranderde de opslag en de woordelijk
              gelijke herhaling niet"

   Een route waarvan we het antwoord WEL weten, hoort niet in de wachtrij te
   blijven staan. Zonder deze regel zou het register op 1x LEGACY blijven staan,
   en dat is precies de stand die naar nul moet.

   EN DIT IS DE VAL WAAR MAIN IN LIEP, nu van dichtbij gezien. De telling die
   VOOR deze afleidgang draaide zei 4922 van 4922 geclassificeerd en LEGACY op
   nul -- met de OUDE afgeleide lijst eronder. Pas de telling NA `--afleiden` gaf
   het echte getal. Wie die twee gangen in een run doet, schrijft het register uit
   geheugen dat de nieuwe lijst nog niet kent; dat is hoe MUTATIECONTRACT.json
   3189 afgeleide rijen ging claimen terwijl het afgeleide bestand er 3142 had.
   Draai ze dus apart, en tel NA de tweede.
   ========================================================================== */
'use strict';

const CONTRACTEN = {
  'POST /api/member/rechterhand/logboek/regel/weg': {
    mutatieId: 'member.rechterhand.logboek.regel.weg',
    herkomst: 'mens',
    semantiek: { klasse: 'idempotent' },
    toegang: { klasse: 'AUTHENTICATED' },
    stand: 'PROTECTED',
    bewijs: { gemeten: 'kale ronde zonder sleutel: beschermd op grond van de opslag -- de eerste ' +
      'oproep veranderde iets en de woordelijk gelijke herhaling niet. Het enige verschil dat de ' +
      'opslagmeter bij de eerste oproep zag zat in `wacht`, de emmer van een rem', op: '2026-09-13' },
    nagekeken: 'met de hand, 2026-09-13: server/kern/rechterhand/logboek.js:40 doet ' +
      '`o.regels = o.regels.filter(x => x.id !== id)` en slaat op. Een regel die er al uit is, valt ' +
      'er niet nog een keer uit: de filter laat dezelfde verzameling achter. Dat is de eigen ' +
      'afhandeling in de route die PROTECTED vraagt, en er is geen duplicaatregel voor nodig',
    afgetekend: {
      door: 'Claude (Opus 5), handler gelezen op 13 september 2026 nadat de verse idemproef hem uit ' +
        'de afleidgang liet vallen; niet door een mens nagelezen',
      op: '2026-09-13'
    }
  }
};

module.exports = { CONTRACTEN };
