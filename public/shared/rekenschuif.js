/* RTG Office: verwijzingen meeschuiven bij kopiëren, plakken en doorvoeren.

   Wie =B2*C2 kopieert van rij 2 naar rij 3 bedoelt =B3*C3 -- dat is de
   afspraak van elk rekenblad, en zonder deze laag is plakken een leugen.
   Een dollarteken zet een deel vast: $B2 houdt zijn kolom, B$2 zijn rij,
   $B$2 allebei. Tekst tussen aanhalingstekens blijft met rust ("A1" in een
   opschrift is geen verwijzing), en een functienaam als LOG10 ook.

   Schuift een verwijzing van het blad af (boven rij 1, links van kolom A),
   dan wordt de hele formule #VERW! -- als tekst in de cel, zodat de fout
   ZICHTBAAR is en doorwerkt in alles wat naar deze cel wijst. Stilletjes
   klemmen zou een andere som opleveren die er geloofwaardig uitziet; dat
   is precies de soort fout die dit pakket weigert.

   Levert window.RTGRekenschuif (en module.exports voor de test). */
(function (root) {
  'use strict';
  function kolIndex(naam) {
    var s = String(naam || '').toUpperCase(), n = 0;
    for (var i = 0; i < s.length; i++) n = n * 26 + (s.charCodeAt(i) - 64);
    return n - 1;
  }
  function kolNaam(i) {
    var s = '';
    i = Math.max(0, i | 0);
    do { s = String.fromCharCode(65 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
    return s;
  }

  /* De verwijzing zoals de lezer hem kent ($A$1, AA12), maar hier mag er
     geen letter, cijfer of haakje-openen op volgen: LOG10( is een functie
     en AB12CD is een naam, geen verwijzing met een staart. */
  var REF = /^(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![A-Za-z0-9_.(])/;

  function verschuif(formule, dRij, dKol) {
    var s = String(formule == null ? '' : formule);
    if (s.charAt(0) !== '=') return s;          // gewone tekst schuift niet
    if (!dRij && !dKol) return s;
    var uit = '', i = 0, kapot = false;
    while (i < s.length) {
      var c = s.charAt(i);
      if (c === '"') {                           // tekst letterlijk overnemen
        var j = i + 1;
        while (j < s.length) {
          if (s.charAt(j) === '"') { if (s.charAt(j + 1) === '"') { j += 2; continue; } j++; break; }
          j++;
        }
        uit += s.slice(i, j); i = j; continue;
      }
      var m = REF.exec(s.slice(i));
      // het teken ervoor mag geen deel van een naam zijn (anders is dit de
      // staart van iets anders, zoals de 10 in LOG10 of de B2 in TAB2X)
      if (m && !/[A-Za-z0-9_.$]/.test(uit.slice(-1))) {
        var kol = kolIndex(m[2]) + (m[1] ? 0 : dKol);
        var rij = (+m[4] - 1) + (m[3] ? 0 : dRij);
        if (kol < 0 || rij < 0) kapot = true;
        uit += m[1] + kolNaam(kol) + m[3] + (rij + 1);
        i += m[0].length; continue;
      }
      uit += c; i++;
    }
    return kapot ? '#VERW!' : uit;
  }

  var api = { verschuif: verschuif, kolNaam: kolNaam, kolIndex: kolIndex };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.RTGRekenschuif = api;
})(typeof self !== 'undefined' ? self : this);
