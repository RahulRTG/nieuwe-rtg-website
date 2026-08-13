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
    if (zaal) {
      window.RTGHorecaZaal.laad();
      // de verzoeken van gasten horen bij de zaal en laden dus met de zaal mee
      if (window.RTGHorecaVerzoeken) window.RTGHorecaVerzoeken.laad();
    } else window.RTGHorecaKeuken.laad();
  }

  /* EERST DE POORT, DAN PAS BINDEN. Deze drie regels stonden ervoor, en dat
     hield alleen zolang dit script als eerste poort() aanriep: zodra een ander
     script dat eerder deed, verving de deur #main voordat wij hier waren en was
     tabZaal null. Een volgorde-afhankelijkheid die je pas ziet als iemand er
     een script bij zet. Achter een deur valt er ook niets te bedienen. */
  if (!window.RTGHoreca.poort()) return;

  var arrival = document.querySelector('.ia-host');
  if (arrival && !arrival.id) arrival.id = 'arrival';

  /* Rol-focus verandert alleen de werkruimte, nooit de bevoegdheden. De server
     blijft ieder managerbesluit zelf controleren. */
  window.RTGHoreca.api('/supplier/state', {}).then(function (r) {
    var actor = r.body && r.body.actor || {};
    var func = String(actor.func || actor.role || 'service').toLowerCase();
    var target = func.match(/chef|keuken|kok|pas/) ? 'kitchen' : func.match(/host|recept|ontvang/) ? 'arrival' : func.match(/bedien|bar|zaal|service/) ? 'floor' : 'main';
    document.body.dataset.hqRole = actor.manager ? 'manager' : 'staff';
    document.body.dataset.hqFunc = func;
    var top = document.querySelector('.hq-top>section');
    if (top) {
      var badge = document.createElement('button');
      badge.type = 'button'; badge.className = 'knop hq-role';
      badge.textContent = (actor.func || (actor.manager ? 'Manager' : 'Service')) + ' · Mijn werkruimte';
      badge.addEventListener('click', function () { var el = document.getElementById(target); if (el) el.scrollIntoView({behavior:'smooth', block:'start'}); });
      top.insertBefore(badge, top.lastElementChild);
    }
  }).catch(function () {});

  document.getElementById('tabZaal').addEventListener('click', function () { tab('zaal'); });
  document.getElementById('tabKeuken').addEventListener('click', function () { tab('keuken'); });
  document.getElementById('ververs').addEventListener('click', function () {
    tab(document.getElementById('vZaal').hidden ? 'keuken' : 'zaal');
  });

  window.RTGHorecaZaal.bind();
  window.RTGHorecaKeuken.bind();
  tab('zaal');
})();
