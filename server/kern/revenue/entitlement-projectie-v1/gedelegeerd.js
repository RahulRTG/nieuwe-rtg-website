'use strict';

const bevoegdheid = require('../../commercie/bevoegdheid');
const { tekst, status, levensloop, accountWeigering, accountLevensloop } = require('./gedeeld');

function beslis(context, binding, vraag) {
  const b = binding.authority;
  if (!b || typeof b !== 'object')
    return { error: ['SOURCE_UNAVAILABLE', 'De bestaande bevoegdheidsbron gaf geen bevoegdheid.'] };
  const capabilityPast = b.capability === context.capability;
  const pastReden = capabilityPast ? bevoegdheid.past(b, {
    scope: tekst(vraag.scope) || null,
    waardeCenten: vraag.valueCenten,
    context: vraag.operationContext || {}
  }) : 'Deze bevoegdheid geldt voor ' + String(b.capability || 'een andere handeling') + ' en niet voor de gevraagde capability.';
  const dagReden = !pastReden && vraag.dailyUsage ? bevoegdheid.pastBinnenDag(b, {
    vandaagCenten: vraag.dailyUsage.valueCenten,
    vandaagAantal: vraag.dailyUsage.count,
    waardeCenten: vraag.valueCenten
  }) : null;
  const accountDicht = accountWeigering(binding);
  const effectief = capabilityPast && !pastReden && !dagReden && !accountDicht;
  const denial = effectief ? null : accountDicht || {
    code: capabilityPast ? 'AUTHORITY_LIMIT' : 'AUTHORITY_CAPABILITY_MISMATCH',
    reason: pastReden || dagReden
  };
  const eigenLevensloop = levensloop({
    state: 'SOURCE_AUTHORITY', startsAt: b.at || null,
    expiration: 'NOT_PROVIDED', revocation: 'NOT_PROVIDED'
  });
  return { value: {
    scope: { kind: 'DELEGATED', targetRef: context.targetRef,
      capability: context.capability, requestedScope: tekst(vraag.scope) || null },
    nominal: status(capabilityPast), effective: status(effectief),
    lifecycle: accountLevensloop(binding, eigenLevensloop), denial,
    facts: { authorityScope: b.scope || null, depth: Number.isFinite(b.diepte) ? b.diepte : null,
      provenanceChain: bevoegdheid.herkomst(b) }
  } };
}

module.exports = { beslis };
