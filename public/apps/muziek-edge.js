/* Borrow the real player controls. Audio, transport and progress stay owned
   by Sound; Edge only supplies the single control surface. */
(function (w, d) {
  'use strict';
  var player = d.querySelector('.speler'), release = null;
  if (!player) return;
  function sync() {
    var edge = w.RTGAdaptiveEdge;
    if (player.dataset.actief === 'true' && edge && edge.mountSurface) {
      if (!release) release = edge.mountSurface(player, { kind: 'music' });
    } else if (release) { release(); release = null; }
  }
  function ready() { if (release) release(); release = null; sync(); }
  var observer = new MutationObserver(sync);
  observer.observe(player, { attributes: true, attributeFilter: ['data-actief'] });
  w.addEventListener('rtg-adaptive-ready', ready); sync();
  w.addEventListener('pagehide', function (event) {
    if (event.persisted) return;
    observer.disconnect(); if (release) release();
    w.removeEventListener('rtg-adaptive-ready', ready);
  });
}(window, document));
