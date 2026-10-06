'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const proef = require('./lib/audit-rijen-fixture');
const keten = require('../server/lib/keten');
const regel = pad => ({ wie: 'persoon', methode: 'POST', pad, status: 200 });
const journaal = p => require('../server/kern/command/journaal').maakJournaal({ db: p.db, save: p.save, crypto: require('node:crypto'), auditOpslag: p.save.audit.open('apiSpoor') });

test('migratie bewaart hashloze regels, volgorde, teller en onbekende metadata; nieuwe append gebruikt de geketende kop', t => {
  const oud = keten.schakel({ at: '2026-09-01', pad: '/oud' }, null, 7);
  /* Hashloze regels van VOOR de keten staan ONDER de oudste geketende regel
     (nieuwste-eerst); een hashloze regel daarboven is sinds audit P1-2 een
     breuk en geen erfenis (lib/keten.js). */
  const bron = [oud, { at: '2026-08-31', pad: '/legacy' }];
  const p = proef(t, { handelingLog: bron, apiSpoor: { eigenMeta: { behoud: true }, commandJournaalTotaal: 91 } });
  const h = p.handeling(), j = journaal(p);
  assert.deepEqual(p.lees('handelingLog'), bron);
  const r = h.noteer(regel('/nieuw'));
  assert.equal(r.nr, 8); assert.equal(r.vorige, oud.hash);
  assert.equal(h.ketenstand().zonderKeten, 1); assert.equal(h.ketenstand().ok, true);
  j.noteer({ actor: 'a', actie: 'een' });
  assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 92);
  assert.deepEqual(p.lees('apiSpoor').eigenMeta, { behoud: true });
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM kv WHERE key IN ('handelingLog','apiSpoor')").get().n, 0);
});

test('auditprojectie weigert directe mutatie; vervanging met gelijke lengte blijft een echte opslagactie', t => {
  const p = proef(t), h = p.handeling(); h.noteer(regel('/een'));
  const l = p.db.data.handelingLog;
  assert.throws(() => { l[0].pad = '/vervalst'; }, /alleen leesbaar/);
  assert.throws(() => { delete l[0].wie; }, /alleen leesbaar/);
  assert.throws(() => l.splice(0, 1), /alleen leesbaar/);
  const versie = () => p.conn.prepare("SELECT versie FROM audit_meta WHERE naam='handelingLog'").get().versie;
  const v = versie(); p.db.data.handelingLog = [...l]; p.save();
  assert.equal(versie(), v, 'retentierapport met identieke nieuwe array herschrijft niet');
  p.db.data = { ...p.db.data, handelingLog: [{ at: '2026-01-01', pad: '/vervangen' }] }; p.save();
  assert.equal(p.lees('handelingLog')[0].pad, '/vervangen');
  p.db.data.handelingLog = []; p.save();
  assert.deepEqual(p.lees('handelingLog'), []);
  const terug = p.kind("const d=require('./server/db/sqlite').loadSqlite(); console.log(JSON.stringify(d.handelingLog));");
  assert.equal(terug.status, 0, terug.stderr); assert.deepEqual(JSON.parse(terug.stdout), []);
});

test('bundel publiceert pas na commit; ids en tijden blijven stabiel bij opnieuw bepalen van de ketenkop', async t => {
  const p = proef(t), h = p.handeling(), j = journaal(p); let resultaat;
  await p.bijeen(async () => {
    h.noteer(regel('/een')); resultaat = j.noteer({ actor: 'a', actie: 'een' });
    assert.equal(j.aantal(), 1); assert.equal(h.lijst().totaal, 1);
    assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 0); assert.equal(p.lees('handelingLog').length, 0);
    assert.equal(p.db.data.handelingLog.length, 0, 'de gedeelde projectie bevat geen ongecommitteerde preview');
    p.db.data.ander.waarde = 2; p.save();
  }, { duurzaam: true });
  assert.deepEqual(p.lees('apiSpoor').commandJournaal[0], resultaat);
  assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 1); assert.equal(p.lees('handelingLog').length, 1);
  assert.equal(p.lees('ander').waarde, 2); assert.equal(j.controleer().heel, true);
});

test('commitfout laat rijopslag en leesprojectie ongemoeid; een nieuwe poging legt precies één effect vast', t => {
  const p = proef(t), h = p.handeling();
  const proto = DatabaseSync.prototype, exec = proto.exec; let fail = true;
  const fout = t.mock.method(proto, 'exec', function(sql) { if (sql === 'COMMIT' && fail) { fail = false; throw new Error('commitfout'); } return exec.call(this, sql); });
  assert.throws(() => h.noteer(regel('/een')), /commitfout/);
  assert.equal(p.lees('handelingLog').length, 0); assert.equal(p.db.data.handelingLog.length, 0);
  fout.mock.restore(); h.noteer(regel('/een'));
  assert.equal(p.lees('handelingLog').length, 1); assert.equal(h.ketenstand().ok, true);
});

test('actorwissing herschrijft atomair, behoudt metadata en teller, en laat geen actor in live SQL/KV achter', async t => {
  const p = proef(t, { apiSpoor: { eigenMeta: 'blijft' } }), j = journaal(p);
  j.noteer({ actor: 'te-wissen', actie: 'een' }); j.noteer({ actor: 'andere', actie: 'twee' });
  let resultaat;
  await p.bijeen(() => {
    resultaat = j.wisActor('te-wissen');
    assert.equal(p.lees('apiSpoor').commandJournaal[0].actor, 'te-wissen');
  });
  assert.equal(resultaat.geraakt, 1); assert.equal(j.controleer().heel, true);
  const v = p.lees('apiSpoor'); assert.equal(v.eigenMeta, 'blijft'); assert.equal(v.commandJournaalTotaal, 3);
  assert.equal(v.commandJournaal[0].actor, 'gewist'); assert.equal(v.commandJournaal.at(-1).actie, 'wissing in het spoor');
  assert.ok(!JSON.stringify(p.conn.prepare('SELECT * FROM audit_rij').all()).includes('te-wissen'));
  assert.ok(!JSON.stringify(p.conn.prepare('SELECT * FROM kv').all()).includes('te-wissen'));
});

