/* RTG Office, het bord (deelmodule): het bewerkpaneel van een open kaart.
   Titel, notitie, wie en wanneer, het label in de huiskleuren, klaar,
   verplaatsen en weghalen. Pure opmaak; de kliklogica woont in bord.js.
   Levert window.RTGOfficeBordPaneel. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var IN = 'font:inherit;padding:0.35rem 0.5rem;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit;';
  var KNOP = 'font:inherit;font-size:0.72rem;padding:0.3rem 0.55rem;border:1px solid var(--line);border-radius:8px;background:transparent;color:inherit;cursor:pointer;';

  function html(k, LABELS) {
    return '<div data-bpaneel="1" style="margin-top:0.5rem;border-top:1px solid var(--line);padding-top:0.5rem;display:flex;flex-direction:column;gap:0.35rem;cursor:default;">' +
      '<input data-bv="titel" value="' + esc(k.titel) + '" placeholder="Titel" style="font-size:0.84rem;' + IN + '">' +
      '<textarea data-bv="notitie" placeholder="Notitie" style="font-size:0.8rem;min-height:44px;resize:vertical;' + IN + '">' + esc(k.notitie) + '</textarea>' +
      '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">' +
      '<input data-bv="wie" value="' + esc(k.wie) + '" placeholder="Wie" style="flex:1;min-width:90px;font-size:0.78rem;' + IN + '">' +
      '<input data-bv="voor" type="date" value="' + esc(k.voor) + '" style="font-size:0.78rem;' + IN + '"></div>' +
      '<div style="display:flex;gap:0.3rem;align-items:center;flex-wrap:wrap;">' +
      LABELS.map(function (x) {
        return '<button data-blabel="' + x[0] + '" title="' + x[0] + '" style="width:22px;height:22px;border-radius:50%;border:2px solid ' +
          (k.label === x[0] ? 'var(--txt,#F4F1EC)' : 'var(--line)') + ';background:' + (x[1] === 'transparent' ? 'transparent' : x[1]) + ';cursor:pointer;"></button>';
      }).join('') +
      '<span style="flex:1;"></span>' +
      '<button data-bklaar="1" style="border-radius:999px;' + KNOP + '">' + (k.klaar ? 'Heropen' : '✓ Klaar') + '</button></div>' +
      '<div style="display:flex;gap:0.3rem;flex-wrap:wrap;">' +
      '<button data-bschuif="-1" style="' + KNOP + '">← lijst</button>' +
      '<button data-bschuif="1" style="' + KNOP + '">lijst →</button>' +
      '<button data-bop="-1" style="' + KNOP + '">↑</button>' +
      '<button data-bop="1" style="' + KNOP + '">↓</button>' +
      '<span style="flex:1;"></span>' +
      '<button data-bweg="1" style="color:var(--burgundy-on-dark,#C23A5E);' + KNOP.replace('color:inherit;', '') + '">Weg</button></div></div>';
  }

  window.RTGOfficeBordPaneel = { html: html };
})();
