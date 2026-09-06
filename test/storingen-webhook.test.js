'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const protocol = require('../server/storingen/protocol');
const { startServer, stop } = require('./helper');
const sleutel = crypto.randomBytes(32).toString('hex');
const encryptie = crypto.randomBytes(32).toString('hex');
const body = () => Buffer.from(JSON.stringify({ app: 'rtg', soort: 'zelfproef',
  tijd: new Date().toISOString(), fout: 'E2E ontvangst zonder klantgegevens', context: { token: 'NOOIT_OPSLAAN' } }));
async function stuur(base, raw, id, headers = {}) {
  const r = await fetch(base + protocol.PAD, { method: 'POST', body: raw,
    headers: { 'content-type': 'application/json', ...protocol.koppen(sleutel, id, raw), ...headers } });
  return { status: r.status, body: await r.json(), retry: r.headers.get('retry-after') };
}
test('echte app: authenticatie, opslagbewijs, parallelle retries, herstart en rem', async t => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-storingen-e2e-'));
  const env = { RTG_DATA_DIR: map, RTG_ENC_KEY: encryptie, ERR_WEBHOOK_SECRET: sleutel, SMTP_URL: '', ERR_WEBHOOK_URL: '' };
  let a, b;
  try {
    a = await startServer({ env });
    const raw = body(), id = crypto.randomUUID();
    await t.test('ongesigneerd, verval, manipulatie en invoer worden geweigerd', async () => {
      assert.equal((await fetch(a.base + protocol.PAD)).status, 404);
      assert.equal((await fetch(a.base + protocol.PAD, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
      assert.equal((await stuur(a.base, raw, id, protocol.koppen(sleutel, id, raw, Date.now() - 360000))).status, 401);
      assert.equal((await stuur(a.base, raw, id, protocol.koppen(crypto.randomBytes(32).toString('hex'), id, raw))).status, 401);
      assert.equal((await stuur(a.base, Buffer.from(raw.toString().replace('zonder', 'andere')), id, protocol.koppen(sleutel, id, raw))).status, 401);
      assert.equal((await stuur(a.base, Buffer.from('{'), id)).status, 400);
      assert.equal((await stuur(a.base, raw, id, { 'content-encoding': 'gzip' })).status, 415);
      assert.equal((await stuur(a.base, Buffer.alloc(protocol.MAX_BYTES + 1, 32), id)).status, 413);
      assert.equal(fs.existsSync(path.join(map, 'storingen.db')), false, 'ongeldige meldingen worden niet opgeslagen');
    });
    await t.test('ontvangstbewijs dekt werkelijk versleutelde opslag', async () => {
      const r = await stuur(a.base, raw, id);
      assert.equal(r.status, 201);
      assert.ok(protocol.bewijsGoed(sleutel, id, raw, r.body));
      const db = new DatabaseSync(path.join(map, 'storingen.db'), { readOnly: true });
      try {
        const row = db.prepare('SELECT * FROM ontvangsten WHERE id=?').get(id);
        assert.equal(row.digest, protocol.hash(raw));
        assert.match(row.inhoud, /^RTGENC1:/);
        assert.ok(!row.inhoud.includes('E2E ontvangst'));
      } finally { db.close(); }
      assert.equal(fs.statSync(path.join(map, 'storingen.db')).mode & 0o777, 0o600);
      assert.equal((await stuur(a.base, Buffer.from(raw.toString().replace('E2E', 'Andere')), id)).status, 409);
    });
    await t.test('twee echte processen leggen gelijktijdige retries slechts eenmaal vast', async () => {
      b = await startServer({ env: { ...env, ERR_WEBHOOK_URL: a.base + protocol.PAD, ERR_WEBHOOK_INTERN: '1' } });
      const nieuw = crypto.randomUUID();
      const rs = await Promise.all(Array.from({ length: 12 }, (_, i) => stuur(i % 2 ? a.base : b.base, raw, nieuw)));
      assert.equal(rs.filter(r => r.status === 201).length, 1);
      assert.equal(rs.filter(r => r.status === 200).length, 11);
      for (const r of rs) assert.ok(protocol.bewijsGoed(sleutel, nieuw, raw, r.body));
      const db = new DatabaseSync(path.join(map, 'storingen.db'), { readOnly: true });
      try { assert.equal(db.prepare('SELECT count(*) AS n FROM ontvangsten').get().n, 2); } finally { db.close(); }
    });
    await t.test('eigenaaractie loopt door de echte alarmroute, afzender en ontvangst', async () => {
      const post = (pad, data, token) => fetch(b.base + pad, { method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(data) });
      assert.equal((await post('/api/techniek/alarm/proef', {})).status, 401);
      const login = await (await post('/api/techniek/inloggen', { login: 'roellie.i@gmail.com', wachtwoord: 'Imran' })).json();
      assert.ok(login.token, 'de geisoleerde fixture levert de echte eigenaarsessie');
      const r = await (await post('/api/techniek/alarm/proef', {}, login.token)).json();
      assert.equal(r.ok, true); assert.equal(r.opgeslagen, true);
      assert.equal(r.stand.bezorgd, 1);
      const db = new DatabaseSync(path.join(map, 'storingen.db'), { readOnly: true });
      try { assert.equal(db.prepare('SELECT digest FROM ontvangsten WHERE id=?').get(r.id).digest, r.digest); } finally { db.close(); }
    });
    await stop(a); a = null;
    await stop(b); b = null;
    a = await startServer({ env });
    await t.test('deduplicatie overleeft een volledige herstart', async () => {
      const r = await stuur(a.base, raw, id);
      assert.equal(r.status, 200); assert.equal(r.body.herhaald, true);
      assert.ok(protocol.bewijsGoed(sleutel, id, raw, r.body));
    });
    await t.test('ook ongeldige verzoeken krijgen een begrensd verzoekbudget', async () => {
      let laatste;
      for (let i = 0; i < 62; i++) laatste = await stuur(a.base, raw, id, { 'x-rtg-signature': 'v1=ongeldig' });
      assert.equal(laatste.status, 429); assert.equal(laatste.retry, '60');
    });
  } finally { if (a) await stop(a); if (b) await stop(b); fs.rmSync(map, { recursive: true, force: true }); }
});

test('invoer bewaart geen vrije context, stack of geheimen in de melding', () => {
  const { inhoudVan } = require('../server/opzet/storingenwebhook');
  const raw = Buffer.from(JSON.stringify({ app: 'rtg', soort: 'fout', tijd: new Date().toISOString(),
    fout: 'Bearer private-token token=' + sleutel, stack: 'persoonlijke stack', context: { token: sleutel, p: '/api/x?token=prive' } }));
  const r = inhoudVan(raw);
  assert.equal(r.stack, undefined); assert.equal(r.context, undefined);
  assert.equal(r.bron, '/api/x'); assert.ok(!JSON.stringify(r).includes(sleutel));
  assert.ok(!r.fout.includes('private-token'));
});
