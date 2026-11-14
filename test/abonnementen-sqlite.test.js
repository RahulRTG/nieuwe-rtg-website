/* Echte bestaande SQLite-collecties en versleutelde accounts in twee processen.
   De provider is een lokale fixture: dit is geen echte kaart- of webhookproef. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawnSync } = require('node:child_process');
const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-abonnement-keten-'));
Object.assign(process.env, { NODE_ENV: 'test', RTG_DATA_DIR: map, DATABASE_URL: '', PG_URL: '',
  RTG_STORE: 'sqlite', RTG_SECRET_KEY: '17'.repeat(32), RTG_VAULT_KEY: '29'.repeat(32), RTG_VAULT_RING: '' });
const opslag = require('../server/db'), accounts = require('../server/accounts');
opslag.load(); accounts.init();
const user = accounts.createUserSync({ email: 'keten@example.test', realName: 'Lokale ketenproef',
  password: 'alleen-lokale-proef', tier: 'guest' });
assert.equal(user.id, 1);
accounts.saveMemberState(1, { invoices: [] });
const { keten } = require('./abonnementen-keten-fixture.cjs');
let antwoordFout = false;
const bewerkCollectie = (vorm, fn) => {
  const r = opslag.bewerkCollectie(vorm, fn);
  if (antwoordFout) { antwoordFout = false; throw Error('Collectieantwoord na echte COMMIT verloren'); }
  return r;
};
function leesAnderProces() {
  const code = "const o=require('./server/db');o.load();const a=require('./server/accounts');a.init();" +
    "console.log(JSON.stringify({contracten:o.db.data.contracten,bw:o.db.data.betaalWaarheid," +
    "onboarding:o.db.data.onboarding,md:a.getMemberState(1),tier:a.getUserById(1).tier}));";
  const p = spawnSync(process.execPath, ['-e', code], { cwd: path.join(__dirname, '..'), env: process.env, encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  return JSON.parse(p.stdout.trim().split('\n').at(-1));
}
test.after(() => {
  require('../server/accounts/state').db.close();
  // Alleen de exact voor deze test gemaakte map, nooit een gebruikersdatabase.
  fs.rmSync(map, { recursive: true, force: true });
});

test('duurzaam aanbod en betaalvoorbereiding overleven verloren commitantwoord; retry activeert eenmaal', async () => {
  const f = keten({ db: opslag.db, accounts, bewerkCollectie, save: opslag.save });
  const id = await f.getekend();
  let vers = leesAnderProces();
  assert.equal(vers.contracten.find(c => c.id === id).status, 'GEACCEPTEERD');
  assert.ok(vers.onboarding.profielen['user-1'].ondertekend['abonnement:' + id]);
  assert.equal(vers.tier, 'guest');
  antwoordFout = true;
  await assert.rejects(f.service.betaal(1, { contractId: id }), /echte COMMIT/);
  assert.equal(f.stand.providerCalls, 0);
  vers = leesAnderProces();
  assert.equal(Object.values(vers.bw).length, 1);
  assert.equal(Object.values(vers.bw)[0].start.terugkerend.modus, 'vastleggen');
  assert.equal(vers.md.invoices.length, 0);
  await f.service.betaal(1, { contractId: id });
  f.bevestig();
  await f.service.herstel(1, { contractId: id });
  vers = leesAnderProces();
  assert.equal(vers.md.invoices.length, 1); assert.equal(vers.md.invoices[0].status, 'paid');
  assert.equal(vers.contracten.find(c => c.id === id).status, 'ACTIEF');
  assert.equal(vers.tier, 'rtg'); assert.equal(Object.values(vers.bw).length, 1);
  await f.service.herstel(1, { contractId: id });
  assert.equal(f.stand.providerCalls, 1);
});
