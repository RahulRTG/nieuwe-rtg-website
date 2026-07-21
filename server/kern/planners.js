/* RTG Planners & Advies: drie genres waar de mens het laatste woord houdt.
   Weddings en prive-events (draaiboeken over de keten), professionele
   diensten (advocaat, notaris, fiscalist; de AI plant alleen) en
   verzekeringen (uitsluitend adviserend; hier wordt nooit een polis
   afgesloten). Elk genre woont in een eigen module onder ./planners/;
   dit bestand voegt ze samen zodat het require-pad en de API gelijk
   blijven. Opslag in db.data.weddings[code], db.data.advies[code],
   db.data.polis[code]. */

module.exports = (state) => ({
  ...require('./planners/weddings')(state),
  ...require('./planners/praktijk')(state),
  ...require('./planners/polis')(state)
});
