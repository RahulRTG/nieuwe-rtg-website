'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startServer, stop } = require('./helper');
let srv, a, b;
const api = async (pad, body, token = a, transportKey) => {
  const r = await fetch(srv.base + pad, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer ' + token,
    'Idempotency-Key': transportKey || body && body.operationId || crypto.randomUUID()
  }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};
const act = body => api('/api/bestanden/actie', body);
const list = async () => (await api('/api/bestanden/mijn')).body.items;
const input = (file, capability = 'documents.trash') => ({ capability, contractVersion: 1,
  operationId: crypto.randomUUID(), id: file.id, expectedVersion: file.documentVersion });
async function file() {
  const r = await api('/api/bestanden/upload', { naam: 'pilot.txt', dataUrl: 'data:text/plain;base64,cHJvb2Y=' });
  assert.equal(r.status, 200);
  return (await list()).find(x => x.id === r.body.id);
}
test.before(async () => {
  srv = await startServer({ env: { RTG_STORE: process.env.RTG_DOCUMENT_TEST_STORE || 'sqlite', SMTP_URL: '' } });
  for (const n of [1, 2]) {
    const r = await api('/api/auth/register', { name: 'Pilot ' + n, email: 'pilot' + n + '@example.test',
      phone: '061234000' + n, password: 'pilot-local-123', geboortedatum: '1990-01-01', tier: 'rtg' });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.ok(r.body.token); if (n === 1) a = r.body.token; else b = r.body.token;
  }
});
test.after(() => stop(srv && srv.child));

test('one logical trash survives concurrent retries; content and versions remain intact', async () => {
  const f = await file();
  await api('/api/bestanden/upload', { id: f.id, dataUrl: 'data:text/plain;base64,cHJvb2Yy' });
  const body = input((await list()).find(x => x.id === f.id));
  const results = await Promise.all([act(body), act(body), act(body)]);
  assert.ok(results.every(r => r.status === 200), JSON.stringify(results));
  assert.equal(results.filter(r => !r.body.herhaald).length, 1);
  assert.equal(new Set(results.map(r => r.body.auditRef)).size, 1);
  assert.equal((await list()).find(x => x.id === f.id).weg, true);
  assert.equal((await api('/api/bestanden/haal', { id: f.id })).body.dataUrl, 'data:text/plain;base64,cHJvb2Yy');
  assert.equal((await api('/api/bestanden/haal', { id: f.id, versie: 0 })).body.dataUrl, 'data:text/plain;base64,cHJvb2Y=');
  const restore = input((await list()).find(x => x.id === f.id), 'documents.restore');
  const restored = await act(restore);
  assert.equal(restored.status, 200, JSON.stringify(restored));
  assert.equal(restored.body.resource.state, 'active', JSON.stringify(restored));
  assert.equal((await list()).find(x => x.id === f.id).weg, false, 'restore must publish active state');
  const late = await act(body);
  assert.equal(late.body.herhaald, true);
  assert.equal(late.body.resource.state, 'active', 'late retry cannot trash the restored file');
  assert.equal((await list()).find(x => x.id === f.id).weg, false);
});

test('changed input, stale versions, unknown contracts and forged authority fail closed', async () => {
  const f = await file(), body = input(f);
  assert.equal((await act({ ...body, actor: 'owner' })).status, 400);
  assert.equal((await act({ ...body, capability: 'constructor' })).status, 400);
  assert.equal((await act({ ...body, capability: 'document.purge' })).status, 400);
  assert.equal((await act({ ...body, operationId: [body.operationId] })).status, 428);
  assert.equal((await act(body)).status, 200);
  assert.equal((await act({ ...body, capability: 'documents.restore' })).body.code, 'operation_conflict');
  assert.equal((await act({ ...body, operationId: crypto.randomUUID() })).body.code, 'version_conflict');
});

