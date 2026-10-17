'use strict';

const diepVast = require('../immutable');

const PROJECTIE_ID = 'rtg.revenue.entitlement-decision';
const PROJECTIE_VERSION = '1.0.0';

const SOORT = Object.freeze({
  B2C_PASS_CAPABILITY: 'B2C_PASS_CAPABILITY',
  B2B_ZAAK_CAPABILITY: 'B2B_ZAAK_CAPABILITY',
  WORKOS_RIGHT: 'WORKOS_RIGHT',
  TENANT_QUOTA: 'TENANT_QUOTA',
  DELEGATED_AUTHORITY: 'DELEGATED_AUTHORITY'
});

const STAND = Object.freeze({ ALLOWED: 'ALLOWED', DENIED: 'DENIED', UNKNOWN: 'UNKNOWN' });

const BRONNEN = Object.freeze({
  [SOORT.B2C_PASS_CAPABILITY]: Object.freeze({
    id: 'rtg.commercie.lid-capability',
    provenance: Object.freeze([
      Object.freeze({ file: 'server/kern/commercie/rechten.js', symbol: 'voorLid' }),
      Object.freeze({ file: 'server/kern/commercie/capaciteiten.js', symbol: 'mag' })
    ])
  }),
  [SOORT.B2B_ZAAK_CAPABILITY]: Object.freeze({
    id: 'rtg.commercie.zaak-capability',
    provenance: Object.freeze([
      Object.freeze({ file: 'server/kern/commercie/rechten.js', symbol: 'voorZaak' }),
      Object.freeze({ file: 'server/kern/commercie/zaakabonnement.js', symbol: 'van' })
    ])
  }),
  [SOORT.WORKOS_RIGHT]: Object.freeze({
    id: 'rtg.workos.role-right',
    provenance: Object.freeze([
      Object.freeze({ file: 'server/bedrijf/rollen-beleid.js', symbol: 'rechtenVan' }),
      Object.freeze({ file: 'server/bedrijf/rollen-register.js', symbol: 'ROLLEN' }),
      Object.freeze({ file: 'server/bedrijf/deuren.js', symbol: 'lidVan' })
    ])
  }),
  [SOORT.TENANT_QUOTA]: Object.freeze({
    id: 'rtg.tenant.contract-quota',
    provenance: Object.freeze([
      Object.freeze({ file: 'server/kern/tenant/contract.js', symbol: 'van' }),
      Object.freeze({ file: 'server/kern/tenant/contract.js', symbol: 'magWerkruimteErbij' })
    ])
  }),
  [SOORT.DELEGATED_AUTHORITY]: Object.freeze({
    id: 'rtg.commercie.delegated-authority',
    provenance: Object.freeze([
      Object.freeze({ file: 'server/kern/commercie/bevoegdheid.js', symbol: 'past' }),
      Object.freeze({ file: 'server/kern/commercie/bevoegdheid.js', symbol: 'herkomst' })
    ])
  })
});

const TENANT_ACTIES = Object.freeze(['workspace.create', 'api.request']);

function tekst(waarde) { return String(waarde == null ? '' : waarde).trim(); }
function status(ja) { return ja ? STAND.ALLOWED : STAND.DENIED; }

function levensloop({ state, startsAt, expiresAt, expiration, revokedAt, revocation }) {
  return {
    sourceState: state || 'NOT_PROVIDED',
    startsAt: startsAt || null,
    expiresAt: expiresAt || null,
    expiration: expiration || 'NOT_PROVIDED',
    revokedAt: revokedAt || null,
    revocation: revocation || 'NOT_PROVIDED'
  };
}

function basis(context, bron, binding, beslissing) {
  return diepVast({
    schemaVersion: 1,
    projectionId: PROJECTIE_ID,
    projectionVersion: PROJECTIE_VERSION,
    mode: 'READ_ONLY',
    context,
    decision: {
      source: {
        id: bron.id,
        bindingProvenance: binding && binding.provenance || null,
        provenance: bron.provenance.map(x => ({ ...x }))
      },
      ...beslissing
    },
    effects: { granted: false, revoked: false, mutated: false }
  });
}

function geslotenProjectie(vraag, code, reason) {
  const kind = vraag && SOORT[vraag.kind] ? vraag.kind : null;
  return basis({
    kind,
    actorAccountRef: tekst(vraag && vraag.actorAccountRef) || null,
    subjectAccountRef: null,
    targetRef: null
  }, {
    id: 'rtg.account.context-binding',
    provenance: [{ file: 'server/kern/revenue/entitlement-projectie-v1.js', symbol: 'bindingVoor' }]
  }, null, {
    scope: { kind, targetRef: null, capability: null },
    nominal: STAND.UNKNOWN,
    effective: STAND.DENIED,
    lifecycle: levensloop({ state: 'UNKNOWN' }),
    denial: { code, reason },
    facts: {}
  });
}

function vraagContext(vraag) {
  const v = vraag || {};
  const kind = SOORT[v.kind] || null;
  const actor = tekst(v.actorAccountRef);
  const subject = tekst(v.subjectAccountRef);
  const target = tekst(v.targetRef);
  const capability = tekst(v.capability);
  if (!kind || !actor || !subject || actor !== subject || !target || !capability) return null;
  return { kind, actorAccountRef: actor, subjectAccountRef: subject,
    targetRef: target, capability };
}

function bindingProjectieKlopt(binding, context) {
  return !!(binding && binding.verified === true &&
    tekst(binding.actorAccountRef) === context.actorAccountRef &&
    tekst(binding.subjectAccountRef) === context.subjectAccountRef &&
    tekst(binding.targetRef) === context.targetRef &&
    tekst(binding.kind) === context.kind &&
    tekst(binding.provenance) && binding.accountState &&
    typeof binding.accountState.active === 'boolean');
}

function accountWeigering(binding) {
  return binding.accountState.active ? null : {
    code: 'ACCOUNT_INACTIVE',
    reason: 'De bestaande accountbron meldt dat deze accountbinding niet actief is.'
  };
}

function accountLevensloop(binding, eigen) {
  if (binding.accountState.active) return eigen;
  return levensloop({
    ...eigen,
    state: 'ACCOUNT_REVOKED',
    revokedAt: binding.accountState.revokedAt || null,
    revocation: 'REVOKED'
  });
}

module.exports = {
  PROJECTIE_ID, PROJECTIE_VERSION, SOORT, STAND, BRONNEN, TENANT_ACTIES,
  tekst, status, levensloop, basis, gesloten: geslotenProjectie, vraagContext,
  bindingKlopt: bindingProjectieKlopt,
  accountWeigering, accountLevensloop
};
