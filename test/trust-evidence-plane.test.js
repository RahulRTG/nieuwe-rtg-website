'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { maakPlane, context, retry, migration, compatibility, sloProfiles,
  provenance, constitution, hospitalityChain } = require('../server/kern/bewijsvlak');
const { maakLedger } = require('../server/kern/bewijsvlak/ledger');
const envelop = require('../server/kern/envelop');

const ref = (type, id) => ({ domain: 'hospitality', type, id });

test('correlation context gebruikt nooit de onbewezen publieke correlation header', () => {
  const mw = context.middleware();
  const req = { id: 'request-1', headers: { 'x-rtg-correlation': 'aanvaller' } };
  const koppen = {};
  const res = { set: (k, v) => { koppen[k] = v; } };
  mw(req, res, () => {
    assert.equal(context.huidige().requestId, 'request-1');
    assert.notEqual(context.huidige().chainId, 'aanvaller');
    assert.equal(req.trustContext.chainId, koppen['X-RTG-Correlation']);
  });
});

test('request, event en gevolg houden één keten en expliciete causaliteit', () => {
  const root = context.maak({ chainId: 'chain_test', stepId: 'step_request', phase: 'request' });
  context.inContext(root, () => {
    const eerste = envelop.maak({ kanaal: 'trust-test', actor: 'LidEen', classificatie: 'intern' });
    assert.equal(eerste.correlatie, 'chain_test');
    assert.equal(eerste.oorzaak, 'step_request');
    envelop.inKeten(eerste, () => {
      const tweede = envelop.maak({ kanaal: 'trust-gevolg', classificatie: 'intern' });
      assert.equal(tweede.correlatie, 'chain_test');
      assert.equal(tweede.oorzaak, eerste.id);
      assert.equal(context.huidige().stepId, eerste.id);
    });
  });
});

test('alleen een verse geldige HMAC-carrier mag een serviceketen hervatten', () => {
  const root = context.maak({ phase: 'request' }), secret = 'carrier-secret-voor-de-test';
  let headers;
  context.inContext(root, () => { headers = context.carrier(secret, 1000000000000); });
  const geldig = context.verifieerCarrier(headers, secret, { nu: 1000000000100 });
  assert.equal(geldig.chainId, root.chainId); assert.equal(geldig.causedBy, root.stepId);
  assert.equal(geldig.actorRef, null, 'actorbevoegdheid reist nooit mee met correlation');
  assert.equal(context.verifieerCarrier({ ...headers, 'x-rtg-chain': headers['x-rtg-chain'] + 'a' }, secret,
    { nu: 1000000000100 }), null);
  assert.equal(context.verifieerCarrier(headers, secret, { nu: 1000001000000 }), null, 'oude carrier verloopt');
});

test('ledger is content-addressed, append-only en gescheiden per trust boundary', () => {
  const regels = [], ledger = maakLedger({ regels, nu: () => '2026-09-30T00:00:00.000Z' });
  const bewijs = ledger.bewijs({ available: true }, { kind: 'capacity',
    subjectRef: ref('window', 'A-20'), capabilityRef: { id: 'hospitality.availability.check', version: 1 },
    authorityRef: { id: 'rtg:hospitality', version: 1 } });
  assert.match(bewijs.evidenceId, /^evidence_[a-f0-9]{64}$/);
  assert.notEqual(bewijs.evidenceId, 'evidence_' + bewijs.digest,
    'de identifier bindt meer dan alleen de losse content');
  ledger.append({ boundary: 'supplier:A', claimId: 'claim_a', evidenceRefs: [bewijs] });
  ledger.append({ boundary: 'supplier:B', claimId: 'claim_b', evidenceRefs: [bewijs] });
  ledger.append({ boundary: 'supplier:A', claimId: 'claim_c', evidenceRefs: [bewijs] });
  assert.deepEqual(ledger.verify('supplier:A').ok, true);
  assert.equal(regels[2].previousHash, regels[0].hash, 'interleaving koppelt nooit twee tenants');
  const fout = regels.map(x => ({ ...x })); fout[2].claimId = 'gewijzigd';
  assert.equal(maakLedger({ regels: fout }).verify('supplier:A').ok, false);
});

