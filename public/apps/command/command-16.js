/* RTG Command, deel 16: de steden.

   HET SCHERM TOONT PER STAP OF HIJ GEDAAN IS, en er staat er bewust een tussen
   die dat NOOIT wordt: het stadsweefsel draagt vandaag een geografie zonder
   sleutel "welke stad". Een tweede stad met eigen zones en Stadsdozen is een
   verbouwing van die laag.

   Dat had een groen vinkje kunnen zijn. Dan start iemand Antwerpen, ziet
   "ingericht", en ontdekt een maand later dat elke meting in de zones van de
   eerste stad is geboekt. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  C.TEKENAARS.stad = function (el) {
    el.innerHTML = '<h2 class="ckop">Steden</h2>' +
      '<p class="lead">Een stad inrichten. De stand is met opzet eerlijker dan de knop: "gestart" betekent ' +
      'dat de administratie klaarstaat, niet dat de stad draait.</p>' +
      '<div id="stUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('stad').then(function (d) {
        var u = '<div class="kaart"><h3>Wat een knop hier niet kan</h3><p>' + esc(d.let) + '</p></div>' +
          '<div class="kaart"><h3>Nieuwe stad</h3><div class="crij">' +
          '<input class="veld" id="stN" placeholder="naam" style="width:12rem;">' +
          '<input class="veld" id="stL" placeholder="landcode (bv. NL)" style="width:8rem;">' +
          '<button class="knop vol" id="stGa">Starten</button></div>' +
          '<p class="meta">Het landpakket van dat land moet aanstaan.</p></div>';

        for (var i = 0; i < d.steden.length; i++) {
          var s2 = d.steden[i];
          u += '<div class="kaart"><h3>' + esc(s2.naam) + ' <span class="meta">' + esc(s2.land) + '</span></h3>' +
            s2.stappen.map(function (p) {
              return '<div class="lijn"><b>' + esc(p.stap) + '</b> <span class="cniveau ' +
                (p.gedaan ? 'ok' : 'onbekend') + '">' + (p.gedaan ? 'gedaan' : 'staat open') + '</span>' +
                '<div class="meta">' + esc(p.uitleg) + '</div></div>';
            }).join('') +
            '<div class="crij" style="margin-top:.7rem;"><button class="knop" data-stweg="' + esc(s2.naam) +
            '">Stoppen</button></div></div>';
        }
        document.querySelector('#stUit').innerHTML = u;
        document.querySelector('#stGa').onclick = function () {
          api('stad/start', { naam: document.querySelector('#stN').value,
            land: document.querySelector('#stL').value })
            .then(teken).catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
        hang('data-stweg', function (n) { return api('stad/stop', { naam: n }).then(teken); });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#stUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };


  function hang(attr, doe) {
    Array.prototype.forEach.call(document.querySelectorAll('[' + attr + ']'), function (b) {
      b.onclick = function () { doe(b.getAttribute(attr)).catch(function (e) { if (!e.stil) C.meld(e.message); }); };
    });
  }

  C.WERKPLEKKEN.push({ id: 'stad', naam: 'Steden', sec: 'Besturen' });
  void S;
})();
