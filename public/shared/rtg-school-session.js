/* Tijdelijke schoolsessies voor de professionele werkruimtes.

   School- en personeelssleutels horen niet permanent op een gedeeld gezin-
   of schooltoestel te blijven staan. Daarom gebruikt deze laag uitsluitend
   sessionStorage: sluiten van de tab/browser ruimt de sleutel op. Oude
   localStorage-sessies worden eenmalig overgenomen en direct verwijderd.

   Na dertig minuten zonder activiteit verloopt de sessie ook binnen een open
   tab. De server blijft bij elk verzoek de rol en de sleutel controleren; dit
   bestand is de extra clientgrens, nooit de bron van rechten. */
(function (w) {
  'use strict';
  var MAX_STIL = 30 * 60 * 1000;
  var MERK = 'rtg-school-sessie-v1';

  function pak(k) {
    var raw = null;
    try { raw = sessionStorage.getItem(k); } catch (e) {}
    if (!raw) {
      /* Veilige migratie van de eerdere permanente opslag. */
      try {
        raw = localStorage.getItem(k);
        if (raw) localStorage.removeItem(k);
      } catch (e) {}
      if (raw) {
        try { zet(k, JSON.parse(raw)); } catch (e) { raw = null; }
        try { raw = sessionStorage.getItem(k); } catch (e) { raw = null; }
      }
    }
    if (!raw) return null;
    try {
      var doos = JSON.parse(raw);
      if (!doos || doos.merk !== MERK || !doos.waarde) return null;
      if (Date.now() > doos.verloopt) { weg(k); return null; }
      return doos;
    } catch (e) { weg(k); return null; }
  }

  function zet(k, waarde) {
    if (!waarde) return weg(k);
    try { sessionStorage.setItem(k, JSON.stringify({ merk: MERK, waarde: waarde, verloopt: Date.now() + MAX_STIL })); } catch (e) {}
    try { localStorage.removeItem(k); } catch (e) {}
    return waarde;
  }
  function lees(k) { var d = pak(k); return d ? d.waarde : null; }
  function raak(k) {
    var d = pak(k); if (!d) return false;
    d.verloopt = Date.now() + MAX_STIL;
    try { sessionStorage.setItem(k, JSON.stringify(d)); } catch (e) {}
    return true;
  }
  function weg(k) {
    try { sessionStorage.removeItem(k); } catch (e) {}
    try { localStorage.removeItem(k); } catch (e) {}
  }
  function bewaak(sleutels, verlopen) {
    sleutels = sleutels || [];
    var laatste = 0;
    function actief() {
      var nu = Date.now(); if (nu - laatste < 15000) return;
      laatste = nu; sleutels.forEach(raak);
    }
    ['pointerdown', 'keydown', 'focus'].forEach(function (soort) { addEventListener(soort, actief, { passive: true }); });
    var klok = setInterval(function () {
      var had = false, heeft = false;
      sleutels.forEach(function (k) {
        try { if (sessionStorage.getItem(k)) had = true; } catch (e) {}
        if (pak(k)) heeft = true;
      });
      if (had && !heeft && verlopen) verlopen();
    }, 30000);
    return function () { clearInterval(klok); };
  }

  w.RTGSchoolSession = { lees: lees, zet: zet, raak: raak, weg: weg, bewaak: bewaak, maxStil: MAX_STIL };
})(window);
