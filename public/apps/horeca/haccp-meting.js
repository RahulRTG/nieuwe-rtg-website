/* RTG Horeca (scherm): HACCP -- de meetpunten en het temperatuurlogboek.

   Dit is het scherm dat een inspecteur wil zien, en dat is iets anders dan een
   voorraadscherm: het gaat niet over hoeveel er ligt, maar of het veilig is.

   Drie dingen die hier zichtbaar zijn en die een logboek pas een logboek maken:

   1. WAT VANDAAG NOG NIET GEMETEN IS, STAAT ER ALS GEMIST. Een leeg logboek
      ziet er anders precies zo uit als een goed logboek.
   2. EEN WAARDE BUITEN DE GRENS VRAAGT EEN ACTIE. Het veld staat er al; zonder
      actie weigert de server de meting, en dat weigeren is geen hindernis maar
      de hele bedoeling.
   3. CORRIGEREN KAN, GLADSTRIJKEN NIET. De oude waarde blijft staan met wie
      hem wijzigde en waarom. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;

  function logboek() {
    K.api('/haccp/logboek', { van: $('aVan').value.trim(), tot: $('aTot').value.trim() }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('aAantal').textContent = d.aantal;
      $('aAfwijking').textContent = d.afwijkingen;
      $('aPunt').innerHTML = (d.punten || []).map(function (p) {
        return '<option value="' + esc(p.id) + '">' + esc(p.naam) + ' (' +
          [p.min, p.max].filter(function (x) { return x != null; }).join(' tot ') + ' ' + esc(p.eenheid) + ')</option>';
      }).join('');
      $('aGemist').textContent = d.gemistVandaag.length
        ? 'Vandaag nog niet gemeten: ' + d.gemistVandaag.join(', ') + '.'
        : 'Alle meetpunten zijn vandaag gemeten.';
      $('aLog').innerHTML = (d.metingen || []).map(function (m) {
        return K.rij('<b>' + esc(m.punt) + '</b> <span class="stil">· ' + esc(m.at.slice(0, 16).replace('T', ' ')) +
          ' · ' + esc(m.door) + '</span>' +
          (m.afwijking ? ' <span class="allergie">afwijking</span>' : '') +
          (m.actie ? ' <span class="stil">· ' + esc(m.actie) + '</span>' : '') +
          ((m.correcties || []).length ? ' <span class="tag">gecorrigeerd van ' + m.correcties[0].was + '</span>' : ''),
        '<span class="tag' + (m.afwijking ? ' laat' : ' aan') + '">' + m.waarde + ' ' + esc(m.eenheid) + '</span>' +
          K.knop('Corrigeer', { cor: m.id }));
      }).join('') || '<p class="stil">Nog geen metingen in dit bereik.</p>';
      K.bind($('aLog'), 'cor', function (b) { $('aCorId').value = b.dataset.cor; });
    });
  }

  if (!K.poort()) return;

  $('aPuntZet').addEventListener('click', function () {
    K.api('/haccp/punt', { naam: $('aPuntNaam').value.trim(),
      min: $('aMin').value === '' ? null : Number($('aMin').value),
      max: $('aMax').value === '' ? null : Number($('aMax').value),
      frequentie: $('aFrequentie').value.trim() }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      $('aPuntNaam').value = '';
      logboek();
    });
  });
  $('aMeting').addEventListener('click', function () {
    K.api('/haccp/meting', { puntId: $('aPunt').value, waarde: Number($('aWaarde').value),
      actie: $('aActie').value.trim() }).then(function (r) {
      var d = r.body;
      if (d.error) {
        K.meld(d.error);
        if (d.afwijking) $('aActie').focus();
        return;
      }
      $('aWaarde').value = ''; $('aActie').value = '';
      K.meld(d.meting.afwijking ? 'Afwijking vastgelegd, met de actie erbij.' : 'Meting vastgelegd.');
      logboek();
    });
  });
  $('aCorrigeer').addEventListener('click', function () {
    K.api('/haccp/meting/corrigeer', { metingId: $('aCorId').value.trim(),
      waarde: Number($('aCorWaarde').value), reden: $('aCorReden').value.trim() }).then(function (r) {
      if (r.body.error) return K.meld(r.body.error);
      $('aCorReden').value = '';
      K.meld(r.body.let);
      logboek();
    });
  });
  $('aToon').addEventListener('click', logboek);
  logboek();
})();
