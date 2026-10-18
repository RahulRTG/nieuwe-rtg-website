/* ABONNEMENTSBRONNEN: de read-only audit meldt ontbrekende en strijdige
   ladder-, prijs-, capability-, runtime- en aanmeldingsgegevens expliciet.
   Contractbodems zijn geen maandprijzen; onzekere bronnen leveren geen gezond
   oordeel op. De proef gebruikt bestaande kernels en gerichte bronvarianten;
   zij bewijst geen betaling, entitlementtoekenning of productieconfiguratie. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const audit = require('../server/kern/revenue/subscription-source-audit-v1');
const ladder = require('../server/kern/pasladder');

function bronnen() {
  const db = { data: {} };
  const geld = require('../server/kern/geldregie').maakGeldregie({ db, save: () => {} });
  const schoon = (t, n) => String(t == null ? '' : t).replace(/[<>]/g, '').trim().slice(0, n || 200);
  const aanmeldingen = require('../server/kern/aanmeldingen')({ db, save: () => {}, crypto,
    schoon, geldPasprijzen: geld.geldPasprijzen }).aanmeldingen;
  return { geldPasprijzen: geld.geldPasprijzen, applicationPasses: aanmeldingen.PASSEN };
}

test('1. de audit projecteert exact de vijf officiële laddertreden', () => {
  const uit = audit.maakSubscriptionSourceAuditV1(bronnen());
  assert.deepEqual(uit.tiers.map(t => t.id), ladder.treden().map(t => t.id));
  assert.equal(uit.summary.tiers, 5);
  assert.equal(uit.schemaVersion, 1);
  assert.equal(uit.auditId, audit.AUDIT_ID);
});

test('2. gratis, lijst en contract houden hun verschillende prijsbetekenis', () => {
  const uit = audit.maakSubscriptionSourceAuditV1(bronnen());
  const perId = Object.fromEntries(uit.tiers.map(t => [t.id, t]));
  assert.deepEqual(perId.gratis.pricing, { kind: 'FREE', currency: 'EUR', amountCenten: 0,
    floorCenten: 0, sourceStatus: 'HEALTHY' });
  assert.equal(perId.rtg.pricing.kind, 'LIST');
  assert.equal(perId.rtg.pricing.amountCenten, 6500);
  assert.equal(perId['business-lite'].pricing.amountCenten, 15000);
  for (const id of ['business', 'lifestyle']) {
    assert.equal(perId[id].pricing.kind, 'CONTRACT');
    assert.equal(perId[id].pricing.amountCenten, null, id + ': een bodem is geen maandprijs');
    assert.equal(perId[id].pricing.floorCenten, ladder.trede(id).bodemCenten);
  }
});

test('3. capabilities en B2B-toewijsbaarheid komen uit het bestaande profiel', () => {
  const uit = audit.maakSubscriptionSourceAuditV1(bronnen());
  const lite = uit.tiers.find(t => t.id === 'business-lite');
  assert.deepEqual(lite.capability.capabilities,
    ['can_be_partner', 'can_manage_staff', 'can_use_ai', 'can_use_pos', 'can_use_workos']);
  assert.equal(lite.capability.b2bAssignable, true);
  assert.equal(uit.tiers.find(t => t.id === 'rtg').capability.b2bAssignable, false);
});

test('4. Business Lite blijft zichtbaar als huidige runtime-bronnen afwijken', () => {
  const uit = audit.maakSubscriptionSourceAuditV1(bronnen());
  const lite = uit.tiers.find(t => t.id === 'business-lite');
  assert.equal(lite.application.defined, true);
  assert.equal(lite.capability.sourceStatus, 'HEALTHY');
  assert.equal(lite.runtime.recognized, false);
  assert.equal(lite.runtime.sourceStatus, 'SOURCE_MISMATCH');
  assert.equal(lite.status, 'SOURCE_MISMATCH');
  assert.ok(lite.findings.some(f => f.code === 'RUNTIME_SOURCE_SOURCE_MISMATCH'));
  assert.equal(uit.status, 'SOURCE_MISMATCH');
});

test('5. ontbrekende of falende live bronnen worden niet door aannames vervangen', () => {
  const zonder = audit.maakSubscriptionSourceAuditV1();
  assert.ok(zonder.tiers.every(t => t.pricing.sourceStatus === 'UNKNOWN_SOURCE'));
  assert.ok(zonder.tiers.every(t => t.application.sourceStatus === 'UNKNOWN_SOURCE'));
  assert.ok(zonder.tiers.every(t => t.pricing.amountCenten === null));

  const kapot = audit.maakSubscriptionSourceAuditV1({ geldPasprijzen: () => { throw new Error('offline'); },
    applicationPasses: bronnen().applicationPasses });
  assert.ok(kapot.tiers.every(t => t.pricing.sourceStatus === 'UNKNOWN_SOURCE'));

  const incompleet = bronnen();
  incompleet.geldPasprijzen = () => ({ passen: { gratis: { maandCenten: 0 } } });
  const beoordeeld = audit.maakSubscriptionSourceAuditV1(incompleet);
  assert.equal(beoordeeld.tiers.find(t => t.id === 'business-lite').pricing.sourceStatus,
    'SOURCE_MISMATCH');
});

test('6. een contractuele bodem kan ook via een foutieve bron geen maandprijs worden', () => {
  const b = bronnen();
  const echt = b.geldPasprijzen();
  b.geldPasprijzen = () => ({ passen: { ...echt.passen,
    business: { ...echt.passen.business, maandCenten: 500000 } } });
  const business = audit.maakSubscriptionSourceAuditV1(b).tiers.find(t => t.id === 'business');
  assert.equal(business.pricing.amountCenten, null);
  assert.equal(business.pricing.floorCenten, 500000);
  assert.equal(business.pricing.sourceStatus, 'SOURCE_MISMATCH');
});

test('7. resultaat en provenance zijn diep immutable', () => {
  const uit = audit.maakSubscriptionSourceAuditV1(bronnen());
  assert.equal(Object.isFrozen(uit), true);
  assert.equal(Object.isFrozen(uit.sources), true);
  assert.equal(Object.isFrozen(uit.summary), true);
  assert.equal(Object.isFrozen(uit.tiers), true);
  assert.equal(Object.isFrozen(uit.tiers[0].pricing), true);
  assert.equal(Object.isFrozen(uit.tiers[0].findings), true);
  assert.equal(Object.isFrozen(uit.provenance[0]), true);
});

test('8. de audit heeft geen route, opslag, sessie, betaling, grant of mutatie', () => {
  assert.deepEqual(Object.keys(audit).sort(),
    ['AUDIT_ID', 'AUDIT_VERSION', 'BRONNEN', 'STATUS', 'maakSubscriptionSourceAuditV1']);
  const bestand = path.join(__dirname, '../server/kern/revenue/subscription-source-audit-v1.js');
  const code = fs.readFileSync(bestand, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\/])\/\/[^\n]*/g, '$1');
  assert.doesNotMatch(code, /\bdb\b|db\.data|eigencollectie|\bsave\s*\(/);
  assert.doesNotMatch(code, /\bapp\.(get|post|put|delete)\b|req\.session/);
  assert.doesNotMatch(code, /grant|activeer|koop|refund|mutat/i);
});

