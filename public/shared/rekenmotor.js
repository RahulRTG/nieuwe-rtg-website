/* RTG Office: de rekenaar van het rekenblad.

   De lezer (shared/rekenlezer.js) maakt van een formule een boom; hier wordt
   die boom een getal. En de functielijst (shared/rekenfuncties*.js) levert de
   namen. Drie bestanden, drie vragen: hoe staat het er, wat betekent het, en
   wat kan het.

   TWEE DINGEN DIE HIER VASTLIGGEN.

   1. EEN FOUT REIST OMHOOG EN BLIJFT ZICHTBAAR. #DEEL/0! wordt geen nul en
      #NAAM? wordt geen lege cel. Een rekenblad waarin een fout stilletjes
      verdwijnt is gevaarlijker dan een rekenblad dat niets kan: je gelooft de
      uitkomst.
   2. NEDERLANDS EN ENGELS ALLEBEI. Mensen plakken formules uit een ander
      programma, van een collega, van internet. SOM en SUM zijn hier dezelfde
      functie. Wat je typt blijft staan zoals je het typte.

   Levert window.RTGRekenmotor (en module.exports, zodat de test hem gewoon
   kan inladen). */
(function (root) {
  'use strict';
  var LEZER = root.RTGRekenlezer ||
    (typeof require === 'function' ? require('./rekenlezer.js') : { knip: function () { return null; }, ontleed: function () { return null; } });

  /* Kolommen tellen door na Z: A..Z, AA..ZZ. De oude motor kon alleen één
     letter aan; dat is een grens die niemand kan uitleggen. */
  function kolNaam(i) {
    var s = '';
    i = Math.max(0, i | 0);
    do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
    return s;
  }
  function kolIndex(naam) {
    var s = String(naam || '').toUpperCase(), n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }

  // De foutwaarden. Ze zijn tekst, want ze horen leesbaar in een cel te staan.
  var FOUT = { deel: '#DEEL/0!', naam: '#NAAM?', waarde: '#WAARDE!', verw: '#VERW!',
    lus: '#LUS!', getal: '#GETAL!', leeg: '#LEEG!' };
  var isFout = function (v) { return typeof v === 'string' && v.charAt(0) === '#' && v.slice(-1) === '!' || v === FOUT.naam; };

  /* Een getal uit tekst. Mensen typen 1234.5, 1.234,50 en 1234,5 door elkaar en
     bedoelen alle drie hetzelfde. Punten zijn pas duizendtekens als het er
     ondubbelzinnig naar uitziet; 0.215 blijft dus gewoon een decimaal getal. */
  function getalVan(waarde) {
    if (typeof waarde === 'number') return waarde;
    if (typeof waarde === 'boolean') return waarde ? 1 : 0;
    var s = String(waarde == null ? '' : waarde).trim().replace(/^€\s*/, '').replace(/%$/, '');
    if (!s) return 0;
    if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s) || /^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.indexOf(',') >= 0 && s.indexOf('.') < 0) s = s.replace(',', '.');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  var isGetallig = function (v) {
    if (typeof v === 'number' || typeof v === 'boolean') return true;
    var s = String(v == null ? '' : v).trim();
    return !!s && /^-?[\d.,€%\s]+$/.test(s) && /\d/.test(s);
  };

  /* ---- rekenen ----
     `bron.ruw(blad, kol, rij)` geeft terug wat er in een cel STAAT (dus de
     formule, niet de uitkomst). De motor rekent zelf verder; zo hoeft het
     scherm niets van volgorde of afhankelijkheden te weten. */
  function maak(bron) {
    var b = bron || {};
    var ruw = b.ruw || function () { return ''; };
    var standaard = b.blad || 'Blad1';
    var FUNCTIES = (root.RTGRekenfuncties && root.RTGRekenfuncties.tabel) ||
      (typeof require === 'function' ? require('./rekenfuncties.js').tabel : {});
    var bezig = {};                                   // voor kringverwijzingen

    function celWaarde(blad, kol, rij) {
      var sleutel = blad + '!' + kol + ',' + rij;
      if (bezig[sleutel]) return FOUT.lus;
      var rauw = ruw(blad, kol, rij);
      if (rauw == null || rauw === '') return '';
      if (String(rauw).charAt(0) !== '=') return isGetallig(rauw) ? getalVan(rauw) : rauw;
      bezig[sleutel] = true;
      try { return waarde(String(rauw).slice(1), blad); }
      finally { delete bezig[sleutel]; }
    }

    // Een bereik wordt pas uitgerekend als een functie ernaar vraagt; daarom
    // draagt het zijn cellen mee en niet zijn uitkomsten.
    function bereikVan(knoop, blad) {
      var k1 = Math.min(knoop.van.kol, knoop.tot.kol), k2 = Math.max(knoop.van.kol, knoop.tot.kol);
      var r1 = Math.min(knoop.van.rij, knoop.tot.rij), r2 = Math.max(knoop.van.rij, knoop.tot.rij);
      var blad2 = knoop.blad || blad;
      var rijen = [];
      for (var r = r1; r <= r2; r++) {
        var rij = [];
        for (var k = k1; k <= k2; k++) rij.push(celWaarde(blad2, k, r));
        rijen.push(rij);
      }
      return { bereik: true, rijen: rijen, kolommen: k2 - k1 + 1, hoogte: r2 - r1 + 1,
        plat: function () { return rijen.reduce(function (a, x) { return a.concat(x); }, []); } };
    }

    function reken(knoop, blad) {
      if (!knoop) return FOUT.waarde;
      switch (knoop.k) {
        case 'vast': return knoop.v;
        case 'onbekend': return FOUT.naam;
        case 'ref': return celWaarde(knoop.blad || blad, knoop.ref.kol, knoop.ref.rij);
        case 'bereik': return bereikVan(knoop, blad);
        case 'min': {
          var v = reken(knoop.a, blad);
          return isFout(v) ? v : (v && v.bereik ? FOUT.waarde : -getalVan(v));
        }
        case 'procent': {
          var p = reken(knoop.a, blad);
          return isFout(p) ? p : getalVan(p) / 100;
        }
        case 'op': return operator(knoop, blad);
        case 'roep': return roep(knoop, blad);
      }
      return FOUT.waarde;
    }

    function operator(knoop, blad) {
      var a = reken(knoop.a, blad); if (isFout(a)) return a;
      var c = reken(knoop.b, blad); if (isFout(c)) return c;
      if ((a && a.bereik) || (c && c.bereik)) return FOUT.waarde;
      var op = knoop.op;
      if (op === '&') return tekstVan(a) + tekstVan(c);
      if (['=', '<>', '<', '>', '<=', '>='].indexOf(op) >= 0) {
        /* Getallen met getallen, tekst met tekst -- anders vergelijk je appels.
           Een LEGE CEL telt daarbij als nul zodra de andere kant een getal is:
           =ALS(A1=0; 0; 1/A1) is precies de formule die mensen schrijven om
           delen door nul te vóórkomen, en die moet op een lege cel dus "waar"
           geven en niet alsnog #DEEL/0!. Leeg tegen leeg blijft tekst. */
        var telt = function (v) { return isGetallig(v) || v === ''; };
        var beide = (isGetallig(a) && telt(c)) || (isGetallig(c) && telt(a));
        var x = beide ? getalVan(a) : tekstVan(a).toLowerCase();
        var y = beide ? getalVan(c) : tekstVan(c).toLowerCase();
        return op === '=' ? x === y : op === '<>' ? x !== y : op === '<' ? x < y
          : op === '>' ? x > y : op === '<=' ? x <= y : x >= y;
      }
      var n = getalVan(a), m = getalVan(c);
      if (op === '+') return n + m;
      if (op === '-') return n - m;
      if (op === '*') return n * m;
      if (op === '/') return m === 0 ? FOUT.deel : n / m;
      if (op === '^') { var u = Math.pow(n, m); return isFinite(u) ? u : FOUT.getal; }
      return FOUT.waarde;
    }

    /* Een functie roepen. De argumenten worden NIET vooraf uitgerekend: een
       functie krijgt luie argumenten, zodat ALS() en ALS.FOUT() alleen de tak
       aanraken die ze nodig hebben. */
    function roep(knoop, blad) {
      var fn = FUNCTIES[knoop.naam];
      if (!fn) return FOUT.naam;
      var lui = knoop.arg.map(function (a) { return function () { return reken(a, blad); }; });
      try { return fn(lui, hulp); } catch (e) { return FOUT.waarde; }
    }

    function waarde(formule, blad) {
      var t = LEZER.knip(formule);
      if (!t || !t.length) return FOUT.waarde;
      var boom = LEZER.ontleed(t);
      if (!boom) return FOUT.waarde;
      var uit = reken(boom, blad || standaard);
      if (uit && uit.bereik) { var p = uit.plat(); return p.length === 1 ? p[0] : FOUT.waarde; }
      if (typeof uit === 'number' && !isFinite(uit)) return FOUT.getal;
      return uit;
    }

    var hulp = { getalVan: getalVan, tekstVan: tekstVan, isFout: isFout, isGetallig: isGetallig,
      FOUT: FOUT, kolNaam: kolNaam, kolIndex: kolIndex };

    return { waarde: waarde, celWaarde: celWaarde, hulp: hulp,
      // "wat staat er in deze cel, uitgerekend" -- de enige ingang voor het scherm
      cel: function (kol, rij, blad) { return celWaarde(blad || standaard, kol, rij); } };
  }

  function tekstVan(v) {
    if (v == null) return '';
    if (typeof v === 'boolean') return v ? 'WAAR' : 'ONWAAR';
    if (typeof v === 'number') return String(Math.round(v * 1e10) / 1e10).replace('.', ',');
    return String(v);
  }

  var api = { maak: maak, kolNaam: kolNaam, kolIndex: kolIndex, getalVan: getalVan,
    tekstVan: tekstVan, isFout: isFout, isGetallig: isGetallig, FOUT: FOUT, lezer: LEZER };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.RTGRekenmotor = api;
})(typeof self !== 'undefined' ? self : this);
