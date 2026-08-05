/* RTG Horeca (scherm): de zaal -- open rekeningen, een regel erop, een gang
   vrijgeven, splitsen en afrekenen.

   Twee dingen die dit scherm expres laat zien en die in de meeste kassa's
   verstopt zitten: de LIJSTPRIJS naast de kortingsprijs (zodat een gast kan
   zien wat er van de kaart af ging), en bij het splitsen de som van de delen
   naast het totaal. Dat tweede is geen sier: het is de bewering die de server
   ook doet, en als hij hier niet klopt, klopt er iets niet. */
(function () {
  'use strict';
  var huidig = null;

  function $(id) { return document.getElementById(id); }
  var esc = function (t) { return window.RTGHoreca.esc(t); };
  var euro = function (c) { return window.RTGHoreca.euro(c); };
  var api = function (p, b) { return window.RTGHoreca.api(p, b); };
  var meld = function (t) { window.RTGHoreca.meld(t); };

  function laad() {
    api('/rekeningen', { status: 'open' }).then(function (r) {
      var d = r.body;
      if (d.error) return meld(d.error);
      $('zLijst').innerHTML = (d.rekeningen || []).map(function (x) {
        return '<div class="item"><span><b>' + esc(x.tafel || x.kanaal) + '</b>' +
          ' <span class="stil">· ' + x.regels + ' regel(s) · ' + x.gasten + ' gast(en)</span></span>' +
          '<span class="rij"><span class="stil">' + euro(x.totalen.netto) + '</span>' +
          '<button class="knop" data-open="' + esc(x.id) + '">Openen</button></span></div>';
      }).join('') || '<p class="stil">Er staat niets open.</p>';
      Array.prototype.forEach.call($('zLijst').querySelectorAll('[data-open]'), function (b) {
        b.addEventListener('click', function () { toon(b.dataset.open); });
      });
      if (huidig) toon(huidig, true);
    });
  }

  function toon(id, stil) {
    api('/rekening', { rekeningId: id }).then(function (r) {
      if (r.body.error) { huidig = null; $('zDetailKaart').hidden = true; if (!stil) meld(r.body.error); return; }
      var rek = r.body.rekening;
      huidig = rek.id;
      $('zDetailKaart').hidden = false;
      $('zDetailKop').textContent = (rek.tafel || rek.kanaal) + ' · ' + rek.gasten + ' gast(en)';
      $('zDetail').innerHTML = (rek.regels || []).map(function (x) {
        return '<div class="item"><span>' + x.aantal + '× ' + esc(x.naam) +
          (x.gang ? ' <span class="tag">gang ' + x.gang + '</span>' : '') +
          (x.station ? ' <span class="tag">' + esc(x.station) + '</span>' : '') +
          (x.allergie ? ' <span class="allergie">' + esc(x.allergie) + '</span>' : '') +
          (x.vrijAt ? ' <span class="tag aan">' + esc(x.stand) + '</span>' : ' <span class="tag">niet vrijgegeven</span>') +
          '</span><span class="stil">' + euro(x.centen * x.aantal) +
          (x.happy ? ' <span class="tag">' + esc(x.happy) + ', van ' + euro(x.lijstprijs) + '</span>' : '') +
          '</span></div>';
      }).join('') || '<p class="stil">Nog niets besteld.</p>';
      $('zDetail').insertAdjacentHTML('beforeend',
        '<div class="item"><span><b>Te betalen</b></span><span class="stil"><b>' + euro(rek.totalen.teBetalen) + '</b>' +
        (rek.totalen.korting ? ' (korting ' + euro(rek.totalen.korting) + ')' : '') +
        (rek.totalen.fooi ? ' · fooi ' + euro(rek.totalen.fooi) : '') + '</span></div>');
    });
  }

  function bind() {
    $('zOpen').addEventListener('click', function () {
      api('/rekening/open', { kanaal: $('zKanaal').value, tafel: $('zTafel').value.trim(),
        gasten: Number($('zGasten').value) || 1 }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('zTafel').value = '';
        huidig = r.body.rekening.id;
        laad();
      });
    });
    $('zRegel').addEventListener('click', function () {
      if (!huidig) return meld('Open eerst een rekening.');
      var naam = $('zNaam').value.trim();
      if (!naam) return meld('Wat wordt er besteld?');
      api('/rekening/regel', { rekeningId: huidig, naam: naam, prijs: Number($('zPrijs').value) || 0,
        aantal: Number($('zAantal').value) || 1, gang: Number($('zGang').value) || 0,
        station: $('zStation').value.trim(), allergie: $('zAllergie').value.trim() }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        $('zNaam').value = ''; $('zPrijs').value = ''; $('zAllergie').value = '';
        laad();
      });
    });
    $('zVrij').addEventListener('click', function () {
      if (!huidig) return meld('Open eerst een rekening.');
      api('/gang/vrij', { rekeningId: huidig, gang: Number($('zVrijGang').value) || 0,
        serveerOm: $('zServeerOm').value.trim() }).then(function (r) {
        meld(r.body.error || (r.body.vrijgegeven + ' regel(s) naar de keuken.'));
        if (!r.body.error) laad();
      });
    });
    $('zSplitsGa').addEventListener('click', function () {
      if (!huidig) return meld('Open eerst een rekening.');
      var n = Number($('zSplits').value) || 0;
      if (n < 2) return meld('In hoeveel delen?');
      api('/rekening/splits', { rekeningId: huidig, perPersoon: n }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        var som = (r.body.delen || []).reduce(function (t, d) { return t + d.totalen.netto; }, 0);
        meld('Gesplitst in ' + r.body.delen.length + ' delen, samen ' + euro(som) + '.');
        huidig = null;
        laad();
      });
    });
    $('zBetaal').addEventListener('click', function () {
      if (!huidig) return meld('Open eerst een rekening.');
      api('/betaal', { rekeningId: huidig, wijze: 'pin' }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld(r.body.gesloten ? 'Betaald en gesloten.' : 'Nog open: ' + euro(r.body.openstaand));
        if (r.body.gesloten) huidig = null;
        laad();
      });
    });
  }

  window.RTGHorecaZaal = { bind: bind, laad: laad };
})();
