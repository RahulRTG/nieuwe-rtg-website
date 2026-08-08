/* RTG Handel, deel "aanvraag": het formulier waarmee een zaak een aanvraag
   uitzet. Apart van handel.js omdat een productbestand niet over de 10 KB hoort
   (keuringsregel), en omdat dit het enige stuk is dat eigen tussenstand
   bijhoudt: de regels die nog niet zijn verstuurd. Draait op de schil die
   handel.js neerzet (window.RTGHandel). */
(function () {
  'use strict';
  var regels = [];   // de regels van de aanvraag in aanbouw

  function tekenRegels() {
    var el = document.getElementById('hRegels');
    if (!el) return;
    el.innerHTML = regels.length
      ? regels.map(function (r, i) {
        return '<div class="item"><span>' + RTGHandel.regelTekst(r) + '</span>' +
          '<button class="knop" type="button" data-weg="' + i + '">Weg</button></div>';
      }).join('')
      : '<p class="stil">Nog geen regels.</p>';
    Array.prototype.forEach.call(el.querySelectorAll('[data-weg]'), function (b) {
      b.addEventListener('click', function () { regels.splice(Number(b.dataset.weg), 1); tekenRegels(); });
    });
  }

  RTGHandel.formulier = function () {
    document.getElementById('hRegel').addEventListener('click', function () {
      var wat = document.getElementById('hWat'), aantal = document.getElementById('hAantal'),
        eenheid = document.getElementById('hEenheid');
      if (!wat.value.trim() || !(Number(aantal.value) > 0)) {
        RTGHandel.meld('Vul in wat u nodig heeft, en hoeveel.'); return;
      }
      regels.push({ wat: wat.value.trim(), aantal: Number(aantal.value), eenheid: eenheid.value });
      wat.value = ''; aantal.value = '';
      tekenRegels();
    });
    document.getElementById('hZet').addEventListener('click', function () {
      RTGHandel.api('/aanvraag', {
        genre: document.getElementById('hGenre').value,
        titel: document.getElementById('hTitel').value,
        regels: regels,
        ophalen: document.getElementById('hOphalen').value,
        retour: document.getElementById('hRetour').value
      }).then(function () {
        RTGHandel.meld('Aanvraag uitgezet.');
        regels = []; tekenRegels();
        document.getElementById('hTitel').value = '';
        RTGHandel.laden();
      }).catch(function (err) { RTGHandel.meld(err.message); });
    });
    tekenRegels();
  };
})();
