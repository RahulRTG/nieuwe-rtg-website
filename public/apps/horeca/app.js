/* RTG Horeca (scherm): de bedrading van het dienstscherm. Twee weergaven op een
   pagina -- de zaal en de keuken -- want dat zijn de twee schermen die tijdens
   de spits open staan. De rest van het Horeca OS heeft zijn eigen pagina's
   (expeditie, bezorging, hotel, events, club, HACCP, beheer).

   De sessie, de API en de deur komen uit horeca/kern.js. */
(function () {
  'use strict';
  function tab(welke) {
    var zaal = welke === 'zaal';
    document.getElementById('vZaal').hidden = !zaal;
    document.getElementById('vKeuken').hidden = zaal;
    document.getElementById('tabZaal').setAttribute('aria-selected', zaal ? 'true' : 'false');
    document.getElementById('tabKeuken').setAttribute('aria-selected', zaal ? 'false' : 'true');
    if (zaal) window.RTGHorecaZaal.laad(); else window.RTGHorecaKeuken.laad();
  }

  document.getElementById('tabZaal').addEventListener('click', function () { tab('zaal'); });
  document.getElementById('tabKeuken').addEventListener('click', function () { tab('keuken'); });
  document.getElementById('ververs').addEventListener('click', function () {
    tab(document.getElementById('vZaal').hidden ? 'keuken' : 'zaal');
  });

  if (!window.RTGHoreca.poort()) return;
  window.RTGHorecaZaal.bind();
  window.RTGHorecaKeuken.bind();
  tab('zaal');
})();
