/* RTG Horeca (scherm): clubtegoed en polsbandbeheer.

   Een polsband is geld. Daarom staan er drie dingen op dit scherm die je in
   veel clubsystemen niet vindt:

   1. HET SALDO STAAT ER GEWOON, en het kan nooit onder nul. Wat er niet op
      staat, wordt niet afgeboekt; de rest wordt apart afgerekend.
   2. RESTSALDO KAN TERUG. Dat is geen gunst maar geld van de gast; de knop
      staat er even groot als het opwaarderen.
   3. ER STAAT GEEN NAAM OP. Een band draagt een nummer en een saldo. Wie hem
      verliest, verliest zijn tegoed en niet zijn identiteit -- wij hoeven niet
      te weten wie er om 02:41 een biertje kocht.

   De minimum spend op een VIP-tafel staat er als AFSPRAAK bij: het scherm
   toont wat er nog te gaan is en boekt niets automatisch bij. Wat er aan het
   eind gebeurt, is een gesprek aan de tafel. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;

  function toonBand(d) {
    $('cBandUit').textContent = 'Band ' + d.band.nummer + ': ' + K.euro(d.band.saldo) +
      ' saldo (in totaal ' + K.euro(d.band.opgewaardeerd) + ' opgewaardeerd).';
  }

  function tafels() {
    K.api('/club/tafel/stand', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('cTafels').innerHTML = (d.tafels || []).map(function (t) {
        return K.rij('<b>' + esc(t.tafel) + '</b> <span class="stil">· ' + esc(t.gastnaam || 'zonder naam') +
          ' · ' + t.personen + ' personen</span> <span class="tag' + (t.gehaald ? ' aan' : '') + '">' +
          (t.gehaald ? 'minimum gehaald' : K.euro(t.teGaan) + ' te gaan') + '</span>',
        K.euro(t.besteed) + ' van ' + K.euro(t.minimumCenten));
      }).join('') || '<p class="stil">Er staat geen tafel met een minimum spend.</p>';
      $('cTafelLet').textContent = d.let;
    });
  }

  if (!K.poort()) return;

  $('cBandOp').addEventListener('click', function () {
    K.api('/club/band', { nummer: $('cNummer').value.trim(), bedrag: Number($('cBedrag').value) || 0 })
      .then(function (r) {
        if (r.body.error) return K.meld(r.body.error);
        toonBand(r.body);
        K.meld(r.body.let);
      });
  });
  $('cBandBetaal').addEventListener('click', function () {
    K.api('/club/band/betaal', { nummer: $('cNummer').value.trim(), bedrag: Number($('cBedrag').value) || 0 })
      .then(function (r) {
        var d = r.body;
        if (d.error) return K.meld(d.error);
        $('cBandUit').textContent = 'Afgeboekt: ' + K.euro(d.geboekt) + ', saldo ' + K.euro(d.saldo) +
          (d.tekort ? '. ' + d.let : '.');
      });
  });
  $('cBandTerug').addEventListener('click', function () {
    K.api('/club/band/terug', { nummer: $('cNummer').value.trim() }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('cBandUit').textContent = K.euro(d.uitbetaald) + ' terugbetaald; het saldo staat op nul. ' + d.let;
    });
  });

  $('cTafelZet').addEventListener('click', function () {
    K.api('/club/tafel', { tafel: $('cTafel').value.trim(), gastnaam: $('cTafelGast').value.trim(),
      personen: Number($('cTafelPersonen').value) || 2, minimum: Number($('cTafelMin').value) || 0,
      rekeningId: $('cTafelRek').value.trim() }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      tafels();
    });
  });
  $('cTafelToon').addEventListener('click', tafels);
  tafels();
})();
