/* RTG Office, tabellen in het tekstdocument: invoegen en onderhouden.

   Een kantoortekst zonder tabellen is een brief. De knop kijkt waar u
   staat: buiten een tabel voegt hij er een in (kop-rij plus cellen, u
   kiest de maat); staat de cursor IN een tabel, dan krijgt u rijen en
   kolommen erbij of eraf, precies op die plek. De tabel is gewone HTML in
   het document -- hij bewaart, exporteert en drukt af als alles hier.

   Gebruikt het paneel van bladpro (RTGOfficeBladPro.hulp); twee keer
   hetzelfde venster bouwen is twee keer hetzelfde onderhoud.
   Levert window.RTGOfficeTekstTabel. */
(function () {
  'use strict';

  function celBij(vel) {
    var s = window.getSelection();
    var n = s && s.rangeCount ? s.anchorNode : null;
    while (n && n !== vel) {
      if (n.tagName === 'TD' || n.tagName === 'TH') return n;
      n = n.parentNode;
    }
    return null;
  }

  function invoegen(vel, onWijzig) {
    var H = window.RTGOfficeBladPro.hulp;
    // de plek onthouden: de klik op de knop haalt de focus uit het document
    var s = window.getSelection();
    var reeks = s && s.rangeCount && vel.contains(s.anchorNode) ? s.getRangeAt(0).cloneRange() : null;
    var p = H.paneel('Tabel invoegen');
    var rijen = H.velden(p, 'Rijen (zonder de kop)', 3);
    var kolommen = H.velden(p, 'Kolommen', 3);
    p.appendChild(H.el('p', 'bpstil', 'De eerste rij is de kop. Eenmaal ingevoegd: klik in de tabel en ' +
      'druk opnieuw op Tabel voor rijen en kolommen erbij of eraf.'));
    var rij = H.el('div', 'bprij');
    rij.appendChild(H.knop('Invoegen', function () {
      var r = Math.max(1, Math.min(30, Math.round(+rijen.value) || 3));
      var k = Math.max(1, Math.min(10, Math.round(+kolommen.value) || 3));
      var html = '<table><tr>';
      for (var i = 0; i < k; i++) html += '<th><br></th>';
      html += '</tr>';
      for (var j = 0; j < r; j++) { html += '<tr>'; for (i = 0; i < k; i++) html += '<td><br></td>'; html += '</tr>'; }
      html += '</table><p><br></p>';
      vel.focus();
      if (reeks) { s.removeAllRanges(); s.addRange(reeks); }
      document.execCommand('insertHTML', false, html);
      onWijzig(); H.sluit();
    }));
    p.appendChild(rij);
  }

  function onderhoud(vel, onWijzig, cel) {
    var H = window.RTGOfficeBladPro.hulp;
    var tabel = cel; while (tabel && tabel.tagName !== 'TABLE') tabel = tabel.parentNode;
    var tr = cel.parentNode, idx = cel.cellIndex;
    var p = H.paneel('Tabel: rijen en kolommen');
    p.appendChild(H.el('p', 'bpstil', 'Op de plek waar u staat. Weghalen kan tot er een rij of kolom over is.'));
    var doe = function (fn) { return function () { fn(); onWijzig(); H.sluit(); }; };
    var rij = H.el('div', 'bprij');
    rij.appendChild(H.knop('Rij erbij', doe(function () {
      var nieuw = document.createElement('tr');
      for (var i = 0; i < tr.cells.length; i++) { var td = document.createElement('td'); td.innerHTML = '<br>'; nieuw.appendChild(td); }
      tr.parentNode.insertBefore(nieuw, tr.nextSibling);
    })));
    rij.appendChild(H.knop('Rij weg', doe(function () {
      if (tabel.rows.length > 1) tr.parentNode.removeChild(tr);
    })));
    p.appendChild(rij);
    var rij2 = H.el('div', 'bprij');
    rij2.appendChild(H.knop('Kolom erbij', doe(function () {
      Array.prototype.forEach.call(tabel.rows, function (r) {
        var c = document.createElement(r.cells[0] && r.cells[0].tagName === 'TH' ? 'th' : 'td');
        c.innerHTML = '<br>';
        var na = r.cells[idx];
        r.insertBefore(c, na ? na.nextSibling : null);
      });
    })));
    rij2.appendChild(H.knop('Kolom weg', doe(function () {
      if (tabel.rows[0].cells.length <= 1) return;
      Array.prototype.forEach.call(tabel.rows, function (r) { if (r.cells[idx]) r.removeChild(r.cells[idx]); });
    })));
    p.appendChild(rij2);
    var rij3 = H.el('div', 'bprij');
    rij3.appendChild(H.knop('Hele tabel weg', doe(function () {
      if (confirm('Deze tabel en alles erin weghalen?')) tabel.parentNode.removeChild(tabel);
    })));
    p.appendChild(rij3);
  }

  /* De tabel-knop in de werkbalk (tekst.js) roept dit aan: buiten een tabel
     invoegen, erbinnen onderhouden. */
  window.RTGOfficeTekstTabel = {
    open: function (vel, onWijzig) {
      var cel = celBij(vel);
      if (cel) onderhoud(vel, onWijzig, cel); else invoegen(vel, onWijzig);
    }
  };
})();