test('claims en ledger dragen alleen digests en veilige refs, nooit de aangeleverde waarde', () => {
  const state = {}, plane = maakPlane({ state, mode: 'shadow' });
  const r = plane.observe({ capability: 'hospitality.availability.check', boundary: 'supplier:A',
    subjectRef: ref('window', 'A-20'), predicate: 'hospitality.capacity.available',
    value: { secret: 'niet-in-claim' }, evidence: { available: true },
    policy: { id: 'hospitality-policy', version: 1, decision: 'SHADOW' } });
  assert.equal(r.ok, true);
  assert.match(r.claim.valueDigest, /^[a-f0-9]{64}$/);
  assert.equal(Object.hasOwn(r.claim, 'value'), false);
  assert.equal(plane.ledger.verify('supplier:A').ok, true);
  const herstart = maakPlane({ state, mode: 'shadow' });
  const opgeslagen = herstart.ledger.haalBewijs(r.claim.evidenceRefs[0].evidenceId);
  assert.equal(Object.hasOwn(opgeslagen, 'content'), false);
  assert.equal(opgeslagen.contentDigest, r.claim.evidenceRefs[0].digest);
  assert.equal(opgeslagen.metadata.capabilityRef.id, 'hospitality.availability.check');
  assert.match(opgeslagen.metadata.subjectRefDigest, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(state).includes('niet-in-claim'), false);
  assert.equal(JSON.stringify(state).includes('A-20'), false,
    'de ledger bewaart geen leesbare subjectref naast de domeinclaim');
});

test('dezelfde content voor twee subjects dedupliceert nooit over de subjectgrens', () => {
  const blobs = {}, ledger = maakLedger({ blobs });
  const metadata = { kind: 'capacity', capabilityRef: { id: 'hospitality.availability.check', version: 1 },
    authorityRef: { id: 'rtg:hospitality', version: 1 }, privateNote: 'niet-bewaren' };
  const a = ledger.bewijs({ available: true }, { ...metadata, subjectRef: ref('window', 'A') });
  const b = ledger.bewijs({ available: true }, { ...metadata, subjectRef: ref('window', 'B') });
  assert.notEqual(a.evidenceId, b.evidenceId);
  assert.equal(Object.keys(blobs).length, 2);
  assert.equal(JSON.stringify(blobs).includes('niet-bewaren'), false);
  assert.equal(JSON.stringify(blobs).includes('"id":"A"'), false);
});

test('ledgercapaciteit sluit zonder historie te verwijderen en replay blijft mogelijk', () => {
  const regels = [], blobs = {}, ledger = maakLedger({ regels, blobs,
    limits: { records: 1, evidence: 1 }, nu: () => '2026-09-30T00:00:00.000Z' });
  const metadata = { subjectRef: ref('window', 'A'), capabilityRef: { id: 'hospitality.availability.check', version: 1 } };
  const eerste = ledger.bewijs({ available: true }, metadata);
  assert.equal(ledger.bewijs({ available: true }, metadata).evidenceId, eerste.evidenceId, 'idempotente replay blijft veilig');
  assert.throws(() => ledger.bewijs({ available: false }, metadata), e => e.code === 'EVIDENCE_CAPACITY_REACHED');
  ledger.append({ boundary: 'supplier:A', evidenceRefs: [eerste] });
  assert.throws(() => ledger.append({ boundary: 'supplier:A', evidenceRefs: [eerste] }),
    e => e.code === 'EVIDENCE_CAPACITY_REACHED');
  assert.equal(regels.length, 1); assert.equal(Object.keys(blobs).length, 1);
  assert.equal(ledger.verify('supplier:A').ok, true, 'de bestaande hashketen is niet stil ingekort');
});

test('legacy raw evidence start fail-closed en wordt niet stil herschreven', () => {
  const legacy = { evidence_oud: { evidenceId: 'evidence_oud', digest: 'a'.repeat(64),
    metadata: { kind: 'capacity' }, content: { persoon: 'raw' } } };
  assert.throws(() => maakLedger({ blobs: legacy }), e => e.code === 'LEGACY_RAW_EVIDENCE_REQUIRES_MIGRATION');
  assert.equal(legacy.evidence_oud.content.persoon, 'raw');
});

