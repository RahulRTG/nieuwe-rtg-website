/* RTGId: een id uit de CSPRNG van de browser.

   Voor alles wat echt uniek moet zijn: idempotentie-sleutels voor geld-acties, en
   de id's van blokken, kaarten, menu-items en streken. Twee dingen met hetzelfde
   id zijn voor de app EEN ding, en dan gaat er stil iets fout: bij een
   idem-sleutel houdt de server de tweede geld-actie voor een herhaling van de
   eerste en antwoordt "gelukt" zonder te boeken; bij een menu-item of een
   kanban-kaart bewerk je er ineens twee tegelijk.

   Date.now() is milliseconde-grof en Math.random().toString(36).slice(...) levert
   een handvol bits, waar de botsingskans bij honderden id's al merkbaar is.

   Dit staat met opzet in een EIGEN bestand en wordt ZONDER defer geladen, vóór de
   code die het gebruikt. Het zat eerst in shared/basis.js, maar dat laadt deferred
   en dus pas na het parsen -- terwijl de documenteditors hun eerste blokken al
   tijdens het parsen aanmaken. Die kregen daardoor een ReferenceError. Deze module
   raakt de DOM niet, dus hij mag vooraan staan.

   Keuringsregel 15 bewaakt twee dingen: dat niemand een id uit de klok of
   Math.random bouwt, en dat elke pagina die RTGId gebruikt dit bestand ook
   inlaadt -- zodat het load-order-gat niet stil terugkomt. */
(function () {
  'use strict';
  if (window.RTGId) return;
  window.RTGId = function (voor) {
    var b = new Uint8Array(16), k;
    try {
      crypto.getRandomValues(b);
      k = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    } catch (e) {
      // onbereikbaar in elke browser die de rest van deze app draait; nooit
      // stil zonder id zitten weegt hier zwaarder dan de zwakkere bron
      k = Date.now() + '-' + String(Math.random()).slice(2);
    }
    return (voor ? voor + '-' : '') + k;
  };
  // de naam waarmee de geld-paden hem kennen (zie keuringsregel 15)
  window.RTGIdem = window.RTGId;
})();
