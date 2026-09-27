/* Magnaat na 1.0: WIE ER NOG MEEDOET, EN HOE GOED JE GEZIEN WORDT.

   Twee vragen die de markt (./markt.js) elke dag stelt en die door groeien
   (./groei.js) veranderen: welke concurrenten er nog zijn -- een overgenomen
   concurrent verkoopt niets meer en maakt geen fouten meer -- hoe zichtbaar
   jij bent, met een filiaal erbij, en hoeveel mensen je kunt aansturen. */
'use strict';
const M = require('./regels-markt');
const B = require('./regels-bedrijf');
const { FILIAAL } = require('./regels-groei');

function concurrenten(st) {
  const weg = (st.groei && st.groei.overgenomen) || [];
  return (M.CONCURRENTEN[st.aanbod] || []).filter(c => !weg.includes(c.id));
}

function zichtbaarheid(st) {
  const f = st.groei && st.groei.filiaal;
  return M.WIJKEN[st.vestiging.wijk].zichtbaar + (f ? Math.round(M.WIJKEN[f.wijk].zichtbaar * FILIAAL.zichtbaar / 100) : 0);
}

/* Hoeveel mensen je kunt aansturen: met een filiaal is er plek voor meer. */
const teamMax = (st) => B.TEAM_MAX + (st.groei && st.groei.filiaal ? FILIAAL.extraMensen : 0);

module.exports = { concurrenten, zichtbaarheid, teamMax };
