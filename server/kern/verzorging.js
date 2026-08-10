/* RTG Verzorging: drie persoonlijke-dienstengenres op een kern.
   De beauty-salon en barbier (niet-medisch), petcare (pension,
   uitlaatrondes, trimsalon) en de kinderopvang met nanny-service.
   Elk genre woont in een eigen module onder ./verzorging/; dit bestand
   voegt ze samen zodat het require-pad en de API gelijk blijven.
   Opslag in db.data.beauty[code], db.data.petcare[code], db.data.opvang[code].

   De salon heeft er een LEDENkant bij (./verzorging/beautyleden.js): knippen,
   scheren en nagels waren tot nu toe alleen voor de zaak zelf te zien. Die
   laag krijgt de beauty-kern mee in plaats van de bak opnieuw te openen, want
   het aanbod en de agenda horen op een plek te staan. */

module.exports = (state) => {
  const beauty = require('./verzorging/beauty')(state);
  return {
    ...beauty,
    ...require('./verzorging/petcare')(state),
    ...require('./verzorging/opvang')(state),
    ...require('./verzorging/beautyleden')({ ...state, beauty: beauty.beauty })
  };
};
