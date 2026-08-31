/* Serverzijde van het Workspace Platform-catalogus. De bestaande
   functieschakelaars blijven de autoriteit voor routes en doelgroepen; deze
   adapter geeft alle functies een uniforme capabilitynaam zonder ze naar de
   browser of naar een tweede beleidsmotor te kopieren. */
'use strict';
const { FUNCTIES, OP_ID } = require('../functies/register');

function services() {
  return FUNCTIES.map(f => ({
    id: f.id,
    capability: 'service.' + f.id,
    name: f.naam,
    category: f.categorie,
    audiences: Array.isArray(f.doelgroepen) ? f.doelgroepen.slice() : [],
    enabledByDefault: f.standaard !== false,
    governance: 'server-feature-gate'
  }));
}
function bestaat(id) { return !!OP_ID[String(id || '')]; }
function coverage(manifests, experience) {
  const claims = new Set();
  for (const m of manifests || []) for (const id of m.services || []) claims.add(id);
  const onbekend = [...claims].filter(id => !bestaat(id));
  const serviceList = services();
  return {
    serviceCapabilities: serviceList.length,
    experienceFunctions: (experience || []).reduce((n, x) => n + (x.items || []).length, 0),
    claimedByLivingModules: [...claims].filter(bestaat).length,
    governedByServerPolicy: serviceList.length,
    unknownClaims: onbekend
  };
}
module.exports = { services, bestaat, coverage };
