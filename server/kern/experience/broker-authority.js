/* De broker erft het actuele beleid van de bestaande domeindeuren. Dit is
   een route-adapter, geen rechtenregister: req.routeBeleid blijft de eigenaar
   van account-, pas-, intrekkings- en isolatiebesluiten. */
'use strict';
const livingActions = require('../living-world/actions').definitions;
const routes = Object.freeze({
  'attention.acknowledge': ['/api/experience/intent/execute'],
  'schedule.item.create': ['/api/agenda/toevoegen'],
  'network.plan.save': ['/api/mall/lijst/nieuw', '/api/mall/lijst/voegtoe']
});
function canonicalRoutes(intent) {
  if (Object.hasOwn(routes, intent)) return routes[intent].slice();
  const action = String(intent || '').replace(/^living-world\./, '');
  return String(intent || '').startsWith('living-world.') && Object.hasOwn(livingActions, action)
    ? ['/api/living-world/view'] : null;
}
function check(intent, routeBeleid) {
  const paths = canonicalRoutes(intent);
  const unavailable = { status: 503, code: 'AUTHORITY_UNAVAILABLE',
    error: 'Het actuele toegangsbeleid kon niet worden gecontroleerd.' };
  if (!paths || typeof routeBeleid !== 'function') return unavailable;
  for (const path of paths) {
    let decision;
    try { decision = routeBeleid(path); } catch (e) { return unavailable; }
    // Alleen het expliciete null-contract van functiebeleid betekent open.
    if (decision === null) continue;
    if (!decision || !Number.isInteger(decision.status) || decision.status < 400 ||
        decision.status > 599 || !decision.antwoord || typeof decision.antwoord.error !== 'string')
      return unavailable;
    return { status: decision.status, code: 'DOMAIN_ACCESS_DENIED', error: decision.antwoord.error };
  }
  return null;
}
module.exports = { check, canonicalRoutes };
