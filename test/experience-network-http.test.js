'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const h = require('./helper');
let srv, token;
async function post(path, body, auth = token) {
  const r = await fetch(srv.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(auth ? { Authorization: 'Bearer ' + auth } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, headers: r.headers, body: await r.json() };
}
test.before(async () => {
  srv = await h.startServer({ env: { SMTP_URL: '', RTG_AI_UIT: '1' } });
  token = (await post('/api/auth/register', { name: 'Netwerkproef', email: 'network@rtg.test',
    phone: '0612345678', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' }, null)).body.token;
  assert.ok(token);
});
test.after(() => h.stop(srv && srv.child));
const body = { world: 'living', intent: { goal: 'Mijn plan', needs: ['product', 'verblijf'] } };
test('één HTTP-contract bedient vier werelden; antwoorden zijn niet cachebaar', async () => {
  for (const world of ['living', 'travel', 'work', 'foundation']) {
    const r = await post('/api/experience/network', { ...body, world });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.headers.get('cache-control'), 'private, no-store');
    assert.equal(r.body.proposal.needs.length, 2);
    assert.equal(r.body.completeness.status, 'COMPLETE', JSON.stringify(r.body.completeness));
  }
});
test('onbevoegde, gratis gast en vreemde context krijgen geen graaf', async () => {
  assert.equal((await post('/api/experience/network', body, null)).status, 401);
  const guest = (await post('/api/login', { tier: 'guest', pasApp: 'rtg' }, null)).body.token;
  assert.ok(guest);
  assert.equal((await post('/api/experience/network', body, guest)).status, 403);
  assert.equal((await post('/api/experience/network', { ...body, contextId: 'other-user' })).status, 403);
});
test('werkelijke broker -> domeinlijst -> zelfstandig bewijs; dubbele POST schrijft eenmaal', async () => {
  const r = await post('/api/experience/network', body);
  const choices = r.body.proposal.needs.flatMap(n => n.options.slice(0, 1)).map(o => ({ id: o.id, revision: o.revision }));
  assert.equal(choices.length, 2);
  const p = await post('/api/experience/intent/preview', { world: 'living', intent: 'network.plan.save', version: 1,
    parameters: { title: 'Mijn netwerkplan', choices } });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const execute = { previewId: p.body.preview.id, idempotencyKey: 'network-http-001', confirmed: true };
  const replies = await Promise.all([post('/api/experience/intent/execute', execute), post('/api/experience/intent/execute', execute)]);
  assert.ok(replies.every(r => r.status === 200), JSON.stringify(replies.map(r => r.body)));
  assert.equal(replies[0].body.list.id, replies[1].body.list.id);
  const lists = await post('/api/mall/lijsten', {});
  assert.equal(lists.body.lijsten.filter(l => l.naam === 'Mijn netwerkplan').length, 1);
  const proof = await post('/api/experience/evidence', {});
  assert.equal(proof.body.evidence.filter(e => e.intent.id === 'network.plan.save').length, 1);
  assert.equal(proof.body.integrity.valid, true);
});
