/* Spellen (deelmodule): DE LEEFTIJDSPOORT VOOR EEN ZET.

   Afgesplitst van ./partij.js, en om dezelfde reden als de beurtbewaking daar
   staat: dit is SPEL-NEUTRAAL. Deze laag kent geen enkele spelnaam en geen
   enkele rol -- ze leest de descriptor en stelt twee vragen aan ./grens.js.

   TWEE VRAGEN, EN HET VERSCHIL ERTUSSEN IS HET HELE ONTWERP.

   1. MAG DEZE PERSOON DEZE HANDELING DOEN? `volwassenLaag` in de descriptor
      noemt de acties die bij de volwassen laag horen; wie 16 of 17 is mag de
      rest. De lijst in ./grens.js is WIT, dus een nieuwe actie is vanzelf 18+
      tot iemand besluit dat hij bij een bijbaan hoort.

   2. WELKE ROL NEEMT HIJ MET DEZE ZET OP ZICH? De descriptor draagt een haak
      (`rolVanZet`) die dat antwoordt. De grens zit op het moment van
      AANVAARDEN en niet op dat van aanbieden: een werkgever mag voorstellen wat
      hij wil, maar verantwoordelijkheid aannemen waar je te jong voor bent kan
      niet.

   EEN SPEL DAT ER NIETS OVER ZEGT KOMT ONGEHINDERD LANGS. Geen lijst, geen
   haak, geen poort -- de meeste spellen kennen geen leeftijdslagen. */
'use strict';

module.exports = function poort(spel, ctx, potje, mij, zet) {
  const actie = zet && zet.actie;
  if (ctx.magHandeling && (spel.volwassenLaag || []).includes(actie)
    && !ctx.magHandeling(mij, actie))
    return { status: 403, error: ctx.TE_JONG || 'Dat hoort bij de volwassen laag.' };
  if (ctx.magRolAannemen && typeof spel.rolVanZet === 'function') {
    const rol = spel.rolVanZet(potje, zet);
    if (rol && !ctx.magRolAannemen(mij, rol))
      return { status: 403, error: ctx.TE_JONG || 'Die rol hoort bij de volwassen laag.' };
  }
  return null;
};
