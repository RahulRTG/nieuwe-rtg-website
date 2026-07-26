/* RTG Office, het rekenblad: de rekenmotor en het raster.

   Wat een blad tot een blad maakt is niet het hokjespatroon maar wat eromheen
   staat: een formulebalk die zegt in welke cel u staat en wat er echt in
   staat (de formule, niet de uitkomst), koppen die blijven staan als u naar
   beneden scrolt, opmaak per cel zodat geld er als geld uitziet, en onderaan
   de som van wat u geselecteerd heeft.

   De motor kent SOM/SUM, GEM/AVERAGE, MIN, MAX, AANTAL/COUNT, AFRONDEN/ROUND
   en ALS/IF, plus de gewone rekenkunde. Formules worden nooit als code
   uitgevoerd: na het invullen van de cellen blijft er alleen een som van
   cijfers en tekens over, en alles daarbuiten wordt geweigerd.

   Levert window.RTGOfficeBlad. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var kolLetter = function (i) { return String.fromCharCode(65 + i); };

  /* Een getal uit een cel lezen. Mensen typen 1234.5, 1.234,50 en 1234,5 door
     elkaar; alle drie horen hetzelfde te betekenen. Punten worden alleen als
     duizendteken weggehaald als het er ook echt naar uitziet. */
  function getalVan(waarde) {
    var s = String(waarde == null ? '' : waarde).trim();
    if (!s) return 0;
    // punten zijn pas duizendtekens als het er ondubbelzinnig naar uitziet:
    // meerdere groepen (1.234.567) of een komma erachter (1.234,50). Een los
    // 0.215 blijft dus gewoon een decimaal getal.
    if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s) || /^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else if (s.indexOf(',') >= 0 && s.indexOf('.') < 0) s = s.replace(',', '.');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /* Een fout die door de cellen heen omhoog reist, zodat #LUS en #DEEL/0
     bovenaan zichtbaar worden en niet stilletjes een nul worden. */
  function FoutMelding(melding) { this.melding = melding; }

  function maak(opties) {
    var tabel = opties.tabel, refVak = opties.refVak, invoer = opties.invoer,
        voet = opties.voet, onWijzig = opties.onWijzig;
    var data = { cellen: {}, opmaak: {}, rijen: 20, kolommen: 8 };
    var magBewerken = false, actief = 'A1';

    /* ---- rekenen ---- */
    function celGetal(ref, diepte) {
      var rauw = data.cellen[ref];
      if (rauw == null || rauw === '') return 0;
      if (String(rauw).charAt(0) === '=') {
        var v = bereken(rauw, diepte + 1);
        if (String(v).charAt(0) === '#') throw new FoutMelding(v);
        return parseFloat(v) || 0;
      }
      return getalVan(rauw);
    }
    function reeks(a, b, diepte) {
      var m1 = /^([A-Z]+)([0-9]+)$/.exec(a), m2 = /^([A-Z]+)([0-9]+)$/.exec(b);
      if (!m1 || !m2) return [];
      var c1 = m1[1].charCodeAt(0), c2 = m2[1].charCodeAt(0), r1 = +m1[2], r2 = +m2[2], uit = [];
      for (var c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
        for (var r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) uit.push(celGetal(String.fromCharCode(c) + r, diepte));
      return uit;
    }
    function bereken(formule, diepte) {
      diepte = diepte || 0;
      if (diepte > 30) return '#LUS';
      try {
        var ruw = String(formule).slice(1);
        // ALS(voorwaarde;dan;anders) is de enige functie die tekst teruggeeft;
        // die lezen we uit de formule zoals hij getypt is, zodat "Boven" ook
        // Boven blijft en niet in kapitalen verandert.
        var als = /^\s*(ALS|IF)\s*\((.+)\)\s*$/i.exec(ruw);
        if (als) return alsFunctie(als[2], diepte);
        var f = ruw.toUpperCase().replace(/\s+/g, '');
        // bereikfuncties
        f = f.replace(/(SOM|SUM|GEM|AVERAGE|MIN|MAX|AANTAL|COUNT)\(([A-Z]+[0-9]+):([A-Z]+[0-9]+)\)/g, function (_, fn, a, b) {
          var r = reeks(a, b, diepte);
          if (fn === 'SOM' || fn === 'SUM') return r.reduce(function (n, x) { return n + x; }, 0);
          if (fn === 'GEM' || fn === 'AVERAGE') return r.length ? r.reduce(function (n, x) { return n + x; }, 0) / r.length : 0;
          if (fn === 'MIN') return r.length ? Math.min.apply(null, r) : 0;
          if (fn === 'MAX') return r.length ? Math.max.apply(null, r) : 0;
          return r.length;
        });
        // AFRONDEN(waarde;decimalen)
        f = f.replace(/(AFRONDEN|ROUND)\(([^();]+);([0-9]+)\)/g, function (_, fn, w, n) {
          var v = rekenUit(w, diepte); var p = Math.pow(10, Math.min(6, +n));
          return String(Math.round(v * p) / p);
        });
        var uit = rekenUit(f, diepte);
        if (uit === null) return '#FOUT';
        if (!isFinite(uit)) return '#DEEL/0';
        return String(Math.round(uit * 10000) / 10000);
      } catch (e) { return (e && e.melding) ? e.melding : '#FOUT'; }
    }
    /* Een rekenkundige uitdrukking: eerst celverwijzingen invullen, dan alleen
       nog cijfers en tekens toestaan. Wat daar niet aan voldoet rekent niet. */
    function rekenUit(stuk, diepte) {
      var f = String(stuk).replace(/[A-Z]+[0-9]+/g, function (ref) { return celGetal(ref, diepte); });
      if (!/^[-+*/().0-9,\s]*$/.test(f)) return null;
      if (!f.trim()) return 0;
      try { return reken(f.replace(/,/g, '.')); }
      catch (e) { if (e && e.melding) throw e; return null; }
    }

    /* Het rekenaartje zelf: + - * / en haakjes, met de gewone voorrang.
       Bewust geen eval en geen Function: een formule uit een gedeeld document
       hoort nooit als code te draaien -- en de beveiligingsregels van de app
       staan dat terecht ook niet toe. */
    function reken(uitdruk) {
      var s = String(uitdruk), i = 0;
      function spatie() { while (i < s.length && s.charAt(i) === ' ') i++; }
      function waarde() {
        spatie();
        var c = s.charAt(i);
        if (c === '(') { i++; var v = som(); spatie(); if (s.charAt(i) === ')') i++; return v; }
        if (c === '-') { i++; return -waarde(); }
        if (c === '+') { i++; return waarde(); }
        var start = i;
        while (i < s.length && /[0-9.]/.test(s.charAt(i))) i++;
        if (i === start) throw new Error('geen getal');
        return parseFloat(s.slice(start, i));
      }
      function product() {
        var v = waarde();
        for (;;) {
          spatie();
          var c = s.charAt(i);
          if (c === '*') { i++; v *= waarde(); }
          else if (c === '/') { i++; v /= waarde(); }
          else return v;
        }
      }
      function som() {
        var v = product();
        for (;;) {
          spatie();
          var c = s.charAt(i);
          if (c === '+') { i++; v += product(); }
          else if (c === '-') { i++; v -= product(); }
          else return v;
        }
      }
      var uit = som();
      spatie();
      if (i < s.length) throw new Error('onbegrepen rest');
      return uit;
    }
    function alsFunctie(binnen, diepte) {
      var deel = splitsOpPuntkomma(binnen);
      if (deel.length < 2) return '#FOUT';
      var v = /^(.+?)(<=|>=|<>|=|<|>)(.+)$/.exec(deel[0].toUpperCase().replace(/\s+/g, ''));
      if (!v) return '#FOUT';
      var links = rekenUit(v[1], diepte), rechts = rekenUit(v[3], diepte);
      if (links === null || rechts === null) return '#FOUT';
      var waar = v[2] === '=' ? links === rechts : v[2] === '<>' ? links !== rechts
        : v[2] === '<' ? links < rechts : v[2] === '>' ? links > rechts
        : v[2] === '<=' ? links <= rechts : links >= rechts;
      var uit = String(waar ? deel[1] : (deel[2] || '')).trim();
      var q = /^"(.*)"$/.exec(uit);
      if (q) return q[1];
      var g = rekenUit(uit.toUpperCase().replace(/\s+/g, ''), diepte);
      return g === null ? '#FOUT' : String(Math.round(g * 10000) / 10000);
    }
    function splitsOpPuntkomma(s) {
      var uit = [], diep = 0, huidig = '';
      for (var i = 0; i < s.length; i++) {
        var c = s.charAt(i);
        if (c === '(') diep++; if (c === ')') diep--;
        if (c === ';' && diep === 0) { uit.push(huidig); huidig = ''; } else huidig += c;
      }
      uit.push(huidig);
      return uit;
    }

    /* ---- tonen: de opmaak bepaalt hoe een uitkomst eruitziet ---- */
    function toonWaarde(ref) {
      var rauw = data.cellen[ref] || '';
      var uit = String(rauw).charAt(0) === '=' ? bereken(rauw) : rauw;
      var op = data.opmaak[ref];
      if (uit === '' || uit == null) return '';
      if (op === 'geld' || op === 'getal' || op === 'procent') {
        if (String(uit).charAt(0) === '#' || !/[0-9]/.test(String(uit))) return uit;
        var n = getalVan(uit);
        if (op === 'procent') return (Math.round(n * 1000) / 10).toString().replace('.', ',') + '%';
        var s = Math.abs(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return (n < 0 ? '-' : '') + (op === 'geld' ? '€ ' : '') + s;
      }
      return uit;
    }

    function teken() {
      var h = '<thead><tr><th></th>';
      for (var c = 0; c < data.kolommen; c++) h += '<th>' + kolLetter(c) + '</th>';
      h += '</tr></thead><tbody>';
      for (var r = 1; r <= data.rijen; r++) {
        h += '<tr><td class="rijkop">' + r + '</td>';
        for (var k = 0; k < data.kolommen; k++) {
          var ref = kolLetter(k) + r;
          var rauw = data.cellen[ref] || '';
          var isForm = String(rauw).charAt(0) === '=';
          var toon = toonWaarde(ref);
          var klas = (data.opmaak[ref] === 'kop' ? 'kopcel' : (data.opmaak[ref] || ''));
          if (String(toon).charAt(0) === '#') klas += ' fout';
          if (ref === actief) klas += ' actief';
          h += '<td tabindex="0" data-ref="' + ref + '"' + (isForm ? ' data-berekend="1"' : '') +
            (klas ? ' class="' + klas.trim() + '"' : '') + '>' + esc(toon) + '</td>';
        }
        h += '</tr>';
      }
      tabel.innerHTML = h + '</tbody>';
