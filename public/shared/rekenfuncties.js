/* RTG Office: de functies van het rekenblad (deel 1: rekenen, tellen, kiezen).

   Wat een rekenblad bruikbaar maakt is niet het raster maar de functielijst.
   Daarom staat die hier voluit, met Nederlandse EN Engelse namen naast elkaar:
   wie een formule uit een ander programma plakt hoeft niets te vertalen.

   HOE EEN FUNCTIE ER HIER UITZIET. Ze krijgt LUIE argumenten -- kleine
   functies die pas iets uitrekenen als je ze aanroept. Dat is geen
   ingewikkeldheid om de ingewikkeldheid: het is de enige manier waarop
   =ALS(A1=0; 0; 1/A1) niet alsnog door nul deelt.

   WAT ER BEWUST NIET IN ZIT: ASELECT() en soortgelijke toevalsfuncties. Een
   cel die bij elke hertekening een ander getal toont, verandert een rekenblad
   in iets waar je een uitkomst niet meer aan kunt navertellen. Wie toeval wil,
   typt het zelf.

   Deel 2 (voorwaarden, logica, geld) en deel 3 (tekst, zoeken, datums) vullen
   dezelfde tabel aan. */
(function (root) {
  'use strict';
  var tabel = {};

  // Een functie onder meerdere namen inschrijven: 'SOM|SUM'.
  function zet(namen, fn) {
    namen.split('|').forEach(function (n) { tabel[n] = fn; });
  }

  /* De gereedschapskist die elke functie deelt. `plat` maakt van argumenten
     (waarden én bereiken) één rij waarden; `getallen` houdt daar alleen de
     getallen van over -- precies zoals SOM over een kolom met koppen erboven
     hoort te werken: de tekst telt niet mee, hij is ook geen fout. */
  function plat(lui, h) {
    var uit = [];
    for (var i = 0; i < lui.length; i++) {
      var v = lui[i]();
      if (h.isFout(v)) throw { fout: v };
      if (v && v.bereik) {
        /* Ook een fout MIDDEN IN een bereik reist omhoog. Anders zou
           =SOM(A1:A9) over een kolom met één kapotte cel een keurig getal
           geven dat niet klopt -- en dat is de gevaarlijkste uitkomst die een
           rekenblad kan produceren: eentje die je gelooft. */
        var rij = v.plat();
        for (var j = 0; j < rij.length; j++) if (h.isFout(rij[j])) throw { fout: rij[j] };
        uit = uit.concat(rij);
      } else uit.push(v);
    }
    return uit;
  }
  function getallen(lui, h) {
    return plat(lui, h).filter(function (v) { return h.isGetallig(v); }).map(h.getalVan);
  }
  // Een functie die over getallen gaat, met de foutafhandeling er al omheen.
  function overGetallen(fn) {
    return function (lui, h) {
      try { return fn(getallen(lui, h), h); } catch (e) { return (e && e.fout) || h.FOUT.waarde; }
    };
  }
  var som = function (r) { return r.reduce(function (a, x) { return a + x; }, 0); };

  /* ---- rekenen ---- */
  zet('SOM|SUM', overGetallen(som));
  zet('PRODUCT', overGetallen(function (r) { return r.length ? r.reduce(function (a, x) { return a * x; }, 1) : 0; }));
  zet('ABS', overGetallen(function (r) { return Math.abs(r[0] || 0); }));
  zet('WORTEL|SQRT', overGetallen(function (r, h) { return r[0] < 0 ? h.FOUT.getal : Math.sqrt(r[0] || 0); }));
  zet('MACHT|POWER', overGetallen(function (r, h) {
    var v = Math.pow(r[0] || 0, r.length > 1 ? r[1] : 2);
    return isFinite(v) ? v : h.FOUT.getal;
  }));
  zet('EXP', overGetallen(function (r) { return Math.exp(r[0] || 0); }));
  zet('LN', overGetallen(function (r, h) { return r[0] > 0 ? Math.log(r[0]) : h.FOUT.getal; }));
  zet('LOG|LOG10', overGetallen(function (r, h) {
    if (!(r[0] > 0)) return h.FOUT.getal;
    return r.length > 1 ? Math.log(r[0]) / Math.log(r[1]) : Math.log(r[0]) / Math.LN10;
  }));
  zet('PI', function () { return Math.PI; });
  zet('INTEGER|INT', overGetallen(function (r) { return Math.floor(r[0] || 0); }));
  zet('REST|MOD', overGetallen(function (r, h) {
    if (!r[1]) return h.FOUT.deel;
    return r[0] - r[1] * Math.floor(r[0] / r[1]);          // tekenregel van het rekenblad, niet die van JS
  }));

  // Afronden. Negatieve decimalen ronden af op tientallen, honderdtallen, ...
  var rond = function (n, d, wijze) {
    var p = Math.pow(10, Math.max(-10, Math.min(10, d || 0)));
    var v = n * p;
    // een halve cent hoort omhoog te gaan, ook bij drijvende-kommaruis (2,675)
    if (wijze === 'boven') v = v >= 0 ? Math.ceil(v - 1e-9) : Math.floor(v + 1e-9);
    else if (wijze === 'beneden') v = v >= 0 ? Math.floor(v + 1e-9) : Math.ceil(v - 1e-9);
    else v = Math.sign(v) * Math.round(Math.abs(v) + 1e-9);
    return v / p;
  };
  zet('AFRONDEN|ROUND', overGetallen(function (r) { return rond(r[0] || 0, r.length > 1 ? r[1] : 0); }));
  zet('AFRONDEN.NAAR.BOVEN|ROUNDUP', overGetallen(function (r) { return rond(r[0] || 0, r.length > 1 ? r[1] : 0, 'boven'); }));
  zet('AFRONDEN.NAAR.BENEDEN|ROUNDDOWN', overGetallen(function (r) { return rond(r[0] || 0, r.length > 1 ? r[1] : 0, 'beneden'); }));

  /* ---- tellen en gemiddelden ---- */
  zet('GEMIDDELDE|GEM|AVERAGE', overGetallen(function (r, h) { return r.length ? som(r) / r.length : h.FOUT.deel; }));
  zet('MIN', overGetallen(function (r) { return r.length ? Math.min.apply(null, r) : 0; }));
  zet('MAX', overGetallen(function (r) { return r.length ? Math.max.apply(null, r) : 0; }));
  zet('AANTAL|COUNT', function (lui, h) {
    try { return getallen(lui, h).length; } catch (e) { return (e && e.fout) || h.FOUT.waarde; }
  });
  // AANTALARG telt alles wat niet leeg is, dus ook tekst. Dat verschil is het
  // hele punt van twee functies.
  zet('AANTALARG|COUNTA', function (lui, h) {
    try {
      return plat(lui, h).filter(function (v) { return v !== '' && v != null; }).length;
    } catch (e) { return (e && e.fout) || h.FOUT.waarde; }
  });
  zet('MEDIAAN|MEDIAN', overGetallen(function (r, h) {
    if (!r.length) return h.FOUT.deel;
    var s = r.slice().sort(function (a, b) { return a - b; }), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }));
  zet('STDEV|STDEVA|STDEV.S', overGetallen(function (r, h) {
    if (r.length < 2) return h.FOUT.deel;
    var g = som(r) / r.length;
    return Math.sqrt(som(r.map(function (x) { return (x - g) * (x - g); })) / (r.length - 1));
  }));
  var nde = function (omhoog) {
    return function (lui, h) {
      try {
        var n = h.getalVan(lui[lui.length - 1]());
        var r = getallen(lui.slice(0, -1), h).sort(function (a, b) { return omhoog ? a - b : b - a; });
        return (n >= 1 && n <= r.length) ? r[Math.round(n) - 1] : h.FOUT.getal;
      } catch (e) { return (e && e.fout) || h.FOUT.waarde; }
    };
  };
  zet('GROOTSTE|LARGE', nde(false));
  zet('KLEINSTE|SMALL', nde(true));

  var api = { tabel: tabel, zet: zet, plat: plat, getallen: getallen, overGetallen: overGetallen };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; [require('./rekenfuncties2.js'), require('./rekenfuncties3.js')].forEach(function (f) { f(api); }); return; }
  root.RTGRekenfuncties = api;
})(typeof self !== 'undefined' ? self : this);
