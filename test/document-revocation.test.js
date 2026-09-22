'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { randomUUID } = require('node:crypto');
const { startServer, stop } = require('./helper');
test('real session revoked after admission cannot mutate or replay when its transaction resumes', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-document-revoke-'));
  const s = await startServer({ script: path.join(__dirname, 'fixtures/document-certification/queued-server.cjs'), env: { RTG_DATA_DIR: dir, RTG_STORE: process.env.RTG_DOCUMENT_TEST_STORE || 'sqlite', SMTP_URL: '' } });
  t.after(async () => { await new Promise(resolve => { s.child.once('exit', resolve); stop(s); }); fs.rmSync(dir, { recursive: true, force: true }); });
  let token;
  const post = async (route, body) => {
    const r = await fetch(s.base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json() };
  };
  const member = await post('/api/auth/register', { name: 'Synthetic Revocation', email: 'revoke@example.test', phone: '0612345678', password: 'synthetic-12345', geboortedatum: '1990-01-01', tier: 'rtg' });
  assert.equal(member.status, 200); token = member.body.token;
  const file = await post('/api/bestanden/upload', { naam: 'safe.txt', dataUrl: 'data:text/plain;base64,c2FmZQ==' }); assert.equal(file.status, 200);
  fs.writeFileSync(path.join(dir, 'arm-document-wait'), 'arm');
  const pending = post('/api/bestanden/actie', { capability: 'documents.trash', contractVersion: 1, id: file.body.id, expectedVersion: file.body.documentVersion, operationId: randomUUID() });
  const until = Date.now() + 10000;
  while (!fs.existsSync(path.join(dir, 'document-waiting')) && Date.now() < until) await new Promise(r => setTimeout(r, 10));
  assert.ok(fs.existsSync(path.join(dir, 'document-waiting')), 'request actually reached capability before revocation');
  const logout = await post('/api/logout'); assert.equal(logout.status, 200);
  fs.writeFileSync(path.join(dir, 'release-document-wait'), 'release');
  const result = await pending; assert.equal(result.status, 401); assert.equal(result.body.code, 'authority_revoked');
  const login = await post('/api/auth/login', { email: 'revoke@example.test', password: 'synthetic-12345' });
  assert.equal(login.status, 200, JSON.stringify(login)); token = login.body.token;
  const state = await post('/api/bestanden/mijn'); assert.equal(state.status, 200);
  assert.equal(state.body.items.find(x => x.id === file.body.id).weg, false);
});
