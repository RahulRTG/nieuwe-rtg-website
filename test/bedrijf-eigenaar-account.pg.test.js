'use strict';
/* Eigen database vereist, zoals iedere .pg.test.js. Twee afzonderlijke caches
   lezen eerst tegelijk GEEN manager; de bestaande gedeelde unieke index beslist. */
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
const { vereist } = require('./infra');
const url = process.env.DATABASE_URL || process.env.PG_URL;
const skip = vereist('pg', !!url, 'DATABASE_URL ontbreekt; eigen PostgreSQL-testdatabase vereist');
test('eigenaarprovisioning tegen echte PostgreSQL en twee afzonderlijke processen', { skip, timeout: 60000 }, async t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-eigenaar-pg-'));
  process.env.RTG_DATA_DIR = tmp; process.env.NODE_ENV = 'production';
  process.env.RTG_SECRET_KEY = '2'.repeat(64); process.env.RTG_VAULT_KEY = '3'.repeat(64);
  const accounts = require('../server/accounts'), S = require('../server/accounts/state');
  const mirror = require('../server/accounts/mirror');
  accounts.init(); await accounts.startPostgres();
  const lid = await accounts.achtergrondWerk(() => accounts.createUserSync({ email: 'bedrijfpg@proef.test',
    password: 'test-geheim-42', tier: 'rtg', realName: 'Proefeigenaar' }));
  const g = code => ({ supplierCode: code, memberId: Number(lid.id), name: 'Eigenaar' });
  const tellen = async code => (await mirror.accountPool().query(
    'SELECT COUNT(*)::int AS n FROM supplier_staff WHERE supplier_code=$1 AND member_id=$2', [code, lid.id])).rows[0].n;
  try {
    await t.test('bevestigde commit en retry geven dezelfde manager; tier blijft persoonlijk', async () => {
      const a = await accounts.maakEigenaarEenmaal(g('PGEEN'));
      const b = await accounts.maakEigenaarEenmaal(g('PGEEN'));
      assert.equal(Number(a.id), Number(b.id)); assert.equal(await tellen('PGEEN'), 1);
      assert.equal(accounts.getUserById(lid.id).tier, 'rtg');
    });
    await t.test('twee processen met beide een lege voorlezing maken exact een gedeelde actieve plek', async () => {
      const code = `const a=require('./server/accounts'),m=require('./server/accounts/mirror'); a.init();
        const echt=m.leesStaffVanLidVers;let vrij,eerste=true;
        m.leesStaffVanLidVers=async(...args)=>{const r=await echt(...args);if(eerste){eerste=false;
          process.send({gelezen:r.length});await new Promise(z=>{vrij=z});}return r};
        process.on('message',async msg=>{if(msg==='vrij'){vrij();return;}try{
          const r=await a.maakEigenaarEenmaal(JSON.parse(process.env.PROEF_EIGENAAR));
          process.send({id:r.id});await a.flushBijAfsluiten();process.exit(0);
        }catch(e){process.send({error:e.message,code:e.code});await a.flushBijAfsluiten();process.exit(1);}});
        a.startPostgres().then(()=>process.send({ready:true})).catch(e=>{console.error(e);process.exit(1)});`;
      const jobs = [1, 2].map(n => {
        const child = spawn(process.execPath, ['-e', code], { cwd: path.resolve(__dirname, '..'),
          env: { ...process.env, RTG_DATA_DIR: path.join(tmp, 'kind-' + n), PROEF_EIGENAAR: JSON.stringify(g('PGTWEE')) },
          stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
        let ready, gelezen, stderr = '', resultaat;
        const gestart = new Promise(r => { ready = r; }), gelezenP = new Promise(r => { gelezen = r; });
        const klaar = new Promise((resolve, reject) => {
          child.stderr.on('data', s => { stderr += s; }); child.on('error', reject);
          child.on('message', m => { if (m.ready) ready(); else if (m.gelezen != null) gelezen(m.gelezen); else resultaat = m; });
          child.on('exit', c => c === 0 && resultaat?.id ? resolve(Number(resultaat.id)) : reject(Error(JSON.stringify(resultaat) + stderr)));
        });
        return { child, gestart, gelezenP, klaar };
      });
      try {
        await Promise.all(jobs.map(j => j.gestart)); jobs.forEach(j => j.child.send('begin'));
        assert.deepEqual(await Promise.all(jobs.map(j => j.gelezenP)), [0, 0]);
        jobs.forEach(j => j.child.send('vrij'));
        const ids = await Promise.all(jobs.map(j => j.klaar)); assert.equal(ids[0], ids[1]);
        assert.equal(await tellen('PGTWEE'), 1);
        assert.equal(Number((await accounts.maakEigenaarEenmaal(g('PGTWEE'))).id), ids[0]);
      } finally { jobs.forEach(j => { if (j.child.exitCode == null) j.child.kill(); }); }
    });
    await t.test('fout vóór PostgreSQL-commit laat geen lokale of gedeelde manager achter', async t2 => {
      const echt = mirror.commitAccountWijzigingen; let faal = true;
      t2.mock.method(mirror, 'commitAccountWijzigingen', async (...args) => {
        const r = await echt(...args); if (faal) { faal = false; throw Error('voor commit'); } return r;
      });
      await assert.rejects(accounts.maakEigenaarEenmaal(g('PGROL')), /voor commit/);
      assert.equal(await tellen('PGROL'), 0); assert.equal(accounts.listStaff('PGROL').length, 0);
      assert.ok((await accounts.maakEigenaarEenmaal(g('PGROL'))).id); assert.equal(await tellen('PGROL'), 1);
    });
    await t.test('ingetrokken gedeelde plek wordt uit verse bron geweigerd', async () => {
      const s = await accounts.maakEigenaarEenmaal(g('PGUIT'));
      await accounts.achtergrondWerk(() => accounts.deactivateStaff(s.id));
      await assert.rejects(accounts.maakEigenaarEenmaal(g('PGUIT')), /ingetrokken/);
      assert.equal(await tellen('PGUIT'), 1);
    });
  } finally {
    await accounts.flushBijAfsluiten(); S.db.close(); fs.rmSync(tmp, { recursive: true, force: true });
  }
});
