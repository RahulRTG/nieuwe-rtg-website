/* RTG ENTITLEMENT PROJECTIE V1.

   Deze facade VERLEENT NIETS. Zij maakt vijf bestaande antwoorden vergelijkbaar:
   het productprofiel van een lid, het zaakabonnement, een WorkOS-rolrecht, een
   tenantquotum en een gedelegeerde bevoegdheid. Iedere bron blijft eigenaar van
   haar eigen beslissing en levenscyclus.

   De projectie heeft bewust geen sessie, database of route. `bindingVoor` moet
   een binding leveren die al door de bestaande account-/werkruimtedeur is
   vastgesteld. Ontbreekt die binding of past hij niet exact bij de vraag, dan
   blijft het antwoord dicht zonder een domeinbron te lezen. */
'use strict';

const gedeeld = require('./entitlement-projectie-v1/gedeeld');
const capability = require('./entitlement-projectie-v1/capability');
const workos = require('./entitlement-projectie-v1/workos');
const tenant = require('./entitlement-projectie-v1/tenant');
const gedelegeerd = require('./entitlement-projectie-v1/gedelegeerd');

const {
  PROJECTIE_ID, PROJECTIE_VERSION, SOORT, STAND, BRONNEN, TENANT_ACTIES,
  basis, gesloten, vraagContext, bindingKlopt, levensloop, tekst
} = gedeeld;

function maakEntitlementProjectieV1({ bindingVoor, commercieRechten, datum } = {}) {
  const dag = datum || (() => new Date().toISOString().slice(0, 10));

  function projecteer(vraag) {
    const context = vraagContext(vraag);
    if (!context) return gesloten(vraag, 'UNKNOWN_CONTEXT',
      'De entitlementcontext is onbekend, onvolledig of niet aan dezelfde account gebonden.');
    if (typeof bindingVoor !== 'function') return gesloten(vraag, 'BINDING_SOURCE_UNAVAILABLE',
      'De bestaande accountbinding is niet aangesloten; de projectie blijft gesloten.');

    let binding;
    try { binding = bindingVoor({ ...context }); } catch (_) {
      return gesloten(vraag, 'BINDING_SOURCE_UNAVAILABLE',
        'De bestaande accountbinding kon niet veilig worden gelezen; de projectie blijft gesloten.');
    }
    if (!bindingKlopt(binding, context)) return gesloten(vraag, 'CONTEXT_NOT_VERIFIED',
      'De bestaande accountbron bevestigt deze context niet.');

    const bron = BRONNEN[context.kind];
    let uit;
    try {
      if (context.kind === SOORT.B2C_PASS_CAPABILITY) {
        if (!commercieRechten || typeof commercieRechten.voorLid !== 'function')
          return gesloten(vraag, 'SOURCE_UNAVAILABLE', 'De bestaande commerciële rechtenbron is niet aangesloten.');
        uit = capability.beslis(context, binding,
          commercieRechten.voorLid(binding.pass, context.subjectAccountRef), 'lid');
      } else if (context.kind === SOORT.B2B_ZAAK_CAPABILITY) {
        if (!commercieRechten || typeof commercieRechten.voorZaak !== 'function' ||
            tekst(binding.zaakCode) !== context.targetRef)
          return gesloten(vraag, 'SOURCE_UNAVAILABLE', 'De bestaande zakelijke rechtenbron is niet aangesloten.');
        uit = capability.beslis(context, binding,
          commercieRechten.voorZaak(binding.zaakCode), 'zaak');
      } else if (context.kind === SOORT.WORKOS_RIGHT) {
        uit = workos.beslis(context, binding, dag());
      } else if (context.kind === SOORT.TENANT_QUOTA) {
        uit = tenant.beslis(context, binding);
      } else if (context.kind === SOORT.DELEGATED_AUTHORITY) {
        uit = gedelegeerd.beslis(context, binding, vraag);
      }
    } catch (_) {
      return gesloten(vraag, 'SOURCE_UNAVAILABLE',
        'De bestaande entitlementbron kon niet veilig worden gelezen; de projectie blijft gesloten.');
    }
    if (!uit || uit.error) return basis(context, bron, binding, {
      scope: { kind: context.kind, targetRef: context.targetRef, capability: context.capability },
      nominal: STAND.UNKNOWN, effective: STAND.DENIED,
      lifecycle: levensloop({ state: 'UNKNOWN' }),
      denial: { code: uit && uit.error ? uit.error[0] : 'SOURCE_UNAVAILABLE',
        reason: uit && uit.error ? uit.error[1] : 'De bestaande entitlementbron gaf geen beslissing.' },
      facts: {}
    });
    return basis(context, bron, binding, uit.value);
  }

  return Object.freeze({ projecteer });
}

module.exports = {
  PROJECTIE_ID, PROJECTIE_VERSION, SOORT, STAND, BRONNEN, TENANT_ACTIES,
  maakEntitlementProjectieV1
};
