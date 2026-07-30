/* RTG Office: de functies van het rekenblad (deel 2: voorwaarden, logica, geld).

   Vult dezelfde tabel als shared/rekenfuncties.js. Hier staan de functies die
   een KEUZE maken in plaats van een som: tel alleen op wat aan een voorwaarde
   voldoet, doe dit of dat, en de geldsommen waar mensen anders een rekenmachine
   bij pakken.

   De luiheid van de argumenten is hier zichtbaar: ALS() raakt maar één tak aan,
   en EN/OF stoppen zodra de uitkomst vaststaat. */
(function (root) {
  'use strict';

  function aanvullen(api) {
    var zet = api.zet, plat = api.plat, getallen = api.getallen;
    var som = function (r) { return r.reduce(function (a, x) { return a + x; }, 0); };

    /* ---- voorwaarden ----
       De criteria van een rekenblad: ">100", "<=0", "appel", "<>". Ze staan als
       TEKST in een cel of formule, en dat is precies waarom ze een eigen kleine
       lezer krijgen in plaats van dat we ze door de rekenmotor duwen. */
    function toets(criterium, h) {
      var s = String(criterium == null ? '' : criterium).trim();
      var m = /^(<=|>=|<>|=|<|>)(.*)$/.exec(s);
      var op = m ? m[1] : '=', rest = m ? m[2].trim() : s;
      var getal = h.isGetallig(rest) ? h.getalVan(rest) : null;
      return function (waarde) {
        if (getal !== null && h.isGetallig(waarde)) {
          var n = h.getalVan(waarde);
          return op === '=' ? n === getal : op === '<>' ? n !== getal : op === '<' ? n < getal
            : op === '>' ? n > getal : op === '<=' ? n <= getal : n >= getal;
        }
        var a = h.tekstVan(waarde).toLowerCase(), c = rest.toLowerCase();
        return op === '<>' ? a !== c : op === '=' ? a === c : false;
      };
    }
    // SOM.ALS(bereik; criterium; [optelbereik]) -- het derde bereik is optioneel,
    // net als elders, want vaak toets je in kolom A en tel je kolom B op.
    function metCriterium(watDoen) {
      return function (lui, h) {
        try {
          var kijk = lui[0](), crit = lui[1] ? lui[1]() : '', pak = lui[2] ? lui[2]() : null;
          if (h.isFout(kijk) || h.isFout(crit)) return h.isFout(kijk) ? kijk : crit;
          var rij = (kijk && kijk.bereik) ? kijk.plat() : [kijk];
          var op = (pak && pak.bereik) ? pak.plat() : (pak != null ? [pak] : rij);
          var raak = toets(crit, h), uit = [];
          for (var i = 0; i < rij.length; i++) if (raak(rij[i])) uit.push(op[i]);
          return watDoen(uit, h);
        } catch (e) { return (e && e.fout) || h.FOUT.waarde; }
      };
    }
    zet('SOM.ALS|SUMIF', metCriterium(function (uit, h) {
      return som(uit.filter(h.isGetallig).map(h.getalVan));
    }));
    zet('AANTAL.ALS|COUNTIF', metCriterium(function (uit) { return uit.length; }));
    zet('GEMIDDELDE.ALS|GEM.ALS|AVERAGEIF', metCriterium(function (uit, h) {
      var g = uit.filter(h.isGetallig).map(h.getalVan);
      return g.length ? som(g) / g.length : h.FOUT.deel;
    }));

    // SOMPRODUCT: twee bereiken paarsgewijs vermenigvuldigen en optellen. De
    // werkpaardfunctie van iedere begroting.
    zet('SOMPRODUCT|SUMPRODUCT', function (lui, h) {
      try {
        var rijen = lui.map(function (f) { var v = f(); if (h.isFout(v)) throw { fout: v }; return (v && v.bereik) ? v.plat() : [v]; });
        if (!rijen.length) return 0;
        var n = Math.min.apply(null, rijen.map(function (r) { return r.length; }));
        var t = 0;
        for (var i = 0; i < n; i++) {
          var p = 1;
          for (var j = 0; j < rijen.length; j++) p *= h.getalVan(rijen[j][i]);
          t += p;
        }
        return t;
      } catch (e) { return (e && e.fout) || h.FOUT.waarde; }
    });

    /* ---- logica ----
       Hier is de luiheid van de argumenten zichtbaar: ALS raakt maar één tak aan,
       en EN/OF stoppen zodra de uitkomst vaststaat. */
    var waarheid = function (v, h) {
      if (typeof v === 'boolean') return v;
      if (h.isGetallig(v)) return h.getalVan(v) !== 0;
      var s = h.tekstVan(v).toUpperCase();
      return s === 'WAAR' || s === 'TRUE';
    };
    zet('ALS|IF', function (lui, h) {
      if (lui.length < 2) return h.FOUT.waarde;
      var v = lui[0]();
      if (h.isFout(v)) return v;
      if (waarheid(v, h)) return lui[1]();
      return lui[2] ? lui[2]() : false;
    });
    zet('EN|AND', function (lui, h) {
      for (var i = 0; i < lui.length; i++) {
        var v = lui[i](); if (h.isFout(v)) return v;
        var rij = (v && v.bereik) ? v.plat() : [v];
        for (var j = 0; j < rij.length; j++) if (!waarheid(rij[j], h)) return false;
      }
      return true;
    });
    zet('OF|OR', function (lui, h) {
      for (var i = 0; i < lui.length; i++) {
        var v = lui[i](); if (h.isFout(v)) return v;
        var rij = (v && v.bereik) ? v.plat() : [v];
        for (var j = 0; j < rij.length; j++) if (waarheid(rij[j], h)) return true;
      }
      return false;
    });
    zet('NIET|NOT', function (lui, h) {
      var v = lui[0] ? lui[0]() : false;
      return h.isFout(v) ? v : !waarheid(v, h);
    });
    /* ALS.FOUT is de functie die een blad leesbaar houdt: hij vangt een fout op
       ZONDER hem te verbergen, want jij hebt zelf gezegd wat er dan moet staan. */
    zet('ALS.FOUT|IFERROR', function (lui, h) {
      var v = lui[0] ? lui[0]() : h.FOUT.waarde;
      return h.isFout(v) ? (lui[1] ? lui[1]() : '') : v;
    });
    var isNet = function (test) {
      return function (lui, h) {
        var v = lui[0] ? lui[0]() : '';
        if (v && v.bereik) v = v.plat()[0];
        return test(v, h);
      };
    };
    zet('ISFOUT|ISERROR', isNet(function (v, h) { return h.isFout(v); }));
    zet('ISLEEG|ISBLANK', isNet(function (v) { return v === '' || v == null; }));
    zet('ISGETAL|ISNUMBER', isNet(function (v, h) { return !h.isFout(v) && v !== '' && h.isGetallig(v); }));
    zet('ISTEKST|ISTEXT', isNet(function (v, h) { return !h.isFout(v) && v !== '' && !h.isGetallig(v) && typeof v !== 'boolean'; }));

    /* ---- geld ----
       Genoeg om een aflossing, een eindwaarde of een contante waarde uit te
       rekenen. Wat er NIET bij komt is een rendementsvoorspeller: die zou een
       belofte doen die niemand kan waarmaken. */
    zet('BET|PMT', function (lui, h) {
      var r = h.getalVan(lui[0] ? lui[0]() : 0), n = h.getalVan(lui[1] ? lui[1]() : 0);
      var hw = h.getalVan(lui[2] ? lui[2]() : 0);
      if (!n) return h.FOUT.deel;
      if (!r) return -hw / n;
      return -(hw * r) / (1 - Math.pow(1 + r, -n));
    });
    zet('TW|FV', function (lui, h) {
      var r = h.getalVan(lui[0] ? lui[0]() : 0), n = h.getalVan(lui[1] ? lui[1]() : 0);
      var bet = h.getalVan(lui[2] ? lui[2]() : 0), hw = h.getalVan(lui[3] ? lui[3]() : 0);
      if (!r) return -(hw + bet * n);
      var g = Math.pow(1 + r, n);
      return -(hw * g + bet * (g - 1) / r);
    });
    zet('HW|PV', function (lui, h) {
      var r = h.getalVan(lui[0] ? lui[0]() : 0), n = h.getalVan(lui[1] ? lui[1]() : 0);
      var bet = h.getalVan(lui[2] ? lui[2]() : 0);
      if (!r) return -bet * n;
      return -bet * (1 - Math.pow(1 + r, -n)) / r;
    });
    // BTW is geen standaardfunctie, maar wel wat hier het vaakst met de hand
    // wordt uitgerekend -- en dan met een verkeerd percentage.
    zet('BTW', function (lui, h) {
      var bedrag = h.getalVan(lui[0] ? lui[0]() : 0);
      var pct = lui[1] ? h.getalVan(lui[1]()) : 0.21;
      if (pct > 1) pct = pct / 100;
      return bedrag * pct;
    });
    api.toets = toets;
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = aanvullen; return; }
  if (root.RTGRekenfuncties) aanvullen(root.RTGRekenfuncties);
})(typeof self !== 'undefined' ? self : this);
