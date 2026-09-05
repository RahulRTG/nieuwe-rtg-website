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

  /* GEEN TERUGVAL OP KLOK OF Math.random(). Als Web Crypto ontbreekt, is er
     geen veilige idempotentiesleutel. Dan moet de handeling VOOR de fetch
     stoppen in plaats van onder een voorspelbare sleutel naar de server te
     gaan. De functie zelf wordt wel altijd geplaatst: elke aanroeper krijgt
     zo dezelfde, duidelijke fail-closed fout in plaats van een ReferenceError. */
  function veiligId(voor) {
    var c = window.crypto;
    if (!c || typeof c.getRandomValues !== 'function') {
      throw new Error('Veilige browser-willekeur ontbreekt; RTG voert deze handeling niet uit.');
    }
    var b = new Uint8Array(16);
    c.getRandomValues(b);
    var k = Array.prototype.map.call(b, function (x) {
      return ('0' + x.toString(16)).slice(-2);
    }).join('');
    return (voor ? voor + '-' : '') + k;
  }

  /* id.js is de autoritatieve definitie. Een eerder gelijknamig globaal mag
     deze veiligheidsgrens niet ongemerkt vervangen; de parserblokkerende
     include zet daarom beide publieke namen opnieuw op dezelfde CSPRNG-functie. */
  window.RTGId = veiligId;
  window.RTGIdem = veiligId;
})();
