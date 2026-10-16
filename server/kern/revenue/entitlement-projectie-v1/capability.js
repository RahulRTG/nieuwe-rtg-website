'use strict';

const caps = require('../../commercie/capaciteiten');
const { status, levensloop, accountWeigering, accountLevensloop } = require('./gedeeld');

function beslis(context, binding, bord, soort) {
  if (!Object.prototype.hasOwnProperty.call(caps.CAPS, context.capability))
    return { error: ['UNKNOWN_CAPABILITY', 'Deze capability bestaat niet in het bestaande productprofiel.'] };
  const regel = bord && Array.isArray(bord.rechten)
    ? bord.rechten.find(r => r.cap === context.capability) : null;
  if (!regel || typeof regel.nominaal !== 'boolean' || typeof regel.effectief !== 'boolean')
    return { error: ['SOURCE_UNAVAILABLE', 'De bestaande commerciële rechtenbron gaf geen bruikbare beslissing.'] };

  const accountDicht = accountWeigering(binding);
  const effectief = regel.effectief && !accountDicht;
  const contract = bord.contract || null;
  const eigenLevensloop = levensloop({
    state: contract && contract.status || 'NOT_PROVIDED',
    startsAt: bord.sinds || null,
    expiresAt: contract && contract.eindigtOp || null,
    expiration: contract ? (contract.eindigtOp ? 'AT' : 'UNBOUNDED') : 'NOT_PROVIDED',
    revocation: 'NOT_PROVIDED'
  });
  const denial = effectief ? null : accountDicht || {
    code: regel.nominaal ? 'CAPABILITY_NOT_EFFECTIVE' : 'CAPABILITY_NOT_INCLUDED',
    reason: regel.let || 'Het bestaande productprofiel bevat deze capability niet.'
  };

  return { value: {
    scope: { kind: soort === 'lid' ? 'ACCOUNT' : 'BUSINESS',
      targetRef: context.targetRef, capability: context.capability },
    nominal: status(regel.nominaal),
    effective: status(effectief),
    lifecycle: accountLevensloop(binding, eigenLevensloop),
    denial,
    facts: {
      productTier: bord.pas || null,
      productTierName: bord.pasNaam || null,
      assignmentProvenance: bord.herkomst || null,
      enforcement: regel.handhaving || null,
      contractRef: contract && contract.id || null
    }
  } };
}

module.exports = { beslis };
