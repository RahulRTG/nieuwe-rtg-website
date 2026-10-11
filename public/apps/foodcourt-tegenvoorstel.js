/* Wat het LID ziet van een tegenvoorstel (kern/ervaring/tafeluitzondering.js,
   CONCIERGE.md par. 2.7-2.9). Een restaurant kan zeggen "niet om 20:00, wel om
   21:15, en die houden wij een kwartier voor u vast". Het lid kreeg daarvan een
   melding, maar had nergens een knop om ja of nee te zeggen. Hier staat hij, op
   de Food Court (eigenaar van horeca.reserveren in SCHERMEIGENAAR.json), boven de
   lijst restaurants -- alleen als er iets ligt.

   Het lid ziet de nieuwe tijd, de gevraagde tijd en tot wanneer de tafel wordt
   vastgehouden; NIET wie het besloot (regel 4 van tafeluitzondering.js). Of het
   voorstel nog geldt, beslist de server: een verlopen voorstel wordt daar
   geweigerd, ook als het scherm het nog toont.

   Gebruikt de globale helpers van foodcourt.html (esc, api, meld, TOKEN). */
(function () {
  'use strict';
  var plek = document.getElementById('tvLijst');
  if (!plek || typeof TOKEN === 'undefined' || !TOKEN) return;
  var klok = function (iso) { var t = Date.parse(iso); return Number.isFinite(t) ? new Date(t).toTimeString().slice(0, 5) : ''; };

  async function teken() {
    var d;
    try { d = await api('/api/reserveringen/mijn'); } catch (e) { plek.innerHTML = ''; return; }
    var open = (d.reserveringen || []).filter(function (r) { return r.status === 'tegenvoorstel' && r.tegenvoorstel; });
    if (!open.length) { plek.innerHTML = ''; return; }
    plek.innerHTML = '<h2 class="night-title">Een andere tijd voor u</h2>' + open.map(function (r) {
      var verlopen = !(Date.parse(r.tegenvoorstel.geldigTot) > Date.now());
      return '<div class="tv-rij" data-tv="' + esc(r.id) + '"><p><b>' + esc(r.supplierName || 'Het restaurant') + '</b> · ' + esc(r.datum)
        + ' · ' + esc(r.personen) + ' personen<br>Om ' + esc(r.gevraagdeTijd) + ' lukt het niet. Wel om <b>' + esc(r.tijd) + '</b>'
        + (verlopen ? '. Dit voorstel is verlopen: de tafel wordt niet meer vastgehouden.'
          : '; die tafel wordt tot ' + esc(klok(r.tegenvoorstel.geldigTot)) + ' voor u vastgehouden.') + '</p>'
        + (verlopen ? '' : '<button type="button" class="terug js-tv-ja">Ja, om ' + esc(r.tijd) + '</button> ')
        + '<button type="button" class="terug js-tv-nee">Nee, dank u</button></div>';
    }).join('');
    plek.querySelectorAll('[data-tv]').forEach(function (rij) {
      var id = rij.dataset.tv;
      var antwoord = async function (akkoord, knop) {
        knop.disabled = true;
        try {
          var r = await api('/api/reservering/tegenvoorstel', { id: id, akkoord: akkoord });
          meld(akkoord ? 'Uw tafel om ' + r.reservering.tijd + ' is bevestigd.' : 'Doorgegeven: u komt niet op de andere tijd.');
        } catch (e) { meld(e.message); }
        teken();
      };
      var ja = rij.querySelector('.js-tv-ja'); if (ja) ja.addEventListener('click', function () { antwoord(true, ja); });
      var nee = rij.querySelector('.js-tv-nee'); nee.addEventListener('click', function () { antwoord(false, nee); });
    });
  }
  teken();
})();
