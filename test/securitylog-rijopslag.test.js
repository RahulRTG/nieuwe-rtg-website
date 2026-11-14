'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { spawn } = require('node:child_process'), path = require('node:path');
const proef = require('./lib/audit-rijen-fixture');
const keten = require('../server/lib/keten');
const maak = p => require('../server/kern/identiteit/inlogherkomst').maakInlogspoor({
  db: p.db, save: p.save, schoon: require('../server/kern/util').schoon });
const bron = wie => `const p=require('./server/db');p.db.data=require('./server/db/sqlite').loadSqlite();
  const s=require('./server/kern/identiteit/inlogherkomst').maakInlogspoor({db:p.db,save:p.save,schoon:v=>v});
  s.logInlog('test',true,${JSON.stringify(wie)},{ip:'127.0.0.1'});`;

test('security-rijen migreren pas bij schrijven en behouden legacyvolgorde en ketenkop', t => {
  const oud = keten.schakel({ at: '2026-01-01', wie: 'oud' }, null, 7);
  const lijst = [oud, { at: '2025-12-01', wie: 'legacy' }];
  const p = proef(t, { securityLog: lijst }), s = maak(p);
  assert.equal(s.securityLogKeten().zonderKeten, 1);
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM audit_meta WHERE naam='securityLog'").get().n, 0);
  s.logInlog('account', true, 'nieuw', {});
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM audit_meta WHERE naam='securityLog'").get().n, 1);
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM kv WHERE key='securityLog'").get().n, 0);
  const na = p.lees('securityLog'); assert.deepEqual(na.slice(1), lijst);
  assert.equal(na[0].nr, 8); assert.equal(na[0].vorige, oud.hash); assert.equal(s.securityLogKeten().ok, true);
});

test('security-append schrijft alleen nieuwe rij, niet bestaande geschiedenis', t => {
  const p = proef(t, { securityLog: [] }), s = maak(p);
  for (let i=0;i<12;i++) s.logInlog('history-marker', true, 'lid'+i, {});
  const stringify = JSON.stringify; let historiekopie = 0;
  t.mock.method(JSON, 'stringify', function(v, ...rest) {
    if (Array.isArray(v) && v.some(r => r?.kanaal === 'history-marker')) historiekopie++;
    return stringify.call(this, v, ...rest);
  });
  s.logInlog('nieuw', false, null, {});
  assert.equal(historiekopie, 0, 'geen volledige securityLog-JSON per inlog');
  assert.equal(p.lees('securityLog').length, 13);
});

test('security-commitfout publiceert geen RAM-regel en retry schrijft eenmaal', t => {
  const p = proef(t, { securityLog: [] }), s = maak(p); s.logInlog('een', true, 'a', {});
  const voor = p.lees('securityLog'), exec = DatabaseSync.prototype.exec;
  let schrijft = false;
  const m = t.mock.method(DatabaseSync.prototype, 'exec', function(sql) {
    if (sql === 'BEGIN IMMEDIATE') schrijft = true;
    if (sql === 'COMMIT' && schrijft) throw Error('security-write-fout');
    return exec.call(this, sql);
  });
  assert.throws(() => s.logInlog('twee', false, 'b', {}), /security-write-fout/);
  assert.deepEqual(p.lees('securityLog'), voor);
  assert.deepEqual(p.db.data.securityLog, voor, 'geen ongecommitteerde regel in de levende projectie');
  m.mock.restore(); s.logInlog('twee', false, 'b', {});
  assert.equal(p.lees('securityLog').length, 2); assert.equal(s.securityLogKeten().ok, true);
});

test('security-rijen behouden 5000 nieuwste regels en een doorlopend hashvolgnummer', t => {
  let vorige = null; const lijst = [];
  for (let i=1;i<=5000;i++) { const r=keten.schakel({at:'2026-01-01',wie:'lid'+i},vorige,i); lijst.push(r); vorige=r.hash; }
  const p=proef(t,{securityLog:lijst.reverse()}),s=maak(p); s.logInlog('nieuw',true,'nieuw',{});
  const na=p.lees('securityLog'); assert.equal(na.length,5000); assert.equal(na[0].nr,5001);
  assert.equal(na.at(-1).nr,2); assert.equal(s.securityLogKeten().ok,true);
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM audit_rij WHERE naam='securityLog'").get().n,5000);
});

