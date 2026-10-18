/* REVENUE ENTITLEMENT PROJECTIE V1.

   De projectie voegt geen zesde rechtenmodel toe. Zij normaliseert alleen de
   uitspraken van bestaande bronnen en blijft dicht wanneer de bestaande
   accountdeur de context niet bevestigt. De isolatietoets hieronder gebruikt
   bewust bekende identifiers van tenant B: kennis van zo'n identifier is geen
   binding en mag geen brongegevens opleveren. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { maakRechten } = require('../server/kern/commercie/rechten');
const bevoegdheid = require('../server/kern/commercie/bevoegdheid');
const P = require('../server/kern/revenue/entitlement-projectie-v1');

const ACCOUNT_A = 'account-a';
const ACCOUNT_B = 'account-b';

function rechtenbord() {
  return maakRechten({
    zaakAbonnement: {
      van: code => code === 'ZAAK-GROOT'
        ? { code, pas: 'business', herkomst: 'vastgelegd', sinds: '2026-01-01', contractId: 'CTR-1' }
        : { code, pas: 'business-lite', herkomst: 'vastgelegd', sinds: '2026-02-01', contractId: null }
    },
    contracten: {
      vind: id => id === 'CTR-1' ? { id, status: 'ACTIEF', afgesprokenCenten: 500000,
        prijsVastTot: '2027-01-01', eindigtOp: '2027-12-31' } : null
    }
  });
}

function binding(kind, targetRef, extra) {
  return {
    verified: true,
    kind,
    actorAccountRef: ACCOUNT_A,
    subjectAccountRef: ACCOUNT_A,
    targetRef,
    provenance: 'bestaande-testdeur',
    accountState: { active: true, revokedAt: null },
    ...extra
  };
}

function vraag(kind, targetRef, capability, extra) {
  return {
    kind,
    actorAccountRef: ACCOUNT_A,
    subjectAccountRef: ACCOUNT_A,
    targetRef,
    capability,
    ...extra
  };
}

function projector(bindings, opties) {
  return P.maakEntitlementProjectieV1({
    commercieRechten: rechtenbord(),
    datum: () => '2026-10-16',
    bindingVoor: context => bindings[context.kind + '|' + context.targetRef] || null,
    ...opties
  });
}

test('1. B2C projecteert bestaande pascapability met herkomst en zonder effect', () => {
  const soort = P.SOORT.B2C_PASS_CAPABILITY;
  const pr = projector({ [soort + '|' + ACCOUNT_A]: binding(soort, ACCOUNT_A, { pass: 'rtg' }) });
  const uit = pr.projecteer(vraag(soort, ACCOUNT_A, 'can_use_ai'));

  assert.equal(uit.mode, 'READ_ONLY');
  assert.equal(uit.decision.nominal, P.STAND.ALLOWED);
  assert.equal(uit.decision.effective, P.STAND.ALLOWED);
  assert.equal(uit.decision.source.id, 'rtg.commercie.lid-capability');
  assert.equal(uit.decision.source.bindingProvenance, 'bestaande-testdeur');
  assert.ok(uit.decision.source.provenance.some(x => x.symbol === 'voorLid'));
  assert.equal(uit.decision.lifecycle.expiration, 'NOT_PROVIDED',
    'de pasbron levert geen verzonnen einddatum');
  assert.equal(uit.decision.lifecycle.revocation, 'NOT_PROVIDED');
  assert.deepEqual(uit.effects, { granted: false, revoked: false, mutated: false });
});

test('2. B2B houdt productbelofte, effectieve stand en contractlevensloop uit elkaar', () => {
  const soort = P.SOORT.B2B_ZAAK_CAPABILITY;
  const pr = projector({ [soort + '|ZAAK-GROOT']: binding(soort, 'ZAAK-GROOT', { zaakCode: 'ZAAK-GROOT' }) });
  const uit = pr.projecteer(vraag(soort, 'ZAAK-GROOT', 'can_use_enterprise_governance'));

  assert.equal(uit.decision.nominal, P.STAND.ALLOWED);
  assert.equal(uit.decision.effective, P.STAND.ALLOWED);
  assert.equal(uit.decision.facts.productTier, 'business');
  assert.equal(uit.decision.facts.assignmentProvenance, 'vastgelegd');
  assert.equal(uit.decision.facts.contractRef, 'CTR-1');
  assert.equal(uit.decision.lifecycle.sourceState, 'ACTIEF');
  assert.equal(uit.decision.lifecycle.expiresAt, '2027-12-31');
  assert.equal(uit.decision.lifecycle.expiration, 'AT');
});

test('3. WorkOS rapporteert rolvenster en lidmaatschapsintrekking zonder zelf een recht toe te kennen', () => {
  const soort = P.SOORT.WORKOS_RIGHT;
  const actief = binding(soort, 'WERK-A', { member: {
    id: 'lid-a', status: 'actief', rollen: [{ id: 'projectleider', van: '2026-01-01', tot: '2026-12-31' }]
  } });
  const ingetrokken = binding(soort, 'WERK-UIT', { member: {
    id: 'lid-uit', status: 'uit dienst', uitAt: '2026-10-15T12:00:00.000Z',
    rollen: [{ id: 'projectleider', van: '2026-01-01', tot: null }]
  } });
  const pr = projector({ [soort + '|WERK-A']: actief, [soort + '|WERK-UIT']: ingetrokken });

  const goed = pr.projecteer(vraag(soort, 'WERK-A', 'project'));
  assert.equal(goed.decision.nominal, P.STAND.ALLOWED);
  assert.equal(goed.decision.effective, P.STAND.ALLOWED);
  assert.deepEqual(goed.decision.facts.activeRoles, ['projectleider']);
  assert.equal(goed.decision.lifecycle.expiresAt, '2026-12-31');

  const dicht = pr.projecteer(vraag(soort, 'WERK-UIT', 'project'));
  assert.equal(dicht.decision.nominal, P.STAND.ALLOWED,
    'de toegewezen rol blijft een historisch feit');
  assert.equal(dicht.decision.effective, P.STAND.DENIED);
  assert.equal(dicht.decision.denial.code, 'MEMBERSHIP_INACTIVE');
  assert.equal(dicht.decision.lifecycle.revocation, 'REVOKED');
  assert.equal(dicht.decision.lifecycle.revokedAt, '2026-10-15T12:00:00.000Z');
});

test('4. tenantquota zijn een read-only momentopname met een concrete afwijzingsreden', () => {
  const soort = P.SOORT.TENANT_QUOTA;
  const snapshot = {
    pakket: 'zakelijk', naam: 'Zakelijk', ingegaan: '2026-01-01', tot: null, loopt: true,
    grenzen: { werkruimtes: 5, apiPerUur: 20000 },
    verbruik: { werkruimtes: 5, apiDitUur: 19, uurGrens: 20000 },
    nietAfgedwongen: []
  };
  const voor = JSON.stringify(snapshot);
  const pr = projector({ [soort + '|ORG-A']: binding(soort, 'ORG-A', { tenantContract: snapshot }) });

  const vol = pr.projecteer(vraag(soort, 'ORG-A', 'workspace.create'));
  assert.equal(vol.decision.nominal, P.STAND.ALLOWED);
  assert.equal(vol.decision.effective, P.STAND.DENIED);
  assert.equal(vol.decision.denial.code, 'TENANT_QUOTA_REACHED');
  assert.deepEqual(vol.decision.facts, {
    package: 'zakelijk', packageName: 'Zakelijk', limit: 5, used: 5,
    enforcement: 'magWerkruimteErbij'
  });

  const api = pr.projecteer(vraag(soort, 'ORG-A', 'api.request'));
  assert.equal(api.decision.effective, P.STAND.ALLOWED);
  assert.equal(api.decision.facts.used, 19);
  assert.equal(JSON.stringify(snapshot), voor, 'projecteren verandert het tenantcontract of de teller niet');
});

test('5. gedelegeerde bevoegdheid gebruikt de bestaande scope- en bedraggrenzen', () => {
  const soort = P.SOORT.DELEGATED_AUTHORITY;
  const authority = bevoegdheid.maakBevoegdheid({
    capability: 'money.refund', scope: 'zaak:ZAAK-GROOT',
    grenzen: { maxCenten: 10000, maxPerDagCenten: 25000 }, door: 'directie', nu: () => 10
  });
  const pr = projector({ [soort + '|AUTH-1']: binding(soort, 'AUTH-1', { authority }) });

  const goed = pr.projecteer(vraag(soort, 'AUTH-1', 'money.refund', {
    scope: 'zaak:ZAAK-GROOT', valueCenten: 8000,
    dailyUsage: { valueCenten: 5000, count: 1 }
  }));
  assert.equal(goed.decision.effective, P.STAND.ALLOWED);
  assert.equal(goed.decision.facts.authorityScope, 'zaak:ZAAK-GROOT');
  assert.equal(goed.decision.facts.provenanceChain[0].door, 'directie');

  const teVeel = pr.projecteer(vraag(soort, 'AUTH-1', 'money.refund', {
    scope: 'zaak:ZAAK-GROOT', valueCenten: 12000
  }));
  assert.equal(teVeel.decision.nominal, P.STAND.ALLOWED);
  assert.equal(teVeel.decision.effective, P.STAND.DENIED);
  assert.equal(teVeel.decision.denial.code, 'AUTHORITY_LIMIT');
  assert.match(teVeel.decision.denial.reason, /hoger/);
});

test('6. B2B2C/accountisolatie: een bekende B-context levert A geen bronfeit op', () => {
  const soort = P.SOORT.WORKOS_RIGHT;
  let bronGelezen = 0;
  const vreemdeBinding = {
    verified: true, kind: soort,
    actorAccountRef: ACCOUNT_B, subjectAccountRef: ACCOUNT_B,
    targetRef: 'WERK-B-GEHEIM', provenance: 'werkos.deuren.lidVan',
    accountState: { active: true, revokedAt: null },
    member: { id: 'LID-B-GEHEIM', status: 'actief', rollen: [{ id: 'directie', van: null, tot: null }] }
  };
  const pr = P.maakEntitlementProjectieV1({
    commercieRechten: {
      voorLid() { bronGelezen++; throw new Error('hoort niet'); },
      voorZaak() { bronGelezen++; throw new Error('hoort niet'); }
    },
    datum: () => '2026-10-16',
    bindingVoor(context) {
      /* De bestaande deur vindt B alleen voor account B. A kent de targetRef,
         maar krijgt geen binding. */
      if (context.actorAccountRef === ACCOUNT_B && context.targetRef === 'WERK-B-GEHEIM') return vreemdeBinding;
      return null;
    }
  });
  const uit = pr.projecteer(vraag(soort, 'WERK-B-GEHEIM', 'project'));
  const json = JSON.stringify(uit);

  assert.equal(uit.decision.effective, P.STAND.DENIED);
  assert.equal(uit.decision.nominal, P.STAND.UNKNOWN);
  assert.equal(uit.decision.denial.code, 'CONTEXT_NOT_VERIFIED');
  assert.equal(bronGelezen, 0, 'zonder accountbinding wordt geen domeinbron gelezen');
  assert.equal(json.includes('WERK-B-GEHEIM'), false);
  assert.equal(json.includes('LID-B-GEHEIM'), false);
  assert.equal(json.includes('directie'), false);
});

