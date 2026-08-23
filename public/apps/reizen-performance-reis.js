(function (R) {
  'use strict';
  var $ = R.$, maak = R.maak;
  var MAAND = ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];

  function datumDelen(iso) {
    var d = new Date(String(iso || '') + 'T12:00:00');
    return isNaN(d.getTime()) ? { dag: '--', maand: '' } : { dag: String(d.getDate()).padStart(2, '0'), maand: MAAND[d.getMonth()] };
  }
  function renderRegister(lijst) {
    var doel = $('#komend'); doel.textContent = '';
    $('#tel').textContent = lijst.length ? lijst.length + (lijst.length === 1 ? ' reis' : ' reizen') : '';
    if (!lijst.length) { doel.appendChild(maak('p', 'leegtekst', 'Verder staat er niets gepland. Nieuwe boekingen verschijnen hier vanzelf.')); return; }
    lijst.forEach(function (reis) {
      var a = maak('a', 'reisregel'); a.href = reis.link || '#';
      if (reis.link === '#taxi') a.addEventListener('click', function (e) { e.preventDefault(); R.wisselBlad('taxi'); });
      var dat = datumDelen(reis.van), datum = maak('span', 'reisdatum'), kern = maak('span', 'reiskern'), status = maak('span', 'reisstatus');
      datum.appendChild(maak('b', '', dat.dag)); datum.appendChild(document.createTextNode(dat.maand));
      kern.appendChild(maak('b', '', reis.titel || 'Reis'));
      kern.appendChild(maak('small', '', [reis.bestemming, reis.app, reis.kenmerk].filter(Boolean).join(' · ')));
      status.appendChild(document.createTextNode((reis.teken || '·') + ' ' + (reis.status || 'Status niet bekend')));
      a.appendChild(datum); a.appendChild(kern); a.appendChild(status); doel.appendChild(a);
    });
  }
  function updateVandaag(data) {
    var lijst = data.komend || [], vlucht = lijst.find(function (x) { return x.soort === 'vlucht'; });
    var eerst = lijst.filter(function (x) { return x.van === R.vandaagISO(0) && x.tijd; })
      .sort(function (a, b) { return String(a.tijd).localeCompare(String(b.tijd)); })[0];
    var bestemming = vlucht && vlucht.bestemming ? vlucht.bestemming : ((lijst[0] && lijst[0].bestemming) || 'UW REIS');
    $('#titelVandaag').textContent = String(bestemming).toUpperCase();
    $('#gereedTeller').textContent = lijst.length + '/' + lijst.length + ' GEREED';
    $('#dagzin').textContent = lijst.length ? 'Alles voor uw volgende beweging staat bij elkaar.' : 'Er staat nog geen reis gepland.';
    var raster = $('#dagRaster'); if (raster) raster.hidden = !lijst.length;
    var status = $('#statusLijst'); status.textContent = '';
    lijst.slice(0, 3).forEach(function (reis) {
      var a = maak('a'); a.href = reis.link || '#reizen';
      var i = maak('i', 'statusicoon ' + (reis.sig === 'gezond' ? 'goed' : reis.sig === 'incident' ? 'let' : 'wacht'), reis.teken || '·');
      var span = maak('span'), titel = maak('b', '', reis.titel || reis.app || 'Reis');
      span.appendChild(titel); span.appendChild(maak('small', '', [reis.status, reis.bestemming, reis.kenmerk].filter(Boolean).join(' · ')));
      a.appendChild(i); a.appendChild(span); a.appendChild(maak('em', '', '›')); status.appendChild(a);
    });
    if (eerst) { $('#volgendTijd').textContent = eerst.tijd; $('#volgendLabel').textContent = eerst.titel || 'Volgend reismoment';
      $('#volgendVan').textContent = 'VERTREK';
      $('#volgendNaar').textContent = String(eerst.bestemming || 'BESTEMMING').toUpperCase(); }
    if (vlucht && vlucht.tijd) $('#volgendExtra').textContent = 'VLUCHT ' + vlucht.tijd;
  }
  function renderReizen(data) {
    R.staat.reizen = data; tekenStand(data);
    renderRegister(tekenCanvasVandaag(data.komend || [])); updateVandaag(data);
  }
  R.laadReizen = function (melding) {
    if (!R.token) {
      renderReizen({ stand: { niveau: 'onbekend', woord: 'Inlog nodig' }, telling: {}, stil: ['ledensessie'], komend: [] });
      $('#komend').textContent = '';
      $('#komend').appendChild(maak('p', 'leegtekst', 'Log in om uw echte reizen op te halen. Er worden geen voorbeeldreizen getoond.'));
      if (melding) R.toast('Log eerst in via de leden-app.');
      return Promise.resolve();
    }
    return R.api('/api/reis/wereld', {}).then(function (data) { renderReizen(data); if (melding) R.toast('Uw reizen zijn bijgewerkt.'); })
      .catch(function (e) { tekenStand({}); $('#titelVandaag').textContent = e.status === 401 ? 'INLOG NODIG' : 'NIET BESCHIKBAAR';
        $('#gereedTeller').textContent = '0/0 GEREED'; $('#dagzin').textContent = e.message + ' Er worden geen oude gegevens getoond.';
        var raster = $('#dagRaster'); if (raster) raster.hidden = true; $('#statusLijst').textContent = ''; $('#komend').textContent = '';
        $('#komend').appendChild(maak('p', 'leegtekst', e.message + ' Uw vorige gegevens worden niet als actueel getoond.')); R.toast(e.message); });
  };
  $('[data-ververs-reizen]').addEventListener('click', function () { R.laadReizen(true); });
})(window.RTGReizen);
