/* WAT ER MET EEN PAGINA GEBEURT ZODRA HIJ EEN WERKBLAD WORDT.

   Een werkblad is een gewone pagina in een frame, en die pagina weet niet dat hij
   in een werktafel hangt. Twee dingen kloppen daardoor niet vanzelf:

   1. HIJ DRAAGT ZIJN EIGEN ZWEVENDE DINGEN MEE. Rahuls knop rechtsonder, de
      magazine-blokken, de cookiemelding: allemaal position:fixed, allemaal boven
      op de balk van de werktafel die er al is. Twee Rahuls op een scherm is geen
      dubbele hulp maar een fout. Ze gaan hier uit met een stijlregel IN dat
      document -- niet weggehaald, want het is hun pagina, alleen niet zichtbaar
      zolang hij een blad is.

      #rtg-cookie staat er op ID en niet op klasse: het aria-label is vertaald,
      en op de klasse stond hij in het Engels dubbel.

   2. SCROLLEN IN HET BLAD IS SCROLLEN VOOR DE CONSOLE. De glasconsole hoort te
      krimpen zodra je gaat lezen, en het frame vertelt dat niet aan het
      bovendocument. Vandaar dat er hier op wordt geluisterd, ook op de
      binnenvakken -- veel schermen scrollen in een element en niet in het
      venster, en dan komt er nooit een scroll op window voorbij.

   Een eigen bestand omdat het een eigen onderwerp is: shared/command/werktafel.js
   gaat over het MEUBEL (bank, bladen, scheiding, balk), dit over wat er in een
   blad gebeurt. Het stond daar, en duwde dat bestand over de 10 KB uit regel 13
   van scripts/check.js -- precies wat die grens hoort te melden.

   Alles in een try: een frame kan van een andere herkomst zijn, en dan is er
   niets te haken. Dat is geen fout maar een blad dat we met rust laten.

   Levert window.RTGCommandBladhaak(p, klein). */
(function (w, d) {
  'use strict';
  var VERBERG = '#rahulFab,.rahulfab,.rahulsheet,.mgz-blok,.mgz-ruimte,.amn-knop,#rtg-cookie' +
    '{display:none!important}body{padding-bottom:0!important}';
  w.RTGCommandBladhaak = function (p, klein) {
    try {
      var doc = p.frame.contentDocument, st = doc.createElement('style');
      st.textContent = VERBERG;
      doc.head.appendChild(st);
      /* Het bovendocument hoort te weten dat er in een blad wordt gewerkt: de
         chrome van het dock zakt dan in (shared/adaptief/diepte.js). Een frame
         kan dat niet zelf vertellen, en de schil kan het niet zien -- vandaar
         dat het hier wordt doorgegeven, op de enige plek waar we allebei de
         kanten in handen hebben. */
      var beweegt = function () {
        klein();
        try { d.dispatchEvent(new w.CustomEvent('rtg-blad-beweegt')); } catch (x) {}
      };
      p.frame.contentWindow.addEventListener('scroll', beweegt, { passive: true });
      doc.addEventListener('input', beweegt, true);
      var sc = doc.querySelectorAll('[class*=content],main');
      for (var i = 0; i < sc.length; i++) sc[i].addEventListener('scroll', beweegt, { passive: true });
    } catch (e) {}
  };
})(window, document);
