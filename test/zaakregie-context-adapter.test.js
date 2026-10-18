'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const regiebeeld = require('../server/kern/zaakregiebeeld');
const { maakZaakregieContextAdapter } = require('../server/kern/zaakregie-context/adapter');

const servicezaak = (id = 'SUP-A') => ({ id, titel: 'Hulp met reservering', stand: 'inBehandeling',
  team: 'concierge', eigenaar: 'medewerker', tijdlijn: [{ at: '2026-10-16T10:00:00.000Z' }] });
const bureauzaak = () => ({ id: 'CASE-A', titel: 'Privétransfer', status: 'in voorbereiding',
  team: [{ rol: 'Travel' }], tijdlijn: [{ op: '2026-10-16T09:00:00.000Z' }] });

const bronnen = (extra) => Object.assign({
  tenantVanWerkruimte: code => code === 'W-A' ? { org: 'ORG-A', actief: true } : null,
  werkruimtesVan: account => account === 'user-a'
    ? [{ tenant: 'ORG-A', werkruimte: 'W-A', lid: { id: 'lid-a', status: 'actief' } }] : [],
  employmentVanPersoon: account => account === 'user-a'
    ? [{ id: 'emp-a', entiteit: 'ent-a', rol: 'Planner', soort: 'employment', actief: true }] : [],
  vertegenwoordigingMijn: () => ({ ikSta: [] }),
  serviceMachtigingenVan: account => account === 'user-a'
    ? [{ id: 'mch-a', zaak: 'SUP-A', stand: 'geldig' }] : []
}, extra || {});

const binding = (extra) => Object.assign({ schemaVersion: 1,
  account: { kind: 'rtg-account', id: 'user-a', provenance: 'authenticated-rtg-session' },
  workspace: { kind: 'workos-workspace', id: 'W-A', provenance: 'tenant-bootstrap' },
  case: { kind: 'case-source', domain: 'service', type: 'service-case', id: 'SUP-A',
    provenance: 'service-case-owner-check' },
  legalEntity: { kind: 'concern-entity', id: 'ent-a', provenance: 'concern-employment' }
}, extra || {});

test('zonder betrouwbare routebinding blijft Zaakregie leesbaar maar context fail-closed', () => {
  const p = maakZaakregieContextAdapter({ bronnen: bronnen() }).service(servicezaak());
  assert.equal(p.source.id, 'SUP-A');
  assert.equal(p.context.status, 'onbekend');
  assert.equal(p.context.provenance[0].reason, 'binding-resolver-ontbreekt');
  assert.deepEqual(p.context.context, { tenant: null, workspace: null, legalEntity: null });
  assert.equal(p.context.grantsAuthority, false);
  assert.equal(p.actions.every(x => x.executable === false), true);
  assert.doesNotMatch(JSON.stringify(p.context), /user-a|W-A|ORG-A|ent-a|mch-a/);
});

test('een onvolledige of asynchrone binding wordt niet als context gebruikt', () => {
  const onvolledig = maakZaakregieContextAdapter({ bronnen: bronnen(),
    bindingVanBron: () => ({ schemaVersion: 1 }) }).service(servicezaak());
  assert.equal(onvolledig.context.status, 'onbekend');
  assert.equal(onvolledig.context.provenance[0].reason, 'binding-onvolledig');

  const async = maakZaakregieContextAdapter({ bronnen: bronnen(),
    bindingVanBron: async () => binding() }).service(servicezaak());
  assert.equal(async.context.status, 'onbekend');
  assert.equal(async.context.provenance[0].reason, 'asynchrone-binding-niet-ondersteund');
});

test('een binding voor een andere zaak levert conflict zonder contextidentifiers', () => {
  const p = maakZaakregieContextAdapter({ bronnen: bronnen(), bindingVanBron: () => binding({
    case: { kind: 'case-source', domain: 'service', type: 'service-case', id: 'SUP-B',
      provenance: 'service-case-owner-check' }
  }) }).service(servicezaak());
  assert.equal(p.context.status, 'conflict');
  assert.equal(p.context.provenance[0].reason, 'case-binding-wijkt-af');
  assert.doesNotMatch(JSON.stringify(p.context), /SUP-A|SUP-B|user-a|W-A|ORG-A|ent-a/);
});