test('capability resolution is fail-closed op implementatie, policy, compatibility en SLO', () => {
  const plane = maakPlane({ state: {} });
  const basis = { id: 'reservation.request', versions: { client: 1, policy: 1, event: 1 },
    policy: { decision: 'ALLOW' }, dependencies: { 'hospitality.availability.check': true } };
  assert.equal(plane.why({ id: 'bestaat.niet' }).decision, 'DENY');
  assert.deepEqual(plane.why({ ...basis, slo: { oordeel: 'onvoldoende gemeten' } }).reasons, ['SLO_UNKNOWN']);
  assert.equal(plane.why({ ...basis, slo: { oordeel: 'niet gehaald' } }).state, 'DEGRADED');
  assert.equal(plane.why({ ...basis, slo: { oordeel: 'gehaald' } }).state, 'AVAILABLE');
  assert.equal(plane.why({ ...basis, versions: { client: 0, policy: 1, event: 1 }, slo: { oordeel: 'gehaald' } }).decision, 'DENY');
});

test('compatibility degradeert alleen veilige reads; mutations gaan dicht', () => {
  const c = { compatibility: { client: { min: 6 }, policy: { min: 12 }, event: { min: 5 } } };
  assert.equal(compatibility.resolve(c, { client: 5, policy: 12, event: 5 }).decision, 'DENY');
  assert.equal(compatibility.resolve(c, { client: 5, policy: 12, event: 5 }, { readOnly: true }).decision, 'DEGRADE');
});

test('compatibility matrix komt uit contracts en capability-SLO mist nooit stilletjes een doel', () => {
  const plane = maakPlane({ state: {} });
  const matrix = plane.registry.compatibilityMatrix();
  assert.equal(matrix.length, plane.registry.publiek().length);
  assert.ok(matrix.every(x => x.client && x.policy && x.event));
  const onbekend = sloProfiles.resolve('booking-v1', { doelen: [
    { id: 'beschikbaarheid', oordeel: 'gehaald' }, { id: 'snelheid-p90', oordeel: 'gehaald' }
  ] });
  assert.equal(onbekend.oordeel, 'onvoldoende gemeten');
  assert.ok(onbekend.reasons.includes('SLO_MISSING:booking-success'));
  const pay = sloProfiles.resolve('payment-v1', { doelen: [
    { id: 'betalen', oordeel: 'gehaald' }, { id: 'snelheid-p99', oordeel: 'gehaald' },
    { id: 'beschikbaarheid', oordeel: 'gehaald' }
  ] });
  assert.equal(pay.oordeel, 'gehaald');
});

test('capabilitymeter scheidt techniek, policy en domeinuitkomst duurzaam', () => {
  const start = Date.parse('2026-09-28T00:00:00.000Z'), einde = Date.parse('2026-09-30T00:00:00.000Z');
  const state = {}, plane = maakPlane({ state, nu: () => start });
  for (let n = 0; n < 200; n++) plane.metrics.record({ capability: 'payment.authorize',
    outcome: 'SUCCEEDED', domainOutcome: 'PAYMENT_AUTHORIZED', durationMs: 100,
    measurementKey: 'pay-success-' + n, at: einde });
  plane.metrics.record({ capability: 'payment.authorize', outcome: 'DENIED',
    domainOutcome: 'POLICY_DENIED', errorClass: 'POLICY_DENIED', durationMs: 3, at: einde });
  const groen = plane.slo('payment.authorize', einde);
  assert.equal(groen.oordeel, 'gehaald');
  assert.equal(groen.availability.eligible, 200);
  assert.equal(groen.excluded.denied, 1, 'een policyweigering is geen technische storing');
  assert.equal(groen.domainOutcomes.POLICY_DENIED, 1);
  const herstart = maakPlane({ state, nu: () => einde });
  assert.equal(herstart.slo('payment.authorize', einde).availability.succeeded, 200,
    'de meting overleeft een procesherstart');
});

test('capability-SLO bewijst foutbudget, latency, freshness en onvoldoende bewijs', () => {
  const start = Date.parse('2026-09-28T00:00:00.000Z'), einde = Date.parse('2026-09-30T00:00:00.000Z');
  const plane = maakPlane({ state: {}, nu: () => start });
  assert.deepEqual(plane.slo('reservation.request', start).reasons,
    ['NO_ELIGIBLE_MEASUREMENTS', 'INSUFFICIENT_SAMPLES', 'INSUFFICIENT_WINDOW_COVERAGE',
      'INSUFFICIENT_LATENCY_SAMPLES', 'STALE_MEASUREMENTS']);
  for (let n = 0; n < 197; n++) plane.metrics.record({ capability: 'payment.authorize',
    outcome: 'SUCCEEDED', domainOutcome: 'PAYMENT_AUTHORIZED', durationMs: 100, at: einde });
  for (let n = 0; n < 3; n++) plane.metrics.record({ capability: 'payment.authorize', outcome: 'FAILED',
    domainOutcome: 'PAYMENT_FAILED', errorClass: 'PROVIDER_TIMEOUT', durationMs: 1500, at: einde });
  const rood = plane.slo('payment.authorize', einde);
  assert.equal(rood.oordeel, 'niet gehaald');
  assert.ok(rood.reasons.includes('AVAILABILITY_TARGET_MISSED'));
  assert.ok(rood.reasons.includes('LATENCY_TARGET_MISSED'));
  assert.equal(rood.availability.budget.exhausted, true);
  assert.equal(rood.errorClasses.PROVIDER_TIMEOUT, 3);
});

