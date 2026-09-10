/* Eén lege staat voor elke Living Module. Het vlak gebruikt de huisbrede
   RTGLeeg-grammatica en wijst naar de echte functie die de ontbrekende inhoud
   kan maken. De module houdt alleen de bestemming in eigendom. */
(function (w, d) {
  'use strict';
  function fallback(o) {
    var n = d.createElement(o.pad ? 'a' : 'div');
    n.className = 'rtg-leeg-vlak' + (o.pad ? ' rtg-leeg-vlak--actie' : '');
    if (o.pad) n.href = o.pad;
    var ey = d.createElement('span'); ey.className = 'rtg-leeg-ey'; ey.textContent = o.ey || 'RTG'; n.appendChild(ey);
    var b = d.createElement('b'); b.textContent = o.titel || ''; n.appendChild(b);
    if (o.wat) { var p = d.createElement('p'); p.textContent = o.wat; n.appendChild(p); }
    if (o.pad) { var s = d.createElement('span'); s.className = 'rtg-leeg-actie'; s.textContent = o.tekst || 'Aanvullen'; n.appendChild(s); }
    return n;
  }
  function maak(o) {
    o = o || {};
    var stappen = o.pad ? [{ tekst: o.tekst || 'Aanvullen', pad: o.pad }] : [];
    var n = w.RTGLeeg && w.RTGLeeg.vlak ? w.RTGLeeg.vlak({ ey: o.ey, titel: o.titel, wat: o.wat, stappen: stappen }) : fallback(o);
    n.classList.add('rtg-workspace-empty');
    if (o.pad) n.dataset.ssUrl = o.pad;
    return n;
  }
  w.RTGWorkspaceEmpty = maak;
})(window, document);
