'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const h = require('./helper'), { driver, fullScenario } = require('./lib/library-fixture');
let srv; const tokens = {}, actors = [];
async function request(path, body, actor) {
  const r = await fetch(srv.base + '/api/library/' + path, { method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(tokens[actor] ? { Authorization: 'Bearer ' + tokens[actor] } : {}) },
    body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() };
}
test.before(async () => {
  srv = await h.startServer({ env: { RTG_STORE: 'sqlite', SMTP_URL: '', RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '' } });
  for (const name of ['A', 'B', 'C']) {
    const r = await fetch(srv.base + '/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Library ' + name, email: 'library-' + name + '@example.test', phone: '0612345678',
        password: 'VeiligWachtwoord123!', geboortedatum: '1990-01-01', tier: 'rtg' }) });
    const b = await r.json(); assert.equal(r.status, 200, JSON.stringify(b));
    // Derive the actor from the actual registration result, not a forged request field.
    const id = b.state?.user?.id;
    assert.ok(id, 'De aanmelding geeft een bestaande account-ID terug.');
    const actor = 'user-' + id; actors.push(actor); tokens[actor] = b.token;
  }
});
test.after(async () => { if (srv) await h.stop(srv.child); });
test('echte server: achttien stappen, uitgeschakelde optionele diensten en alle kernelroutes', async () => {
  assert.equal((await request('work/get', { workId: 'missing' })).status, 401);
  const raw = async (actor, action, input) => (await request(action.replace('.', '/'), input, actor)).body;
  const query = async (actor, kind, input) => (await request({ work: 'work/get', edition: 'edition/get', preview: 'publication/preview', proof: 'proof' }[kind], input, actor)).body;
  const d = driver(raw, query, actors[0], actors[1]); const s = await fullScenario(d);
  assert.equal((await request('work/get', { workId: s.workId }, actors[2])).status, 404);
  const forged = await request('rights/grant', await d.input('rights.grant', { grantor: actors[1], actor: actors[0] }), actors[2]);
  assert.equal(forged.status, 404);
  await d.command(d.A, 'edition.warn', { editionId: s.e1, reason: 'Zie de verbeterde tweede editie.' });
  await d.command(d.A, 'edition.withdraw', { editionId: s.e1, reason: 'Geen nieuwe verspreiding van editie 1.' });
  const old = await query(d.A, 'edition', { workId: s.workId, editionId: s.e1 });
  assert.equal(old.available, false); assert.equal(JSON.stringify(old.edition.snapshot), s.bytes);
  await d.command(d.B, 'publication.revoke-consent', { editionId: s.e2, reason: 'Instemming ingetrokken.' });
  await d.command(d.B, 'rights.revoke', { grantId: s.grants[1], reason: 'Verlening ingetrokken.' });
  await d.command(d.B, 'agreement.conflict', { agreementId: s.agreementId, reason: 'Bespreek nieuwe verspreiding.' });
  assert.equal((await query(d.A, 'preview', { workId: s.workId, editionId: s.e2 })).code, 'BLOCKING_CONFLICT');
  assert.equal((await query(d.A, 'proof', { workId: s.workId })).integrity, true);
});
test('HTTP-organisatie: uitsluitend de bestaande Concern-eigenaar vertegenwoordigt een entiteit', async () => {
  const response = await fetch(srv.base + '/api/concern/entiteit/nieuw', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokens[actors[0]] },
    body: JSON.stringify({ naam: 'Library testorganisatie', land: 'NL' }) });
  const body = await response.json(); assert.equal(response.status, 200, JSON.stringify(body));
  const id = body.entiteit?.id || body.id;
  assert.ok(id, JSON.stringify(body));
  const input = { operationId: 'organization_work_0001', data: { title: 'Organisatiewerk', type: 'manual', language: 'nl', responsible: 'entiteit:' + id } };
  assert.equal((await request('work/create', input, actors[1])).status, 403);
  const made = await request('work/create', input, actors[0]); assert.equal(made.status, 200, JSON.stringify(made.body));
  const work = await request('work/get', { workId: made.body.workId }, actors[0]);
  assert.equal(work.body.work.responsible, 'entiteit:' + id);
  assert.equal(Object.hasOwn(work.body.work, 'copyrightOwner'), false);
});
