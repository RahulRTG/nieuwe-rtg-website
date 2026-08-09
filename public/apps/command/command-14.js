/* RTG Command, deel 14: de overname.

   HET SCHERM LOOPT IN DE VOLGORDE VAN DE MOTOR: inlezen, afbeelden, droogloop,
   uitvoeren. Die volgorde is de veiligheid, dus hij staat ook zo op het scherm
   in plaats van als vier losse knoppen naast elkaar.

   HET ZEGEL STAAT OP DE KNOP. "Uitvoeren met zegel a1b2c3" is geen sier: het
   zegel hoort bij precies de droogloop die eronder staat. Verandert de partij
   of de afbeelding, dan past het niet meer en weigert de server -- zodat je
   nooit het ene rapport goedkeurt en iets anders importeert. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  C.TEKENAARS.overname = function (el) {
    el.innerHTML = '<h2 class="ckop">Overname</h2>' +
      '<p class="lead">De administratie van een overgenomen bedrijf inlezen, in vier stappen waarvan de ' +
      'volgorde de veiligheid is. Uitvoeren kan alleen met het zegel van precies de droogloop die je hebt ' +
      'bekeken, en er wordt nooit iets overschreven.</p>' +
      '<div id="ovUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('overname').then(function (d) {
        var u = '<div class="kaart"><h3>Nieuwe partij inlezen</h3>' +
          '<div class="crij"><input class="veld" id="ovN" placeholder="naam van de partij" style="width:14rem;">' +
          '<select class="veld" id="ovS">' + d.soorten.map(function (s2) {
            return '<option value="' + esc(s2.type) + '">' + esc(s2.label) + ' (sleutel: ' + esc(s2.sleutel) + ')</option>';
          }).join('') + '</select></div>' +
          '<label class="lb" for="ovR">De rijen, als JSON-lijst</label>' +
          '<textarea class="veld" id="ovR" placeholder=\'[{"ID":"X1","Naam":"Zaak Een"}]\'></textarea>' +
          '<div class="crij"><button class="knop vol" id="ovGa">Inlezen</button></div>' +
          '<p class="meta">' + esc(d.uitleg) + '</p></div>';

        for (var i = 0; i < d.partijen.length; i++) u += partij(d.partijen[i]);
        document.querySelector('#ovUit').innerHTML = u;

        document.querySelector('#ovGa').onclick = function () {
          var rijen;
          try { rijen = JSON.parse(document.querySelector('#ovR').value || '[]'); }
          catch (e) { return C.meld('Dat is geen geldige JSON.'); }
          api('overname/lees', { naam: document.querySelector('#ovN').value,
            soort: document.querySelector('#ovS').value, rijen: rijen })
            .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        hang('data-ovd', function (id) { return api('overname/droogloop', { id: id }).then(teken); });
        hang('data-ovt', function (id) { return api('overname/terug', { id: id }).then(teken); });
        Array.prototype.forEach.call(document.querySelectorAll('[data-ova]'), function (b) {
          b.onclick = function () {
            var id = b.getAttribute('data-ova');
            var a = document.querySelector('#ova-' + id).value;
            var afb;
            try { afb = JSON.parse(a || '{}'); } catch (e) { return C.meld('Dat is geen geldige JSON.'); }
            api('overname/afbeelden', { id: id, afbeelding: afb })
              .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
          };
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-ovv]'), function (b) {
          b.onclick = function () {
            api('overname/voer', { id: b.getAttribute('data-ovv'), zegel: b.getAttribute('data-zegel'),
              reden: 'overname via het scherm' })
              .then(function () { teken(); }).catch(function (e) { if (!e.stil) C.meld(e.message); });
          };
        });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#ovUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }

    function partij(p) {
      var u = '<div class="kaart"><h3>' + esc(p.naam) + ' <span class="meta">' + esc(p.soort) + ' · ' +
        p.rijen + ' rijen · ' + esc(p.stand) + '</span></h3>';
      u += '<label class="lb" for="ova-' + esc(p.id) + '">Afbeelding: ons veld naar hun veld</label>' +
        '<div class="crij"><input class="veld" id="ova-' + esc(p.id) + '" style="width:22rem;" value=\'' +
        esc(JSON.stringify(p.afbeelding || {})) + '\'>' +
        '<button class="knop" data-ova="' + esc(p.id) + '">Afbeelden</button>' +
        '<button class="knop" data-ovd="' + esc(p.id) + '">Droogloop</button></div>';
      if (p.rapport) {
        u += '<div class="rooster">' +
          tegel('Gaat erin', p.rapport.erin, 'groen', 'van ' + p.rapport.aangeboden + ' aangeboden') +
          tegel('Gaat er niet in', p.rapport.mis, p.rapport.mis ? 'gold' : '', 'met een reden per rij') +
          '</div>' +
          (p.rapport.misVoorbeelden.length ? '<div class="schuif"><table class="ctab"><thead><tr><th>Regel</th><th>Sleutel</th><th>Waarom niet</th></tr></thead><tbody>' +
            p.rapport.misVoorbeelden.map(function (m) {
              return '<tr><td>' + m.regel + '</td><td>' + esc(m.sleutel || '') + '</td><td class="meta">' +
                esc(m.waarom) + '</td></tr>';
            }).join('') + '</tbody></table></div>' : '');
        if (!p.uitgevoerd) {
          u += '<div class="crij"><button class="knop vol" data-ovv="' + esc(p.id) + '" data-zegel="' +
            esc(p.rapport.zegel) + '">Uitvoeren met zegel ' + esc(p.rapport.zegel) + '</button></div>';
        }
      }
      if (p.uitgevoerd) {
        u += '<p class="meta">Uitgevoerd op ' + esc(p.uitgevoerd.at) + ' door ' + esc(p.uitgevoerd.door) +
          ': ' + p.uitgevoerd.erin + ' rijen erin.</p>' +
          '<div class="crij"><button class="knop" data-ovt="' + esc(p.id) + '">Terugdraaien</button></div>';
      }
      return u + '</div>';
    }
    function hang(attr, doe) {
      Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) {
        b.onclick = function () { doe(b.getAttribute(attr)).catch(function (e) { if (!e.stil) C.meld(e.message); }); };
      });
    }
  };


  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.WERKPLEKKEN.push({ id: 'overname', naam: 'Overname', sec: 'Doen' });
  void S;
})();
