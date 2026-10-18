'use strict';

const { TENANT_ACTIES, status, levensloop, accountWeigering, accountLevensloop } = require('./gedeeld');

function beslis(context, binding) {
  if (!TENANT_ACTIES.includes(context.capability))
    return { error: ['UNKNOWN_TENANT_QUOTA', 'Deze quotumhandeling bestaat niet in de read-only tenantprojectie.'] };
  const c = binding.tenantContract;
  if (!c || !c.grenzen || !c.verbruik || typeof c.loopt !== 'boolean')
    return { error: ['SOURCE_UNAVAILABLE', 'De bestaande tenantbron gaf geen bruikbare contractprojectie.'] };

  let grens, gebruikt;
  if (context.capability === 'workspace.create') {
    grens = c.grenzen.werkruimtes;
    gebruikt = c.verbruik.werkruimtes;
  } else {
    grens = c.grenzen.apiPerUur;
    gebruikt = c.verbruik.apiDitUur;
  }
  if (!Number.isFinite(grens) || !Number.isFinite(gebruikt))
    return { error: ['SOURCE_UNAVAILABLE', 'De bestaande tenantbron gaf geen leesbare grens en verbruik.'] };

  const nominaal = grens > 0;
  const accountDicht = accountWeigering(binding);
  const effectief = nominaal && c.loopt && gebruikt < grens && !accountDicht;
  let denial = null;
  if (!effectief) {
    if (accountDicht) denial = accountDicht;
    else if (!c.loopt) denial = { code: 'TENANT_CONTRACT_EXPIRED', reason: c.let || 'Het bestaande tenantcontract is verlopen.' };
    else if (gebruikt >= grens) denial = { code: 'TENANT_QUOTA_REACHED', reason: 'Het bestaande tenantquotum is bereikt.' };
    else denial = { code: 'TENANT_QUOTA_UNAVAILABLE', reason: 'Het bestaande tenantpakket bevat geen bruikbare grens.' };
  }
  const eigenLevensloop = levensloop({
    state: c.loopt ? 'ACTIVE' : 'EXPIRED', startsAt: c.ingegaan || null,
    expiresAt: c.tot || null, expiration: c.tot ? 'AT' : 'UNBOUNDED',
    revocation: 'NOT_PROVIDED'
  });
  return { value: {
    scope: { kind: 'TENANT', targetRef: context.targetRef, capability: context.capability },
    nominal: status(nominaal), effective: status(effectief),
    lifecycle: accountLevensloop(binding, eigenLevensloop), denial,
    facts: { package: c.pakket || null, packageName: c.naam || null, limit: grens, used: gebruikt,
      enforcement: context.capability === 'workspace.create' ? 'magWerkruimteErbij' : 'tel' }
  } };
}

module.exports = { beslis };
