/* De rem: een kleine, eigen in-memory rate-limiter (verving express-rate-limit).
   Vaste-venster-telling per sleutel (standaard het IP): binnen elk venster van
   windowMs mag een sleutel maximaal `limit` verzoeken; daarboven springt de rem
   aan (standaard 429). Geen externe store, geen dependency -- precies wat we
   nodig hebben, niets meer. Verlopen bakken worden periodiek opgeruimd zodat de
   Map niet oneindig groeit.

   Puur telwerk, geen cryptografie -- dit botst niet met regel 1 van de lijn.

   Gebruik (Express-middleware):
     const rem = require('./rem');
     app.post('/pad', rem({ windowMs: 60000, limit: 12 }), handler);

   Opties:
     windowMs  lengte van het venster in ms (standaard 60000)
     limit     maximaal aantal verzoeken per venster per sleutel (standaard 300)
     key       (req) => string: waarop we tellen (standaard req.ip)
     skip      (req) => boolean: sla dit verzoek helemaal over
     handler   (req, res, next) => ...: wat te doen boven de grens (standaard 429) */
'use strict';

function rem(opts) {
  opts = opts || {};
  const windowMs = opts.windowMs || 60000;
  const limit = opts.limit != null ? opts.limit : 300;
  const key = opts.key || (req => req.ip);
  const skip = opts.skip || null;
  const handler = opts.handler || ((req, res) =>
    res.status(429).json({ error: 'Even rustig aan: te veel verzoeken. Probeer het over een minuut opnieuw.' }));
  const bakken = new Map(); // sleutel -> { vanaf, n }

  const opruimer = setInterval(() => {
    const nu = Date.now();
    for (const [k, b] of bakken) if (nu - b.vanaf > windowMs * 2) bakken.delete(k);
  }, windowMs);
  if (opruimer.unref) opruimer.unref(); // houdt het proces niet in leven

  const mw = (req, res, next) => {
    if (skip && skip(req)) return next();
    const nu = Date.now();
    const k = key(req);
    const b = bakken.get(k) || { vanaf: nu, n: 0 };
    if (nu - b.vanaf > windowMs) { b.vanaf = nu; b.n = 0; } // venster verlopen: opnieuw
    b.n += 1;
    bakken.set(k, b);
    if (b.n > limit) return handler(req, res, next);
    next();
  };
  mw.bakken = bakken; // inzichtelijk voor tests
  return mw;
}

module.exports = rem;
