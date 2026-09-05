/* De techniekdeur is vrijgesteld van functieschakelaars en van de huisstop,
   zodat de eigenaar het huis kan herstellen. Zij is niet vrijgesteld van de
   PERSOONLIJKE isolatie van die eigenaar: een overgenomen eigenaarssessie mag
   na containment niet via deze beheerroute blijven muteren. */
'use strict';

const isolatiepoort = require('./isolatiepoort');

function behandel(req, res, next, { db, beschermstand }) {
  if (!req.path.startsWith('/api/techniek')) return false;
  const uit = isolatiepoort.weeg(req, { db, beschermstand, slaHuisOver: true });
  if (uit) res.status(503).json(uit.antwoord);
  else next();
  return true;
}

module.exports = { behandel };