test('measurementsleutel telt replay eenmaal en weigert betekenisconflict', () => {
  const plane = maakPlane({ state: {} });
  const basis = { capability: 'reservation.request', outcome: 'SUCCEEDED',
    domainOutcome: 'RESERVATION_REQUESTED', measurementKey: 'reservation:R1', durationMs: 10 };
  assert.equal(plane.measure(basis).replay, false);
  assert.equal(plane.measure({ ...basis, durationMs: 99, replay: true }).replay, true);
  assert.equal(plane.metrics.aggregate('reservation.request', 30).attempts, 1);
  assert.equal(plane.metrics.aggregate('reservation.request', 30).replays, 1);
  assert.throws(() => plane.measure({ ...basis, outcome: 'FAILED', errorClass: 'TIMEOUT' }),
    /andere betekenis/);
});

test('alle zes capabilityfasen hebben een meetbaar profiel in één snapshot', () => {
  const plane = maakPlane({ state: {} }), snapshot = plane.snapshot();
  assert.deepEqual(snapshot.contracts.map(c => c.phase).sort(),
    ['availability', 'booking', 'experience', 'fulfillment', 'outcome', 'payment']);
  assert.equal(snapshot.capabilitySlo.length, 6);
  assert.ok(snapshot.capabilitySlo.every(x => x.profile && x.oordeel === 'onvoldoende gemeten'));
});

test('deterministische retry houdt input vast en bewijst iedere poging', async () => {
  assert.equal(retry.vertraging('op-1', 2, { baseMs: 100 }), retry.vertraging('op-1', 2, { baseMs: 100 }));
  let keren = 0; const gezien = [];
  const r = await retry.voerUit({ operationId: 'op-1', idempotencyKey: 'idem-1', inputHash: 'hash-1',
    policy: { maxAttempts: 3, baseMs: 1 }, wait: async () => {}, onAttempt: x => gezien.push(x),
    execute: async ({ inputHash }) => { assert.equal(inputHash, 'hash-1'); keren++; if (keren < 3)
      throw Object.assign(new Error('tijdelijk'), { code: 'ETIMEDOUT' }); return { ok: true }; } });
  assert.equal(r.ok, true); assert.equal(keren, 3); assert.equal(gezien.length, 3);
  assert.deepEqual(new Set(gezien.map(x => x.inputHash)), new Set(['hash-1']));
});

