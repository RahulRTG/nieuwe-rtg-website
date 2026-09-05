'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('SQLite bewaart sleutel plus volledige projectie atomair en fail-closed bij drift', () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-economisch-sqlite-'));
  const code = String.raw`
    (async()=>{
      const path=require('node:path'),{DatabaseSync}=require('node:sqlite');
      const d=require('./server/db'); d.load();
      d.db.data.paySaldi={extern:-100,lid:100};d.db.data.payBoekingen=[];d.save();
      const i={sleutel:'payout-terug:'+('a'.repeat(64)),afdruk:'b'.repeat(64),
        identiteit:{domein:'pay',van:'extern',naar:'lid',centen:10,soort:'terug',ref:'R / vreemd'},
        collecties:['paySaldi','payBoekingen']};
      let werk=0;
      const doe=()=>d.economischeBoekingEenmaal(i,()=>{werk++;const boeking={id:'E1',van:'extern',naar:'lid',centen:10,soort:'terug',ref:'R / vreemd'};d.db.data.paySaldi.extern-=10;d.db.data.paySaldi.lid+=10;d.db.data.payBoekingen.unshift(boeking);d.save();return {ok:true,boeking}});
      const een=await doe(),twee=await doe();
      const sql=new DatabaseSync(path.join(process.env.RTG_DATA_DIR,'store.db'));
      const rij=sql.prepare('SELECT sleutel,afdruk,antwoord FROM economische_boekingen WHERE sleutel=?').get(i.sleutel);
      sql.prepare('DELETE FROM economische_boekingen WHERE sleutel=?').run(i.sleutel);
      const mist=await doe();
      sql.prepare('INSERT INTO economische_boekingen(sleutel,afdruk,antwoord) VALUES(?,?,?)').run(rij.sleutel,rij.afdruk,rij.antwoord);
      d.db.data.payBoekingen[0].ref='zelfde-id-andere-ref';d.save();
      const drift=await doe();sql.close();
      console.log(JSON.stringify({een,twee,mist,drift,werk,saldi:d.db.data.paySaldi}));
    })().catch(e=>{console.error(e);process.exit(1)});`;
  try {
    const r = spawnSync(process.execPath, ['-e', code], { cwd: path.join(__dirname, '..'),
      env: { ...process.env, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '',
        RTG_DATA_DIR: map, RTG_ENC_KEY: '', TX_LEDGER_SQLITE: '0' },
      encoding: 'utf8', timeout: 20000 });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    const regels = r.stdout.trim().split(/\r?\n/).filter(Boolean);
    const uit = JSON.parse(regels[regels.length - 1]);
    assert.equal(uit.een.ok, true);
    assert.equal(uit.twee.herhaald, true);
    assert.equal(uit.mist.code, 'ECONOMISCHE_SLEUTEL_ONTBREEKT');
    assert.equal(uit.drift.code, 'ECONOMISCHE_PROJECTIE_ONTBREEKT');
    assert.equal(uit.werk, 1);
    assert.deepEqual(uit.saldi, { extern: -110, lid: 110 });
  } finally { fs.rmSync(map, { recursive: true, force: true }); }
});
