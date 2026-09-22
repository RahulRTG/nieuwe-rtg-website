'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stopNet } = require('./helper');

test('geweigerde documentopslag wijzigt geen titel, inhoud, historie of audit, ook na herstart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-office-atomic-'));
  const env = { RTG_DATA_DIR: dir, RTG_STORE: 'sqlite', RTG_ENC_KEY: '', SMTP_URL: '' };
  let srv;
  const api = async (pad, body, token) => {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: {
      'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {})
    }, body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json() };
  };
  const opgeslagen = id => {
    const db = new DatabaseSync(path.join(dir, 'store.db'), { readOnly: true });
    try { return JSON.parse(db.prepare('SELECT val FROM kv WHERE key=?').get('officeDocs').val)[id]; }
    finally { db.close(); }
  };
  try {
    srv = await startServer({ env });
    const reg = await api('/api/auth/register', { name: 'Opslagproef', email: 'atomic@example.invalid',
      phone: '0612233445', password: 'OnlySynthetic!2026', geboortedatum: '1990-01-01', tier: 'rtg' });
    assert.equal(reg.status, 200);
    const token = reg.body.token;
    const maak = await api('/api/kantoorpakket/maak', { soort: 'blad', titel: 'Oorspronkelijk' }, token);
    const id = maak.body.id;
    const voor = opgeslagen(id), cellen = {};
    for (let i = 1; i <= 1400; i++)
      cellen[String.fromCharCode(65 + Math.floor(i / 999)) + (i % 999 + 1)] = 'x'.repeat(390);
    const fout = await api('/api/kantoorpakket/bewaar', { id, titel: 'Geweigerd', inhoud: { cellen } }, token);
    assert.equal(fout.status, 413);
    assert.equal((await api('/api/kantoorpakket/open', { id }, token)).body.titel, voor.titel);
    assert.deepEqual(opgeslagen(id), voor, 'afgewezen invoer wijzigde de database');
    // Een andere geslaagde opslag mag geen achtergebleven RAM-mutatie meenemen.
    assert.equal((await api('/api/kantoorpakket/ster', { id, aan: true }, token)).status, 200);
    assert.deepEqual(opgeslagen(id), { ...voor, ster: true });
    await stopNet(srv.child); srv = null;
    srv = await startServer({ env });
    assert.equal((await api('/api/kantoorpakket/open', { id }, token)).body.titel, voor.titel);
    assert.deepEqual(opgeslagen(id), { ...voor, ster: true });
  } finally {
    if (srv) await stopNet(srv.child);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
