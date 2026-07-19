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

  /* De ademende dagkleur: op elke getekende milliseconde is de kleur een
     fractie anders. Toon en lichtheid golven heel langzaam (tientallen
     seconden per ademtocht, hooguit een paar graden en anderhalf procent)
     rond de dagkleur uit het blad, zodat elke levende achtergrond
     onmerkbaar van kleur naar kleur glijdt. Wie minder beweging wil
     (prefers-reduced-motion) houdt de stilstaande kleur. */
  var RUSTIG = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!RUSTIG && w.requestAnimationFrame) {
    var wortel = d.documentElement, basis = null, sleutel = '';
    var naarHsl = function (hex) {
      var n = parseInt(hex.slice(1), 16);
      var r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
      var ma = Math.max(r, g, b), mi = Math.min(r, g, b), t = ma - mi, l = (ma + mi) / 2;
      var s = t === 0 ? 0 : t / (1 - Math.abs(2 * l - 1));
      var h = t === 0 ? 0 : ma === r ? ((g - b) / t + 6) % 6 : ma === g ? (b - r) / t + 2 : (r - g) / t + 4;
      return { h: h * 60, s: s * 100, l: l * 100 };
    };
    var lees = function () {
      wortel.style.removeProperty('--dag-kleur');
      var v = getComputedStyle(wortel).getPropertyValue('--dag-kleur').trim();
      basis = /^#[0-9A-Fa-f]{6}$/.test(v) ? naarHsl(v) : null;
    };
    var adem = function (t) {
      var nu = wortel.getAttribute('data-seizoen') + '/' + wortel.getAttribute('data-dagdeel');
      if (nu !== sleutel) { sleutel = nu; lees(); }
      if (basis) {
        var h = basis.h + 4 * Math.sin(t / 21000) + 2 * Math.sin(t / 8700);
        var l = basis.l + 1.5 * Math.sin(t / 13000);
        wortel.style.setProperty('--dag-kleur', 'hsl(' + h.toFixed(3) + ' ' + basis.s.toFixed(2) + '% ' + l.toFixed(3) + '%)');
      }
      w.requestAnimationFrame(adem);
    };
    w.requestAnimationFrame(adem);
  }
})(window, document);
