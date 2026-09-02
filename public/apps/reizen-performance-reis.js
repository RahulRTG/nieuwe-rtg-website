(function (R) {
  'use strict';
  var $ = R.$, maak = R.maak;
  var MAAND = ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];

  function datumDelen(iso) {
    var d = new Date(String(iso || '') + 'T12:00:00');
    return isNaN(d.getTime()) ? { dag: '--', maand: '' } : { dag: String(d.getDate()).padStart(2, '0'), maand: MAAND[d.getMonth()] };
  }
  /* HET REISREGISTER HEEFT EEN EIGENAAR, EN DAT IS DIT BESTAND NIET.
     Hier stond renderRegister(): die vulde #komend met een PLATTE, chronologische
     lijst reisregels. reizen.html vult datzelfde element met de GEGROEPEERDE
     vorm -- een kop per reis, met de onderdelen eronder -- en dat is het model
     van REIZEN.md: een Reis met onderdelen, niet een stroom losse regels.

     Allebei draaiden ze bij het laden, allebei schreven ze in #komend, en wie
     het laatst klaar was won. Dat is niet "soms de verkeerde opmaak" maar twee
     waarheden over hetzelfde register; in de toets won de platte en
     test/reizenscherm.e2e.js zakte op zijn eigen onderwerp.

     Dit bestand houdt wat van hem is: de stand, het canvas van vandaag en het
     volgende reismoment in de kop. Het register is van reizen.html, samen met
     de teller #tel die eraan hangt.

     WAT HIERMEE VERVALT, en dat hoort hardop: de taxi-deeplink die een regel met
     `link === '#taxi'` naar het taxiblad stuurde, en de demolijst die zonder
     token werd getoond. Dat laatste is geen verlies: een scherm dat zonder
     gegevens toch reizen toont, zegt iets wat het niet weet. */
  /* DE MOMENTENSTROOK. Eén pion per reisonderdeel, met de dag of de tijd
     eronder -- uit dezelfde lijst als de status en het volgende moment, zodat
     de drie nooit iets anders kunnen zeggen over dezelfde reis. De eerste
     tegel is een handeling en geen onderdeel: iets toevoegen wat elders is
     geboekt. Er staan met opzet geen mensen in: RTG verzint geen reisgenoten,
     en wie er echt bij hoort staat in het gezelschap van de reis. */
  var TEKEN = { vlucht: '\u2708', verblijf: '\u25AD', rit: '\u2192', reis: '\u25C7', charter: '\u2708' };
  function tekenMomenten(lijst) {
    var vak = $('#momenten'); if (!vak) return;
    vak.textContent = '';
    var toe = maak('a', 'pion pion-toe');
    toe.href = '#invoer';
    toe.appendChild(maak('span', 'pionrond', '+'));
    toe.appendChild(maak('small', '', 'Voeg toe'));
    vak.appendChild(toe);
    lijst.slice(0, 8).forEach(function (o) {
      var a = maak('a', 'pion');
      a.href = o.link || '#reizen';
      var rond = maak('span', 'pionrond' + (o.sig === 'incident' ? ' let' : ''), TEKEN[o.soort] || '\u25C7');
      a.appendChild(rond);
      a.appendChild(maak('b', '', o.bestemming || o.titel || 'Onderdeel'));
      var d = datumDelen(o.van);
      a.appendChild(maak('small', '', o.tijd || (d.dag + ' ' + d.maand).trim()));
      vak.appendChild(a);
    });
    if (!lijst.length) vak.appendChild(maak('p', 'leegtekst', 'Nog geen onderdelen bij deze reis.'));
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
    tekenMomenten(lijst);
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
    R.staat.reizen = data;
    tekenCanvasVandaag(data.komend || []); updateVandaag(data);
  }
  R.laadReizen = function (melding) {
    /* GEEN VERZONNEN REIS VOOR WIE NIET IS AANGEMELD. Hier stond een
       demowereld met drie komende reizen en een gezonde stand; wie de app
       zonder token opende zag dus een reisoverzicht dat niet van hem was.
       RTG toont wat er echt is, of het zegt dat het niets kan tonen. */
    if (!R.token) { if (melding) R.toast('Log in om uw reizen te zien.'); return; }
    return R.api('/api/reis/wereld', {}).then(function (data) { renderReizen(data); if (melding) R.toast('Uw reizen zijn bijgewerkt.'); })
      /* Ook bij een storing NIET in #komend schrijven: dat register is van
         reizen.html, en die zegt zelf wat er misging. Twee foutmeldingen over
         elkaar heen leest als twee storingen. */
      .catch(function (e) { R.toast(e.message); });
  };
  $('[data-ververs-reizen]').addEventListener('click', function () { R.laadReizen(true); });
})(window.RTGReizen);
