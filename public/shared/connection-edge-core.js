/* De zuivere grens van Connection Edge: alleen intern consistente acties uit
   een producteigen serverprojectie worden een clientmodel. */
(function (g, fabriek) {
  'use strict';
  var api = fabriek();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (g) g.RTGConnectionEdgeCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var LABELS = Object.freeze({
    discover:'Ontdek', matches:'Matches', profile:'Profiel', chat:'Chat', meet:'Meet', more:'Meer',
    date:'Date', safety:'Safety', route:'Route', today:'Today', society:'Society', concierge:'Concierge',
    not_now:'Not now', open_to_introduction:'Open to introduction', arrange:'Arrange', approve:'Approve',
    together:'Together', table:'The Table', confirm_encounter:'Confirm encounter'
  });
  var HERSTELCODES = Object.freeze(['STALE_CONNECTION_STATE', 'CAPABILITY_NOT_AVAILABLE',
    'CONNECTION_CONTEXT_NOT_FOUND', 'BLOCKED', 'PRODUCT_GATE_DENY']);
  function productOppervlak(product, surface) {
    var prefix = product === 'vonk' ? 'VONK_' : product === 'rendezvous' ? 'RENDEZVOUS_' : '';
    return !!prefix && String(surface || '').indexOf(prefix) === 0;
  }
  function viewModel(product, projectie) {
    var p = projectie && typeof projectie === 'object' ? projectie : {};
    if (!productOppervlak(product, p.surface)) return null;
    var caps = new Set(Array.isArray(p.availableCapabilities) ? p.availableCapabilities : []);
    var gezien = new Set(), acties = [];
    (Array.isArray(p.actions) ? p.actions : []).forEach(function (actie) {
      if (!actie || typeof actie.id !== 'string' || typeof actie.capability !== 'string' ||
          !caps.has(actie.capability) || gezien.has(actie.id)) return;
      gezien.add(actie.id);
      acties.push({ id:actie.id, capability:actie.capability, labelKey:String(actie.labelKey || ''),
        intent:actie.intent == null ? null : String(actie.intent) });
    });
    return { surface:String(p.surface), state:String(p.state || ''), actions:acties,
      stateRevision:String(p.stateRevision || ''), policyVersion:p.policyVersion,
      projectionVersion:p.projectionVersion, stateContractVersion:p.stateContractVersion };
  }
  function moetHerladen(fout) {
    return !!(fout && HERSTELCODES.indexOf(String(fout.code || '')) >= 0);
  }
  function laagNaHaal(huidig, richting, heeftKind) {
    if (richting === 'right' && huidig === 'child') return 'root';
    if (richting === 'left' && huidig === 'root' && heeftKind) return 'child';
    return huidig;
  }
  return Object.freeze({ LABELS:LABELS, viewModel:viewModel, shouldReconcile:moetHerladen,
    layerAfterSwipe:laagNaHaal, productSurface:productOppervlak });
}));
