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
  const opvang = require('./verzorging/opvang')(state);
  return {
    ...beauty,
    ...require('./verzorging/petcare')(state),
    ...opvang,
    ...require('./verzorging/beautyleden')({ ...state, beauty: beauty.beauty }),
    /* De kinderopvang heeft er sinds 2 september 2026 ook een OUDERkant bij
       (./verzorging/opvangleden.js). Zelfde reden als bij de salon: het aanbod
       was alleen voor de zaak zelf te zien. Hij krijgt de opvang-kern mee in
       plaats van db.data.opvang opnieuw te openen -- die bak heeft een eigenaar,
       en de ouderkant PROJECTEERT hem scherp omdat er voornamen van kinderen in
       staan. Zie de kop daar. */
    ...require('./verzorging/opvangleden')({ ...state, opvang: opvang.opvang })
  };
};
