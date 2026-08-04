/* RTG Horeca (scherm): het managementbeeld -- de dag over alle kanalen, plus
   de signalen.

   Drie regels houden dit scherm eerlijk, en ze zijn alle drie zichtbaar:

   1. ELK CIJFER DRAAGT ZIJN NOEMER. Een gemiddelde besteding zonder het aantal
      bonnen is een getal waar je alles mee kunt beweren; hier staat het aantal
      ernaast.
   2. FOOI IS GEEN OMZET, EN ONINBAAR VERDWIJNT NIET. Beide staan apart, het
      oninbare met de redenen erbij. Een gat in de kas is geen administratieve
      handeling.
   3. ER WORDT NIETS VOORSPELD WAT WE NIET METEN. Er staat geen omzetprognose
      op dit scherm. Wat er staat is wat er NU open staat en wat er vandaag is
      binnengekomen: feiten met een tijdstempel. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;

  function dagbeeld() {
    K.api('/dagbeeld', { datum: $('mDatum').value.trim() }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('mOmzet').textContent = K.euro(d.omzetCenten);
      $('mBonnen').textContent = d.bonnen;
      $('mGasten').textContent = d.gasten;
      $('mGemiddeld').textContent = d.gemiddeldePerBon == null ? '-' : K.euro(d.gemiddeldePerBon);
      $('mKanalen').innerHTML = (d.perKanaal || []).map(function (k) {
        return K.rij('<b>' + esc(k.kanaal) + '</b> <span class="stil">· ' + k.bonnen + ' bon(nen) · ' +
          k.gasten + ' gast(en)</span>',
        K.euro(k.omzetCenten) + ' <span class="stil">· ' +
          (k.gemiddeldePerBon == null ? 'geen gemiddelde' : K.euro(k.gemiddeldePerBon) + ' per bon') + '</span>');
      }).join('') || '<p class="stil">Op deze datum is er nog geen bon afgerekend.</p>';
      $('mWijzen').innerHTML = Object.keys(d.perBetaalwijze).map(function (w) {
        return K.rij(esc(w), K.euro(d.perBetaalwijze[w]));
      }).join('') || '<p class="stil">Nog niets afgerekend.</p>';
      $('mApart').innerHTML =
        K.rij('Fooi <span class="stil">· gaat naar het personeel, telt niet in de omzet</span>', K.euro(d.fooiCenten)) +
        K.rij('Korting', K.euro(d.kortingCenten)) +
        K.rij('Oninbaar <span class="stil">· ' + (d.oninbaar.redenen.length ? esc(d.oninbaar.redenen.join('; ')) : 'geen') + '</span>',
          d.oninbaar.bonnen + ' bon(nen) · ' + K.euro(d.oninbaar.centen)) +
        K.rij('Nog open <span class="stil">· oudste ' + esc((d.nogOpen.oudste || '-').slice(0, 16).replace('T', ' ')) + '</span>',
          d.nogOpen.rekeningen + ' rekening(en) · ' + K.euro(d.nogOpen.centen));
      $('mLet').textContent = d.let;
    });
  }

  function signalen() {
    K.api('/signalen', {}).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      $('mSignaalTelling').textContent = d.aantal;
      $('mSignalen').innerHTML = (d.signalen || []).map(function (s) {
        return K.rij('<span class="tag">' + esc(s.soort) + '</span> ' + esc(s.tekst), esc(s.tafel || ''));
      }).join('') || '<p class="stil">Er vraagt op dit moment niets om aandacht.</p>';
      $('mSignaalLet').textContent = d.let;
    });
  }

  if (!K.poort()) return;
  $('mVerversNu').addEventListener('click', function () { dagbeeld(); signalen(); });
  $('mDagToon').addEventListener('click', dagbeeld);
  dagbeeld();
  signalen();
})();
