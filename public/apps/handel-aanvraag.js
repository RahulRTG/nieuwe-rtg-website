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
    /* Twee ingangen, één formulier. De regels, het ophalen en het retour zijn
       voor allebei hetzelfde; alleen de kop verschilt -- een soort bedrijf en
       offertes, of een bekende zaak en een prijs die al vaststaat. */
    var modus = document.getElementById('hModus');
    var UITLEG = {
      aanvraag: 'Een aanvraag gaat naar een heel soort bedrijf, niet naar \u00e9\u00e9n adres. ' +
        'Elke zaak van dat soort ziet hem, ook een die zich gisteren heeft aangemeld. ' +
        'U kiest daarna zelf uit de offertes die binnenkomen.',
      bestelling: 'Bij een vaste leverancier met een afgesproken prijs is offreren een omweg. ' +
        'De bestelling gaat meteen naar die zaak; daarna loopt hij dezelfde weg: inplannen, ' +
        'leveren, factureren, betalen.'
    };
    function zetModus() {
      var best = modus.value === 'bestelling';
      document.getElementById('hGenre').style.display = best ? 'none' : '';
      document.getElementById('hZaak').style.display = best ? '' : 'none';
      document.getElementById('hPrijs').style.display = best ? '' : 'none';
      document.getElementById('hUitleg').textContent = UITLEG[modus.value];
      document.getElementById('hZet').textContent = best ? 'Bestelling plaatsen' : 'Aanvraag uitzetten';
    }
    modus.addEventListener('change', zetModus);
    zetModus();

    document.getElementById('hZet').addEventListener('click', function () {
      var best = modus.value === 'bestelling';
      RTGHandel.api(best ? '/bestellen' : '/aanvraag', {
        genre: document.getElementById('hGenre').value,
        leverancierCode: document.getElementById('hZaak').value,
        prijs: document.getElementById('hPrijs').value,
        titel: document.getElementById('hTitel').value,
        regels: regels,
        ophalen: document.getElementById('hOphalen').value,
        retour: document.getElementById('hRetour').value
      }).then(function () {
        RTGHandel.meld(best ? 'Bestelling geplaatst.' : 'Aanvraag uitgezet.');
        regels = []; tekenRegels();
        document.getElementById('hTitel').value = '';
        RTGHandel.laden();
      }).catch(function (err) { RTGHandel.meld(err.message); });
    });
    tekenRegels();
  };
})();
