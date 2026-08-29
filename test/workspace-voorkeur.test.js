/* De Adaptive Workspace bewaart compositie en niets anders. Dit toetst zowel de
   pure grens als de twee accountwegen die Continuity gebruikt. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { normaliseer } = require('../server/kern/workspace-voorkeur');
const workspaceAudit = require('../server/kern/workspace-audit');
const { startServer, stop } = require('./helper');

test('workspace-voorkeur laat alleen de canonieke compositie door', () => {
  const r = normaliseer({ version: 99, order: ['messages', 'travel', 'messages'], hidden: ['travel'],
    active: 'messages', density: 'compact', token: 'hoort-niet-mee', moduleData: { bericht: 'ook niet' } },
  '2026-08-29T12:00:00.000Z');
  assert.deepEqual(r, { version: 2, order: ['messages', 'travel'], hidden: ['travel'], active: 'messages',
    density: 'compact', updatedAt: '2026-08-29T12:00:00.000Z' });
  assert.equal(normaliseer({ order: ['GOED-NIET'] }).status, 400, 'vrije ids worden niet als opslagpad geaccepteerd');
  assert.equal(normaliseer({ order: ['travel'], hidden: ['travel'], active: 'travel' }).status, 400,
    'een verborgen module kan niet tegelijk actief zijn');
});

test('workspace-audit bewaart alleen brokermetadata en geen vrije detailpayload', () => {
  const md = {};
  const r = workspaceAudit.noteer(md, { action: 'travel.driver.attach', owner: 'travel', phase: 'completed',
    workspaceId: 'dubai', detail: { chauffeur: 'hoort niet in dit spoor' } }, 'member-1', '2026-08-29T12:00:00.000Z');
  assert.equal(r.ok, true); assert.equal(workspaceAudit.lees(md)[0].detail, undefined);
  assert.equal(workspaceAudit.noteer(md, { action: 'vrije actie', owner: 'travel', phase: 'completed' }, 'member-1').status, 400);
});

test.describe('workspace-accountwegen', () => {
  let srv, base, token;
  const api = (pad, body) => fetch(base + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

  test.before(async () => {
    srv = await startServer({ env: { SMTP_URL: '' } }); base = srv.base;
    const u = Date.now().toString().slice(-8);
    const r = await api('/api/auth/register', { name: 'Workspace Lid', email: 'workspace-' + u + '@toets.example',
      phone: '06' + u, password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg', pasApp: 'rtg' });
    token = r.body.token; assert.ok(token, 'registratie gaf geen accounttoken');
  });
  test.after(() => stop(srv && srv.child));

  test('workspace-compositie volgt het account zonder moduledata mee te nemen', async () => {
  const gezet = await api('/api/ik/workspace/zet', { workspace: {
    order: ['messages', 'travel', 'safety'], hidden: ['safety'], active: 'messages', density: 'compact',
    conversation: ['mag niet mee'], authorization: 'mag ook niet mee'
  } });
  assert.equal(gezet.status, 200, JSON.stringify(gezet.body));
  assert.deepEqual(gezet.body.workspace.order, ['messages', 'travel', 'safety']);
  assert.equal(gezet.body.workspace.conversation, undefined);
  assert.equal(gezet.body.workspace.authorization, undefined);
  assert.match(gezet.body.workspace.updatedAt, /^\d{4}-\d\d-\d\dT/);

  const gelezen = await api('/api/ik/workspace', {});
  assert.equal(gelezen.status, 200);
  assert.deepEqual(gelezen.body.workspace, gezet.body.workspace, 'dezelfde canonieke compositie komt terug');
  });

  test('muterende brokeractions krijgen een begrensd accountauditspoor', async () => {
    const gezet = await api('/api/ik/workspace/audit/noteer', { action: 'travel.driver.attach', owner: 'travel',
      phase: 'completed', workspaceId: 'dubai', detail: { kenteken: 'niet bewaren' } });
    assert.equal(gezet.status, 200, JSON.stringify(gezet.body));
    const gelezen = await api('/api/ik/workspace/audit', {});
    assert.equal(gelezen.status, 200); assert.equal(gelezen.body.audit[0].action, 'travel.driver.attach');
    assert.equal(gelezen.body.audit[0].detail, undefined);
  });
});
