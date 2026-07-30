/* RTG Office: de functies van het rekenblad (deel 3: tekst, zoeken, datums).

   Vult dezelfde tabel als shared/rekenfuncties.js en -2.js; opgeknipt omdat een
   functielijst nu eenmaal doorgroeit en een bestand van 20 KB niemand meer
   leest.

   DATUMS ZIJN HIER GEWOON TEKST: 2026-07-26. De grote rekenbladen bewaren een
   datum als een volgnummer sinds 1900, met een schrikkeljaar dat nooit bestaan
   heeft erin verwerkt. Dat is een halve eeuw sleepgewicht dat wij niet hoeven
   over te nemen: wie in een cel "2026-07-26" ziet staan, weet wat het is, en
   DAGEN() rekent het verschil net zo goed uit. De prijs is dat een datum niet
   zomaar optelbaar is met +1; daarvoor is er DATUM.PLUS(). Een eerlijke ruil,
   en hij staat hier opgeschreven. */
(function (root) {
  'use strict';

  function aanvullen(api) {
    var zet = api.zet, plat = api.plat, toets = api.toets;

    /* ---- tekst ---- */
    zet('TEKST.SAMENVOEGEN|CONCATENATE|TEKST.COMBINEREN', function (lui, h) {
      try { return plat(lui, h).map(h.tekstVan).join(''); } catch (e) { return (e && e.fout) || h.FOUT.waarde; }
    });
    var stuk = function (hoe) {
      return function (lui, h) {
        var t = h.tekstVan(lui[0] ? lui[0]() : '');
        var n = lui[1] ? Math.round(h.getalVan(lui[1]())) : 1;
        var m = lui[2] ? Math.round(h.getalVan(lui[2]())) : 1;
        if (h.isFout(t)) return t;
        return hoe(t, n, m);
      };
    };
    zet('LINKS|LEFT', stuk(function (t, n) { return t.slice(0, Math.max(0, n)); }));
    zet('RECHTS|RIGHT', stuk(function (t, n) { return n <= 0 ? '' : t.slice(-n); }));
    // DEEL(tekst; start; aantal): de eerste letter is 1, niet 0. Zo telt een mens.
    zet('DEEL|MID', stuk(function (t, n, m) { return t.substr(Math.max(0, n - 1), Math.max(0, m)); }));
    zet('LENGTE|LEN', function (lui, h) { return h.tekstVan(lui[0] ? lui[0]() : '').length; });
    zet('HOOFDLETTERS|UPPER', function (lui, h) { return h.tekstVan(lui[0] ? lui[0]() : '').toUpperCase(); });
    zet('KLEINE.LETTERS|LOWER', function (lui, h) { return h.tekstVan(lui[0] ? lui[0]() : '').toLowerCase(); });
    zet('BEGINLETTERS|PROPER', function (lui, h) {
      return h.tekstVan(lui[0] ? lui[0]() : '').toLowerCase()
        .replace(/(^|[\s-])([a-zà-ÿ])/g, function (_, v, l) { return v + l.toUpperCase(); });
    });
    zet('SPATIES.WISSEN|TRIM', function (lui, h) {
      return h.tekstVan(lui[0] ? lui[0]() : '').replace(/\s+/g, ' ').trim();
    });
    zet('VERVANGEN|SUBSTITUTE', function (lui, h) {
      var t = h.tekstVan(lui[0] ? lui[0]() : ''), oud = h.tekstVan(lui[1] ? lui[1]() : '');
      var nieuw = h.tekstVan(lui[2] ? lui[2]() : '');
      return oud ? t.split(oud).join(nieuw) : t;
    });
    zet('VIND.SPEC|FIND|VIND.ALLES|SEARCH', function (lui, h) {
      var wat = h.tekstVan(lui[0] ? lui[0]() : ''), waarin = h.tekstVan(lui[1] ? lui[1]() : '');
      var i = waarin.toLowerCase().indexOf(wat.toLowerCase());
      return i < 0 ? h.FOUT.waarde : i + 1;
    });
    zet('WAARDE|VALUE', function (lui, h) {
      var v = lui[0] ? lui[0]() : '';
      return h.isFout(v) ? v : h.getalVan(v);
    });
    /* TEKST(getal; "0,00") -- alleen de opmaken die een mens hier echt nodig
       heeft. Een volledige opmaaktaal nabouwen levert een handleiding op waar
       niemand om vroeg; de opmaakknoppen in de balk doen de rest. */
    zet('TEKST|TEXT', function (lui, h) {
      var v = lui[0] ? lui[0]() : '';
      if (h.isFout(v)) return v;
      var vorm = h.tekstVan(lui[1] ? lui[1]() : '').toLowerCase();
      var n = h.getalVan(v);
      var dec = (vorm.match(/,(0+)/) || [null, ''])[1].length;
      var s = Math.abs(n).toFixed(dec);
      if (/#\.##|\.000/.test(vorm) || vorm.indexOf('€') >= 0) {
        var d = s.split('.');
        d[0] = d[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        s = d.join(',');
      } else s = s.replace('.', ',');
      return (n < 0 ? '-' : '') + (vorm.indexOf('€') >= 0 ? '€ ' : '') + s + (vorm.indexOf('%') >= 0 ? '%' : '');
    });

    /* ---- zoeken ----
       VERT.ZOEKEN is de functie waarvoor mensen een rekenblad openen: haal bij
       deze naam het bijbehorende getal op. Standaard EXACT zoeken. De grote
       programma's zoeken standaard bij benadering, en dat is de bron van
       ontelbare stille fouten in de wereld -- wij draaien die keuze om. */
    function tabelVan(v) { return (v && v.bereik) ? v.rijen : null; }
    zet('VERT.ZOEKEN|VLOOKUP', function (lui, h) {
      var wat = lui[0] ? lui[0]() : '', tab = tabelVan(lui[1] ? lui[1]() : null);
      var kol = lui[2] ? Math.round(h.getalVan(lui[2]())) : 1;
      if (h.isFout(wat)) return wat;
      if (!tab || kol < 1) return h.FOUT.verw;
      var raak = toets('=' + h.tekstVan(wat), h);
      for (var r = 0; r < tab.length; r++) {
        if (raak(tab[r][0])) return kol <= tab[r].length ? tab[r][kol - 1] : h.FOUT.verw;
      }
      return h.FOUT.leeg;
    });
    zet('HORIZ.ZOEKEN|HLOOKUP', function (lui, h) {
      var wat = lui[0] ? lui[0]() : '', tab = tabelVan(lui[1] ? lui[1]() : null);
      var rij = lui[2] ? Math.round(h.getalVan(lui[2]())) : 1;
      if (h.isFout(wat)) return wat;
      if (!tab || !tab.length || rij < 1) return h.FOUT.verw;
      var raak = toets('=' + h.tekstVan(wat), h);
      for (var k = 0; k < tab[0].length; k++) {
        if (raak(tab[0][k])) return rij <= tab.length ? tab[rij - 1][k] : h.FOUT.verw;
      }
      return h.FOUT.leeg;
    });
    // INDEX(bereik; rij; [kolom]) -- 1 is de eerste, ook hier.
    zet('INDEX', function (lui, h) {
      var tab = tabelVan(lui[0] ? lui[0]() : null);
      if (!tab) return h.FOUT.verw;
      var r = lui[1] ? Math.round(h.getalVan(lui[1]())) : 1;
      var k = lui[2] ? Math.round(h.getalVan(lui[2]())) : 1;
      // bij een bereik van één kolom mag je de kolom weglaten, en andersom
      if (tab.length === 1 && !lui[2]) { k = r; r = 1; }
      if (r < 1 || r > tab.length || k < 1 || k > tab[r - 1].length) return h.FOUT.verw;
      return tab[r - 1][k - 1];
    });
    zet('VERGELIJKEN|MATCH', function (lui, h) {
      var wat = lui[0] ? lui[0]() : '', v = lui[1] ? lui[1]() : null;
      if (h.isFout(wat)) return wat;
      var rij = (v && v.bereik) ? v.plat() : null;
      if (!rij) return h.FOUT.verw;
      var raak = toets('=' + h.tekstVan(wat), h);
      for (var i = 0; i < rij.length; i++) if (raak(rij[i])) return i + 1;
      return h.FOUT.leeg;
    });

    /* ---- datums (ISO-tekst, zie de kop) ---- */
    var alsDatum = function (v, h) {
      var s = h.tekstVan(v).trim();
      var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
      if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);       // 26-07-2026, zoals men hier schrijft
      if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
      return null;
    };
    var isoVan = function (d) {
      return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') +
        '-' + String(d.getUTCDate()).padStart(2, '0');
    };
    var uitDatum = function (pak) {
      return function (lui, h) {
        var d = alsDatum(lui[0] ? lui[0]() : '', h);
        return d ? pak(d) : h.FOUT.waarde;
      };
    };
    zet('VANDAAG|TODAY', function () { return isoVan(new Date()); });
    zet('NU|NOW', function () { return new Date().toISOString().slice(0, 16).replace('T', ' '); });
    zet('JAAR|YEAR', uitDatum(function (d) { return d.getUTCFullYear(); }));
    zet('MAAND|MONTH', uitDatum(function (d) { return d.getUTCMonth() + 1; }));
    zet('DAG|DAY', uitDatum(function (d) { return d.getUTCDate(); }));
    // WEEKDAG: maandag is 1. De zondag-is-1-telling van de Amerikaanse
    // rekenbladen klopt hier met geen enkele agenda.
    zet('WEEKDAG|WEEKDAY', uitDatum(function (d) { return ((d.getUTCDay() + 6) % 7) + 1; }));
    zet('DATUM|DATE', function (lui, h) {
      var j = Math.round(h.getalVan(lui[0] ? lui[0]() : 0));
      var m = Math.round(h.getalVan(lui[1] ? lui[1]() : 1));
      var d = Math.round(h.getalVan(lui[2] ? lui[2]() : 1));
      var dt = new Date(Date.UTC(j, m - 1, d));
      return isNaN(dt.getTime()) ? h.FOUT.waarde : isoVan(dt);
    });
    zet('DAGEN|DAYS', function (lui, h) {
      var a = alsDatum(lui[0] ? lui[0]() : '', h), b = alsDatum(lui[1] ? lui[1]() : '', h);
      if (!a || !b) return h.FOUT.waarde;
      return Math.round((a - b) / 86400000);
    });
    zet('DATUM.PLUS|EDATE.DAGEN', function (lui, h) {
      var a = alsDatum(lui[0] ? lui[0]() : '', h);
      if (!a) return h.FOUT.waarde;
      return isoVan(new Date(a.getTime() + Math.round(h.getalVan(lui[1] ? lui[1]() : 0)) * 86400000));
    });

  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = aanvullen; return; }
  if (root.RTGRekenfuncties) aanvullen(root.RTGRekenfuncties);
})(typeof self !== 'undefined' ? self : this);