test('ambigue geldactie herhaalt nooit zonder reconciliatiebewijs', async () => {
  let calls = 0;
  const r = await retry.voerUit({ operationId: 'pay-1', idempotencyKey: 'idem-pay', inputHash: 'money-hash', money: true,
    policy: { maxAttempts: 4 }, execute: async () => { calls++; throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT', ambiguous: true }); } });
  assert.equal(r.ok, false); assert.equal(r.classification, 'RECONCILE_REQUIRED'); assert.equal(calls, 1);
});

test('outbox en inbox maken dubbele aflevering veilig en detecteren key-conflict', async () => {
  const plane = maakPlane({ state: {} });
  const event = { id: 'event-1', type: 'reservation.requested', chainId: 'chain-1', payload: { reservationRef: 'R1' } };
  assert.equal(plane.transport.enqueue(event).replay, false);
  assert.equal(plane.transport.enqueue(event).replay, true);
  assert.throws(() => plane.transport.enqueue({ ...event, payload: { reservationRef: 'R2' } }), /andere inhoud/);
  let effects = 0;
  assert.equal((await plane.transport.consume(event, async () => ({ effect: ++effects }))).replay, false);
  assert.equal((await plane.transport.consume(event, async () => ({ effect: ++effects }))).replay, true);
  assert.equal(effects, 1);
});

test('migratieplanner laat UNKNOWN en REVIEW nooit automatisch uitvoeren', () => {
  const p = migration.plan({ change: 'schema-v10', from: 9, to: 10,
    entities: [{ ref: { type: 'safe', id: '1' } }, { ref: { type: 'meaning', id: '2' } }],
    classify: e => e.ref.type === 'safe' ? { state: 'SAFE_AUTO', preview: { migrated: true } }
      : { state: 'REVIEW', reasons: ['DOMAIN_MEANING_CHANGED'] } });
  assert.equal(p.decision, 'REVIEW'); assert.equal(migration.verify(p).executable, false);
  const unknown = migration.plan({ change: 'x', from: 1, to: 2, entities: [{}], classify: () => null });
  assert.equal(unknown.entities[0].state, 'UNKNOWN'); assert.notEqual(unknown.decision, 'ALLOW');
});

test('dependency-confidence leert per edge en invalidation volgt alleen bewezen kanten', () => {
  const g = provenance.maakGraaf(); g.node('change:a'); g.node('claim:b'); g.node('proof:c');
  const e = g.edge('change:a', 'claim:b', { reason: 'imports', confidence: 0.5 });
  g.edge('claim:b', 'proof:c', { reason: 'proves', confidence: 0.8 });
  const na = g.calibrate(e.edgeId, false, 'evidence:red');
  assert.ok(na.confidence < 0.5);
  assert.deepEqual(g.invalidate(['change:a']), ['change:a', 'claim:b', 'proof:c']);
  assert.equal(g.why('change:a', 'proof:c').connected, true);
  assert.equal(g.why('proof:c', 'change:a').confidence, 0);
});

test('hospitality golden chain gebruikt zes echte adapters en één causale keten', async () => {
  const plane = maakPlane({ state: {}, mode: 'shadow' }), keys = new Set(), calls = [];
  const adapter = phase => async meta => {
    calls.push({ phase, chainId: meta.context.chainId, causedBy: meta.context.causedBy, key: meta.idempotencyKey });
    assert.equal(keys.has(phase + ':' + meta.idempotencyKey), false); keys.add(phase + ':' + meta.idempotencyKey);
    return { ok: true, subjectRef: ref(phase, phase + '-1'), value: { status: 'ok' },
      policy: { id: phase + '-policy', version: 1, decision: 'ALLOW' } };
  };
  const adapters = Object.fromEntries(hospitalityChain.STAPPEN.map(([p]) => [p, adapter(p)]));
  const r = await hospitalityChain.run({ plane, input: { supplierRef: 'S1', date: '2026-10-10' }, adapters });
  assert.equal(r.ok, true); assert.equal(calls.length, 6); assert.equal(new Set(calls.map(x => x.chainId)).size, 1);
  assert.equal(r.evidence.length, 6); assert.equal(plane.ledger.lijst({ chainId: r.chainId }).length, 18,
    'iedere stap heeft een attempt-, claim- en measurement receipt');
  for (const [, capability] of hospitalityChain.STAPPEN)
    assert.equal(plane.metrics.aggregate(capability, 30).attempts, 1);
  for (let i = 1; i < calls.length; i++) assert.ok(calls[i].causedBy, 'iedere volgende fase heeft een directe oorzaak');
});

test('hospitality chain stopt gesloten en voert latere fasen niet uit', async () => {
  const plane = maakPlane({ state: {} }); let later = 0;
  const adapters = Object.fromEntries(hospitalityChain.STAPPEN.map(([p]) => [p, async () => {
    if (p === 'booking') return { ok: false, status: 409, error: 'geen capaciteit' };
    if (['payment', 'fulfillment', 'outcome'].includes(p)) later++;
    return { ok: true, subjectRef: ref(p, p), value: { ok: true } };
  }]));
  const r = await hospitalityChain.run({ plane, input: {}, adapters });
  assert.equal(r.ok, false); assert.equal(r.failedAt, 'booking'); assert.equal(later, 0);
});

test('constitution is pas groen wanneer alle invarianten bewezen zijn', () => {
  assert.equal(constitution.controleer({}).ok, false);
  const groen = Object.fromEntries(constitution.INVARIANTS.map(i => [i.id, true]));
  assert.deepEqual(constitution.controleer(groen), { ok: true, checked: constitution.INVARIANTS.length, missing: [] });
});
