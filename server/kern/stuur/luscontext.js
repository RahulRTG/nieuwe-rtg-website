/* DE ISOLATIECONTEXT VAN EEN LUS -- uit de sessie, en nergens anders vandaan.

   Afgesplitst van ./lus.js, dat over de tienduizend bytes ging. Het is een klein
   stuk met een groot gevolg, en dat is precies waarom het een eigen plek
   verdient: zou deze context uit `opties` komen in plaats van uit de sessie, dan
   kiest de aanroeper zelf welke beveiligingsstand op hem van toepassing is -- en
   dan is de hele isolatielaag een instelling.

   ONTBREEKT DE SESSIE (een dienstlus, een zaak-token), dan blijft de context leeg
   en versmalt er niets. Dat is bewust: een lege context betekent "geen drager
   bekend" en niet "alles dicht". Wie het HUIS in isolatie zet, doet dat via de
   incidentcontrole, en die geldt sowieso -- ook zonder deze context. */
'use strict';

module.exports = function maakLusContext({ isolatie }) {
  return function isoContextVan(req) {
    const s = (req && req.session) || null;
    if (!s) return null;
    const laag = typeof isolatie === 'function' ? isolatie() : isolatie;
    if (!laag) return null;
    try {
      return laag.context({ identiteit: s.key || null, sessie: s.id || s.sid || s.key || null });
    } catch (e) { return null; }
  };
};
