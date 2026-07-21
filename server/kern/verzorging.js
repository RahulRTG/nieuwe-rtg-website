/* RTG Verzorging: drie persoonlijke-dienstengenres op een kern.
   De beauty-salon en barbier (niet-medisch), petcare (pension,
   uitlaatrondes, trimsalon) en de kinderopvang met nanny-service.
   Elk genre woont in een eigen module onder ./verzorging/; dit bestand
   voegt ze samen zodat het require-pad en de API gelijk blijven.
   Opslag in db.data.beauty[code], db.data.petcare[code], db.data.opvang[code]. */

module.exports = (state) => ({
  ...require('./verzorging/beauty')(state),
  ...require('./verzorging/petcare')(state),
  ...require('./verzorging/opvang')(state)
});
