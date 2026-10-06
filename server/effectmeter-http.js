'use strict';

/* HTTP is alleen de presentatie van de teller. De tellercontext en de
   meetbetekenis blijven in effectmeter.js; deze adapter bezit uitsluitend de
   ene antwoordgrens waaraan de twee diagnostische headers worden toegevoegd. */
function koppelEffectmeterHttp(app, opties) {
  const o = opties || {};
  if (!o.aan || !app || typeof app.use !== 'function') return false;
  app.use((req, res, next) => {
    o.perVerzoek((teller) => {
      const echt = res.end;
      res.end = function (...args) {
        try {
          if (!res.headersSent) {
            res.setHeader('X-RTG-Effect', o.stand(teller));
            res.setHeader('X-RTG-Effect-Niet-Gemeten', o.nietGemeten.join(','));
          }
        } catch (e) { /* een diagnosekop mag het antwoord nooit breken */ }
        return echt.apply(this, args);
      };
      next();
    });
  });
  return true;
}

module.exports = { koppelEffectmeterHttp };