test('7. onbekende, cross-account en onbeschikbare context sluiten generiek en zonder bronlek', () => {
  const pr = projector({});
  const gevallen = [
    { kind: 'VERZONNEN', actorAccountRef: ACCOUNT_A, subjectAccountRef: ACCOUNT_A,
      targetRef: 'X', capability: 'x' },
    { kind: P.SOORT.B2C_PASS_CAPABILITY, actorAccountRef: ACCOUNT_A, subjectAccountRef: ACCOUNT_B,
      targetRef: ACCOUNT_B, capability: 'can_use_ai' },
    vraag(P.SOORT.B2C_PASS_CAPABILITY, ACCOUNT_A, 'can_use_ai')
  ];
  for (const geval of gevallen) {
    const uit = pr.projecteer(geval);
    assert.equal(uit.decision.nominal, P.STAND.UNKNOWN);
    assert.equal(uit.decision.effective, P.STAND.DENIED);
    assert.equal(uit.context.subjectAccountRef, null);
    assert.equal(uit.context.targetRef, null);
    assert.deepEqual(uit.decision.facts, {});
  }
});

test('8. een ingetrokken account kan een bronrecht nog nominaal tonen maar nooit effectief gebruiken', () => {
  const soort = P.SOORT.B2C_PASS_CAPABILITY;
  const b = binding(soort, ACCOUNT_A, { pass: 'rtg',
    accountState: { active: false, revokedAt: '2026-10-16T09:00:00.000Z' } });
  const pr = projector({ [soort + '|' + ACCOUNT_A]: b });
  const uit = pr.projecteer(vraag(soort, ACCOUNT_A, 'can_use_ai'));
  assert.equal(uit.decision.nominal, P.STAND.ALLOWED);
  assert.equal(uit.decision.effective, P.STAND.DENIED);
  assert.equal(uit.decision.denial.code, 'ACCOUNT_INACTIVE');
  assert.equal(uit.decision.lifecycle.sourceState, 'ACCOUNT_REVOKED');
  assert.equal(uit.decision.lifecycle.revokedAt, '2026-10-16T09:00:00.000Z');
});

