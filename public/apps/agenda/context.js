/* WAAR JE BENT, gezegd door dit scherm zelf (EDGE.md besluit 11, ronde 2).
   Dit scherm wijst een eigen hoofdactie aan (data-hoofdactie), dus het zegt ook
   zelf waar je bent; daarmee staat het niet meer op CONTEXT_SCHULD in
   scripts/edgedekking.js. De titel is de documenttitel van het scherm --
   dezelfde naam die het tabblad en de werktafel tonen, geen tweede naam. De
   kop in de pagina is het niet: die tekent rtg-daily.js pas later opnieuw. In de schil reist hij via adaptief/brug.js naar het
   blikveld, en daar leest Rahul hem (edge/rahulzicht.js).

   Het scherm publiceert GEEN handelingen: het declareert er geen, en een lijst
   ids zonder declaratie zou een knop beloven die er niet is. */
(function (w, d) {
  'use strict';
  d.addEventListener('DOMContentLoaded', function () {
    if (!w.RTGAdaptief) return;
    w.RTGAdaptief.context({ bron: 'agenda', titel: d.title });
  }, { once: true });
})(window, document);
