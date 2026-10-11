/* WAAR JE BENT, gezegd door dit scherm zelf (EDGE.md besluit 11, ronde 2).
   Dit scherm wijst een eigen hoofdactie aan (data-hoofdactie), dus het zegt ook
   zelf waar je bent; daarmee staat het niet meer op CONTEXT_SCHULD in
   scripts/edgedekking.js. De titel is de documenttitel van het scherm --
   dezelfde naam die het tabblad en de werktafel tonen, geen tweede naam. Die
   titel wordt na het laden nog vertaald (rtg-daily-fields.js), dus de context
   volgt hem: verandert de titel, dan zegt het scherm het opnieuw. Eén keer
   publiceren liet in het Engels "RTG Agenda" staan onder een tab "RTG Calendar". In de schil reist hij via adaptief/brug.js naar het
   blikveld van de schil.

   Het scherm publiceert GEEN handelingen: het declareert er geen, en een lijst
   ids zonder declaratie zou een knop beloven die er niet is. */
(function (w, d) {
  'use strict';
  function zeg() { if (w.RTGAdaptief) w.RTGAdaptief.context({ bron: 'agenda', titel: d.title }); }
  d.addEventListener('DOMContentLoaded', function () {
    zeg();
    var t = d.querySelector('head > title');
    if (t && w.MutationObserver) new w.MutationObserver(zeg).observe(t, { childList: true, characterData: true, subtree: true });
  }, { once: true });
})(window, document);