test('9. de contractvorm is immutable en bevat geen opslag, route of mutatie-ingang', () => {
  const soort = P.SOORT.B2C_PASS_CAPABILITY;
  const pr = projector({ [soort + '|' + ACCOUNT_A]: binding(soort, ACCOUNT_A, { pass: 'rtg' }) });
  const uit = pr.projecteer(vraag(soort, ACCOUNT_A, 'can_use_ai'));
  assert.equal(Object.isFrozen(uit), true);
  assert.equal(Object.isFrozen(uit.decision), true);
  assert.equal(Object.isFrozen(uit.decision.source.provenance), true);
  assert.throws(() => { uit.decision.effective = P.STAND.DENIED; }, TypeError);

  const ingang = path.join(__dirname, '../server/kern/revenue/entitlement-projectie-v1.js');
  const delen = path.join(__dirname, '../server/kern/revenue/entitlement-projectie-v1');
  for (const bestand of [ingang, ...fs.readdirSync(delen).map(naam => path.join(delen, naam))]) {
    const bron = fs.readFileSync(bestand, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\/])\/\/[^\n]*/g, '$1');
    assert.doesNotMatch(bron, /\bdb\b|db\.data|eigencollectie/, bestand);
    assert.doesNotMatch(bron, /\bapp\.(get|post|put|delete)\b|req\.session/, bestand);
  }
  assert.deepEqual(Object.keys(pr), ['projecteer']);
  assert.deepEqual(Object.keys(P).filter(k => /grant|revoke|zet|koop|betaal|activeer/i.test(k)), []);
});
