/* RTG Command, deel 16: de steden en het alarm.

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
          '<input class="veld mid" id="stN" placeholder="naam">' +
          '<input class="veld smal" id="stL" placeholder="landcode (bv. NL)">' +
          '<input class="veld kort" id="stLat" placeholder="lat" aria-label="breedtegraad">' +
          '<input class="veld kort" id="stLng" placeholder="lng" aria-label="lengtegraad">' +
          '<button class="knop vol" id="stGa">Starten</button></div>' +
          '<p class="meta">Het landpakket van dat land moet aanstaan. Met een middelpunt bouwt de start ' +
          'ook meteen het weefsel: zes zones met hun straatsegmenten. Zonder middelpunt staat de ' +
          'administratie er wel en blijft die stap open.</p></div>';

        for (var i = 0; i < d.steden.length; i++) {
          var s2 = d.steden[i];
          u += '<div class="kaart"><h3>' + esc(s2.naam) + ' <span class="meta">' + esc(s2.land) + '</span></h3>' +
            s2.stappen.map(function (p) {
              return '<div class="lijn"><b>' + esc(p.stap) + '</b> <span class="cniveau ' +
                (p.gedaan ? 'ok' : 'onbekend') + '">' + (p.gedaan ? 'gedaan' : 'staat open') + '</span>' +
                '<div class="meta">' + esc(p.uitleg) + '</div></div>';
            }).join('') +
            '<div class="crij" class="mt"><button class="knop" data-stweg="' + esc(s2.naam) +
            '">Stoppen</button></div></div>';
        }
        document.querySelector('#stUit').innerHTML = u;
        document.querySelector('#stGa').onclick = function () {
          api('stad/start', { naam: document.querySelector('#stN').value,
            land: document.querySelector('#stL').value,
            lat: Number(document.querySelector('#stLat').value) || null,
            lng: Number(document.querySelector('#stLng').value) || null })
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

  /* HET ALARM. Hij hoort bij "Zien" en bovenaan, want een alarm dat je moet
     opzoeken is geen alarm. */
  C.TEKENAARS.alarm = function (el) {
    el.innerHTML = '<h2 class="ckop">Alarm</h2>' +
      '<p class="lead">Een SLO zonder alarm is een rapportcijfer achteraf. Deze piep meet niets zelf: ' +
      'elke controle leest een laag die er al is. En hij gaat af bij het ONTSTAAN en bij het OPLOSSEN, ' +
      'niet elke ronde -- een melding die steeds terugkomt leert mensen om hem weg te klikken.</p>' +
      '<div id="alUit"><div class="leeg">Meten…</div></div>';
    teken();

    function teken() {
      api('alarm').then(function (d) {
        var u = '<div class="rooster">' +
          tegel('Actief', d.tel.actief, d.tel.actief ? 'acc' : 'groen', d.tel.hoog + ' met ernst hoog') +
          tegel('Stilgezet', d.tel.stil, d.tel.stil ? 'gold' : '', 'tijdelijk, met een reden in het journaal') +
          '</div>';
        u += '<div class="kaart"><h3>Waar dit alarm uitkomt</h3><ul>' +
          d.uitgangen.map(function (x) { return '<li class="meta">' + esc(x) + '</li>'; }).join('') +
          '</ul><p class="meta">' + esc(d.let) + '</p></div>';

        if (!d.alarmen.length) u += '<div class="kaart"><p>Geen enkele bevinding.</p></div>';
        for (var i = 0; i < d.alarmen.length; i++) {
          var a = d.alarmen[i];
          var stil = a.stilTot && Date.parse(a.stilTot) > Date.now();
          u += '<div class="lijn"><b>' + esc(a.naam) + '</b> ' +
            '<span class="cniveau ' + (a.actief ? (a.ernst === 'hoog' ? 'mis' : 'onbekend') : 'ok') + '">' +
            (a.actief ? esc(a.ernst) : 'opgelost') + '</span>' +
            (stil ? ' <span class="meta">stil tot ' + esc(a.stilTot) + '</span>' : '') +
            '<div class="meta">' + esc(a.wat) + ' · sinds ' + esc(a.sinds) + '</div>' +
            (a.actief && !stil ? '<div class="crij"><button class="knop" data-alstil="' + esc(a.id) +
              '">8 uur stilzetten</button></div>' : '') + '</div>';
        }
        document.querySelector('#alUit').innerHTML = u;
        hang('data-alstil', function (id) {
          return api('alarm/stil', { id: id, uren: 8, reden: 'stilgezet vanaf het scherm' }).then(teken);
        });
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#alUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.WERKPLEKKEN.unshift({ id: 'alarm', naam: 'Alarm', sec: 'Zien',
    teller: function (s) { return s.start && s.start.alarm ? s.start.alarm.actief : 0; } });
  C.WERKPLEKKEN.push({ id: 'stad', naam: 'Steden', sec: 'Besturen' });
  void S;
})();
