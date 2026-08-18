/* De collectie-transactie tegen twee ECHTE processen op dezelfde SQLite-WAL.
   Eén verwachte revisie mag precies één keer winnen; een gooiende callback mag
   geen gewijzigde RAM- of schijfstaat achterlaten. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const basisEnv = map => ({ ...process.env, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '',
  RTG_DATA_DIR: map, RTG_ENC_KEY: '' });
function laatsteJson(tekst) {
  const regels = String(tekst || '').trim().split(/\r?\n/).filter(Boolean);
  return JSON.parse(regels[regels.length - 1]);
}
function draai(code, env) {
  return new Promise((resolve, reject) => {
    const kind = spawn(process.execPath, ['-e', code], { cwd: ROOT, env });
    let uit = '', fout = '';
    kind.stdout.on('data', b => { uit += b; });
    kind.stderr.on('data', b => { fout += b; });
    kind.on('error', reject);
    kind.on('exit', status => status === 0 ? resolve(laatsteJson(uit)) : reject(new Error(fout || uit || 'kindproces faalde')));
  });
}

test('SQLite-collectieslot accepteert één revisie en rolt een mislukte mutatie terug', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-collectie-slot-'));
  const env = basisEnv(map);
  const laad = "const d=require('./server/db');d.load();";
  try {
    const init = spawnSync(process.execPath, ['-e', laad +
      "console.log(JSON.stringify(d.bewerkCollectie('slotproef',s=>{s.revisie=0;return {ok:true}})))"],
    { cwd: ROOT, env, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);

    const race = laad +
      "const r=d.bewerkCollectie('slotproef',s=>{if(s.revisie!==0)return {status:409};s.revisie+=1;return {ok:true}});console.log(JSON.stringify(r))";
    const uitslagen = await Promise.all([draai(race, env), draai(race, env)]);
    assert.equal(uitslagen.filter(x => x.ok).length, 1, 'precies één proces commit de verwachte revisie');
    assert.equal(uitslagen.filter(x => x.status === 409).length, 1, 'het tweede proces ziet de nieuwe revisie');

    const chaos = laad +
      "try{d.bewerkCollectie('slotproef',s=>{s.revisie=99;throw new Error('schijfstoring')})}catch(e){}" +
      "console.log(JSON.stringify(d.bewerkCollectie('slotproef',s=>({revisie:s.revisie}))))";
    assert.deepEqual(await draai(chaos, env), { revisie: 1 }, 'de mislukte callback laat niets achter');
  } finally {
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
});
