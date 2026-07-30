/* RTG Office, het rekenblad: de grafiek.

   Getekend met SVG, uit uw eigen cellen. Geen bibliotheek van een vreemde
   server -- die zou de beveiligingsregels van de app niet eens halen, en een
   staafje tekenen is geen werk waar je een pakket voor nodig hebt.

   Staven of een lijn, meer niet. Een taartdiagram komt er bewust niet: uit
   taartpunten leest niemand een verhouding beter af dan uit staven naast
   elkaar, en het staat er in andere programma's vooral omdat het er altijd
   al stond.

   Het paneel en de knoppen komen van apps/office/bladpro.js; dit bestand
   gaat alleen over het beeld. Levert window.RTGOfficeGrafiek. */
(function () {
  'use strict';
  var M = window.RTGRekenmotor;
  var P = window.RTGOfficeBladPro;
  if (!P) return;
  var el = P.hulp.el, knop = P.hulp.knop, paneel = P.hulp.paneel,
      velden = P.hulp.velden, refVan = P.hulp.refVan;

  function grafiek(blad) {
    var hier = refVan(blad.actief());
    if (!hier) return;
    var d = blad.data();
    var p = paneel('Grafiek van kolom ' + hier.kol);
    var van = velden(p, 'Van rij', 1), tot = velden(p, 'Tot en met rij', Math.min(d.rijen, 12));
    var labels = velden(p, 'Namen uit kolom (leeg = geen)', '');
    labels.type = 'text';
    labels.value = M.kolNaam(Math.max(0, M.kolIndex(hier.kol) - 1));
    var doek = el('div', 'bpdoek');
    var rij = el('div', 'bprij');
    var teken = function (soort) {
      return function () {
        var a = Math.max(1, +van.value || 1), b = Math.min(d.rijen, +tot.value || d.rijen);
        var punten = [];
        for (var r = a; r <= b; r++) {
          var w = blad.uitkomst(hier.kol + r);
          if (w === '' || M.isFout(w) || !M.isGetallig(w)) continue;
          punten.push({ v: M.getalVan(w),
            naam: labels.value ? M.tekstVan(blad.uitkomst(labels.value.toUpperCase() + r)) : String(r) });
        }
        doek.textContent = '';
        if (!punten.length) { doek.appendChild(el('p', 'bpstil', 'Geen getallen in dat stuk.')); return; }
        doek.appendChild(svg(punten, soort));
      };
    };
    rij.appendChild(knop('Staven', teken('staaf')));
    rij.appendChild(knop('Lijn', teken('lijn')));
    p.appendChild(rij);
    p.appendChild(doek);
    teken('staaf')();
  }

  function svg(punten, soort) {
    var B = 520, H = 220, marge = 28;
    var hoog = Math.max.apply(null, punten.map(function (p) { return p.v; }));
    var laag = Math.min.apply(null, punten.map(function (p) { return p.v; }));
    if (hoog === laag) { hoog = hoog + 1; laag = Math.min(0, laag); }
    laag = Math.min(0, laag);
    var y = function (v) { return H - marge - (v - laag) / (hoog - laag) * (H - 2 * marge); };
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 ' + B + ' ' + H);
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', 'Grafiek van ' + punten.length + ' waarden, van ' +
      M.tekstVan(laag) + ' tot ' + M.tekstVan(hoog));
    var mk = function (naam, kv) {
      var e = document.createElementNS(ns, naam);
      for (var k in kv) e.setAttribute(k, kv[k]);
      return e;
    };
    s.appendChild(mk('line', { x1: marge, y1: y(0), x2: B - marge, y2: y(0), class: 'as' }));
    var breed = (B - 2 * marge) / punten.length;
    if (soort === 'staaf') {
      punten.forEach(function (p, i) {
        var top = Math.min(y(p.v), y(0)), hh = Math.abs(y(p.v) - y(0));
        s.appendChild(mk('rect', { x: marge + i * breed + breed * 0.15, y: top,
          width: breed * 0.7, height: Math.max(1, hh), class: 'staaf' }));
      });
    } else {
      var pad = punten.map(function (p, i) {
        return (i ? 'L' : 'M') + (marge + i * breed + breed / 2) + ' ' + y(p.v);
      }).join(' ');
      s.appendChild(mk('path', { d: pad, class: 'lijn' }));
    }
    // de namen eronder, maar alleen zoveel als er leesbaar past
    var stap = Math.ceil(punten.length / 8);
    punten.forEach(function (p, i) {
      if (i % stap) return;
      var t = mk('text', { x: marge + i * breed + breed / 2, y: H - 8, class: 'bijschrift' });
      t.textContent = p.naam.slice(0, 10);
      s.appendChild(t);
    });
    return s;
  }

  window.RTGOfficeGrafiek = { open: grafiek };
})();
