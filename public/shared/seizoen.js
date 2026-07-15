/* De zonnewijzer van de website: bepaalt het seizoen (kalender) en de
   zonstand (klok, met per seizoen een eigen zonsopkomst en -ondergang) en
   zet data-seizoen en data-dagdeel op <html>. shared/seizoen.css vertaalt
   die twee assen naar het 4x4-kleurenpalet.

   Testen kan met ?seizoen=winter&dagdeel=ochtend in de adresbalk.
   Zonder JavaScript blijft de vaste donkere huisstijl gewoon staan. */
(function (w, d) {
  'use strict';
  // zonsopkomst en -ondergang (uur, decimaal) per seizoen
  var ZON = { lente: [7, 20.5], zomer: [6, 21.5], herfst: [7.5, 19], winter: [8.5, 17] };
  var NAAM = { ochtend: 'ochtendzon', middag: 'middaglicht', avond: 'avondlicht', nacht: 'nacht' };
  var SEIZOEN = { lente: 'Lente', zomer: 'Zomer', herfst: 'Herfst', winter: 'Winter' };

  function seizoenVan(maand) { // maand 0-11, meteorologisch
    return maand >= 2 && maand <= 4 ? 'lente'
      : maand >= 5 && maand <= 7 ? 'zomer'
      : maand >= 8 && maand <= 10 ? 'herfst' : 'winter';
  }
  function dagdeelVan(seizoen, uur) {
    var op = ZON[seizoen][0], onder = ZON[seizoen][1];
    if (uur < op || uur >= onder + 1) return 'nacht';
    if (uur < 12) return 'ochtend';
    if (uur < onder - 2.5) return 'middag';
    return 'avond';
  }

  function zet() {
    var q = null;
    try { q = new URLSearchParams(w.location.search); } catch (e) {}
    var nu = new Date();
    var s = (q && q.get('seizoen')) || seizoenVan(nu.getMonth());
    if (!ZON[s]) s = seizoenVan(nu.getMonth());
    var dd = (q && q.get('dagdeel')) || dagdeelVan(s, nu.getHours() + nu.getMinutes() / 60);
    if (!NAAM[dd]) dd = dagdeelVan(s, nu.getHours() + nu.getMinutes() / 60);
    var r = d.documentElement;
    r.setAttribute('data-seizoen', s);
    r.setAttribute('data-dagdeel', dd);
    var el = d.querySelector('[data-palet-label]');
    if (el) el.textContent = 'Palet: ' + SEIZOEN[s] + ' · ' + NAAM[dd];
    return { seizoen: s, dagdeel: dd };
  }

  zet();
  // de zon draait door: elke vijf minuten opnieuw kijken
  var timer = setInterval(zet, 5 * 60000);
  if (timer && timer.unref) timer.unref();
  w.Seizoen = { zet: zet };
})(window, document);