test('twee security-schrijvers bouwen één keten; een procescrash verliest de bevestigde rij niet', async t => {
  const p=proef(t,{securityLog:[]}),s=maak(p); s.logInlog('start',true,'start',{});
  const draai=wie=>new Promise((resolve,reject)=>{
    const c=spawn(process.execPath,['-e',bron(wie).replace("s.logInlog(","for(let i=0;i<12;i++)s.logInlog(")],
      {cwd:path.join(__dirname,'..'),env:process.env,stdio:['ignore','ignore','pipe']});
    let err='';c.stderr.on('data',b=>err+=b);c.on('error',reject);c.on('exit',code=>code===0?resolve():reject(Error(err)));
  });
  await Promise.all([draai('a'),draai('b')]);
  const kill=p.kind(bron('crash')+"process.kill(process.pid,'SIGKILL');"); assert.equal(kill.signal,'SIGKILL',kill.stderr);
  const terug=p.kind("const p=require('./server/db');p.db.data=require('./server/db/sqlite').loadSqlite();console.log(JSON.stringify(p.db.data.securityLog));");
  assert.equal(terug.status,0,terug.stderr); const na=JSON.parse(terug.stdout);
  assert.equal(na.length,26); assert.equal(na[0].wie,'crash'); assert.equal(keten.verifieer(na).ok,true);
  assert.equal(na.filter(r=>r.wie==='a').length,12); assert.equal(na.filter(r=>r.wie==='b').length,12);
});

test('security-rijen blijven versleuteld en offline downgrade materialiseert dezelfde lijst', t => {
  const p=proef(t,{securityLog:[]},require('node:crypto').randomBytes(32).toString('hex')),s=maak(p);
  s.logInlog('account',true,'vertrouwelijk',{}); const voor=p.lees('securityLog');
  const rows=p.conn.prepare("SELECT waarde FROM audit_rij WHERE naam='securityLog'").all(); assert.equal(rows.length,1);
  assert.match(rows[0].waarde,/^RTGENC1:/); assert.ok(!rows[0].waarde.includes('vertrouwelijk'));
  assert.throws(()=>p.conn.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?)').run('securityLog','[]',99),/stop oude schrijvers/);
  const terug=p.kind(`const {DatabaseSync}=require('node:sqlite');const k=new DatabaseSync(process.env.RTG_DATA_DIR+'/store.db');
    const kluis=require('./server/kluis');require('./server/db/audit-compat').materialiseer(k,kluis);
    console.log(kluis.ontsleutel(k.prepare("SELECT val FROM kv WHERE key='securityLog'").get().val));k.close();`);
  assert.equal(terug.status,0,terug.stderr); assert.deepEqual(JSON.parse(terug.stdout),voor);
  const nieuw=p.kind(bron('na-downgrade')+"console.log(JSON.stringify(p.db.data.securityLog));");
  assert.equal(nieuw.status,0,nieuw.stderr);const herimport=JSON.parse(nieuw.stdout);
  assert.deepEqual(herimport.slice(1),voor);assert.equal(herimport[0].vorige,voor[0].hash);
});

test('security-bundel bevestigt beide regels samen en bewaart vaste tijd/volgorde', async t => {
  const p=proef(t,{securityLog:[]}),s=maak(p); s.logInlog('start',true,'start',{});
  await p.bijeen(()=>{
    s.logInlog('a',true,'a',{}); s.logInlog('b',false,'b',{});
    assert.equal(s.securityLogKeten().ok,true);
    assert.notEqual(s.securityLogKeten().top,p.lees('securityLog')[0].hash,'preview bevat de staged kop');
    assert.equal(p.lees('securityLog').length,1);
  },{duurzaam:true});
  const na=p.lees('securityLog'); assert.deepEqual(na.map(r=>r.wie),['b','a','start']);
  assert.equal(keten.verifieer(na).ok,true);
});

test('beschadigde KV-migratiebron blijft ongewijzigd, ook bij gezonde RAM-projectie', t => {
  for (const waarde of [null, {}, 'geen lijst']) {
    const p=proef(t,{securityLog:[]}),s=maak(p);
    p.conn.prepare("UPDATE kv SET val=? WHERE key='securityLog'").run(JSON.stringify(waarde));
    assert.throws(()=>s.logInlog('test',true,'a',{}),/niet de verklaarde vorm/);
    assert.deepEqual(p.lees('securityLog'),waarde);
    assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM audit_meta WHERE naam='securityLog'").get().n,0);
  }
});

