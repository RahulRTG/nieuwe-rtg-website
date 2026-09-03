/* DE 5XX-TELLER VAN /metrics -- wat log.js MELDT, telt dit.

   `rtg_fouten_totaal` stond in server/meting-tekst.js netjes uitgeschreven met
   een HELP- en een TYPE-regel, en `meting.telFout()` had in de hele
   productiecode geen enkele aanroeper. De teller stond dus voor altijd op nul:
   het endpoint antwoordt, de regel staat er, en niemand ziet dat er nooit iets
   in gaat (TAKEN.md 7.10).

   HET ZIJN GEEN TWEE PLEKKEN. Die taak zei "log.js en opzet/afsluiters.js", maar
   allebei die plekken roepen `log.uitzondering()` aan -- en dat doen de vijftig
   andere plekken die een storing melden ook. Twee aanroepers ophangen waar er
   een nodig is, betekent de rest missen. Vandaar EEN haak, in log.uitzondering.

   WAT ER GETELD WORDT IS EEN SERVERFOUT EN NIET ELKE MELDING. afsluiters.js
   meldt ook een 413 en een 400 langs deze weg; dat is de client die iets
   verkeerds stuurt, geen storing van ons. De regel is daarom: tellen TENZIJ de
   context een status onder de 500 draagt. Een uitzondering zonder status is per
   definitie van ons, en dat is de meerderheid.

   DE SOORT IS DE NAAM VAN DE FOUT EN NOOIT HET PAD. Een Prometheus-label met een
   pad erin laat de reeks meegroeien met het verkeer, en op een route met een id
   erin groeit hij ongelimiteerd. `TypeError`, `RangeError`, `Error`: een korte,
   gesloten verzameling die zegt WAT voor storing het was zonder te zeggen wie
   hem opriep.

   EIGEN BESTAND EN GEEN REGEL IN log.js, en dat is niet alleen de omvangregel:
   log.js gaat over MELDEN (waar gaat een regel heen, in welke vorm) en dit over
   TELLEN. Dat zijn twee onderwerpen, en het tweede kent de meetlaag terwijl het
   eerste die niets aangaat. */
'use strict';

function telServerfout(err, context) {
  const status = context && context.status;
  if (status !== undefined && status !== null && Number(status) < 500) return;
  const soort = (err && err.name) || (err && err.constructor && err.constructor.name) || 'Error';
  require('./meting').telFout(soort);
}

module.exports = { telServerfout };
