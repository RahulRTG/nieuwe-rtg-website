/* RTG Horeca (scherm): events -- offerte, akkoord, verbruik en nacalculatie.

   Dit scherm gaat over het stuk van een partij waar het geld zit. Het
   draaiboek, de mise-en-place en de menukeuze met allergenen staan elders in
   het huis en worden hier niet overgedaan.

   Drie regels staan hier zichtbaar op het scherm en niet alleen in de server:

   1. EEN OFFERTE IS PAS EEN OPDRACHT NA EEN AKKOORD MET NAAM. Er is geen knop
      die een offerte stilletjes bevestigt.
   2. POSTEN WIJZIGEN NA AKKOORD MAAKT EEN NIEUWE VERSIE die opnieuw getekend
      moet worden. Het scherm zegt dat met zoveel woorden.
   3. EEN NACALCULATIE ZONDER KOSTEN IS GEEN NACALCULATIE. Zolang er niets is
      ingevoerd blijft de marge leeg -- geen prachtige 100%. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;
  var huidig = null;

  function lijst() {
    K.api('/event/lijst', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('vLijst').innerHTML = (d.events || []).map(function (e) {
        return '<div class="item"><span><b>' + esc(e.naam) + '</b> <span class="stil">· ' +
          esc(e.datum || 'geen datum') + ' · ' + e.gasten + ' gasten · versie ' + e.versie + '</span>' +
          ' <span class="tag' + (e.status === 'bevestigd' ? ' aan' : '') + '">' + esc(e.status) + '</span></span>' +
          '<span class="rij"><span class="stil">' + K.euro(e.totaalCenten) +
          (e.aanbetaald ? ' · ' + K.euro(e.aanbetaald) + ' aanbetaald' : '') + '</span>' +
          K.knop('Openen', { ev: e.id }) + '</span></div>';
      }).join('') || '<p class="stil">Er staat nog geen event.</p>';
      K.bind($('vLijst'), 'ev', function (b) { huidig = b.dataset.ev; toon(); });
    });
  }

  function toon() {
    if (!huidig) return;
    K.api('/event/nacalculatie', { eventId: huidig }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('vNaUit').innerHTML =
        K.rij('Opbrengst (de bevestigde posten)', K.euro(d.opbrengstCenten)) +
        K.rij('Kosten' + (d.perSoort ? ' <span class="stil">· ' + Object.keys(d.perSoort).map(function (s) {
          return s + ' ' + K.euro(d.perSoort[s]);
        }).join(', ') + '</span>' : ''), K.euro(d.kostenCenten)) +
        (d.compleet
          ? K.rij('<b>Marge</b>', '<b>' + K.euro(d.margeCenten) + ' (' + d.margeProcent + '%)</b>') +
            K.rij('Per gast', K.euro(d.perGast)) +
            K.rij('Gewerkte uren', d.gewerkteUren + ' uur')
          : '<p class="stil">' + esc(d.let) + '</p>');
    });
  }

  function posten() {
    var uit = [];
    for (var i = 1; i <= 3; i++) {
      var o = $('vPost' + i).value.trim();
      if (!o) continue;
      uit.push({ omschrijving: o, aantal: Number($('vAantal' + i).value) || 1,
        prijs: Number($('vPrijs' + i).value) || 0 });
    }
    return uit;
  }

  if (!K.poort()) return;

  $('vOfferte').addEventListener('click', function () {
    K.api('/event/offerte', { naam: $('vNaam').value.trim(), datum: $('vDatum').value.trim(),
      gasten: Number($('vGasten').value) || 1, contact: $('vContact').value.trim(),
      ruimte: $('vRuimte').value.trim(), posten: posten() }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      huidig = r.body.event.id;
      K.meld('Offerte gemaakt: ' + K.euro(r.body.event.totaalCenten) + '.');
      lijst(); toon();
    });
  });
  $('vPosten').addEventListener('click', function () {
    if (!huidig) return K.meld('Kies eerst een event.');
    K.api('/event/posten', { eventId: huidig, posten: posten() }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      K.meld(d.opnieuwAkkoordNodig ? d.let : 'Versie ' + d.event.versie + ' staat klaar.');
      lijst(); toon();
    });
  });
  $('vAkkoord').addEventListener('click', function () {
    if (!huidig) return K.meld('Kies eerst een event.');
    K.api('/event/akkoord', { eventId: huidig, door: $('vDoor').value.trim(),
      kanaal: $('vKanaal').value }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      K.meld('Akkoord vastgelegd op naam van ' + r.body.event.akkoord.door + '.');
      lijst();
    });
  });
  $('vAanbetaling').addEventListener('click', function () {
    if (!huidig) return K.meld('Kies eerst een event.');
    K.api('/event/aanbetaling', { eventId: huidig, bedrag: Number($('vAanbedrag').value) || 0 })
      .then(function (r) {
        var d = r.body;
        if (d.error) return K.meld(d.error);
        K.meld(d.deel + '% van de opdracht is aanbetaald.');
        lijst();
      });
  });
  $('vKosten').addEventListener('click', function () {
    if (!huidig) return K.meld('Kies eerst een event.');
    K.api('/event/kosten', { eventId: huidig, soort: $('vKostSoort').value,
      omschrijving: $('vKostWat').value.trim(), bedrag: Number($('vKostBedrag').value) || 0,
      uren: Number($('vKostUren').value) || 0 }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      $('vKostWat').value = ''; $('vKostBedrag').value = ''; $('vKostUren').value = '';
      toon();
    });
  });
  $('vNa').addEventListener('click', toon);
  lijst();
})();
