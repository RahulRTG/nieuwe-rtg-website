/* DE INVOERBALIE (REIZEN.md fase 2), op het RTG Design System.

   Stond als inline script in reizen.html; het gedrag is gelijk. Twee knoppen,
   en het verschil ertussen is het hele ontwerp: "Lees voor" maakt een VOORSTEL
   en verandert niets aan uw reizen; pas "Voeg toe" maakt er een onderdeel van.
   Wat de lezer eruit haalde staat er per veld bij, waaruit en hoe zeker, en
   wat onder de drempel bleef staat als na te kijken gemarkeerd.

   De zekerheden komen van de server en gaan er nooit heen: dit scherm stuurt
   alleen wat een mens intikt. */
(function (w, d) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var $ = R.$;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g,
    function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var api = function (pad, body) { return R.api('/api/reis/' + pad, body); };
  var VELDNAAM = { soort: 'Soort', titel: 'Naam', bestemming: 'Bestemming', van_datum: 'Van',
    tot_datum: 'Tot', kenmerk: 'Kenmerk', vlucht: 'Vlucht', van: 'Vertrek vanaf', naar: 'Aankomst op',
    reiziger: 'Reiziger', stoel: 'Stoel' };
  var SOORTEN = ['vlucht', 'verblijf', 'vervoer', 'transfer', 'activiteit', 'tafel', 'evenement', 'spoor'];
  var BESTAND = null, VOORSTEL = null, DREMPEL = 0.85;

  /* Na een wijziging tellen drie vakken mee: het register, de balie, de wacht. */
  function ververs() {
    if (R.register) R.register.laad();
    laadMijnInvoer();
    if (R.laadWacht) R.laadWacht();
  }

  $('#invKies').addEventListener('click', function () { $('#invBestand').click(); });
  $('#invBestand').addEventListener('change', function () {
    var f = $('#invBestand').files[0];
    if (!f) { BESTAND = null; $('#invBestandNaam').textContent = ''; return; }
    var lezer = new FileReader();
    lezer.onload = function () { BESTAND = { naam: f.name, dataUrl: String(lezer.result) }; $('#invBestandNaam').textContent = f.name; };
    lezer.onerror = function () { BESTAND = null; $('#invBestandNaam').textContent = 'Dat bestand kon niet gelezen worden.'; };
    lezer.readAsDataURL(f);
  });

  $('#invLees').addEventListener('click', function () {
    var knop = $('#invLees');
    knop.disabled = true;
    $('#invUit').innerHTML = '<p class="ds-meta">Lezen...</p>';
    api('invoer/lees', Object.assign({ tekst: $('#invTekst').value }, BESTAND || {})).then(function (dt) {
      VOORSTEL = dt.voorstel; DREMPEL = dt.drempel || DREMPEL;
      tekenVoorstel(dt);
    }).catch(function (e) { $('#invUit').innerHTML = '<p class="ds-meta">' + esc(e.message) + '</p>'; })
      .then(function () { knop.disabled = false; });
  });

  function veldje(id, label, waarde) {
    return '<label class="ds-veldlabel" for="' + id + '">' + esc(label) +
      '<input class="ds-invoer" id="' + id + '" value="' + esc(waarde || '') + '" maxlength="120"></label>';
  }

  /* Eerst WAT ER GELEZEN IS met de onderbouwing, daarna pas de velden: wie
     eerst een ingevuld formulier ziet, leest de herkomst niet meer. */
  function tekenVoorstel(dt) {
    var velden = dt.voorstel.velden || {}, namen = Object.keys(velden);
    var gelezen = namen.length ? '<ul class="ds-lijst">' + namen.map(function (n) {
      var f = velden[n], onzeker = f.zekerheid < DREMPEL;
      return '<li class="ds-lijst__rij"><span></span><span><span class="ds-lijst__titel" data-gelezen>' + esc(VELDNAAM[n] || n) + ': ' +
        esc(String(f.waarde)) + (onzeker ? ' <span data-na-te-kijken>&middot; na te kijken</span>' : '') + '</span>' +
        '<span class="ds-lijst__tekst">' + esc(f.uitleg) + '</span></span><span></span></li>';
    }).join('') + '</ul>' : '<p class="ds-meta">Wij konden er niets uit lezen. Het origineel is bewaard; vul de gegevens zelf in.</p>';
    var waarde = function (n) { return (velden[n] || {}).waarde || ''; };
    $('#invUit').innerHTML = '<h3 class="ds-kaart__titel">Wat wij eruit lezen</h3><p class="ds-meta">' + esc(dt.opmerking || '') + '</p>' + gelezen +
      '<h3 class="ds-kaart__titel">Nakijken en aanvullen</h3><div class="ds-veldgroep">' +
      veldje('bTitel', 'Naam', waarde('titel') || waarde('vlucht') || waarde('kenmerk')) +
      '<label class="ds-veldlabel" for="bSoort">Soort<select class="ds-invoer" id="bSoort">' + SOORTEN.map(function (x) {
        return '<option value="' + x + '"' + (waarde('soort') === x ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
      veldje('bBestemming', 'Bestemming', waarde('bestemming')) + veldje('bVan', 'Van (jjjj-mm-dd)', waarde('van_datum')) +
      veldje('bTot', 'Tot (leeg mag)', waarde('tot_datum')) + '</div>' +
      '<div><button class="ds-knop ds-knop--primair" id="invVoegToe" type="button" data-ds-actie="Voeg toe aan mijn reizen">Voeg toe aan mijn reizen</button></div>' +
      '<p class="ds-meta">Pas hierna staat het bij uw reizen.</p>';
    $('#invVoegToe').addEventListener('click', voegToe);
  }

  function voegToe() {
    if (!VOORSTEL) return;
    var knop = $('#invVoegToe');
    knop.disabled = true;
    api('invoer/bevestig', { id: VOORSTEL.id, velden: {
      titel: $('#bTitel').value, soort: $('#bSoort').value, bestemming: $('#bBestemming').value,
      van_datum: $('#bVan').value, tot_datum: $('#bTot').value } }).then(function () {
      VOORSTEL = null; BESTAND = null;
      $('#invTekst').value = ''; $('#invBestandNaam').textContent = ''; $('#invBestand').value = '';
      $('#invUit').innerHTML = '<p class="ds-meta">Toegevoegd. Het staat nu bij uw reizen.</p>';
      ververs();
      /* En dan ook echt laten zien: het register staat in het blad "reizen". */
      if (R.wisselBlad) R.wisselBlad('reizen');
    }).catch(function (e) { $('#invUit').insertAdjacentHTML('beforeend', '<p class="ds-meta">' + esc(e.message) + '</p>'); knop.disabled = false; });
  }

  /* Wat u zelf invoerde, met een knop om het weer weg te halen; het bewijsstuk
     blijft in uw eigen kluis staan. */
  function laadMijnInvoer() {
    return api('invoer/mijn').then(function (dt) {
      var rij = dt.onderdelen || [];
      $('#invTel').textContent = rij.length ? rij.length + ' toegevoegd' : '';
      $('#invMijn').innerHTML = !rij.length ? '' : '<h3 class="ds-kaart__titel">Door u toegevoegd</h3><ul class="ds-lijst">' + rij.map(function (x) {
        return '<li class="ds-lijst__rij"><span></span><span><span class="ds-lijst__titel">' + esc(x.titel) + (x.bestemming ? ' &middot; ' + esc(x.bestemming) : '') +
          '</span><span class="ds-lijst__tekst">' + esc(x.van) + (x.tot ? ' t/m ' + esc(x.tot) : '') + ' &middot; ' +
          esc(x.status === 'tecontroleren' ? 'nog na te kijken' : 'ingelezen') + ' &middot; uit ' + esc(x.herkomst) + '</span></span>' +
          '<button class="ds-knop ds-knop--stil ds-knop--klein" type="button" data-weg="' + esc(x.id) + '">Weghalen</button></li>';
      }).join('') + '</ul>';
      R.$$('[data-weg]', $('#invMijn')).forEach(function (b) { b.addEventListener('click', function () {
        b.disabled = true;
        api('invoer/weg', { id: b.dataset.weg }).then(ververs).catch(function () { b.disabled = false; });
      }); });
    }).catch(function () {});
  }
  laadMijnInvoer();
})(window, document);
