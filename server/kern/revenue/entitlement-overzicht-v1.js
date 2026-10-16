/* RTG ENTITLEMENT OVERZICHT V1.

   Dit is een ACCOUNTGEBONDEN LEESBEELD boven entitlement-projectie-v1. Het
   verzamelt bestaande beslissingen, maar verleent, activeert of herroept niets.
   De accountbinding komt uit een bestaande deur; iedere onderliggende vraag
   gaat daarna nogmaals door haar eigen bronbinding en autorisatiegrens.

   Catalogus, Payment Truth en RTG Pay zijn bewust geen entitlementbron:
   catalogus-v1 beschrijft een aanbod, Payment Truth een economische betaling en
   RTG Pay het interne grootboek. Zonder een bestaand, exact contract dat zo'n
   geldfeit aan een recht bindt, mag dit overzicht daar geen toegang uit afleiden. */
'use strict';

const { STAND } = require('./entitlement-projectie-v1');

const OVERZICHT_ID = 'rtg.revenue.entitlement-overview';
const OVERZICHT_VERSION = '1.0.0';
const MAX_VRAGEN = 64;

function tekst(waarde) { return String(waarde == null ? '' : waarde).trim(); }

function diepVast(waarde) {
  if (!waarde || typeof waarde !== 'object' || Object.isFrozen(waarde)) return waarde;
  for (const deel of Object.values(waarde)) diepVast(deel);
  return Object.freeze(waarde);
}

function contractBasis() {
  return {
    schemaVersion: 1,
    overviewId: OVERZICHT_ID,
    overviewVersion: OVERZICHT_VERSION,
    mode: 'READ_ONLY'
  };
}

function gesloten(code, reason) {
  return diepVast({
    ...contractBasis(),
    account: null,
    entitlements: [],
    summary: { total: 0, nominalAllowed: 0, effectiveAllowed: 0, denied: 0, unknown: 0 },
    denial: { code, reason },
    effects: { granted: false, revoked: false, mutated: false, financial: false }
  });
}

function contextVan(vraag) {
  const v = vraag || {};
  const actorAccountRef = tekst(v.actorAccountRef);
  const subjectAccountRef = tekst(v.subjectAccountRef);
  if (!actorAccountRef || !subjectAccountRef || actorAccountRef !== subjectAccountRef) return null;
  return { actorAccountRef, subjectAccountRef };
}

function bindingKlopt(binding, context) {
  return !!(binding && binding.verified === true &&
    tekst(binding.actorAccountRef) === context.actorAccountRef &&
    tekst(binding.subjectAccountRef) === context.subjectAccountRef &&
    tekst(binding.provenance) && binding.accountState &&
    typeof binding.accountState.active === 'boolean');
}

function vraagVoorAccount(vraag, context) {
  const v = vraag || {};
  return {
    ...v,
    actorAccountRef: context.actorAccountRef,
    subjectAccountRef: context.subjectAccountRef
  };
}

function besluitKlopt(item, context) {
  const c = item && item.context;
  const d = item && item.decision;
  const bron = d && d.source;
  const geslotenBesluit = c && c.actorAccountRef === context.actorAccountRef &&
    c.subjectAccountRef === null && c.targetRef === null &&
    d.nominal === STAND.UNKNOWN && d.effective === STAND.DENIED;
  const eigenBesluit = c && c.actorAccountRef === context.actorAccountRef &&
    c.subjectAccountRef === context.subjectAccountRef;
  return !!(item && item.mode === 'READ_ONLY' && d && bron && tekst(bron.id) &&
    Array.isArray(bron.provenance) && bron.provenance.length &&
    bron.provenance.every(p => p && tekst(p.file) && tekst(p.symbol)) &&
    d.lifecycle && tekst(d.lifecycle.sourceState) &&
    [STAND.ALLOWED, STAND.DENIED, STAND.UNKNOWN].includes(d.nominal) &&
    [STAND.ALLOWED, STAND.DENIED].includes(d.effective) &&
    (eigenBesluit || geslotenBesluit) &&
    (d.effective !== STAND.DENIED || (d.denial && tekst(d.denial.code) && tekst(d.denial.reason))));
}

function telling(entitlements) {
  const summary = { total: entitlements.length, nominalAllowed: 0,
    effectiveAllowed: 0, denied: 0, unknown: 0 };
  for (const item of entitlements) {
    const beslissing = item && item.decision || {};
    if (beslissing.nominal === STAND.ALLOWED) summary.nominalAllowed += 1;
    if (beslissing.effective === STAND.ALLOWED) summary.effectiveAllowed += 1;
    if (beslissing.effective === STAND.DENIED) summary.denied += 1;
    if (beslissing.nominal === STAND.UNKNOWN) summary.unknown += 1;
  }
  return summary;
}

function maakEntitlementOverzichtV1({ entitlementProjectie, bindingVoorAccount } = {}) {
  function voorAccount(vraag) {
    const context = contextVan(vraag);
    if (!context) return gesloten('UNKNOWN_ACCOUNT_CONTEXT',
      'Het entitlementoverzicht vraagt één geverifieerde account voor actor en onderwerp.');
    if (!entitlementProjectie || typeof entitlementProjectie.projecteer !== 'function')
      return gesloten('ENTITLEMENT_SOURCE_UNAVAILABLE',
        'De bestaande entitlementprojectie is niet aangesloten; het overzicht blijft gesloten.');
    if (typeof bindingVoorAccount !== 'function') return gesloten('ACCOUNT_BINDING_UNAVAILABLE',
      'De bestaande accountbinding is niet aangesloten; het overzicht blijft gesloten.');

    let binding;
    try { binding = bindingVoorAccount({ ...context }); } catch (_) {
      return gesloten('ACCOUNT_BINDING_UNAVAILABLE',
        'De bestaande accountbinding kon niet veilig worden gelezen; het overzicht blijft gesloten.');
    }
    if (!bindingKlopt(binding, context)) return gesloten('ACCOUNT_CONTEXT_NOT_VERIFIED',
      'De bestaande accountbron bevestigt deze context niet.');

    const vragen = Array.isArray(vraag && vraag.entitlements)
      ? vraag.entitlements.slice(0, MAX_VRAGEN) : [];
    const entitlements = [];
    for (const item of vragen) {
      let besluit;
      try { besluit = entitlementProjectie.projecteer(vraagVoorAccount(item, context)); }
      catch (_) { return gesloten('ENTITLEMENT_SOURCE_UNAVAILABLE',
        'Een bestaande entitlementbron kon niet veilig worden gelezen; het overzicht blijft gesloten.'); }
      if (!besluitKlopt(besluit, context)) return gesloten('INVALID_ENTITLEMENT_DECISION',
        'Een bestaande entitlementbron gaf geen volledig accountgebonden besluit.');
      entitlements.push(besluit);
    }

    return diepVast({
      ...contractBasis(),
      account: {
        accountRef: context.subjectAccountRef,
        bindingProvenance: binding.provenance,
        active: binding.accountState.active,
        revokedAt: binding.accountState.revokedAt || null
      },
      entitlements,
      summary: telling(entitlements),
      denial: null,
      effects: { granted: false, revoked: false, mutated: false, financial: false }
    });
  }

  return Object.freeze({ voorAccount });
}

module.exports = { OVERZICHT_ID, OVERZICHT_VERSION, MAX_VRAGEN, maakEntitlementOverzichtV1 };
