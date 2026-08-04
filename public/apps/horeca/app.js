/* RTG Horeca (scherm): de bedrading. Twee weergaven op een pagina -- de zaal
   en de keuken -- want dat zijn de twee schermen die de dienst dragen. De rest
   van het Horeca OS (bezorgzones, club, folio, events, HACCP, dagbeeld) is
   beheer en hoort in de leverancier-app, niet op het scherm waar iemand tijdens
   de spits naar kijkt.

   De sessie is de gewone zaak-inlog (`rtg_sup_token`, net als de kassa). Wie
   uitgelogd komt, krijgt de gedeelde deur op deze pagina zelf te zien in plaats
   van een omleiding die kwijtraakt waar hij heen wilde (TAKEN 5.5). */
(function () {
  'use strict';
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_sup_token'); } catch (e) {}

  window.RTGHoreca = {
    esc: function (t) {
      return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    },
    euro: function (c) { return '€ ' + ((c || 0) / 100).toFixed(2); },
    meld: function (t) {
      var m = document.getElementById('melding');
      if (!m) return;
      m.textContent = t; m.classList.add('zie');
      clearTimeout(window.RTGHoreca._t);
      window.RTGHoreca._t = setTimeout(function () { m.classList.remove('zie'); }, 3000);
    },
    api: function (pad, body) {
      return fetch('/api/supplier/horeca' + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
        body: JSON.stringify(body || {}) })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
        });
    }
  };

  function uitgelogd() {
    var naar = '/apps/personeel.html?terug=' + encodeURIComponent(location.pathname);
    if (!window.RTGDeur) { location.replace(naar); return; }
    setTimeout(function () {
      var el = document.getElementById('main') || document.body;
      RTGDeur.toon(el, { soort: 'personeel', naar: naar });
    }, 0);
  }

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

  if (!TOKEN) { uitgelogd(); return; }
  window.RTGHorecaZaal.bind();
  window.RTGHorecaKeuken.bind();
  tab('zaal');
})();
