const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, stop } = require('./helper');

let server, base, token;
const post = async (pad, body, authToken) => {
  const r = await fetch(base + pad, { method: 'POST', headers: {
    'Content-Type': 'application/json', ...(authToken ? { Authorization: 'Bearer ' + authToken } : {})
  }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

test.before(async () => {
  server = await startServer({ env: { SMTP_URL: '' } });
  base = server.base;
  const r = await post('/api/auth/register', { name: 'Experience Lid', email: 'experience@rtg.test',
    phone: '0612345678', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
  token = r.body.token;
  assert.ok(token, 'registratie leverde geen token');
});
test.after(() => stop(server && server.child));

test('de vier echte serversprojecties delen één contract zonder domeinwaarheid te kopiëren', async () => {
  for (const world of ['living', 'travel', 'work', 'foundation']) {
    const r = await post('/api/experience/bootstrap', { world }, token);
    assert.equal(r.status, 200, world + ': ' + JSON.stringify(r.body).slice(0, 200));
    assert.equal(r.body.currentWorld, world);
    assert.equal(r.body.projection.world, world);
    assert.equal(r.body.projection.provenance.ownsSourceData, false);
    assert.ok(r.body.currentContext.id.startsWith('ctx_'));
    assert.match(r.body.projection.snapshotHash, /^[a-f0-9]{64}$/);
  }
});

test('een echte agendaregel wordt attention en loopt gebrokerd naar evidence', async () => {
  const vandaag = new Date().toISOString().slice(0, 10);
  const toegevoegd = await post('/api/agenda/toevoegen', {
    titel: 'Experience review', datum: vandaag, tijd: '23:45'
  }, token);
  assert.equal(toegevoegd.status, 200);

  const boot = await post('/api/experience/bootstrap', { world: 'work' }, token);
  const item = boot.body.projection.attention.find(a => a.title === 'Experience review');
  assert.ok(item, 'de echte agendaregel werd geen WorkOS-attention');

  const foundation = await post('/api/experience/bootstrap', { world: 'foundation' }, token);
  assert.equal(foundation.body.projection.attention.some(a => a.title === 'Experience review'), false,
    'een WorkOS-agendaregel mag niet naar FoundationOS lekken');

  const preview = await post('/api/experience/intent/preview', {
    intent: 'attention.acknowledge', version: 1, contextId: boot.body.currentContext.id,
    parameters: { world: 'work', attentionId: item.id }
  }, token);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.preview.policyDecision.decision, 'ALLOW_WITH_CONFIRMATION');

  const uitgevoerd = await post('/api/experience/intent/execute', {
    previewId: preview.body.preview.id, idempotencyKey: 'experience-e2e-001', confirmed: true
  }, token);
  assert.equal(uitgevoerd.status, 200, JSON.stringify(uitgevoerd.body));
  assert.equal(uitgevoerd.body.attention.lifecycle, 'ACKNOWLEDGED');

  const replay = await post('/api/experience/intent/execute', {
    previewId: preview.body.preview.id, idempotencyKey: 'experience-e2e-001', confirmed: true
  }, token);
  assert.equal(replay.status, 200);
  /* De HTTP-idempotentiepoort mag exact het eerste antwoord herhalen voordat
     de broker wordt aangeroepen. De unittoets bewijst broker.replay=true; hier
     is de sterkere ketenbewering dat dezelfde evidence terugkomt. */
  assert.equal(replay.body.evidence.id, uitgevoerd.body.evidence.id);

  const evidence = await post('/api/experience/evidence', {}, token);
  assert.equal(evidence.status, 200);
  assert.equal(evidence.body.evidence.filter(e => e.id === uitgevoerd.body.evidence.id).length, 1);
});

test('Tap, Search en Rahul kunnen dezelfde gebrokerde agenda-intentie veilig gebruiken', async () => {
  const boot = await post('/api/experience/bootstrap', { world: 'work' }, token);
  const definition = boot.body.intents.find(i => i.id === 'schedule.item.create');
  assert.ok(definition, 'schedule.item.create ontbreekt in het serverregister');
  const parameters = { title: 'Golden path overleg', date: '2026-09-05', time: '10:15',
    note: 'Via de gedeelde intentlaag' };

  const fout = await post('/api/experience/intent/preview', {
    intent: definition.id, version: definition.version, world: 'work',
    contextId: 'ctx_verzonnen', parameters
  }, token);
  assert.equal(fout.status, 403);
  assert.equal(fout.body.code, 'CONTEXT_NOT_ALLOWED');

  const preview = await post('/api/experience/intent/preview', {
    intent: definition.id, version: definition.version, world: 'work',
    contextId: boot.body.currentContext.id, parameters
  }, token);
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  assert.equal(preview.body.preview.consequence.changesDomainTruth, true);
  assert.equal(preview.body.preview.consequence.createsFinancialCommitment, false);

  const zonderBevestiging = await post('/api/experience/intent/execute', {
    previewId: preview.body.preview.id, idempotencyKey: 'schedule-e2e-001', confirmed: false
  }, token);
  assert.equal(zonderBevestiging.status, 409);
  assert.equal(zonderBevestiging.body.code, 'CONFIRMATION_REQUIRED');

  const body = { previewId: preview.body.preview.id,
    idempotencyKey: 'schedule-e2e-001', confirmed: true };
  const uitgevoerd = await post('/api/experience/intent/execute', body, token);
  assert.equal(uitgevoerd.status, 200, JSON.stringify(uitgevoerd.body));
  assert.equal(uitgevoerd.body.item.titel, 'Golden path overleg');
  assert.equal(uitgevoerd.body.objectRef.domain, 'agenda');

  const replay = await post('/api/experience/intent/execute', body, token);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.evidence.id, uitgevoerd.body.evidence.id);
  const agenda = await post('/api/agenda/mijn-lijst', {}, token);
  assert.equal(agenda.status, 200);
  assert.equal(agenda.body.items.filter(i => i.titel === 'Golden path overleg').length, 1);

  const work = await post('/api/experience/projection', { world: 'work',
    contextId: boot.body.currentContext.id }, token);
  assert.equal(work.status, 200);
  assert.ok(work.body.objects.some(o => o.ref.domain === 'agenda' && o.title === 'Golden path overleg'));
  const evidence = await post('/api/experience/evidence', { limit: 100 }, token);
  assert.equal(evidence.body.evidence.filter(e => e.id === uitgevoerd.body.evidence.id).length, 1);
  assert.equal(evidence.body.integrity.status, 'VERIFIED');
  assert.equal(evidence.body.integrity.valid, true);
  assert.equal(evidence.body.integrity.chainVersion, 2);
});
