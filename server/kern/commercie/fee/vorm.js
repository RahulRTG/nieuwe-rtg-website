/* DE STANDEN VAN EEN BETAALDIENSTFEE, EN WELKE STAP DAARNA MAG.

   ../fee.js is de administratie: incasseren, boeken, herkansen, afstemmen. Dit
   bestand is de VORM -- de standen en de tabel van toegestane overgangen.

   EEN OVERGANG DIE HIER NIET STAAT, IS EEN PROGRAMMEERFOUT en wordt geweigerd.
   Dat is het hele nut van een expliciete tabel boven een reeks if-jes: je kunt
   hem lezen, en wat er niet in staat kan niet gebeuren. */
'use strict';

const STATUS = {
  GEINCASSEERD: 'GEINCASSEERD',
  OPENSTAAND: 'OPENSTAAND',
  GEBOEKT: 'GEBOEKT',
  HERKANSING: 'HERKANSING',
  AFGESTEMD: 'AFGESTEMD'
};

/* Welke stap na welke mag. Een overgang die hier niet staat is een
   programmeerfout en wordt geweigerd -- niet stil doorgevoerd, want een status
   die achteruit kan lopen maakt elk getal eronder waardeloos. Zelfde regel als
   in kern/betaalopdracht/index.js, en met opzet dezelfde vorm.

   HERKANSING -> HERKANSING mag: een tweede mislukking is geen fout in de
   machine maar een feit dat geteld hoort te worden. */
const OVERGANG = {
  [STATUS.GEINCASSEERD]: [STATUS.OPENSTAAND],
  [STATUS.OPENSTAAND]: [STATUS.GEBOEKT, STATUS.HERKANSING],
  [STATUS.HERKANSING]: [STATUS.GEBOEKT, STATUS.HERKANSING],
  [STATUS.GEBOEKT]: [STATUS.AFGESTEMD],
  [STATUS.AFGESTEMD]: []
};

// nog verschuldigd: deze standen tellen mee in wat de zaak nog moet
const OPEN = new Set([STATUS.GEINCASSEERD, STATUS.OPENSTAAND, STATUS.HERKANSING]);
// klaar: hier hoeft niets meer
const AF = new Set([STATUS.AFGESTEMD]);

const RIJ_MAX = 5000;

function magOvergaan(van, naar) {
  return Array.isArray(OVERGANG[van]) && OVERGANG[van].includes(naar);
}

module.exports = { STATUS, OVERGANG, OPEN, AF, RIJ_MAX, magOvergaan };
