/* DE VORM: bureau, tablet of telefoon -- en wie het wil weten als hij verandert.

   Afgesplitst uit shared/adaptief/register.js, als zuivere verhuizing: het
   register stond op 33 bytes van de grens van 10 KB (scripts/check.js regel 13).
   Het register leest dit deel bij het laden en geeft vorm() en opVorm() door
   onder zijn eigen naam; niemand anders hoeft dit bestand te kennen. Het laadt
   dus VOOR register.js (test/adaptiefdelen.test.js bewaakt die volgorde op elk
   scherm dat het register laadt).

   Levert window.RTGAdaptiefVorm. */
(function (w, d) {
  'use strict';
  if (w.RTGAdaptiefVorm) return;
  var leer = w.RTGAdaptiefLeer;
  if (!leer) return;                       // zonder de leer geen grenzen
  var luisterVorm = [];

  /* Twee mediaqueries en geen resize-teller: de vorm verandert op een grens en
     niet op elke pixel. De grenzen komen uit de leer, zodat er geen tweede
     getal ontstaat naast dat in command.css (WERELD.md-fout in het klein: twee
     lijsten zijn twee waarheden).

     Hier stond eerst innerWidth bij het laden, één keer gemeten. Dat is dezelfde
     fout die de sterrenhemel en de gloed maakten (WERELD.md): meten op een
     moment in plaats van het scherm volgen. Draai je een telefoon, dan klopt een
     gemeten momentopname niet meer. */
  var mqBureau = w.matchMedia('(min-width:' + leer.MAAT.bureau + 'px)');
  var mqTablet = w.matchMedia('(min-width:' + leer.MAAT.tablet + 'px)');
  function vorm() { return mqBureau.matches ? 'bureau' : (mqTablet.matches ? 'tablet' : 'telefoon'); }
  var laatste = vorm();
  function hertoets() {
    var v = vorm();
    if (v === laatste) return;
    laatste = v;
    if (d.documentElement) d.documentElement.setAttribute('data-rtg-vorm', v);
    luisterVorm.slice().forEach(function (f) { try { f(v); } catch (e) {} });
  }
  [mqBureau, mqTablet].forEach(function (mq) {
    if (mq.addEventListener) mq.addEventListener('change', hertoets);
    else if (mq.addListener) mq.addListener(hertoets);
  });
  if (d.documentElement) d.documentElement.setAttribute('data-rtg-vorm', laatste);

  w.RTGAdaptiefVorm = {
    vorm: vorm,
    opVorm: function (f) { if (typeof f === 'function') { luisterVorm.push(f); f(vorm()); } }
  };
})(window, document);
