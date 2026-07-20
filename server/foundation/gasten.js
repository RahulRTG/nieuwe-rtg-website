/* RTFoundation-gasten: de koppeling tussen een RTG-lid (oppas/familie) en een
   gezin, plus de gezinsagenda en de klusjes-met-sterren. Alles wat een
   gekoppelde gast mag lezen (belangrijke info, agenda, locaties) komt hier
   vandaan; meldingen bereiken de gast ook in de RTG-app (inbox + web-push via
   ctx.pushHook). Gemount vanuit foundation.js op de gedeelde context. */
module.exports = (ctx) => {
  /* De koppeling- en gezinslevenlaag draaien als deelmodules op de gedeelde
     context; de koppelinglaag bindt agendaPubliek per aanroep laat, dus de
     mount-volgorde is vrij. */
  const deelKoppeling = require('./gasten/koppeling')(ctx);
  Object.assign(ctx, deelKoppeling);
  const deelLeven = require('./gasten/gezinsleven')(ctx);
  Object.assign(ctx, deelLeven);
  require('./gasten/keuken')(ctx);
  return deelKoppeling;
};
