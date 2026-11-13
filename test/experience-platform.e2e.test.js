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

test('dezelfde persoonlijke Agenda-intrekking geldt via direct HTTP en Experience', async () => {
  const eigenaar = await post('/api/auth/login', {
    login: 'roellie.i@gmail.com', password: 'Imran', pasApp: 'business'
  });
  assert.equal(eigenaar.status, 200);
  assert.ok(eigenaar.body.token);
  const ander = await post('/api/auth/register', { name: 'Experience Ander', email: 'experience-ander@rtg.test',
    phone: '0612345679', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' });
  assert.equal(ander.status, 200);
  assert.ok(ander.body.token);
  const invoer = { intent: 'schedule.item.create', version: 1, world: 'work',
    parameters: { title: 'HTTP actuele bevoegdheid', date: new Date(Date.now() + 86400000).toISOString().slice(0, 10) },
    routeBeleid: { allowed: true }, canonicalRoute: '/api/experience/intent/execute' };
  const preview = await post('/api/experience/intent/preview', invoer, token);
  assert.equal(preview.status, 200, JSON.stringify(preview.body));
  const opdracht = { previewId: preview.body.preview.id, idempotencyKey: 'authority-http-001', confirmed: true,
    intent: 'attention.acknowledge', routeBeleid: { allowed: true } };
  const zet = aan => post('/api/boardroom/zet', {
    id: 'dom-agenda', persoon: 'experience@rtg.test', aan
  }, eigenaar.body.token);
  try {
    assert.equal((await zet(false)).status, 200);
    const direct = await post('/api/agenda/toevoegen', {
      titel: invoer.parameters.title, datum: invoer.parameters.date
    }, token);
    assert.equal(direct.status, 503);
    const dicht = await post('/api/experience/intent/preview', invoer, token);
    assert.equal(dicht.status, direct.status);
    assert.equal(dicht.body.code, 'DOMAIN_ACCESS_DENIED');
    const geweigerd = await post('/api/experience/intent/execute', opdracht, token);
    assert.equal(geweigerd.status, 503);
    assert.equal(geweigerd.body.code, 'DOMAIN_ACCESS_DENIED');
    const bewijs = await post('/api/experience/evidence', { limit: 100 }, token);
    assert.equal(bewijs.body.evidence.some(e => e.previewId === preview.body.preview.id), false);
    const gestolen = await post('/api/experience/intent/execute', opdracht, ander.body.token);
    assert.equal(gestolen.status, 404);
    assert.equal(gestolen.body.code, 'PREVIEW_NOT_FOUND');
    assert.equal((await post('/api/experience/intent/preview', invoer, ander.body.token)).status, 200);
    assert.equal((await zet(true)).status, 200);
    const uitgevoerd = await post('/api/experience/intent/execute', opdracht, token);
    assert.equal(uitgevoerd.status, 200, JSON.stringify(uitgevoerd.body));
    assert.equal((await zet(false)).status, 200);
    const replay = await post('/api/experience/intent/execute', opdracht, token);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.evidence.id, uitgevoerd.body.evidence.id);
    assert.equal((await zet(true)).status, 200);
    const agenda = await post('/api/agenda/mijn-lijst', {}, token);
    assert.equal(agenda.status, 200);
    assert.equal(agenda.body.items.filter(i => i.titel === invoer.parameters.title).length, 1);
    const eind = await post('/api/experience/evidence', { limit: 100 }, token);
    assert.equal(eind.body.evidence.filter(e => e.previewId === preview.body.preview.id).length, 1);
  } finally {
    assert.equal((await zet(true)).status, 200, 'de persoonlijke proefpoort moet weer open');
  }
});

test('de vier echte serversprojecties delen één contract zonder domeinwaarheid te kopiëren', async () => {
  let workContext;
  for (const world of ['living', 'travel', 'work', 'foundation']) {
    const r = await post('/api/experience/bootstrap', { world }, token);
    assert.equal(r.status, 200, world + ': ' + JSON.stringify(r.body).slice(0, 200));
    assert.equal(r.body.currentWorld, world);
    assert.equal(r.body.projection.world, world);
    assert.equal(r.body.projection.provenance.ownsSourceData, false);
    assert.ok(r.body.currentContext.id.startsWith('ctx_'));
    assert.match(r.body.projection.snapshotHash, /^[a-f0-9]{64}$/);
    if (world === 'work') workContext = r.body.currentContext.id;
  }
  const resume = await post('/api/experience/resume', { world: 'work',
    contextId: workContext, surface: '/apps/kantoor.html',
    navigationState: ['operations', 'attention'] }, token);
  assert.equal(resume.status, 200);
  assert.equal(resume.body.resume.contextId, workContext);
  const heropend = await post('/api/experience/bootstrap', { world: 'work' }, token);
  assert.equal(heropend.body.resume.surface, '/apps/kantoor.html');
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

test('bronwijziging tussen preview en bevestiging blokkeert ook over HTTP', async () => {
  const datum = new Date().toISOString().slice(0, 10);
  const gemaakt = await post('/api/agenda/toevoegen',
    { titel: 'NEXT broncontrole', datum, tijd: '19:30' }, token);
  assert.equal(gemaakt.status, 200);
  const afspraak = gemaakt.body.items.find(i => i.titel === 'NEXT broncontrole');
  assert.ok(afspraak);
  const lees = async () => {
    const r = await post('/api/experience/projection', { world: 'work' }, token);
    assert.equal(r.status, 200);
    return r.body.attention.find(a => a.title === 'NEXT broncontrole');
  };
  const item = await lees();
  assert.ok(item);
  const bereid = () => post('/api/experience/intent/preview', {
    intent: 'attention.acknowledge', version: 1,
    parameters: { world: 'work', attentionId: item.id }
  }, token);
  const oud = await bereid();
  assert.equal(oud.status, 200);
  const gewijzigd = await post('/api/agenda/wijzig', { id: afspraak.id, tijd: '17:00' }, token);
  assert.equal(gewijzigd.status, 200);
  const stale = await post('/api/experience/intent/execute', {
    previewId: oud.body.preview.id, idempotencyKey: 'next-http-stale', confirmed: true
  }, token);
  assert.equal(stale.status, 409);
  assert.equal(stale.body.code, 'STALE_ATTENTION');
  assert.equal((await lees()).lifecycle, 'PRESENTED');
  const bewijs = await post('/api/experience/evidence', {}, token);
  assert.equal(bewijs.body.evidence.some(e => e.previewId === oud.body.preview.id), false);
  const vers = await bereid();
  const akkoord = await post('/api/experience/intent/execute', {
    previewId: vers.body.preview.id, idempotencyKey: 'next-http-fresh', confirmed: true
  }, token);
  assert.equal(akkoord.status, 200);
  assert.equal((await lees()).lifecycle, 'ACKNOWLEDGED');
  assert.notEqual(akkoord.body.attention.revision, item.revision);
  await post('/api/agenda/wijzig', { id: afspraak.id, tijd: '16:00' }, token);
  assert.equal((await lees()).lifecycle, 'PRESENTED');
});

test('Tap, Search en Rahul kunnen dezelfde gebrokerde agenda-intentie veilig gebruiken', async () => {
  const boot = await post('/api/experience/bootstrap', { world: 'work' }, token);
  const definition = boot.body.intents.find(i => i.id === 'schedule.item.create');
  assert.ok(definition, 'schedule.item.create ontbreekt in het serverregister');
  /* DE DATUM KOMT UIT DE KLOK EN STAAT NIET VAST, en dat is geen netheid maar
     een reparatie. Hier stond '2026-09-05'. Deze toets eist verderop dat het
     item in de WERKDAG-projectie verschijnt, en die toont alleen wat nog komt
     (kern/kantoorwereld.js: `dag(i.datum) >= vandaag()`). Op 5 september 2026
     was dat waar; vanaf 6 september viel het item eruit en zakte deze toets --
     elke dag, op elke tak, voor iedereen. Een vaste datum in een lijf dat tegen
     VANDAAG wordt gehouden is dus geen fixture maar een tijdbom.

     Morgen en niet vandaag: `vandaag()` rekent in UTC, en een run die over
     middernacht loopt zou bij een datum van vandaag alsnog omvallen. */
  const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const parameters = { title: 'Golden path overleg', date: morgen, time: '10:15',
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
