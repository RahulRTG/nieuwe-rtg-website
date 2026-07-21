/* RTG Clubs: twee clubgenres op een kern. De golf- en countryclub en de
   sport- en fitnessclub wonen elk in een eigen module onder ./clubs/;
   dit bestand voegt ze samen zodat het require-pad en de API gelijk
   blijven. Opslag in db.data.golfclub[code] en db.data.fitclub[code]. */

module.exports = (state) => ({
  ...require('./clubs/golf')(state),
  ...require('./clubs/fitclub')(state)
});
