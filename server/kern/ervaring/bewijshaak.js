'use strict';
/* De drie haken naar het Trust & Evidence Plane die tafels, tafelplanning en
   waardering elk letterlijk zelf schreven. Het bewijsvlak loopt in
   schaduwstand: een ontbrekend of falend plane geeft null en houdt de
   domeinhandeling nooit tegen. */
module.exports = trustPlane => {
  const roep = (methode, invoer) => {
    if (!trustPlane || typeof trustPlane[methode] !== 'function') return null;
    try { return trustPlane[methode](invoer); } catch (e) { return null; }
  };
  return Object.freeze({
    observe: invoer => roep('observe', invoer),
    metricTimer: invoer => roep('timer', invoer),
    finish: (timer, uitkomst) => {
      if (!timer) return null;
      try { return timer.finish(uitkomst); } catch (e) { return null; }
    }
  });
};
