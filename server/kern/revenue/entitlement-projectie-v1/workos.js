'use strict';

const rollenBeleid = require('../../../bedrijf/rollen-beleid');
const { RECHTEN, ROLLEN } = require('../../../bedrijf/rollen-register');
const { status, levensloop, accountWeigering, accountLevensloop } = require('./gedeeld');

function beslis(context, binding, datum) {
  if (!RECHTEN.includes(context.capability))
    return { error: ['UNKNOWN_WORKOS_RIGHT', 'Dit recht bestaat niet in het bestaande WorkOS-register.'] };
  const lid = binding.member;
  if (!lid || !Array.isArray(lid.rollen))
    return { error: ['SOURCE_UNAVAILABLE', 'De bestaande WorkOS-bron gaf geen bruikbaar lidmaatschap.'] };

  const toewijzingen = lid.rollen.filter(toewijzing => {
    const rol = ROLLEN.find(r => r.id === toewijzing.id);
    return !!(rol && rol.rechten.includes(context.capability));
  });
  const actieveRollen = rollenBeleid.rollenVan(lid, datum);
  const effectiefViaRol = toewijzingen.some(r => actieveRollen.includes(r.id));
  const lidActief = lid.status === 'actief';
  const accountDicht = accountWeigering(binding);
  const effectief = effectiefViaRol && lidActief && !accountDicht;

  const vanaf = toewijzingen.map(r => r.van).filter(Boolean).sort()[0] || null;
  const heeftOnbegrensd = toewijzingen.some(r => !r.tot);
  const eindes = toewijzingen.map(r => r.tot).filter(Boolean).sort();
  const eindigt = heeftOnbegrensd ? null : (eindes[eindes.length - 1] || null);
  const ingetrokken = !lidActief;
  const eigenLevensloop = levensloop({
    state: lid.status || 'UNKNOWN', startsAt: vanaf, expiresAt: eindigt,
    expiration: toewijzingen.length ? (heeftOnbegrensd ? 'UNBOUNDED' : (eindigt ? 'AT' : 'NOT_PROVIDED')) : 'NOT_PROVIDED',
    revokedAt: ingetrokken ? lid.uitAt || null : null,
    revocation: ingetrokken ? 'REVOKED' : 'NOT_REVOKED'
  });

  let denial = null;
  if (!effectief) {
    if (accountDicht) denial = accountDicht;
    else if (!lidActief) denial = { code: 'MEMBERSHIP_INACTIVE', reason: 'Het bestaande WorkOS-lidmaatschap staat op ' + String(lid.status || 'onbekend') + '.' };
    else if (!toewijzingen.length) denial = { code: 'RIGHT_NOT_ASSIGNED', reason: 'Geen toegewezen WorkOS-rol bevat dit recht.' };
    else denial = { code: 'ROLE_WINDOW_INACTIVE', reason: 'De rol die dit recht bevat is op de gevraagde datum niet actief.' };
  }

  return { value: {
    scope: { kind: 'WORKSPACE', targetRef: context.targetRef, capability: context.capability },
    nominal: status(toewijzingen.length > 0),
    effective: status(effectief),
    lifecycle: accountLevensloop(binding, eigenLevensloop),
    denial,
    facts: {
      assignedRoles: toewijzingen.map(r => r.id),
      activeRoles: toewijzingen.filter(r => actieveRollen.includes(r.id)).map(r => r.id),
      readOnly: toewijzingen.some(r => !!(ROLLEN.find(rol => rol.id === r.id) || {}).alleenLezen)
    }
  } };
}

module.exports = { beslis };
