'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), { randomBytes } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop, laadPlaywright, browserOpties, geenBrowser } = require('./helper');
const pw = laadPlaywright();
const stopWait = s => new Promise(resolve => { s.child.once('exit', resolve); stop(s); });
test('trash and restore converge through offline retry new tab logout login and process restart with durable audit', { skip: geenBrowser(pw) }, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-doc-persistence-'));
  const env = { RTG_STORE: 'sqlite', RTG_DATA_DIR: dir, RTG_ENC_KEY: '', RTG_SECRET_KEY: randomBytes(32).toString('hex'), DATABASE_URL: '', PG_URL: '', SMTP_URL: '' };
  let srv = await startServer({ env }), browser, token; const requests = [], trace = [];
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const post = async (route, body) => {
    const r = await fetch(srv.base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body || {}) });
    assert.equal(r.status, 200, route); return r.json();
  };
  const login = { email: 'persistence@example.test', password: 'synthetic-password-123' };
  try {
    token = (await post('/api/auth/register', { ...login, name: 'Synthetic Persistence', phone: '0612345678', geboortedatum: '1990-01-01', tier: 'rtg' })).token;
    const file = await post('/api/bestanden/upload', { naam: 'persist.txt', dataUrl: 'data:text/plain;base64,cGVyc2lzdA==' });
    browser = await pw.chromium.launch(browserOpties(pw));
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await context.addInitScript(token => { localStorage.setItem('rtg_member_token', token); localStorage.setItem('rtg_cookieinfo_v1', '1'); }, token);
    context.on('request', r => { if (new URL(r.url()).pathname === '/api/bestanden/actie') requests.push(r.postDataJSON()); });
    const load = async p => { await p.goto(srv.base + '/apps/bestanden.html', { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.RTGBestanden && window.RTGBestanden.stand()); };
    await load(page);
    await context.setOffline(true);
    const uncertain = await page.evaluate(id => window.RTGBestanden.api('weg', { id }), file.id);
    assert.notEqual(uncertain.status, 200);
    await context.setOffline(false);
    const trash = await page.evaluate(id => window.RTGBestanden.api('weg', { id }), file.id);
    assert.equal(trash.status, 200); assert.equal(trash.body.resource.state, 'trashed');
    assert.equal(requests[0].operationId, requests[1].operationId, 'reconnect must retain the logical operation');
    await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction(() => window.RTGBestanden && window.RTGBestanden.stand());
    assert.equal(await page.evaluate(id => window.RTGBestanden.stand().items.find(x => x.id === id).weg, file.id), true);
    const second = await context.newPage(); await load(second);
    assert.equal(await second.evaluate(id => window.RTGBestanden.stand().items.find(x => x.id === id).weg, file.id), true);
    await post('/api/logout'); token = (await post('/api/auth/login', login)).token;
    const afterLogin = await post('/api/bestanden/mijn'); assert.equal(afterLogin.items.find(x => x.id === file.id).weg, true);
    await stopWait(srv); srv = await startServer({ env });
    assert.equal((await post('/api/bestanden/mijn')).items.find(x => x.id === file.id).weg, true);
    // A new session and process still use the same authoritative file and durable operation receipt.
    await page.addInitScript(token => localStorage.setItem('rtg_member_token', token), token); await load(page);
    const restored = await page.evaluate(id => window.RTGBestanden.api('herstel', { id }), file.id);
    assert.equal(restored.status, 200); assert.equal(restored.body.resource.state, 'active');
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(id => window.RTGBestanden.stand().items.find(x => x.id === id).weg === false, file.id);
    const sql = new DatabaseSync(path.join(dir, 'store.db'), { readOnly: true });
    const all = JSON.parse(sql.prepare("SELECT val FROM kv WHERE key='bestanden'").get().val); sql.close();
    const board = Object.values(all).find(b => b.items.some(x => x.id === file.id));
    assert.equal(board.items.find(x => x.id === file.id).documentRevision, 2);
    assert.equal(Object.keys(board.documentOperations).length, 2);
    for (const entry of Object.values(board.documentOperations)) assert.ok(entry.receipt.auditRef && entry.receipt.contractDigest);
    trace.push({ requests, trash: trash.body, restore: restored.body, database: { lifecycle: board.items.find(x => x.id === file.id).weg, revision: 2, operationReceipts: Object.values(board.documentOperations) }, paths: ['offline retry','refresh','new tab','logout/login','process restart','online convergence'] });
    if (process.env.RTG_DOCUMENT_EVIDENCE_DIR) await page.screenshot({ path: path.join(process.env.RTG_DOCUMENT_EVIDENCE_DIR, 'document-persistence.png'), fullPage: true });
  } finally {
    if (browser) await browser.close(); if (srv.child.exitCode === null) await stopWait(srv);
    if (process.env.RTG_DOCUMENT_EVIDENCE_DIR) fs.writeFileSync(path.join(process.env.RTG_DOCUMENT_EVIDENCE_DIR, 'persistence-trace.json'), JSON.stringify(trace, null, 2));
  }
});
