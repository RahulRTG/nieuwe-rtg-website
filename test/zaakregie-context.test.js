'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { maakZaakregieContext } = require('../server/kern/zaakregie-context');

const basis = (extra) => maakZaakregieContext(Object.assign({
  tenantVanWerkruimte: code => code === 'W-A' ? { org: 'ORG-A', actief: true } : null,
  werkruimtesVan: account => account === 'user-a'
    ? [{ tenant: 'ORG-A', werkruimte: 'W-A', lid: { id: 'lid-a', status: 'actief' } }] : [],
  employmentVanPersoon: account => account === 'user-a' ? [
    { id: 'emp-a', entiteit: 'ent-a', rol: 'Planner', soort: 'employment', actief: true, telt: true },
    { id: 'mandaat-a', entiteit: 'ent-a', rol: 'Accountant', soort: 'mandaat', actief: true, telt: false }
  ] : [],
  vertegenwoordigingMijn: account => ({ ikSta: account === 'user-a' ? [
    { id: 'vg-a', wie: 'Reiziger Zeven', hoedanigheid: 'zaakwaarnemer', stand: 'actief' }
  ] : [] }),
  serviceMachtigingenVan: account => account === 'user-a' ? [
    { id: 'mch-a', zaak: 'SUP-A', stand: 'geldig' }
  ] : []
}, extra || {}));

const vraag = { accountRef: 'user-a', workspaceRef: 'W-A', entityRef: 'ent-a',
  caseRef: { domain: 'service', id: 'SUP-A' } };

test('de context houdt tenant, werkruimte en juridische entiteit als afzonderlijke bronreferenties', () => {
  const p = basis().projecteer(vraag);
  assert.equal(p.status, 'bekend');
  assert.deepEqual(p.context.tenant,
    { kind: 'tenant-org', id: 'ORG-A', source: 'tenant.register.vanWerkruimte' });
  assert.deepEqual(p.context.workspace,
    { kind: 'workos-workspace', id: 'W-A', source: 'tenant.membership.werkruimtesVan', membershipRef: 'lid-a' });
  assert.deepEqual(p.context.legalEntity,
    { kind: 'concern-entity', id: 'ent-a', source: 'concern.employment' });
  assert.deepEqual(p.relationships.map(x => x.kind), ['employment', 'concern-mandate']);
  assert.equal(p.relationships.every(x => x.grantsAuthority === false), true);
  assert.deepEqual(p.capacities.map(x => x.kind), ['human-representation', 'case-support-access']);
  assert.equal(p.capacities.every(x => x.grantsAuthority === false), true);
  assert.equal(p.readOnly, true);
  assert.equal(p.refreshBeforeAction, true);

  const tekst = JSON.stringify(p);
  assert.doesNotMatch(tekst, /organizationId|permissions|rights|capabilities/,
    'de leesprojectie introduceert geen generieke organisatie-id of rechtenprojectie');
});

test('een ander account krijgt geen tenant-, workspace-, entiteit- of mandaatcontext te zien', () => {
  const p = basis().projecteer(Object.assign({}, vraag, { accountRef: 'user-b' }));
  assert.equal(p.status, 'onbekend');
  assert.deepEqual(p.context, { tenant: null, workspace: null, legalEntity: null });
  assert.deepEqual(p.relationships, []);
  assert.deepEqual(p.capacities, []);
  assert.doesNotMatch(JSON.stringify(p), /ORG-A|ent-a|vg-a|mch-a|lid-a/);
});

test('tegenstrijdige tenantbronnen leveren conflict en geen gekozen context', () => {
  const p = basis({ werkruimtesVan: () => [
    { tenant: 'ORG-B', werkruimte: 'W-A', lid: { id: 'lid-b', status: 'actief' } }
  ] }).projecteer(vraag);
  assert.equal(p.status, 'conflict');
  assert.equal(p.states.organization, 'conflict');
  assert.deepEqual(p.context, { tenant: null, workspace: null, legalEntity: null });
  assert.deepEqual(p.capacities, []);
  assert.doesNotMatch(JSON.stringify(p), /ORG-A|ORG-B|lid-b/,
    'een conflict toont geen van beide kandidaten als gekozen organisatie');
});

