/* Tenant en concern zijn twee bronnen en nooit twee schrijfwijzen voor
   hetzelfde object. Deze projectie kiest alleen als de membership en tenant
   spine elkaar bevestigen. */
'use strict';

const B = require('./basis');
const lidActief = (lid) => !!lid && lid.status === 'actief';
const relatieActief = (r) => !!r && typeof r === 'object' && r.bestaatEntiteit !== false
  && (r.actief === true || r.stand === 'loopt');

module.exports = function maakOrganisatie(bronnen) {
  const b = bronnen || {};

  function organisatie(accountRef, workspaceRef, spoor) {
    const t = B.bronLees(b.tenantVanWerkruimte, [workspaceRef]);
    const m = B.bronLees(b.werkruimtesVan, [accountRef]);
    if (!t.ok || !m.ok) {
      spoor.push({ source: !t.ok ? 'tenant.register' : 'tenant.membership', state: 'onbekend',
        reason: !t.ok ? t.reason : m.reason });
      return { status: B.STATUS.ONBEKEND, tenant: null, workspace: null };
    }

    const tenant = t.value;
    const leden = Array.isArray(m.value) ? m.value.filter(x => B.code(x && x.werkruimte) === B.code(workspaceRef)
      && lidActief(x && x.lid)) : [];
    const tenantIds = [...new Set(leden.map(x => B.code(x.tenant)).filter(Boolean))];
    if (!tenant || tenant.actief === false || !B.code(tenant.org)) {
      spoor.push({ source: 'tenant.register', state: 'onbekend', reason: tenant && tenant.actief === false
        ? 'tenant-inactief' : 'werkruimte-zonder-actieve-tenant' });
      return { status: B.STATUS.ONBEKEND, tenant: null, workspace: null };
    }
    if (!tenantIds.length) {
      spoor.push({ source: 'tenant.membership', state: 'onbekend', reason: 'geen-actief-lidmaatschap' });
      return { status: B.STATUS.ONBEKEND, tenant: null, workspace: null };
    }
    if (tenantIds.length !== 1 || tenantIds[0] !== B.code(tenant.org)) {
      spoor.push({ source: 'tenant.register+tenant.membership', state: 'conflict',
        reason: 'tenantbronnen-spreken-elkaar-tegen' });
      return { status: B.STATUS.CONFLICT, tenant: null, workspace: null };
    }
    const lidIds = [...new Set(leden.map(x => B.tekst(x.lid && x.lid.id, 160)).filter(Boolean))];
    if (lidIds.length !== 1) {
      spoor.push({ source: 'tenant.membership', state: 'conflict',
        reason: 'meer-dan-een-actief-lidmaatschap-in-dezelfde-werkruimte' });
      return { status: B.STATUS.CONFLICT, tenant: null, workspace: null };
    }

    const tenantRef = B.contextRef('tenant-org', tenant.org, 'tenant.register.vanWerkruimte');
    const workspace = B.contextRef('workos-workspace', workspaceRef, 'tenant.membership.werkruimtesVan',
      { membershipRef: lidIds[0] });
    spoor.push({ source: 'tenant.register', state: 'actueel', ref: tenantRef });
    spoor.push({ source: 'tenant.membership', state: 'actueel', ref: workspace });
    return { status: B.STATUS.BEKEND, tenant: tenantRef, workspace };
  }

  function concern(accountRef, entityRef, spoor) {
    if (!B.tekst(entityRef, 160)) return { status: B.STATUS.NIET_GEVRAAGD, entity: null, relationships: [] };
    const gelezen = B.bronLees(b.employmentVanPersoon, [accountRef, true]);
    if (!gelezen.ok || !Array.isArray(gelezen.value)) {
      spoor.push({ source: 'concern.employment', state: 'onbekend', reason: gelezen.reason || 'onleesbare-bron' });
      return { status: B.STATUS.ONBEKEND, entity: null, relationships: [] };
    }
    const gezocht = B.tekst(entityRef, 160);
    const alle = gelezen.value.filter(x => B.tekst(x && x.entiteit, 160) === gezocht);
    const actief = alle.filter(relatieActief);
    if (!actief.length) {
      spoor.push({ source: 'concern.employment', state: 'onbekend',
        reason: alle.length ? 'relatie-niet-meer-actief' : 'geen-actuele-relatie-met-entiteit' });
      return { status: B.STATUS.ONBEKEND, entity: null, relationships: [] };
    }
    const relationships = actief.map(x => ({
      kind: x.soort === 'mandaat' || x.telt === false ? 'concern-mandate' : 'employment',
      source: 'concern.employment', authorityRef: B.tekst(x.id, 160), role: B.tekst(x.rol, 80) || null,
      entityRef: gezocht, active: true, grantsAuthority: false
    }));
    const entity = B.contextRef('concern-entity', gezocht, 'concern.employment');
    spoor.push({ source: 'concern.employment', state: 'actueel', ref: entity,
      relationships: relationships.map(x => x.authorityRef) });
    return { status: B.STATUS.BEKEND, entity, relationships };
  }

  return { organisatie, concern };
};
