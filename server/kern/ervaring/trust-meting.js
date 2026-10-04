'use strict';

/* Een schaduwmeting mag nooit een domeinhandeling veranderen. Alle Experience-
   delen gebruiken daarom dezelfde foutisolerende adapter. */
module.exports = function maakExperienceTrustMeting(trustPlane) {
  return Object.freeze({
    observe(invoer) {
      if (!trustPlane || typeof trustPlane.observe !== 'function') return null;
      try { return trustPlane.observe(invoer); } catch (error) { return null; }
    },
    metricTimer(invoer) {
      if (!trustPlane || typeof trustPlane.timer !== 'function') return null;
      try { return trustPlane.timer(invoer); } catch (error) { return null; }
    },
    finish(timer, uitkomst) {
      if (!timer) return null;
      try { return timer.finish(uitkomst); } catch (error) { return null; }
    }
  });
};
