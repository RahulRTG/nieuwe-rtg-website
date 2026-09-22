/* Four real interfaces execute against independent copies of the SAME SQLite fixture.
   Negative UI cases deliberately forge the client projection/transport credential: hidden buttons are not policy. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { randomUUID, randomBytes } = require('node:crypto'), { DatabaseSync } = require('node:sqlite');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser, edgeActies } = require('./helper');
const pw = laadPlaywright();
const cases = [
  ['trash-allow', 'documents.trash', false, 'ALLOW'], ['trash-deny', 'documents.trash', false, 'DENY'],
  ['trash-stale', 'documents.trash', false, 'STALE'], ['trash-noop', 'documents.trash', true, 'NOOP'],
  ['restore-allow', 'documents.restore', true, 'ALLOW'], ['restore-deny', 'documents.restore', true, 'DENY'],
  ['restore-stale', 'documents.restore', true, 'STALE'], ['restore-invalid', 'documents.restore', false, 'INVALID']
];
const stopWait = s => new Promise(resolve => { if (!s || s.child.exitCode !== null) return resolve(); s.child.once('exit', resolve); stop(s); });
const post = async (s, token, route, body) => {
  const r = await fetch(s.base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json() };
};
function database(dir) {
  const sql = new DatabaseSync(path.join(dir, 'store.db'), { readOnly: true });
  try { return JSON.parse(sql.prepare("SELECT val FROM kv WHERE key='bestanden'").get().val); } finally { sql.close(); }
}
function semantic(result, before, after) {
  const find = data => Object.values(data).flatMap(b => b.items || []).find(x => x.id === before.item.id);
  const board = Object.values(after).find(b => (b.items || []).some(x => x.id === before.item.id));
  const receipts = Object.values(board.documentOperations || {}).filter(x => x.receipt.operationId === before.input.operationId).map(x => {
    const { committedAt, ...receipt } = x.receipt; return { ...x, receipt };
  });
  return { status: result.status, code: result.body.code || null, policy: result.body.policy,
    effect: result.body.effect || null, current: { ...find(after), wegOp: find(after).wegOp ? 'TIMESTAMP' : null },
    audit: receipts.map(x => ({ ...x, receipt: { ...x.receipt, resource: { ...x.receipt.resource, version: 'VERSION_HASH' } } })),
    receiptCount: receipts.length };
}
test('UI Edge API Rahul equivalence: ALLOW DENY INVALID STALE with identical actors resources and persisted snapshots', { skip: geenBrowser(pw) }, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doc-equivalence-')), base = path.join(root, 'base');
  fs.mkdirSync(base); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const env = { RTG_STORE: 'sqlite', RTG_ENC_KEY: '', RTG_SECRET_KEY: randomBytes(32).toString('hex'), SMTP_URL: '', DATABASE_URL: '', PG_URL: '' };
  let seed = await startServer({ env: { ...env, RTG_DATA_DIR: base } }), owner, other;
  const fixtures = [];
  try {
    for (const n of [1, 2]) {
      const r = await post(seed, '', '/api/auth/register', { name: 'Synthetic ' + n, email: 'equivalence' + n + '@example.test', phone: '0612345678', password: 'synthetic-password-123', geboortedatum: '1990-01-01', tier: 'rtg' });
      assert.equal(r.status, 200); if (n === 1) owner = r.body.token; else other = r.body.token;
    }
    for (const [name, capability, trashed, scenario] of cases) {
      const f = await post(seed, owner, '/api/bestanden/upload', { naam: name + '.txt', dataUrl: 'data:text/plain;base64,c3ludGhldGlj' }); assert.equal(f.status, 200);
      let item = (await post(seed, owner, '/api/bestanden/mijn')).body.items.find(x => x.id === f.body.id);
      if (trashed) {
        const r = await post(seed, owner, '/api/bestanden/actie', { capability: 'documents.trash', contractVersion: 1, id: item.id, expectedVersion: item.documentVersion, operationId: randomUUID() }); assert.equal(r.status, 200);
        item = (await post(seed, owner, '/api/bestanden/mijn')).body.items.find(x => x.id === item.id);
      }
      fixtures.push({ name, capability, scenario, item, input: { capability, contractVersion: 1, id: item.id, operationId: randomUUID(), expectedVersion: scenario === 'STALE' ? '0'.repeat(64) : item.documentVersion } });
    }
  } finally { await stopWait(seed); }
  const results = {}, trace = [], browserErrors = []; let browser;
  try {
    browser = await pw.chromium.launch(browserOpties(pw));
    for (const caller of ['API', 'UI', 'Edge', 'Rahul']) {
      const dir = path.join(root, caller); fs.cpSync(base, dir, { recursive: true });
      const srv = await startServer({ env: { ...env, RTG_DATA_DIR: dir } });
      let page;
      try {
        if (caller === 'UI' || caller === 'Edge') {
          page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
          await page.addInitScript(token => { localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, owner);
          page.on('dialog', d => d.accept());
          page.on('pageerror', e => browserErrors.push(e.message));
        }
        results[caller] = [];
        for (const f of fixtures) {
          const token = f.scenario === 'DENY' ? other : owner; let response;
          if (caller === 'API') response = await post(srv, token, '/api/bestanden/actie', f.input);
          else if (caller === 'Rahul') {
            const proposed = await post(srv, token, '/api/member/doe', { pad: '/api/bestanden/actie', body: f.input });
            assert.equal(proposed.status, 428, JSON.stringify(proposed));
            const approved = await post(srv, token, '/api/member/doe/bevestig', { goedkeuringId: proposed.body.goedkeuring.id, akkoord: true });
            assert.equal(approved.status, 200); response = { status: approved.body.status, body: approved.body.antwoord };
          } else {
            await page.goto(srv.base + '/apps/bestanden.html', { waitUntil: 'domcontentloaded' });
            await page.waitForFunction(() => window.RTGBestanden && window.RTGBestanden.stand());
            // Invalid-state actions are adversarial projections, not normal affordances.
            await page.evaluate(({ f }) => {
              const file = window.RTGBestanden.stand().items.find(x => x.id === f.item.id);
              file.weg = f.capability === 'documents.restore'; file.documentVersion = f.input.expectedVersion;
              window.RTGBestandenPaneel.open(file.id);
            }, { f });
            await page.route('**/api/bestanden/actie', async route => {
              const body = route.request().postDataJSON();
              assert.equal(body.capability, f.capability); assert.equal(body.id, f.item.id); assert.equal(body.expectedVersion, f.input.expectedVersion);
              await route.continue({ headers: { ...route.request().headers(), authorization: 'Bearer ' + token }, postData: JSON.stringify(f.input) });
            });
            const received = page.waitForResponse(r => new URL(r.url()).pathname === '/api/bestanden/actie');
            if (caller === 'UI') await page.locator(f.capability === 'documents.restore' ? '#bkHerstel' : '#bkWeg').click();
            else { await edgeActies(page); await page.locator('.rtg-adaptive-controls [data-cap="bestanden.' + (f.capability === 'documents.restore' ? 'herstel' : 'weg') + '"]').click(); }
            const r = await received; response = { status: r.status(), body: await r.json() };
            await page.unroute('**/api/bestanden/actie');
          }
          const expected = { ALLOW: 200, NOOP: 200, DENY: 404, STALE: 409, INVALID: 409 }[f.scenario];
          assert.equal(response.status, expected, caller + ':' + f.name + ':' + JSON.stringify(response));
          const snapshot = database(dir), compared = semantic(response, f, snapshot);
          const normalized = { ...compared, current: { ...compared.current, documentRevision: compared.current.documentRevision || 0 } };
          // Opaque timestamps/resource hashes vary only for a new commit time. Input fingerprint/audit identity must match exactly.
          results[caller].push(normalized);
          trace.push({ caller, case: f.name, at: new Date().toISOString(), request: { method: 'POST', path: '/api/bestanden/actie', body: f.input }, response, databaseAssertion: normalized });
        }
        if (page && process.env.RTG_DOCUMENT_EVIDENCE_DIR) await page.screenshot({ path: path.join(process.env.RTG_DOCUMENT_EVIDENCE_DIR, 'equivalence-' + caller + '.png'), fullPage: true });
        assert.deepEqual(browserErrors, []);
        for (let i = 0; i < fixtures.length; i++) assert.deepEqual(results[caller][i], results.API[i], caller + ':' + fixtures[i].name);
      } finally { if (page) await page.close(); await stopWait(srv); }
    }
  } finally {
    if (browser) await browser.close();
    if (process.env.RTG_DOCUMENT_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.RTG_DOCUMENT_EVIDENCE_DIR, 'interface-equivalence-trace.json'), JSON.stringify({ fixtures: fixtures.map(f => ({ ...f, item: { id: f.item.id, documentVersion: f.item.documentVersion, weg: f.item.weg } })), trace, results }, null, 2));
  }
});
