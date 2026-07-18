/* Beveiliging-rooster: budget en urenbewaking, het dienstrooster, de
   AI-autoplanner en de inzetaanvragen van klanten. Krijgt de gedeelde
   context een keer bij het opstarten vanuit kern/beveiliging.js. */
module.exports = (ctx) => {
  /* De planning- en aanvragenlaag draaien als deelmodules op de gedeelde
     context; de aanvragenlaag gebruikt rooster/zetDienst uit de
     planninglaag, dus die gaat eerst de context in. */
  const deelPlanning = require('./rooster/planning')(ctx);
  Object.assign(ctx, deelPlanning);
  const deelAanvragen = require('./rooster/aanvragen')(ctx);
  return { ...deelPlanning, ...deelAanvragen };
};
