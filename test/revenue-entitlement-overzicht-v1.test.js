/* REVENUE ENTITLEMENT OVERZICHT V1.

   Het overzicht bundelt uitsluitend bestaande projectiebesluiten. De toetsen
   bewaken vooral de twee grenzen: een accountbinding is geen tenantbinding en
   een geldfeit is zonder bestaand koppelcontract geen entitlement. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const P = require('../server/kern/revenue/entitlement-projectie-v1');
const O = require('../server/kern/revenue/entitlement-overzicht-v1');

const ACCOUNT_A = 'account-a';
const ACCOUNT_B = 'account-b';

function bronbesluit(vraag) {
  const ingetrokken = vraag.targetRef === 'WERK-INGETROKKEN';
  const toegestaan = vraag.targetRef !== 'ORG-A-VOL' && vraag.targetRef !== 'WERK-VERLOPEN' && !ingetrokken;
  const onbekend = vraag.kind === 'ONBEKENDE_BRON';
  if (onbekend) return {
    schemaVersion: 1, projectionId: 'rtg.revenue.entitlement-decision', projectionVersion: '1.0.0',
    mode: 'READ_ONLY', context: { kind: null, actorAccountRef: vraag.actorAccountRef,
      subjectAccountRef: null, targetRef: null },
    decision: { source: { id: 'rtg.account.context-binding', bindingProvenance: null,
      provenance: [{ file: 'server/kern/revenue/entitlement-projectie-v1.js', symbol: 'bindingVoor' }] },
    scope: { kind: null, targetRef: null, capability: null }, nominal: P.STAND.UNKNOWN,
    effective: P.STAND.DENIED, lifecycle: { sourceState: 'UNKNOWN', startsAt: null,
      expiresAt: null, expiration: 'NOT_PROVIDED', revokedAt: null, revocation: 'NOT_PROVIDED' },
    denial: { code: 'UNKNOWN_CONTEXT', reason: 'Onbekende entitlementbron.' }, facts: {} },
    effects: { granted: false, revoked: false, mutated: false }
  };
  return {
    schemaVersion: 1, projectionId: 'rtg.revenue.entitlement-decision', projectionVersion: '1.0.0',
    mode: 'READ_ONLY', context: { kind: vraag.kind, actorAccountRef: vraag.actorAccountRef,
      subjectAccountRef: vraag.subjectAccountRef, targetRef: vraag.targetRef },
    decision: { source: { id: 'bestaande-bron.' + vraag.kind.toLowerCase(),
      bindingProvenance: 'bestaande-account-en-tenantdeur',
      provenance: [{ file: 'bestaande-bron.js', symbol: 'beslis' }] },
    scope: { kind: vraag.kind, targetRef: vraag.targetRef, capability: vraag.capability },
    nominal: P.STAND.ALLOWED, effective: toegestaan ? P.STAND.ALLOWED : P.STAND.DENIED,
    lifecycle: toegestaan
      ? { sourceState: 'ACTIVE', startsAt: '2026-01-01', expiresAt: null,
        expiration: 'UNBOUNDED', revokedAt: null, revocation: 'NOT_REVOKED' }
      : ingetrokken
        ? { sourceState: 'ACCOUNT_REVOKED', startsAt: '2026-01-01', expiresAt: null,
          expiration: 'UNBOUNDED', revokedAt: '2026-10-16T09:00:00.000Z', revocation: 'REVOKED' }
      : { sourceState: 'EXPIRED', startsAt: '2026-01-01', expiresAt: '2026-10-15',
        expiration: 'EXPIRED', revokedAt: null, revocation: 'NOT_REVOKED' },
    denial: toegestaan ? null : ingetrokken
      ? { code: 'ACCOUNT_INACTIVE', reason: 'De bestaande accountbron is ingetrokken.' }
      : { code: 'SOURCE_EXPIRED', reason: 'De bestaande bron is verlopen.' },
    facts: { sourceOwned: true } }, effects: { granted: false, revoked: false, mutated: false }
  };
}

function opstelling(opties) {
  const gezien = [];
  const entitlementProjectie = {
    projecteer(vraag) { gezien.push(vraag); return bronbesluit(vraag); }
  };
  const binding = {
    verified: true, actorAccountRef: ACCOUNT_A, subjectAccountRef: ACCOUNT_A,
    provenance: 'bestaande-sessiedeur', accountState: { active: true, revokedAt: null }
  };
  const overzicht = O.maakEntitlementOverzichtV1({ entitlementProjectie,
    bindingVoorAccount: context => (opties && opties.bindingVoorAccount
      ? opties.bindingVoorAccount(context) : binding) });
  return { overzicht, gezien };
}

function vraag(entitlements, extra) {
  return { actorAccountRef: ACCOUNT_A, subjectAccountRef: ACCOUNT_A, entitlements, ...extra };
}

test('1. B2C, B2B en B2B2C blijven afzonderlijke bestaande bronbesluiten', () => {
  const { overzicht, gezien } = opstelling();
  const uit = overzicht.voorAccount(vraag([
    { kind: P.SOORT.B2C_PASS_CAPABILITY, targetRef: ACCOUNT_A, capability: 'can_use_ai' },
    { kind: P.SOORT.B2B_ZAAK_CAPABILITY, targetRef: 'ZAAK-A', capability: 'can_use_pos' },
    { kind: P.SOORT.WORKOS_RIGHT, targetRef: 'WERK-A', capability: 'project' }
  ]));

  assert.equal(uit.mode, 'READ_ONLY');
  assert.equal(uit.account.accountRef, ACCOUNT_A);
  assert.equal(uit.account.bindingProvenance, 'bestaande-sessiedeur');
  assert.equal(uit.entitlements.length, 3);
  assert.deepEqual(uit.summary, { total: 3, nominalAllowed: 3,
    effectiveAllowed: 3, denied: 0, unknown: 0 });
  assert.deepEqual(gezien.map(x => x.subjectAccountRef), [ACCOUNT_A, ACCOUNT_A, ACCOUNT_A]);
  assert.ok(uit.entitlements.every(x => x.decision.source.provenance[0].symbol === 'beslis'));
  assert.deepEqual(uit.effects, { granted: false, revoked: false, mutated: false, financial: false });
});

test('2. een verlopen bron behoudt nominale aanspraak, lifecycle en ontzegreden', () => {
  const { overzicht } = opstelling();
  const uit = overzicht.voorAccount(vraag([
    { kind: P.SOORT.WORKOS_RIGHT, targetRef: 'WERK-VERLOPEN', capability: 'project' }
  ]));
  const item = uit.entitlements[0].decision;
  assert.equal(item.nominal, P.STAND.ALLOWED);
  assert.equal(item.effective, P.STAND.DENIED);
  assert.equal(item.lifecycle.sourceState, 'EXPIRED');
  assert.equal(item.lifecycle.expiresAt, '2026-10-15');
  assert.equal(item.denial.code, 'SOURCE_EXPIRED');
  assert.deepEqual(uit.summary, { total: 1, nominalAllowed: 1,
    effectiveAllowed: 0, denied: 1, unknown: 0 });
});

test('3. een ingetrokken account blijft zichtbaar als lifecyclefeit zonder effect', () => {
  const { overzicht } = opstelling({
    bindingVoorAccount: () => ({ verified: true, actorAccountRef: ACCOUNT_A,
      subjectAccountRef: ACCOUNT_A, provenance: 'bestaande-sessiedeur',
      accountState: { active: false, revokedAt: '2026-10-16T09:00:00.000Z' } })
  });
  const uit = overzicht.voorAccount(vraag([
    { kind: P.SOORT.WORKOS_RIGHT, targetRef: 'WERK-INGETROKKEN', capability: 'project' }
  ]));
  assert.equal(uit.account.active, false);
  assert.equal(uit.account.revokedAt, '2026-10-16T09:00:00.000Z');
  assert.equal(uit.entitlements[0].decision.nominal, P.STAND.ALLOWED);
  assert.equal(uit.entitlements[0].decision.effective, P.STAND.DENIED);
  assert.equal(uit.entitlements[0].decision.lifecycle.sourceState, 'ACCOUNT_REVOKED');
  assert.equal(uit.entitlements[0].decision.lifecycle.revocation, 'REVOKED');
  assert.equal(uit.entitlements[0].decision.denial.code, 'ACCOUNT_INACTIVE');
  assert.equal(uit.effects.granted, false);
  assert.equal(uit.effects.revoked, false);
});

test('4. account- en tenantisolatie: een vreemde binding leest geen enkele entitlementbron', () => {
  let bronGelezen = 0;
  const entitlementProjectie = { projecteer() { bronGelezen++; throw new Error('mag niet'); } };
  const overzicht = O.maakEntitlementOverzichtV1({ entitlementProjectie,
    bindingVoorAccount: () => ({ verified: true, actorAccountRef: ACCOUNT_B,
      subjectAccountRef: ACCOUNT_B, provenance: 'tenant-b-deur',
      accountState: { active: true, revokedAt: null } }) });
  const uit = overzicht.voorAccount(vraag([
    { kind: P.SOORT.TENANT_QUOTA, targetRef: 'ORG-B-GEHEIM', capability: 'workspace.create' }
  ]));
  assert.equal(uit.denial.code, 'ACCOUNT_CONTEXT_NOT_VERIFIED');
  assert.equal(bronGelezen, 0);
  assert.equal(JSON.stringify(uit).includes('ORG-B-GEHEIM'), false);
  assert.equal(JSON.stringify(uit).includes(ACCOUNT_B), false);
});

test('5. een bekende vreemde tenanttarget lekt via de onderliggende fail-closed projectie niet', () => {
  const { overzicht } = opstelling();
  const echteProjectie = { projecteer(v) {
    if (v.targetRef === 'ORG-B-GEHEIM') return bronbesluit({ ...v, kind: 'ONBEKENDE_BRON' });
    return bronbesluit(v);
  } };
  const veilig = O.maakEntitlementOverzichtV1({ entitlementProjectie: echteProjectie,
    bindingVoorAccount: ({ actorAccountRef, subjectAccountRef }) => ({ verified: true,
      actorAccountRef, subjectAccountRef, provenance: 'bestaande-sessiedeur',
      accountState: { active: true, revokedAt: null } }) });
  const uit = veilig.voorAccount(vraag([
    { kind: P.SOORT.TENANT_QUOTA, targetRef: 'ORG-B-GEHEIM', capability: 'workspace.create' }
  ]));
  assert.equal(uit.entitlements[0].decision.effective, P.STAND.DENIED);
  assert.equal(uit.entitlements[0].decision.nominal, P.STAND.UNKNOWN);
  assert.equal(JSON.stringify(uit.entitlements[0]).includes('ORG-B-GEHEIM'), false);
  assert.equal(uit.summary.unknown, 1);
});

test('6. onbekende bron sluit per item zonder het hele accountoverzicht te openen', () => {
  const { overzicht } = opstelling();
  const uit = overzicht.voorAccount(vraag([
    { kind: 'ONBEKENDE_BRON', targetRef: 'GEHEIM', capability: 'verzonnen' },
    { kind: P.SOORT.B2C_PASS_CAPABILITY, targetRef: ACCOUNT_A, capability: 'can_use_ai' }
  ]));
  assert.equal(uit.entitlements[0].decision.effective, P.STAND.DENIED);
  assert.equal(uit.entitlements[0].decision.denial.code, 'UNKNOWN_CONTEXT');
  assert.equal(uit.entitlements[1].decision.effective, P.STAND.ALLOWED);
  assert.deepEqual(uit.summary, { total: 2, nominalAllowed: 1,
    effectiveAllowed: 1, denied: 1, unknown: 1 });
});

test('7. cross-account, ontbrekende binding en bronfout sluiten zonder details', () => {
  const cross = opstelling().overzicht.voorAccount({ actorAccountRef: ACCOUNT_A,
    subjectAccountRef: ACCOUNT_B, entitlements: [{ targetRef: 'GEHEIM' }] });
  assert.equal(cross.denial.code, 'UNKNOWN_ACCOUNT_CONTEXT');
  assert.equal(cross.account, null);
  assert.deepEqual(cross.entitlements, []);

  const weg = O.maakEntitlementOverzichtV1({ entitlementProjectie: { projecteer: bronbesluit },
    bindingVoorAccount() { throw new Error('opslag weg'); } });
  const uit = weg.voorAccount(vraag([{ kind: P.SOORT.B2C_PASS_CAPABILITY,
    targetRef: ACCOUNT_A, capability: 'can_use_ai' }]));
  assert.equal(uit.denial.code, 'ACCOUNT_BINDING_UNAVAILABLE');
  assert.equal(JSON.stringify(uit).includes(ACCOUNT_A), false);

  const bronWeg = O.maakEntitlementOverzichtV1({
    entitlementProjectie: { projecteer() { throw new Error('bron weg'); } },
    bindingVoorAccount: ({ actorAccountRef, subjectAccountRef }) => ({ verified: true,
      actorAccountRef, subjectAccountRef, provenance: 'bestaande-sessiedeur',
      accountState: { active: true, revokedAt: null } })
  });
  const bronUit = bronWeg.voorAccount(vraag([{ kind: P.SOORT.B2C_PASS_CAPABILITY,
    targetRef: ACCOUNT_A, capability: 'can_use_ai' }]));
  assert.equal(bronUit.denial.code, 'ENTITLEMENT_SOURCE_UNAVAILABLE');
  assert.deepEqual(bronUit.entitlements, []);
});

test('7b. een verkeerd accountgebonden of onvolledig bronbesluit wordt niet doorgelaten', () => {
  const bindingVoorAccount = ({ actorAccountRef, subjectAccountRef }) => ({ verified: true,
    actorAccountRef, subjectAccountRef, provenance: 'bestaande-sessiedeur',
    accountState: { active: true, revokedAt: null } });
  const vreemd = O.maakEntitlementOverzichtV1({ bindingVoorAccount,
    entitlementProjectie: { projecteer(v) {
      const uit = bronbesluit(v);
      uit.context.subjectAccountRef = ACCOUNT_B;
      return uit;
    } } });
  const vreemdUit = vreemd.voorAccount(vraag([{ kind: P.SOORT.B2C_PASS_CAPABILITY,
    targetRef: ACCOUNT_A, capability: 'can_use_ai' }]));
  assert.equal(vreemdUit.denial.code, 'INVALID_ENTITLEMENT_DECISION');
  assert.equal(JSON.stringify(vreemdUit).includes(ACCOUNT_B), false);

  const geslotenVreemd = O.maakEntitlementOverzichtV1({ bindingVoorAccount,
    entitlementProjectie: { projecteer(v) {
      const uit = bronbesluit({ ...v, kind: 'ONBEKENDE_BRON' });
      uit.context.actorAccountRef = ACCOUNT_B;
      return uit;
    } } });
  assert.equal(geslotenVreemd.voorAccount(vraag([{ kind: 'ONBEKENDE_BRON',
    targetRef: 'GEHEIM', capability: 'verzonnen' }])).denial.code,
  'INVALID_ENTITLEMENT_DECISION');

  const zonderReden = O.maakEntitlementOverzichtV1({ bindingVoorAccount,
    entitlementProjectie: { projecteer(v) {
      const uit = bronbesluit({ ...v, targetRef: 'WERK-VERLOPEN' });
      uit.decision.denial = null;
      return uit;
    } } });
  assert.equal(zonderReden.voorAccount(vraag([{ kind: P.SOORT.WORKOS_RIGHT,
    targetRef: 'WERK-VERLOPEN', capability: 'project' }])).denial.code,
  'INVALID_ENTITLEMENT_DECISION');
});

test('8. het overzicht is immutable, begrensd en heeft geen financiële of mutatie-ingang', () => {
  const { overzicht, gezien } = opstelling();
  const veel = Array.from({ length: O.MAX_VRAGEN + 10 }, (_, i) => ({
    kind: P.SOORT.B2C_PASS_CAPABILITY, targetRef: 'A-' + i, capability: 'can_use_ai'
  }));
  const uit = overzicht.voorAccount(vraag(veel));
  assert.equal(uit.entitlements.length, O.MAX_VRAGEN);
  assert.equal(gezien.length, O.MAX_VRAGEN);
  assert.equal(Object.isFrozen(uit), true);
  assert.equal(Object.isFrozen(uit.entitlements), true);
  assert.throws(() => { uit.summary.total = 0; }, TypeError);
  assert.deepEqual(Object.keys(overzicht), ['voorAccount']);
  assert.deepEqual(Object.keys(O).filter(k => /grant|revoke|zet|koop|betaal|activeer/i.test(k)), []);

  const bron = fs.readFileSync(path.join(__dirname,
    '../server/kern/revenue/entitlement-overzicht-v1.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\/])\/\/[^\n]*/g, '$1');
  assert.doesNotMatch(bron, /\bdb\b|db\.data|eigencollectie|\bsave\s*\(/);
  assert.doesNotMatch(bron, /\bapp\.(get|post|put|delete)\b|req\.session/);
  assert.doesNotMatch(bron, /betaalWaarheid|boekingenVan|saldoVan|projecteerAiExtraS/,
    'catalogus, Payment Truth en RTG Pay worden niet als entitlementbron gelezen');
});
