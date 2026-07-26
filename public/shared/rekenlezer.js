/* RTG Office: de lezer van het rekenblad -- van formuletekst naar een boom.

   EEN FORMULE DRAAIT HIER NOOIT ALS CODE. Geen eval, geen Function, geen
   omweg via een regexp die "toch alleen cijfers" doorlaat. Een document wordt
   gedeeld; een formule van een ander is dus altijd invoer van een vreemde.
   Daarom staat hier een echte ontleder: wat niet in de grammatica staat,
   bestaat niet. Dat is ook precies waarom lezen en rekenen twee bestanden
   zijn -- de grammatica is een ding om apart na te kunnen kijken.

   Er komt een BOOM uit en geen uitkomst, want ALS() mag zijn takken pas
   uitrekenen als hij weet welke het wordt: anders zou =ALS(A1=0;0;1/A1)
   alsnog door nul delen.

   Scheidingstekens volgen de Nederlandse afspraak: de KOMMA is een
   decimaalteken (1,21), de PUNTKOMMA scheidt argumenten. Een punt mag ook als
   decimaalteken, want half Europa typt het zo en het is ondubbelzinnig.

   Levert window.RTGRekenlezer (en module.exports voor de test). */
(function (root) {
  'use strict';
  var kolIndex = function (naam) {
    var s = String(naam || '').toUpperCase(), n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  };

  // Waar een verwijzing aan moet voldoen: $A$1, AA12, C7.
  var REF = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})$/;

  /* ---- in stukjes knippen ----
     Getallen, tekst tussen aanhalingstekens, verwijzingen (met of zonder
     bladnaam ervoor), namen en tekens. Komt er iets voorbij dat hier niet in
     staat, dan is de hele formule ongeldig -- niet "grotendeels goed". */
  function knip(bron) {
    var t = [], i = 0, s = String(bron);
    function verder(re) { var m = re.exec(s.slice(i)); if (m) { i += m[0].length; return m; } return null; }
    while (i < s.length) {
      var c = s.charAt(i);
      if (/\s/.test(c)) { i++; continue; }
      var m;
      if ((m = verder(/^\d+(?:[.,]\d+)?(?:[eE][-+]?\d+)?/))) { t.push({ s: 'getal', v: parseFloat(m[0].replace(',', '.')) }); continue; }
      if (c === '"') {
        var j = i + 1, uit = '', dicht = false;
        while (j < s.length) {
          if (s.charAt(j) === '"') { if (s.charAt(j + 1) === '"') { uit += '"'; j += 2; continue; } dicht = true; break; }
          uit += s.charAt(j); j++;
        }
        // Een aanhalingsteken dat niet gesloten wordt is geen tekst maar een
        // typefout: de formule betekent dan iets anders dan de maker denkt.
        // Half accepteren zou die fout onzichtbaar maken.
        if (!dicht) return null;
        i = j + 1; t.push({ s: 'tekst', v: uit }); continue;
      }
      // een bladnaam voor een verwijzing: Blad2!A1 of 'Mijn blad'!A1
      if ((m = verder(/^'([^']+)'!/)) || (m = verder(/^([A-Za-z_][A-Za-z0-9 _]*)!(?=\$?[A-Za-z]{1,3}\$?\d)/))) {
        t.push({ s: 'blad', v: m[1] }); continue;
      }
      if ((m = verder(/^\$?[A-Za-z]{1,3}\$?\d{1,7}(?![A-Za-z0-9_.])/))) {
        var r = REF.exec(m[0]);
        t.push({ s: 'ref', kol: kolIndex(r[2]), rij: +r[4] - 1, vastK: r[1] === '$', vastR: r[3] === '$' });
        continue;
      }
      if ((m = verder(/^[A-Za-z_][A-Za-z0-9_.]*/))) {
        var naam = m[0].toUpperCase();
        if (naam === 'WAAR' || naam === 'TRUE') { t.push({ s: 'bool', v: true }); continue; }
        if (naam === 'ONWAAR' || naam === 'FALSE') { t.push({ s: 'bool', v: false }); continue; }
        t.push({ s: 'naam', v: naam }); continue;
      }
      if ((m = verder(/^(<=|>=|<>|[-+*/^&%()<>=;:])/))) { t.push({ s: m[0] }); continue; }
      return null;                                  // een teken dat hier niet hoort
    }
    return t;
  }

  /* ---- tot een boom maken ----
     Gewone recursieve afdaling, met de voorrang van een rekenblad: eerst
     haakjes en procent, dan machtsverheffen, dan keer en delen, dan plus en
     min, dan het plakken van tekst (&), en als laatste de vergelijkingen. */
  function ontleed(tokens) {
    var i = 0;
    var kijk = function () { return tokens[i] || { s: 'eind' }; };
    var hap = function (soort) { if (kijk().s === soort) { return tokens[i++]; } return null; };

    function primair() {
      var t = kijk();
      if (t.s === 'getal' || t.s === 'tekst' || t.s === 'bool') { i++; return { k: 'vast', v: t.v }; }
      if (t.s === '-') { i++; return { k: 'min', a: eenheid() }; }
      if (t.s === '+') { i++; return eenheid(); }
      if (t.s === '(') { i++; var b = vergelijk(); if (!hap(')')) return null; return b; }
      if (t.s === 'blad') { i++; var na = primair(); if (!na || (na.k !== 'ref' && na.k !== 'bereik')) return null; na.blad = t.v; return na; }
      if (t.s === 'ref') {
        i++;
        if (kijk().s === ':' && tokens[i + 1] && tokens[i + 1].s === 'ref') {
          i++; var tot = tokens[i++];
          return { k: 'bereik', van: t, tot: tot };
        }
        return { k: 'ref', ref: t };
      }
      if (t.s === 'naam') {
        i++;
        if (!hap('(')) return { k: 'onbekend', v: t.v };   // een kale naam bestaat niet
        var arg = [];
        if (kijk().s !== ')') {
          for (;;) {
            var a = vergelijk();
            if (!a) return null;
            arg.push(a);
            if (hap(';')) continue;
            break;
          }
        }
        if (!hap(')')) return null;
        return { k: 'roep', naam: t.v, arg: arg };
      }
      return null;
    }
    // procent achteraan: 21% is 0,21
    function eenheid() {
      var b = primair();
      while (b && kijk().s === '%') { i++; b = { k: 'procent', a: b }; }
      return b;
    }
    function macht() {
      var links = eenheid();
      if (links && kijk().s === '^') { i++; var rechts = macht(); if (!rechts) return null; return { k: 'op', op: '^', a: links, b: rechts }; }
      return links;
    }
    function product() {
      var b = macht();
      while (b && (kijk().s === '*' || kijk().s === '/')) {
        var op = tokens[i++].s, r = macht();
        if (!r) return null;
        b = { k: 'op', op: op, a: b, b: r };
      }
      return b;
    }
    function som() {
      var b = product();
      while (b && (kijk().s === '+' || kijk().s === '-')) {
        var op = tokens[i++].s, r = product();
        if (!r) return null;
        b = { k: 'op', op: op, a: b, b: r };
      }
      return b;
    }
    function plak() {
      var b = som();
      while (b && kijk().s === '&') { i++; var r = som(); if (!r) return null; b = { k: 'op', op: '&', a: b, b: r }; }
      return b;
    }
    function vergelijk() {
      var b = plak();
      while (b && ['=', '<>', '<', '>', '<=', '>='].indexOf(kijk().s) >= 0) {
        var op = tokens[i++].s, r = plak();
        if (!r) return null;
        b = { k: 'op', op: op, a: b, b: r };
      }
      return b;
    }
    var boom = vergelijk();
    if (!boom || i < tokens.length) return null;
    return boom;
  }

  var api = { knip: knip, ontleed: ontleed };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.RTGRekenlezer = api;
})(typeof self !== 'undefined' ? self : this);
