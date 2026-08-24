/* RTG Horeca (scherm): VUUR -- het stationsbord en de regie.

   VIER DINGEN STAAN HIER BEWUST ZO, en drie ervan komen uit een meting.

   1. DE ALLERGIE. Die krijgt een eigen, omkaderd label op elke bon. Niet omdat
      het mooi staat, maar omdat een kok die scant over een lijst hem anders mist.

   2. DE TIJD MET ZIJN NORM. Er staat "14 van 12 min" en niet alleen een kleur;
      wie een oranje bon ziet, hoort te weten hoeveel te laat hij is. De kleur
      volgt uit het getal, nooit andersom.

   3. DE BAAN, EN WANNEER HET AAN MOET. Nieuw, en het is het hele verschil
      tussen registreren en regisseren (HORECA.md): het bord rekende vooruit
      ("deze bon loopt al 14 minuten") en zegt nu ook terug ("aanzetten om
      19:26, want de gang staat om 19:42 op tafel"). Die som komt uit
      kern/horeca/cadans.js en staat op de bon, zodat een kok hem kan narekenen.

   4. HET BORD VERVERST ZICHZELF, EN GOOIT DE KOK NIET KWIJT WAAR HIJ WAS.
      Dit stond hier fout, en het was gemeten fout:
      - Het bord ververste alleen op een tik op "Toon". Twintig seconden na een
        vrijgegeven gerecht stond het er nog niet op. Nu luistert het naar de
        duwstroom die de server al stuurde (`scope: 'keuken'`), met een trage
        terugval als die stroom wegvalt.
      - Elke verversing verving `kBord.innerHTML` in zijn geheel. Op een bord
        van tachtig bonnen sprong de scrollpositie daardoor 5.182 pixels weg --
        ruim zes schermen -- bij elke tik op een statusknop. Nu wordt een
        bestaande bon BIJGEWERKT in plaats van opnieuw gemaakt, en verankert de
        verversing zich aan de bovenste zichtbare bon. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = function (t) { return K.esc(t); };
  var api = function (p, b) { return K.api(p, b); };
  var meld = function (t) { K.meld(t); };
  var bezig = false;
  /* Hoe een bon eruitziet, staat in ./keuken-bon.js -- zie de kop daar voor
     waarom die naad daar ligt. Dit bestand gaat over hoe het BORD zich
     gedraagt. */
  var inhoud = function (b) { return window.RTGHorecaKeukenBon.inhoud(b); };
  var klokje = function (iso) { return window.RTGHorecaKeukenBon.klokje(iso); };

  function bindBon(el) {
    K.bind(el, 'stand', function (b) {
      if (bezig) return;
      bezig = true;
      api('/keuken/stand', { rekeningId: b.dataset.rek, regelId: b.dataset.regel, stand: b.dataset.stand })
        .then(function (r) {
          bezig = false;
          if (r.body.error) return meld(r.body.error);
          laad();
        }, function () { bezig = false; });
    });
  }

  /* De scroller is de schil van het Horeca OS; buiten die schil is het de
     pagina zelf. Zonder deze anker-stap verspringt het bord alsnog zodra er een
     bon bij komt of af gaat boven de plek waar de kok kijkt. */
  function scroller() {
    return document.querySelector('.hq-stage') || document.scrollingElement || document.body;
  }
  function anker() {
    var bonnen = $('kBord').querySelectorAll('.bon');
    for (var i = 0; i < bonnen.length; i++) {
      var r = bonnen[i].getBoundingClientRect();
      if (r.bottom > 0) return { id: bonnen[i].getAttribute('data-regel'), top: r.top };
    }
    return null;
  }
  function herstel(a) {
    if (!a) return;
    var el = $('kBord').querySelector('[data-regel="' + a.id.replace(/"/g, '\\"') + '"]');
    if (!el) return;
    var delta = el.getBoundingClientRect().top - a.top;
    if (delta) scroller().scrollTop += delta;
  }

  function teken(d) {
    var bord = $('kBord');
    var a = anker();
    var gezien = {};

    if (!d.bonnen || !d.bonnen.length) {
      bord.innerHTML = '<div class="kaart"><p class="stil">Het bord is leeg. De keuken ziet alleen wat de zaal heeft vrijgegeven.</p></div>';
      return;
    }
    if (bord.querySelector('.kaart')) bord.innerHTML = '';  // de lege staat weg

    var vorige = null;
    d.bonnen.forEach(function (b) {
      gezien[b.regelId] = true;
      var el = bord.querySelector('[data-regel="' + String(b.regelId).replace(/"/g, '\\"') + '"]');
      if (!el) {
        el = document.createElement('div');
        el.className = 'bon';
        el.setAttribute('data-regel', b.regelId);
      }
      el.setAttribute('data-baan', b.baan || '');
      el.innerHTML = inhoud(b);
      bindBon(el);
      // op de goede plek zetten; staat hij er al, dan verplaatst dit niets
      var naar = vorige ? vorige.nextSibling : bord.firstChild;
      if (el !== naar) bord.insertBefore(el, naar);
      vorige = el;
    });

    Array.prototype.slice.call(bord.querySelectorAll('.bon')).forEach(function (el) {
      if (!gezien[el.getAttribute('data-regel')]) el.remove();
    });
    herstel(a);
  }

  function laad() {
    var station = $('kStation').value.trim();
    api('/keuken/bord', station ? { station: station } : {}).then(function (r) {
      var d = r.body;
      if (d.error) return meld(d.error);
      var banen = d.banen || {};
      $('kTelling').textContent = d.aantal + ' op het bord' +
        (banen.nu ? ' · ' + banen.nu + ' nu' : '') +
        (banen.hierna ? ' · ' + banen.hierna + ' hierna' : '') +
        (banen.wacht ? ' · ' + banen.wacht + ' wacht' : '') +
        (banen.risico ? ' · ' + banen.risico + ' risico' : '') +
        (d.teLaat ? ' · ' + d.teLaat + ' te laat' : '');
      teken(d);
    });

    api('/keuken/regie', {}).then(function (r) {
      var d = r.body;
      if (d.error) return;
      $('kRegie').innerHTML = (d.tafels || []).map(function (t) {
        return '<div class="item"><span><b>' + esc(t.tafel || t.kanaal) + '</b> <span class="stil">· gang ' + t.gang +
          ' · ' + t.klaar + ' van ' + t.totaal + ' klaar' + (t.laatste ? ' · laatste: ' + esc(t.laatste.naam) + ' (' + esc(t.laatste.station) + ')' : '') + '</span>' +
          (t.allergieen.length ? ' <span class="allergie">' + t.allergieen.map(esc).join(', ') + '</span>' : '') + '</span>' +
          '<span class="tag' + (t.gereed ? ' aan' : (t.staatKoud ? ' laat' : '')) + '">' +
          (t.gereed ? 'gereed' : (t.staatKoud ? t.staatKoud + ' min koud' : 'loopt')) + '</span></div>';
      }).join('') || '<p class="stil">Niets onderhanden.</p>';
    });

    api('/autopilot', {}).then(function (r) {
      var d = r.body; if (d.error) return;
      $('kAutoRahul').textContent = d.rahul;
      $('kAutoStations').innerHTML = (d.stations || []).map(function (s) {
        return '<div class="item"><span><b>' + esc(s.station) + '</b><span class="stil"> · ' + s.nu + ' nu · ' + s.hierna + ' hierna</span></span><button class="knop" data-autost="' + esc(s.station) + '">Open station</button></div>';
      }).join('') || '<p class="stil">Geen vrijgegeven werk. Gebruik dit moment voor gecontroleerde mise-en-place.</p>';
      K.bind($('kAutoStations'), 'autost', function (b) { $('kStation').value = b.dataset.autost; laad(); });
    });
  }

  function bind() {
    $('kToon').addEventListener('click', laad);
    /* De keuken luistert mee. `scope` is leeg bij een terugval, dus die haalt
       alles op; een gerichte duw op 'keuken' haalt alleen dit bord op. */
    K.luister('keuken', function () { if (!document.hidden) laad(); });
  }

  window.RTGHorecaKeuken = { bind: bind, laad: laad };
})();
