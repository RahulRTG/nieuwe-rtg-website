/* Compatibiliteitsingang voor het voormalige ROS-palet.

   RTG heeft één universele Spotlight-owner: shared/sprong.js. Die eigenaar
   gebruikt de gegenereerde bestemmings- en handelingindex, bewaakt interne
   routes, behoudt appbediening en levert de toegankelijke DS-presentatie.

   Bestaande aanroepers van RTGPalet en de sneltoets Ctrl/Cmd+Spatie blijven
   werken, maar bouwen geen tweede dialoog, recentsregister of catalogus meer. */
(function (w, d) {
  'use strict';
  if (w.RTGPalet) return;

  function sprong() {
    return w.RTGSprong && typeof w.RTGSprong.open === 'function' ? w.RTGSprong : null;
  }
  function open() {
    var eigenaar = sprong();
    if (!eigenaar) return false;
    eigenaar.open(); return true;
  }
  function sluit() {
    var eigenaar = sprong();
    if (!eigenaar || typeof eigenaar.sluit !== 'function') return false;
    eigenaar.sluit(); return true;
  }

  d.addEventListener('keydown', function (event) {
    if (!(event.metaKey || event.ctrlKey) || event.code !== 'Space') return;
    event.preventDefault(); open();
  });

  w.RTGPalet = Object.freeze({ open: open, sluit: sluit });
}(window, document));