test('retentierapport verandert geen inhoud; echte retentie bewaart ketenkop en overleeft herstart', t => {
  const oud=keten.schakel({at:new Date(Date.now()-730*86400000).toISOString(),wie:'oud'},null,1);
  const jong=keten.schakel({at:new Date().toISOString(),wie:'jong'},oud.hash,2);
  const p=proef(t,{securityLog:[jong,oud]}),s=maak(p);s.logInlog('test',true,'nieuw',{});
  const voor=p.lees('securityLog'),anker=require('../server/lib/keten-anker');
  const punt=anker.verankerPunt(voor),bewaring=require('../server/bewaartermijnen');
  const v=()=>p.conn.prepare("SELECT versie FROM audit_meta WHERE naam='securityLog'").get().versie;
  const versie=v();bewaring.rapport(p.db);bewaring.veeg(p.db);p.save();
  assert.deepEqual(p.lees('securityLog'),voor);assert.equal(v(),versie);
  bewaring.veeg(p.db,{echt:true});p.save();
  const na=p.lees('securityLog');assert.equal(na.length,2);assert.equal(keten.verifieer(na).ok,true);
  assert.equal(anker.verifieerTegenAnker(na,punt,{max:5000}).ok,true);
  const kind=p.kind("console.log(JSON.stringify(require('./server/db/sqlite').loadSqlite().securityLog));");
  assert.equal(kind.status,0,kind.stderr);assert.deepEqual(JSON.parse(kind.stdout),na);
});

test('security-ketenlezer ververst geen eerder gelezen lijst; standby-poort kan promoveren', t => {
  const p=proef(t,{securityLog:[]}),s=maak(p);p.db.writable=false;
  s.logInlog('passief',true,'a',{});assert.equal(p.lees('securityLog').length,0);
  p.db.writable=true;s.logInlog('actief',true,'a',{});
  const gelezen=p.db.data.securityLog.slice(),kop=gelezen[0].hash;
  const kind=p.kind(bron('extern'));assert.equal(kind.status,0,kind.stderr);
  assert.equal(s.securityLogKeten().top,kop,'lijst en keten gebruiken hetzelfde gedeelde beeld');
  assert.equal(p.lees('securityLog').length,2);
  s.logInlog('actief',true,'b',{});assert.equal(s.securityLogKeten().ok,true);
  assert.equal(p.lees('securityLog').length,3);
});

test('eerste security-migratie wist geen nog niet opgeslagen lokale vervanging', t => {
  const oud=keten.schakel({at:'2026-01-01',wie:'oud'},null,1);
  const p=proef(t,{securityLog:[oud]}),s=maak(p);p.db.data.securityLog=[];
  assert.throws(()=>s.logInlog('nieuw',true,'a',{}),/openstaand lokaal werk/);
  assert.deepEqual(p.db.data.securityLog,[]);assert.deepEqual(p.lees('securityLog'),[oud]);
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM audit_meta WHERE naam='securityLog'").get().n,0);
  p.save.sleutels(['securityLog']);s.logInlog('nieuw',true,'a',{});
  assert.equal(p.lees('securityLog').length,1);assert.equal(p.lees('securityLog')[0].wie,'a');
});

test('echte security-leesweg schept geen ontbrekende collectie of rijmeta', t => {
  const p=proef(t),s=maak(p);s.securityLogKeten();
  assert.equal(Object.hasOwn(p.db.data,'securityLog'),false);
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM kv WHERE key='securityLog'").get().n,0);
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM audit_meta WHERE naam='securityLog'").get().n,0);
});

test('eerste security-migratie herstelt geen lokaal verwijderde collectie uit oude KV', t => {
  const p=proef(t,{securityLog:[{at:'2026-01-01',wie:'oud'}]}),s=maak(p);delete p.db.data.securityLog;
  assert.throws(()=>s.logInlog('nieuw',true,'a',{}),/openstaand lokaal werk/);
  assert.equal(Object.hasOwn(p.db.data,'securityLog'),false);
  assert.equal(p.lees('securityLog')[0].wie,'oud');
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM audit_meta WHERE naam='securityLog'").get().n,0);
});
