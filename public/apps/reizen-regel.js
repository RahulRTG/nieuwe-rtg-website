/* Een regel van het reisregister van TravelOS (uit reizen-register.js, dat
   anders over de 10 kB ging). De regel draagt zijn eigen delen als
   data-reg-titel, data-reg-plaats, data-reg-dag, data-ref en data-reg-bron:
   daar leest de gedeelde ds-bouwer (/ds/register.js) Delen, Kenmerk en
   Overnemen uit, zodat er geen tweede kopie van de reisgegevens nodig is. */
(function (w) {
  'use strict';
  var R = w.RTGReizen; if (!R) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g,
    function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  var SOORT = { verblijf: 'Verblijf', reis: 'Reis', vlucht: 'Vlucht', charter: 'Charter' };
  /* De dag van een reisregel, in de taal van het lid. */
  function dagdeel(iso) {
    var x = new Date(iso + 'T00:00:00');
    if (isNaN(x)) return { wd: '', nr: iso || '', mnd: '' };
    var f = function (o) { return new Intl.DateTimeFormat(R.taal(), o).format(x); };
    return { wd: f({ weekday: 'long' }), nr: f({ day: '2-digit' }), mnd: f({ month: 'short' }) };
  }

  /* Een regel: alleen wat het domein weet. Sleepbaar in de werkruimte met
     precies wat er al op het scherm staat (WERKRUIMTE.md par. 6). */
  function reisRegel(x) {
    var dd = dagdeel(x.van), feiten = [];
    if (x.personen) feiten.push(x.personen + ' ' + (x.personen === 1 ? 'reiziger' : 'reizigers'));
    if (x.wacht) feiten.push(x.wacht.charAt(0).toUpperCase() + x.wacht.slice(1));
    var titel = x.titel || SOORT[x.soort] || 'Reis';
    return '<li><a class="ds-lijst__rij reis" href="' + esc(x.link) + '"' + (x.sig ? ' data-sig="' + esc(x.sig) + '"' : '') +
      ' data-sleep="reis" data-sleep-id="' + esc(x.kenmerk || x.titel || '') + '" data-sleep-label="' +
      esc(titel + (x.bestemming ? ' naar ' + x.bestemming : '')) + '" data-sleep-datum="' + esc(x.van || '') + '">' +
      '<span class="ds-lijst__tijd" data-reg-dag>' + esc(dd.nr) + '<br>' + esc(dd.mnd) + '</span>' +
      '<span><span class="ds-lijst__titel"><span data-reg-titel>' + esc(titel) + '</span>' +
      (x.bestemming ? ' · <span data-reg-plaats>' + esc(x.bestemming) + '</span>' : '') + '</span>' +
      '<span class="ds-lijst__tekst">' + [dd.wd, x.status, feiten.join(' · ')].filter(Boolean).map(esc).join(' · ') +
      (x.app ? (dd.wd || x.status || feiten.length ? ' · ' : '') + '<span data-reg-bron>' + esc(x.app) + '</span>' : '') + '</span>' +
      (x.kenmerk ? '<button class="ds-chip" type="button" data-ref="' + esc(x.kenmerk) + '" title="Kopieer kenmerk">' + esc(x.kenmerk) + '</button>' : '') +
      '</span><span aria-hidden="true">›</span></a></li>';
  }
  R.regel = { dagdeel: dagdeel, reisRegel: reisRegel };
})(window);
