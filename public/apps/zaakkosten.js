/* RTG Kostprijs voor een ZAAK: wat het gebruik van deze zaak ons kost, en wie
   dat betaalt.

   Dezelfde drie routes als een lid, op de sessie van de zaak
   (server/routes/kosten.js). Het tekenwerk komt uit /shared/kostenbeeld.js en
   /shared/kostenketen.js: een zaak hoort exact hetzelfde beeld te zien als een
   lid, want het is hetzelfde antwoord van dezelfde kern.

   WAAROM DIT EEN EIGEN PAGINA IS en geen tab in de zaak-app: het is dezelfde
   weg die RTG Office, RTMAIL en RTG Handel daar al gaan -- een eigen adres op
   dezelfde zaak-inlog, bereikbaar vanuit "Alle functies". De zaak-app is een
   schil van vijftig delen; er een vijftigste bij hangen voor een scherm dat met
   geen enkel ander scherm daar iets deelt, zou hem alleen maar breder maken. */
(function (w, d) {
  'use strict';
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_sup_token'); } catch (e) { /* geen opslag */ }
  var K = w.RTGKosten;
  var $ = function (s) { return d.querySelector(s); };

  function api(pad, body) {
    return fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (TOKEN || '') },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) {
        if (!r.ok) throw new Error(b.error || 'Dat lukte niet.');
        return b;
      });
    });
  }

  /* De deur voor wie uitgelogd komt: dezelfde poort als /apps/handel.html
     gebruikt, zodat een medewerker niet op een leeg scherm belandt. */
  function poort() {
    if (TOKEN) return true;
    var naar = '/apps/personeel.html?terug=' + encodeURIComponent(location.pathname);
    if (!w.RTGDeur) { location.replace(naar); return false; }
    setTimeout(function () {
      w.RTGDeur.toon($('#main') || d.body, { soort: 'personeel', naar: naar });
    }, 0);
    return false;
  }

  function waarom(soort) {
    var vak = d.getElementById('ksKeten-' + soort);
    if (!vak) return;
    if (!vak.hidden) { vak.hidden = true; return; }
    vak.hidden = false;
    vak.innerHTML = '<div class="ks-stap">Laden...</div>';
    api('/api/supplier/kosten/herkomst', { soort: soort })
      .then(function (r) { vak.innerHTML = K.keten(r); })
      .catch(function (e) { vak.innerHTML = '<div class="ks-stap">' + K.esc(e.message) + '</div>'; });
  }

  function laad() {
    return api('/api/supplier/kosten').then(function (beeld) {
      /* De vooruitblik mag mislukken zonder het beeld mee te nemen: dat is een
         verwachting en geen feit. Wat er WEL is, hoort een lezer te zien. */
      return api('/api/supplier/kosten/vooruitblik').catch(function () { return null; })
        .then(function (vb) {
          $('#ksHoofd').innerHTML = K.hoofd(beeld, vb, beeld.grens, 'zaak');
          $('#ksRegels').innerHTML = K.regels(beeld);
          $('#ksBetaalt').innerHTML = K.betaalt(beeld);
          $('#ksNiet').innerHTML = K.niet(beeld);
        });
    }).catch(function (e) {
      $('#ksHoofd').innerHTML = '<p class="stil">' + K.esc(e.message) + '</p>';
    });
  }

  function start() {
    if (!poort()) return;
    K.stijl();
    d.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-waarom]');
      if (b) waarom(b.dataset.waarom);
    });
    laad();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
})(window, document);
