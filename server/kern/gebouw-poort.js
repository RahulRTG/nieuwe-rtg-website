/* De genre-grens van het gebouw: alleen een zaak met de capability `gebouw`
   (het genre kantoorgebouw, server/seed/genres-lijst-b.js) komt in het pand.

   Stond tot 19 oktober 2026 alleen in routes/gebouw.js; gebouwpand en
   gebouwplus vroegen alleen een zaaksessie, zodat ook een restaurant er een
   pand met huurcontracten en keuringen in kon zetten. Nu een poort, drie
   deuren. */
'use strict';

module.exports = (db) => function eisGebouw(req, res) {
  const caps = db.capsVan(req.supplier);
  if (!caps.includes('gebouw')) { res.status(403).json({ error: 'Dit is geen kantoorgebouw-partner.' }); return false; }
  return true;
};