test('losse schrijvers bouwen op dezelfde SQL-kop; een lopende bundel verliest de externe regel niet', async t => {
  const p = proef(t), h = p.handeling(), j = journaal(p); let preview;
  await p.bijeen(() => {
    h.noteer(regel('/lokaal')); preview = j.noteer({ actor: 'lokaal', actie: 'lokaal' });
    const r = p.kind(`const p=require('./server/db');p.db.data=require('./server/db/sqlite').loadSqlite();
      require('./server/lib/handelingsspoor')({db:p.db,save:p.save}).noteer({wie:'extern',methode:'POST',pad:'/extern',status:200});
      require('./server/kern/command/journaal').maakJournaal({db:p.db,save:p.save,crypto:require('crypto'),auditOpslag:p.save.audit.open('apiSpoor')}).noteer({actor:'extern',actie:'extern'});`);
    assert.equal(r.status, 0, r.stderr);
  });
  assert.equal(h.ketenstand().ok, true); assert.equal(j.controleer().heel, true);
  assert.deepEqual(p.lees('handelingLog').map(r => r.pad), ['/lokaal', '/extern']);
  const a = p.lees('apiSpoor'); assert.equal(a.commandJournaalTotaal, 2);
  assert.deepEqual(a.commandJournaal.map(r => r.actor), ['extern', 'lokaal']);
  assert.deepEqual(a.commandJournaal[1], preview);
});

test('SQL-tampering wordt na herstart als ketenbreuk gevonden', t => {
  const p = proef(t), h = p.handeling(); h.noteer(regel('/een')); h.noteer(regel('/twee'));
  const row = p.conn.prepare("SELECT nr,waarde FROM audit_rij WHERE naam='handelingLog' ORDER BY nr LIMIT 1").get();
  const val = JSON.parse(row.waarde); val.pad = '/vervalst';
  p.conn.prepare("UPDATE audit_rij SET waarde=? WHERE naam='handelingLog' AND nr=?").run(JSON.stringify(val), row.nr);
  const r = p.kind("const p=require('./server/db');p.db.data=require('./server/db/sqlite').loadSqlite();console.log(JSON.stringify(require('./server/lib/handelingsspoor')({db:p.db,save:p.save}).ketenstand()));");
  assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).ok, false);
});

test('rijen en metadata gebruiken bestaande versleuteling; oude schrijvers worden geweigerd', t => {
  const p = proef(t, { apiSpoor: { geheim: 'metadata' } }, require('node:crypto').randomBytes(32).toString('hex'));
  const h = p.handeling(), j = journaal(p); h.noteer(regel('/een')); j.noteer({ actor: 'a', actie: 'een' });
  for (const r of p.conn.prepare('SELECT waarde FROM audit_rij').all()) assert.match(r.waarde, /^RTGENC1:/);
  for (const r of p.conn.prepare('SELECT extra FROM audit_meta').all()) assert.match(r.extra, /^RTGENC1:/);
  assert.equal(p.lees('apiSpoor').geheim, 'metadata');
  assert.throws(() => p.conn.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,?)').run('apiSpoor', '{}', 99), /stop oude schrijvers/);
});

test('offline rollback materialiseert voor oude reader en herimport behoudt wijzigingen van de oude release', t => {
  const p = proef(t), h = p.handeling(), j = journaal(p); h.noteer(regel('/een')); j.noteer({ actor: 'a', actie: 'een' });
  const voor = { h: p.lees('handelingLog'), a: p.lees('apiSpoor') };
  const r = p.kind(`const {DatabaseSync}=require('node:sqlite');const k=new DatabaseSync(process.env.RTG_DATA_DIR+'/store.db');
    console.log(JSON.stringify(require('./server/db/audit-compat').materialiseer(k,require('./server/kluis'))));k.close();`);
  assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(r.stdout), { collecties: 2, regels: 2 });
  const old = p.kind(`const {DatabaseSync}=require('node:sqlite');const k=new DatabaseSync(process.env.RTG_DATA_DIR+'/store.db');
    const a=JSON.parse(k.prepare("SELECT val FROM kv WHERE key='apiSpoor'").get().val);
    const h=JSON.parse(k.prepare("SELECT val FROM kv WHERE key='handelingLog'").get().val);
    console.log(JSON.stringify({a,h}));a.oudeRelease='bewaard';k.prepare("UPDATE kv SET val=?,ver=ver+1 WHERE key='apiSpoor'").run(JSON.stringify(a));k.close();`);
  assert.equal(old.status, 0, old.stderr); assert.deepEqual(JSON.parse(old.stdout), voor);
  const nieuw = p.kind("const p=require('./server/db');p.db.data=require('./server/db/sqlite').loadSqlite();p.save.audit.open('apiSpoor');console.log(JSON.stringify(p.db.data.apiSpoor));");
  assert.equal(nieuw.status, 0, nieuw.stderr); assert.equal(JSON.parse(nieuw.stdout).oudeRelease, 'bewaard');
  assert.deepEqual(JSON.parse(nieuw.stdout).commandJournaal, voor.a.commandJournaal);
});