test('9. een falende status en onvolledige bronnen leveren nooit een gezonde prijs op', () => {
  const b = bronnen(), prices = b.geldPasprijzen();
  const mislukt = audit.maakSubscriptionSourceAuditV1({ ...b,
    geldPasprijzen: () => ({ ...prices, status: 503 }) });
  assert.ok(mislukt.tiers.every(t => t.pricing.sourceStatus === 'UNKNOWN_SOURCE'));
  const gratis = audit.maakSubscriptionSourceAuditV1({ ...b, geldPasprijzen: () => ({
    ...prices, passen: { ...prices.passen, gratis: { maandCenten: 100 } }
  }) }).tiers.find(t => t.id === 'gratis');
  assert.equal(gratis.pricing.sourceStatus, 'SOURCE_MISMATCH');
  assert.equal(gratis.pricing.amountCenten, null);
});

test('10. ontbrekende profielen en onbekende capabilities worden zichtbaar afgewezen', () => {
  const b = bronnen();
  const onbekend = audit.maakSubscriptionSourceAuditV1({ ...b, capabilityProfiles: null });
  assert.ok(onbekend.tiers.every(t => t.capability.sourceStatus === 'UNKNOWN_SOURCE'));
  const kapot = audit.maakSubscriptionSourceAuditV1({ ...b, capabilityProfiles: {
    ...require('../server/kern/commercie/capaciteiten').PROFIEL, rtg: ['can_fabricate_money']
  } });
  assert.equal(kapot.tiers.find(t => t.id === 'rtg').capability.sourceStatus, 'SOURCE_MISMATCH');
});