test('een exact gebonden zaak gebruikt de bestaande tenant-, membership- en mandaatlezers', () => {
  let gevraagd;
  const p = maakZaakregieContextAdapter({ bronnen: bronnen(), bindingVanBron: bron => {
    gevraagd = bron;
    return binding();
  } }).service(servicezaak());
  assert.deepEqual(gevraagd, { kind: 'service', source: {
    domain: 'service', type: 'service-case', id: 'SUP-A', version: '2026-10-16T10:00:00.000Z'
  } });
  assert.equal(p.context.status, 'bekend');
  assert.equal(p.context.context.tenant.id, 'ORG-A');
  assert.equal(p.context.context.workspace.id, 'W-A');
  assert.equal(p.context.context.legalEntity.id, 'ent-a');
  assert.deepEqual(p.context.capacities.map(x => x.authorityRef), ['mch-a']);
  assert.equal(p.context.grantsAuthority, false);
});

test('ook een Bureau-regiebeeld gebruikt hetzelfde adaptercontract zonder servicecontext te raden', () => {
  const p = maakZaakregieContextAdapter({ bronnen: bronnen(), bindingVanBron: bron => ({
    schemaVersion: 1,
    account: { kind: 'rtg-account', id: 'user-a', provenance: 'authenticated-rtg-session' },
    workspace: { kind: 'workos-workspace', id: 'W-A', provenance: 'tenant-bootstrap' },
    case: { kind: 'case-source', domain: bron.source.domain, type: bron.source.type,
      id: bron.source.id, provenance: 'bureau-case-owner-check' }
  }) }).bureau(bureauzaak());
  assert.equal(p.source.domain, 'bureau');
  assert.equal(p.context.status, 'bekend');
  assert.equal(p.context.context.tenant.id, 'ORG-A');
  assert.equal(p.context.context.legalEntity, null);
  assert.equal(p.context.capacities.some(x => x.source === 'service.machtiging'), false);
  assert.equal(p.context.grantsAuthority, false);
});

test('cross-tenant, verlopen membership en ingetrokken zaakmachtiging blijven gesloten', () => {
  const crossTenant = maakZaakregieContextAdapter({ bronnen: bronnen({
    werkruimtesVan: () => [{ tenant: 'ORG-B', werkruimte: 'W-A', lid: { id: 'lid-b', status: 'actief' } }]
  }), bindingVanBron: () => binding() }).service(servicezaak());
  assert.equal(crossTenant.context.status, 'conflict');
  assert.deepEqual(crossTenant.context.context, { tenant: null, workspace: null, legalEntity: null });
  assert.doesNotMatch(JSON.stringify(crossTenant.context), /ORG-A|ORG-B|lid-b/);

  const verlopen = maakZaakregieContextAdapter({ bronnen: bronnen({
    werkruimtesVan: () => [{ tenant: 'ORG-A', werkruimte: 'W-A', lid: { id: 'lid-a', status: 'ingetrokken' } }]
  }), bindingVanBron: () => binding() }).service(servicezaak());
  assert.equal(verlopen.context.status, 'onbekend');
  assert.deepEqual(verlopen.context.context, { tenant: null, workspace: null, legalEntity: null });

  const ingetrokken = maakZaakregieContextAdapter({ bronnen: bronnen({
    serviceMachtigingenVan: () => [{ id: 'mch-oud', zaak: 'SUP-A', stand: 'ingetrokken' }]
  }), bindingVanBron: () => binding() }).service(servicezaak());
  assert.equal(ingetrokken.context.capacities.length, 0);
  assert.ok(ingetrokken.context.provenance.some(x => x.reason === 'machtiging-niet-actief'));
  assert.doesNotMatch(JSON.stringify(ingetrokken.context), /mch-oud/);
});

test('een andere accountbinding kan geen membership van het eerste account overnemen', () => {
  const p = maakZaakregieContextAdapter({ bronnen: bronnen(), bindingVanBron: () => binding({
    account: { kind: 'rtg-account', id: 'user-b', provenance: 'authenticated-rtg-session' }
  }) }).service(servicezaak());
  assert.equal(p.context.status, 'onbekend');
  assert.deepEqual(p.context.context, { tenant: null, workspace: null, legalEntity: null });
  assert.deepEqual(p.context.capacities, []);
  assert.doesNotMatch(JSON.stringify(p.context), /ORG-A|lid-a|ent-a|mch-a/);
});

test('de bestaande Zaakregiebeeld-API blijft zonder context en de adapter heeft geen route of opslag', () => {
  const view = regiebeeld.service(servicezaak());
  assert.equal(Object.hasOwn(view, 'context'), false);

  const bestand = path.join(__dirname, '..', 'server/kern/zaakregie-context/adapter.js');
  const stat = fs.statSync(bestand);
  const bron = fs.readFileSync(bestand, 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:'"\\/])\/\/[^\n]*/g, '$1');
  assert.ok(stat.size < 10 * 1024, 'productmodule blijft onder 10 KiB');
  assert.doesNotMatch(bron, /\bdb\b|db\.data|\bapp\.(get|post|put|delete)\b|req\.session|organizationId/);
});
