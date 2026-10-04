/* De gezinscode op het beheerscherm (B18).

   De gezinscode is sinds 4 oktober 2026 een 128-bit code die de server alleen
   als vingerafdruk bewaart (server/foundation/gezinscode.js). Hij staat dus
   precies een keer op een scherm: direct na het aanmaken van het gezin (dan zet
   index.html hem eenmalig in sessionStorage) of na "Nieuwe gezinscode". Daarna
   toont dit blok alleen de STAND -- sinds wanneer, tot wanneer, ingetrokken of
   niet -- en nooit de code zelf. Een gezin van voor B18 heeft nog geen
   gezinscode; de beheerder maakt er hier een, en de oude zes tekens openen niets.

   Eigen bestand, zoals beheer-sessies.js: beheer.html is al groot. */
(function (w, d) {
  var $ = function (q) { return d.querySelector(q); };
  function sessie() { return (w.Sessie && w.Sessie.huidig()) || null; }
  function datum(t) { try { return new Date(t).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return t; } }
  function toonCode(code) {
    $('#uCode').textContent = code || 'Verborgen';
    $('#uDeel').hidden = !code;
    $('#uDeel').onclick = function () {
      var knop = $('#uDeel');
      (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(function () {
        knop.textContent = 'Gekopieerd!'; setTimeout(function () { knop.textContent = 'Kopieer'; }, 1500);
      }, function () { w.alert('Gezinscode: ' + code); });
    };
  }
  function toonStand(st) {
    var el = $('#uStand'); if (!el || !st) return;
    if (st.stand === 'geen') el.textContent = 'Dit gezin heeft nog geen gezinscode. Maak er een; de oude code van zes tekens werkt niet meer.';
    else if (st.stand === 'actief') el.textContent = 'Actief sinds ' + datum(st.uitgegeven) + ', geldig tot ' + datum(st.geldigTot) + '.';
    else el.textContent = st.ingetrokken ? 'Ingetrokken op ' + datum(st.ingetrokken) + '. Maak een nieuwe om weer te kunnen inloggen.'
      : 'Deze gezinscode werkt niet meer. Maak een nieuwe.';
  }
  function laad() {
    var s = sessie(); if (!s || !s.code || !s.token) return;
    fetch('/api/foundation/gezin/' + encodeURIComponent(s.code) + '/gezinscode', { headers: { Authorization: 'Bearer ' + s.token } })
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (x) { if (x) toonStand(x.status); }, function () {});
  }
  function post(pad) {
    var s = sessie();
    return fetch('/api/foundation' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.token },
      body: JSON.stringify({ code: s.code }) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (x) { if (!r.ok) throw new Error(x.error || 'Er ging iets mis.'); return x; });
    });
  }
  function tuig() {
    if (!$('#uCode')) return;
    var nieuw = '';
    try { nieuw = w.sessionStorage.getItem('rtf_gezinscode_nieuw') || ''; w.sessionStorage.removeItem('rtf_gezinscode_nieuw'); } catch (e) {}
    if (nieuw) toonCode(nieuw);
    laad();
    $('#uNieuw').onclick = function () {
      if (!w.confirm('Een nieuwe gezinscode maken? De huidige werkt daarna niet meer; wie al is ingelogd blijft ingelogd.')) return;
      $('#uFout').textContent = '';
      post('/gezin/code/roteer').then(function (x) { toonCode(x.gezinscode); toonStand(x.status); },
        function (e) { $('#uFout').textContent = e.message; });
    };
    $('#uIntrek').onclick = function () {
      if (!w.confirm('De gezinscode intrekken? Niemand kan dan nog inloggen tot u een nieuwe maakt; wie al is ingelogd blijft ingelogd.')) return;
      $('#uFout').textContent = '';
      post('/gezin/code/intrek').then(function (x) { toonCode(''); toonStand(x.status); },
        function (e) { $('#uFout').textContent = e.message; });
    };
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', tuig); else tuig();
})(window, document);
