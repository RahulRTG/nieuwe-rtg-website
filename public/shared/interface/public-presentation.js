/* Public pages consume the same responsive chrome and personal image editor. */
(function (w, d) {
  'use strict';
  var home = d.querySelector('.pp-home,.pp-detail-shell>.wd-home'), root = d.querySelector('.pp-shell,.pp-detail-shell');
  if (!home || !root || root.dataset.warmPublic) return;
  root.dataset.warmPublic = 'true';
  w.RTGWorldPresentation.start({ root: root, home: home, people: root.querySelector('.wd-people'), favorites: root.querySelector('.wd-favorites') });
})(window, document);
