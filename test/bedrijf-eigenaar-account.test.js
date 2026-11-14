'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eigenaar-eenmaal-'));
process.env.RTG_DATA_DIR = TMP; process.env.NODE_ENV = 'test';
delete process.env.DATABASE_URL; delete process.env.PG_URL;
const accounts = require('../server/accounts'), S = require('../server/accounts/state');
accounts.init();
const lid = accounts.createUserSync({ email: 'eigenaar@proef.test', password: 'proef-geheim-42', tier: 'rtg', realName: 'Eigenaar' });
const g = code => ({ supplierCode: code, memberId: lid.id, name: 'Eigenaar', memberTier: 'rtg' });
test.after(() => { S.db.close(); fs.rmSync(TMP, { recursive: true, force: true }); });

test('de echte SQLite-owner herhaalt dezelfde actieve accountplek zonder PIN of tierwijziging', async () => {
  const r = await Promise.all(Array.from({ length: 8 }, () => accounts.maakEigenaarEenmaal(g('EENMAAL'))));
  assert.ok(r.every(x => x.id === r[0].id)); assert.equal(accounts.listStaff('EENMAAL').length, 1);
  assert.equal(r[0].role, 'manager'); assert.equal(r[0].pin_hash, accounts.ACCOUNT_ONLY_HASH);
  assert.equal(accounts.getUserById(lid.id).tier, 'rtg');
  assert.equal((await accounts.maakEigenaarEenmaal({ ...g('eenmaal'), verwachtStaffId: r[0].id })).id, r[0].id);
});
test('bestaande medewerker wordt niet gepromoveerd en ingetrokken beheerder wordt niet hermaakt', async () => {
  accounts.createAccountStaff({ ...g('MEDEWERKER'), role: 'staff' });
  await assert.rejects(accounts.maakEigenaarEenmaal(g('MEDEWERKER')), /geen eenduidige/);
  const st = await accounts.maakEigenaarEenmaal(g('INGETROKKEN')); accounts.deactivateStaff(st.id);
  await assert.rejects(accounts.maakEigenaarEenmaal(g('INGETROKKEN')), /ingetrokken/);
  assert.equal(S.zin("SELECT COUNT(*) AS n FROM supplier_staff WHERE supplier_code='INGETROKKEN'").get().n, 1);
  await assert.rejects(accounts.maakEigenaarEenmaal({ ...g('ONTBREEKT'), verwachtStaffId: 999 }), /ontbreekt/);
  assert.equal(accounts.listStaff('ONTBREEKT').length, 0);
});
test('schrijffout rolt SQLite-insert terug; antwoordverlies na commit wordt eenmaal hervat', async t => {
  const echt = S.db.exec.bind(S.db); let modus = 'voor';
  t.mock.method(S.db, 'exec', sql => {
    if (sql === 'COMMIT' && modus) {
      const nu = modus; modus = null;
      if (nu === 'na') echt(sql);
      throw Error('commitantwoord onderbroken');
    }
    return echt(sql);
  });
  await assert.rejects(accounts.maakEigenaarEenmaal(g('COMMITVOOR')), /onderbroken/);
  assert.equal(accounts.listStaff('COMMITVOOR').length, 0);
  assert.ok((await accounts.maakEigenaarEenmaal(g('COMMITVOOR'))).id);
  modus = 'na'; await assert.rejects(accounts.maakEigenaarEenmaal(g('COMMITNA')), /onderbroken/);
  const st = accounts.listStaff('COMMITNA')[0]; assert.ok(st);
  assert.equal((await accounts.maakEigenaarEenmaal(g('COMMITNA'))).id, st.id);
});
test('twee echte processen delen de SQLite-sleutel en krijgen dezelfde manager', { timeout: 20000 }, async () => {
  const code = `const a=require('./server/accounts'); a.init();
    process.on('message',async()=>{try{const r=await a.maakEigenaarEenmaal(JSON.parse(process.env.PROEF_EIGENAAR));
    process.send({id:r.id});process.exit(0);}catch(e){process.send({error:e.message});process.exit(1);}});process.send({ready:true});`;
  const jobs = Array.from({ length: 2 }, () => {
    const child = spawn(process.execPath, ['-e', code], { cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PROEF_EIGENAAR: JSON.stringify(g('TWEEPROCESSEN')) }, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let stderr = '', ready;
    const gestart = new Promise(r => { ready = r; });
    const klaar = new Promise((resolve, reject) => {
      let resultaat;
      child.stderr.on('data', s => { stderr += s; });
      child.on('message', m => { if (m.ready) ready(); else resultaat = m; });
      child.on('error', reject);
      child.on('exit', c => c === 0 && resultaat?.id ? resolve(resultaat.id) : reject(Error(JSON.stringify(resultaat) + stderr)));
    });
    return { child, gestart, klaar };
  });
  try {
    await Promise.all(jobs.map(j => j.gestart)); jobs.forEach(j => j.child.send('begin'));
    const ids = await Promise.all(jobs.map(j => j.klaar)); assert.equal(ids[0], ids[1]);
    assert.equal(accounts.listStaff('TWEEPROCESSEN').length, 1);
    assert.equal(accounts.listStaff('TWEEPROCESSEN')[0].id, ids[0]);
  } finally { jobs.forEach(j => { if (j.child.exitCode == null) j.child.kill(); }); }
});
test('onjuist id en inactieve eigenaar hebben geen provisioningbijwerking', async () => {
  await assert.rejects(accounts.maakEigenaarEenmaal({ ...g('FOUT'), memberId: '1' }), /exacte/);
  await assert.rejects(accounts.maakEigenaarEenmaal({ ...g('FOUT'), memberId: 999999 }), /actieve persoonlijke/);
  accounts.zetActief(lid.id, false);
  await assert.rejects(accounts.maakEigenaarEenmaal(g('INACTIEF')), /actieve persoonlijke/);
  assert.equal(accounts.listStaff('INACTIEF').length, 0);
});
