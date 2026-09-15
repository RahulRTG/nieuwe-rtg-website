/* ============================================================================
   WAT EEN TWEEDE AANROEP BETEKENT OP DE GEZINSDEUR VAN HET LAB-FONDS.

   De acht routes op /api/rtf/labfonds/* zijn op 14 september 2026 bijgekomen
   (server/routes/labfonds.js). Zonder verklaring is dat een gat, en een gat is
   hier iets anders dan een besluit -- zie de kop van ./idemsleutels.js.

   ELKE REGEL HIERONDER IS GEMETEN EN NIET GEKOZEN.
   test/rtf-labfonds-deur.test.js roept deze routes twee keer aan tegen een
   echte server en kijkt daarna in het grootboek. De uitslag daarvan staat ook
   in ./mutatiecontracten-rtflabfonds.js; deze twee registers horen hetzelfde te
   zeggen, want ze beschrijven dezelfde waarneming.

   DE TWEE DIE NIET DEDUPLICEREN ZIJN DE BELANGRIJKSTE. Twee keer tien euro
   toezeggen is twintig euro toezeggen, en twee buren mogen hetzelfde voorstel
   indienen. Een generieke laag die daar de tweede stilletjes opslokt, laat een
   echte toezegging verdwijnen -- en een verdwenen toezegging valt niet op, een
   dubbele wel. Dat is exact het dobbelsteen-argument uit de kop van
   ./idemsleutels.js, hier met geld erachter.
   ========================================================================== */
'use strict';

const SLEUTELS = {
  /* Lezen. De drie leesroutes van het fonds veranderen niets; drie leesrondes
     achter elkaar bewegen de pot niet (toets 5). Een besluit, geen gat. */
  'POST /api/rtf/labfonds/overzicht': { leest: true },
  'POST /api/rtf/labfonds/financiering': { leest: true },
  'POST /api/rtf/labfonds/scheidsrechter': { leest: true },

  /* Dezelfde locatie twee keer aanmaken levert er EEN op (toets 4): de id komt
     uit de naam. Een dubbeltik binnen het venster is dus een herhaling. */
  'POST /api/rtf/labfonds/locatie/maak': { zelfdeVerzoek: true },

  /* Dezelfde stem twee keer blijft EEN stem (toets 7, voor: 1 / tegen: 0) --
     de motor overschrijft `mijnStem` in plaats van op te tellen. Wie het vaakst
     klikt, stemt hier niet het hardst. */
  'POST /api/rtf/labfonds/stem': { zelfdeVerzoek: true },

  /* En de twee die met opzet NIET dedupliceren. */
  'POST /api/rtf/labfonds/doneer': { nietIdempotent: true,
    waarom: 'twee keer hetzelfde bedrag toezeggen is twee toezeggingen -- gemeten: 2x10 staat als ' +
      '20 in het grootboek (toets 3). Een fonds dat de tweede opslokt, verliest een echte toezegging.' },
  'POST /api/rtf/labfonds/voorstel/maak': { nietIdempotent: true,
    waarom: 'een tweede identiek voorstel krijgt een EIGEN id en staat er als tweede (toets 7). ' +
      'Twee buren mogen hetzelfde willen; samenvoegen neemt de tweede indiener zijn stem af.' },

  /* BESLIS IS EEN TOESTANDSCONTROLE EN GEEN DUPLICAATLAAG, en dat verschil
     wordt hier niet weggepoetst. De tweede aanroep wordt GEWEIGERD met 409
     "Over dit voorstel is al beslist" (toets 7). Dat is een grendel van de
     route zelf; `zelfdeVerzoek` zou die 409 vervangen door een stille herhaling
     van het eerste antwoord, en dan leest "al beslist" als "zojuist beslist".
     Zelfde reden als bij /api/pakket/koop in de kop van ./idem-poort.js. */
  'POST /api/rtf/labfonds/beslis': { nietIdempotent: true,
    waarom: 'de route weigert de tweede zelf met 409 "al beslist"; dat is een toestandscontrole, ' +
      'en een duplicaatlaag eroverheen zou die weigering onzichtbaar maken' }
};

module.exports = { SLEUTELS };
