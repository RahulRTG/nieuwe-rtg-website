/* The document list and RTDocs front use one Office action, with the existing
   server ownership check. Office deletion is permanent: a swipe reveals it,
   and the shared hold/keyboard confirmation is required before execution. */
(function (w, d) {
  'use strict';
  function text(key, nl, en) {
    if (w.RTGi18n && w.RTGi18n.t) return w.RTGi18n.t(key, nl);
    return (d.documentElement.lang || 'nl').indexOf('en') === 0 ? en : nl;
  }
  function start() {
    var O = w.RTGOffice, G = w.RTGGebaar;
    if (!O || !G) return;
    function actions(row) {
      var id = row.getAttribute('data-rtd-documentrij') || row.getAttribute('data-open');
      var state = O.stand();
      var doc = state && (state.docs || []).concat(state.gedeeld || []).find(function (x) { return x.id === id; });
      if (!doc) return null;
      return {
        titel: doc.titel,
        rechts: doc.vanMij ? [{ naam: text('office.deleteForever', 'Voorgoed verwijderen', 'Delete permanently'),
          teken: 'ingrijp', sig: 'incident', borg: true, doe: function () { O.verwijderen(id, true); } }] : [],
        links: [{ naam: text('office.openDocument', 'Document openen', 'Open document'), teken: 'openen',
          doe: function () { if (w.RTGDocs) w.RTGDocs.diep(id); else O.openen(id); } }]
      };
    }
    ['mijnDocs', 'gedeeldDocs', 'rtdVoorzijde'].forEach(function (id) {
      var root = d.getElementById(id);
      if (root) G.lijst(root, '.doc[data-open],[data-rtd-documentrij]', actions);
    });
  }
  if (w.RTGGebaar) start();
  else d.addEventListener('rtg-gebaar', start, { once: true });
}(window, document));