test('een dubbel actief membership in dezelfde werkruimte wordt niet stil samengevoegd', () => {
  const p = basis({ werkruimtesVan: () => [
    { tenant: 'ORG-A', werkruimte: 'W-A', lid: { id: 'lid-a', status: 'actief' } },
    { tenant: 'ORG-A', werkruimte: 'W-A', lid: { id: 'lid-tweede', status: 'actief' } }
  ] }).projecteer(vraag);
  assert.equal(p.status, 'conflict');
  assert.deepEqual(p.context, { tenant: null, workspace: null, legalEntity: null });
});

test('verlopen en ingetrokken bronnen blijven zichtbaar als afwijzingsherkomst maar worden geen context', () => {
  const p = basis({
    employmentVanPersoon: () => [
      { id: 'emp-oud', entiteit: 'ent-a', rol: 'Planner', soort: 'employment', actief: false, stand: 'beëindigd' }
    ],
    vertegenwoordigingMijn: () => ({ ikSta: [
      { id: 'vg-oud', wie: 'Reiziger Zeven', hoedanigheid: 'zaakwaarnemer', stand: 'ingetrokken' }
    ] }),
    serviceMachtigingenVan: () => [{ id: 'mch-oud', zaak: 'SUP-A', stand: 'verlopen' }]
  }).projecteer(vraag);
  assert.equal(p.status, 'onbekend');
  assert.equal(p.states.legalEntity, 'onbekend');
  assert.equal(p.context.legalEntity, null);
  assert.deepEqual(p.relationships, []);
  assert.deepEqual(p.capacities, []);
  assert.ok(p.provenance.some(x => x.source === 'concern.employment' && x.reason === 'relatie-niet-meer-actief'));
  assert.ok(p.provenance.some(x => x.source === 'vertegenwoordiging' && x.reason === 'machtiging-niet-actief'));
  assert.ok(p.provenance.some(x => x.source === 'service.machtiging' && x.reason === 'machtiging-niet-actief'));
  assert.doesNotMatch(JSON.stringify(p), /emp-oud|vg-oud|mch-oud/,
    'ingetrokken bronnen leveren geen bruikbare authority-referentie');
});

test('een servicemachtiging voor een andere zaak opent geen hoedanigheid in de geselecteerde zaak', () => {
  const p = basis({ serviceMachtigingenVan: () => [
    { id: 'mch-verkeerd', zaak: 'SUP-B', stand: 'geldig' }
  ] }).projecteer(vraag);
  assert.equal(p.capacities.some(x => x.source === 'service.machtiging'), false);
  assert.ok(p.provenance.some(x => x.reason === 'machtiging-hoort-bij-andere-zaak'));
  assert.doesNotMatch(JSON.stringify(p), /mch-verkeerd/);
});

test('een onbereikbare bron wordt onbekend en er wordt niets uit een andere context geraden', () => {
  const p = basis({ werkruimtesVan: () => { throw new Error('tijdelijk weg'); } }).projecteer(vraag);
  assert.equal(p.status, 'onbekend');
  assert.deepEqual(p.context, { tenant: null, workspace: null, legalEntity: null });
  assert.equal(p.provenance[0].reason, 'bron-onbeschikbaar');
});

test('de projectie muteert geen bron en heeft zelf geen opslag, route of sessielezer', () => {
  const invoer = JSON.parse(JSON.stringify(vraag));
  const voor = JSON.stringify(invoer);
  const p = basis().projecteer(invoer);
  assert.equal(JSON.stringify(invoer), voor);
  assert.equal(Object.isFrozen(p), true);
  assert.equal(Object.isFrozen(p.context), true);

  const kern = path.join(__dirname, '..', 'server/kern');
  const bestanden = [path.join(kern, 'zaakregie-context.js')]
    .concat(fs.readdirSync(path.join(kern, 'zaakregie-context')).map(n => path.join(kern, 'zaakregie-context', n)));
  const bron = bestanden.map(f => fs.readFileSync(f, 'utf8')).join('\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\/])\/\/[^\n]*/g, '$1');
  assert.doesNotMatch(bron, /\bdb\b|db\.data|eigencollectie|\bapp\.(get|post|put|delete)\b|req\.session/);
  assert.match(bron, /require\('\.\.\/namens\/projectie'\)/,
    'de bestaande namensprojectie wordt hergebruikt; er ontstaat geen tweede mandaattaal');
});