test('owner policy is rechecked before receipts; shared recipient cannot mutate lifecycle', async () => {
  const f = await file(), body = input(f);
  const codeB = (await api('/api/state', {}, b)).body.state.user.codename;
  await api('/api/bestanden/deel', { id: f.id, codenaam: codeB });
  const shared = input((await list()).find(x => x.id === f.id));
  assert.equal((await api('/api/bestanden/actie', shared, b)).status, 404);
  assert.equal((await act(shared)).status, 200);
  assert.equal((await api('/api/bestanden/haal', { id: f.id }, b)).status, 404);
  assert.equal((await api('/api/bestanden/actie', shared, b)).status, 404);
  assert.equal((await api('/api/bestanden/actie', body, 'invalid')).status, 401);
});

test('legacy owner paths require explicit operation and cannot infer permanent deletion', async () => {
  const f = await file();
  assert.equal((await api('/api/bestanden/weg', { id: f.id })).status, 428);
  const { capability, contractVersion, ...body } = input(f);
  assert.equal((await api('/api/bestanden/weg', body)).body.capability, capability);
  assert.equal((await api('/api/bestanden/weg', body)).body.herhaald, true);
  assert.equal((await api('/api/bestanden/haal', { id: f.id })).status, 200);
  const restore = input((await list()).find(x => x.id === f.id), 'documents.restore');
  const r = await api('/api/bestanden/herstel', { id: f.id, operationId: restore.operationId, expectedVersion: restore.expectedVersion });
  assert.equal(r.body.capability, 'documents.restore');
  assert.equal((await api('/api/bestanden/wis', { id: f.id })).status, 409);
});

test('Rahul prepares the same contract; only the bound human confirmation executes it', async () => {
  const f = await file(), body = input(f);
  const proposal = await api('/api/member/doe', { pad: '/api/bestanden/actie', body, akkoord: true, goedgekeurd: true });
  assert.equal(proposal.status, 428, JSON.stringify(proposal));
  assert.equal((await list()).find(x => x.id === f.id).weg, false);
  const confirm = { goedkeuringId: proposal.body.goedkeuring.id, akkoord: true,
    body: { ...body, capability: 'document.purge' } };
  assert.equal((await api('/api/member/doe/bevestig', confirm, b)).status, 403);
  const confirmationKey = crypto.randomUUID();
  const done = await api('/api/member/doe/bevestig', confirm, a, confirmationKey);
  assert.equal(done.body.status, 200, JSON.stringify(done));
  assert.equal(done.body.antwoord.capability, 'documents.trash');
  const retry = await act(body);
  assert.equal(retry.body.auditRef, done.body.antwoord.auditRef);
  assert.equal(retry.body.herhaald, true);
  assert.equal((await api('/api/member/doe/bevestig', confirm, a, confirmationKey)).status, 404);
});

test('a stale Rahul proposal conflicts after the document changes', async () => {
  const f = await file();
  const proposal = await api('/api/member/doe', { pad: '/api/bestanden/actie', body: input(f) });
  assert.equal(proposal.status, 428);
  await api('/api/bestanden/wijzig', { id: f.id, naam: 'changed.txt' });
  const r = await api('/api/member/doe/bevestig', { goedkeuringId: proposal.body.goedkeuring.id, akkoord: true });
  assert.equal(r.body.status, 409);
  assert.equal((await list()).find(x => x.id === f.id).weg, false);
});

test('explicit purge requires ownership and trash; it is not a retry of trash', async () => {
  const f = await file();
  assert.equal((await api('/api/bestanden/wis', { id: f.id }, b)).status, 404);
  assert.equal((await api('/api/bestanden/wis', { id: f.id })).status, 409);
  assert.equal((await act(input(f))).status, 200);
  const deleted = await api('/api/bestanden/wis', { id: f.id });
  assert.equal(deleted.body.weg, true);
  assert.equal((await api('/api/bestanden/haal', { id: f.id })).status, 404);
  assert.equal((await list()).some(x => x.id === f.id), false);
});

// Warm both historical transport-cache layers, then revoke the actual credential.
test('revoked credential cannot replay a successful document response, including route aliases', async () => {
  const f = await file(), body = input(f);
  const alias = '/api/bestanden/actie';
  assert.equal((await api('/API/BESTANDEN/ACTIE/', body)).status, 404, 'this router only exposes canonical paths');
  assert.equal((await api(alias, body)).status, 200);
  assert.equal((await api('/api/logout')).status, 200);
  assert.equal((await api(alias, body)).status, 401);
});
