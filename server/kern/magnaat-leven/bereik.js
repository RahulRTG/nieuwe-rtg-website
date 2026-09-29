/* Magnaat na 1.0: WIE ER NOG MEEDOET, EN HOE GOED JE GEZIEN WORDT.

   Twee vragen die de markt (./markt.js) elke dag stelt en die door groeien
   (./groei.js) veranderen: welke concurrenten er nog zijn -- een overgenomen
   concurrent verkoopt niets meer en maakt geen fouten meer -- hoe zichtbaar
   jij bent, met een filiaal erbij, en hoeveel mensen je kunt aansturen. */
'use strict';
const M = require('./regels-markt');
const B = require('./regels-bedrijf');
const { FILIAAL } = require('./regels-groei');

/* In een gedeelde stad (./stad.js) nemen de andere spelers de eerste plekken
   op de markt in: een speler verkoopt tegen zijn eigen prijs, zit waar hij zit,
   en maakt alleen een fout als hij echt te laat leverde. De kring wordt voor
   elke zet gezet en niet bewaard: hij hoort bij dit moment. */
const kring = new WeakMap();
const zetKring = (st, spelers) => kring.set(st, spelers || []);

function concurrenten(st) {
  const weg = (st.groei && st.groei.overgenomen) || [], k = kring.get(st) || [];
  return (M.CONCURRENTEN[st.aanbod] || [])
    .map((c, i) => k[i] ? Object.assign({}, c, k[i], { id: c.id, speler: true, betrouwbaar: k[i].laat ? 0 : 100 }) : c)
    .filter(c => c.speler || !weg.includes(c.id));
}

function zichtbaarheid(st) {
  const f = st.groei && st.groei.filiaal;
  return M.WIJKEN[st.vestiging.wijk].zichtbaar + (f ? Math.round(M.WIJKEN[f.wijk].zichtbaar * FILIAAL.zichtbaar / 100) : 0);
}

/* Hoeveel mensen je kunt aansturen: met een filiaal is er plek voor meer. */
const teamMax = (st) => B.TEAM_MAX + (st.groei && st.groei.filiaal ? FILIAAL.extraMensen : 0);

module.exports = { concurrenten, zichtbaarheid, teamMax, zetKring };
