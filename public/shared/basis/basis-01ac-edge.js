/* Iedere echte wereldkamer gebruikt dezelfde Edge. Pagina's die randen.js al
   zelf opnemen blijven eigenaar van hun laadvolgorde; de basis vult hem alleen
   aan wanneer hij ontbreekt. Core bestaat niet als zichtbare vijfde wereld. */
(function () {
  'use strict';
  var b = document.body;
  if (!b || ['living', 'travel', 'work', 'foundation'].indexOf(b.getAttribute('data-rtg-world')) < 0) return;
  if (window.RTGRanden || window.__RTGRandenBoot || document.getElementById('rtgRandenJs') ||
      document.querySelector('script[src^="/shared/randen.js"],script[src^="../shared/randen.js"]')) return;
  var s = document.createElement('script');
  s.id = 'rtgRandenJs'; s.src = '/shared/randen.js'; s.async = true;
  (document.head || document.documentElement).appendChild(s);
}());
