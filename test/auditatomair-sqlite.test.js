'use strict';
/* A-P1-05 / audit P0-1, de SQLite-productiestand (een schrijvend proces).

   De gevaarlijke combinatie is `bedrijfsmutatie COMMIT + audit FAALT = 2xx`.
   Hier faalt UITSLUITEND de auditschrijf: een trigger in store.db weigert elke
   nieuwe regel in het handelingsspoor (audit_rij, naam handelingLog), precies
   zoals de PostgreSQL-proef dat met een trigger op kv doet. De kascode is een
   kritieke geldhandeling (opzet/kritiekspoor.js): de voorregel moet duurzaam
   staan VOORDAT de handler draait. Faalt die, dan geen 2xx en geen kascode. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');

const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-auditatomair-'));
let srv;
test.before(async () => { srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: map, RTG_STORE: 'sqlite' } }); });
test.after(() => { stop(srv); try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {} });

const api = (pad, body, token) => fetch(srv.base + pad, { method: 'POST',
  headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
  body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('SQLite: faalt de auditschrijf, dan geen 2xx en geen vastgelegde kascode', async () => {
  const reg = await api('/api/auth/register', { name: 'Atomair Proef', email: 'atomair@x.nl', phone: '0611223344',
    password: 'geheim123', geboortedatum: '1990-05-05', geslacht: 'v', tier: 'rtg', pasApp: 'rtg' });
  assert.ok(reg.body.token, JSON.stringify(reg.body));
  const ok = await api('/api/pay/kascode', { maxCenten: 1000, idem: 'eerst' }, reg.body.token);
  assert.equal(ok.status, 200, 'controle zonder storing: ' + JSON.stringify(ok.body));

  const conn = new DatabaseSync(path.join(map, 'store.db'));
  try {
    const kas = () => { const r = conn.prepare("SELECT val, ver FROM kv WHERE key='payKasToegang'").get(); return r ? r.ver + ':' + r.val : null; };
    const rijen = () => conn.prepare("SELECT COUNT(*) n FROM audit_rij WHERE naam='handelingLog'").get().n;
    const kasVoor = kas(), rijenVoor = rijen();
    assert.ok(kasVoor, 'de eerste kascode staat in store.db');
    conn.exec("CREATE TRIGGER weiger_audit BEFORE INSERT ON audit_rij WHEN NEW.naam = 'handelingLog' " +
      "BEGIN SELECT RAISE(ABORT, 'audit-schrijfactie faalt (geinjecteerd)'); END");
    const r = await api('/api/pay/kascode', { maxCenten: 2000, idem: 'tweede' }, reg.body.token);
    assert.ok(r.status < 200 || r.status >= 300, 'geen 2xx als het spoor niet vaststaat: ' + r.status + ' ' + JSON.stringify(r.body));
    assert.equal(kas(), kasVoor, 'de kascode van het mislukte verzoek staat NIET in store.db');
    assert.equal(rijen(), rijenVoor, 'en er is ook geen halve auditregel');
    conn.exec('DROP TRIGGER weiger_audit');
  } finally { conn.close(); }
});
