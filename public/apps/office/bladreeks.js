/* RTG Office, doorvoeren in het rekenblad: de cel waar u staat over een
   reeks uitrollen, omlaag of naar rechts, met verwijzingen die MEESCHUIVEN
   (shared/rekenschuif.js): =B2*C2 wordt op de volgende rij =B3*C3, en een
   dollarteken zet een deel vast. Eén Ctrl+Z haalt de hele reeks weer weg.

   Gebruikt het paneel en de veldjes van bladpro (RTGOfficeBladPro.hulp);
   twee keer hetzelfde venster bouwen is twee keer hetzelfde onderhoud.
   Levert window.RTGOfficeBladReeks. */
(function () {
  'use strict';
  var M = window.RTGRekenmotor;

  function open(blad) {
    if (!blad.mag()) return;
    var H = window.RTGOfficeBladPro.hulp, S = window.RTGRekenschuif;
    var hier = H.refVan(blad.actief());
    if (!hier) return;
    var d = blad.data();
    var p = H.paneel('Doorvoeren vanaf ' + blad.actief());
    p.appendChild(H.el('p', 'bpstil', 'De cel waar u staat wordt doorgevoerd; verwijzingen schuiven mee. ' +
      'Met een dollarteken staat een deel vast ($B$2 blijft $B$2). Ctrl+Z draait de hele reeks terug.'));

    function rol(refVanStap, aantal) {
      var bron = d.cellen[hier.kol + hier.rij] || '', groep = [];
      for (var n = 1; n <= aantal; n++) {
        var stap = refVanStap(n);
        groep.push({ ref: stap.ref, oud: d.cellen[stap.ref] });
        var w = S.verschuif(bron, stap.dr, stap.dk);
        if (w) d.cellen[stap.ref] = w; else delete d.cellen[stap.ref];
      }
      if (groep.length) { blad.onthoud(groep); blad.vernieuw(); }
      H.sluit();
    }

    var totR = H.velden(p, 'Omlaag tot en met rij', Math.min(d.rijen, hier.rij + 9));
    var rij = H.el('div', 'bprij');
    rij.appendChild(H.knop('Omlaag doorvoeren', function () {
      var b = Math.max(hier.rij, Math.min(d.rijen, +totR.value || hier.rij));
      rol(function (n) { return { ref: hier.kol + (hier.rij + n), dr: n, dk: 0 }; }, b - hier.rij);
    }));
    p.appendChild(rij);

    var van = M.kolIndex(hier.kol);
    var totK = H.velden(p, 'Rechts tot en met kolomnummer', Math.min(d.kolommen, van + 5));
    var rij2 = H.el('div', 'bprij');
    rij2.appendChild(H.knop('Rechts doorvoeren', function () {
      var b = Math.max(van + 1, Math.min(d.kolommen, +totK.value || van + 1)) - 1;
      rol(function (n) { return { ref: M.kolNaam(van + n) + hier.rij, dr: 0, dk: n }; }, b - van);
    }));
    p.appendChild(rij2);
  }

  window.RTGOfficeBladReeks = { open: open };
})();
