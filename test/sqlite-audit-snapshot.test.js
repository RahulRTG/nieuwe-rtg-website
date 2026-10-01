'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const proef = require('./lib/audit-rijen-fixture');
function setup(t) {
  const p = proef(t); p.handeling(); p.api();
  let poll;
  t.mock.method(global, 'setInterval', fn => { poll = fn; return { unref() {} }; });
  const sqlite = require('../server/db/sqlite'); sqlite.startSqliteSync();
  const schrijf = n => {
    const r = p.kind(`const p=require('./server/db');p.db.data=require('./server/db/sqlite').loadSqlite();
      const h=require('./server/lib/handelingsspoor')({db:p.db,save:p.save});
      const j=require('./server/kern/command/journaal').maakJournaal({db:p.db,save:p.save,crypto:require('crypto'),auditOpslag:p.save.audit.open('apiSpoor')});
      p.bijeen(()=>{p.db.data.ander.waarde=${n};p.save();h.noteer({pad:'/${n}',status:200});j.noteer({actor:'a',actie:'${n}'});});`);
    assert.equal(r.status, 0, r.stderr);
  };
  const proto = Object.getPrototypeOf(p.conn.prepare('SELECT 1'));
  return { ...p, sqlite, proto, poll: () => poll(), schrijf };
}
function zelfde(data, n) {
  assert.equal(data.ander.waarde, n);
  assert.equal(data.handelingLog[0].pad, '/' + n);
  assert.equal(data.apiSpoor.commandJournaal.at(-1).actie, String(n));
}

test('KV en beide auditjournalen komen bij poll uit één snapshot ondanks een gelijktijdige externe bundel', t => {
  const p = setup(t); p.schrijf(2);
  const get = p.proto.get; let geraakt = false;
  t.mock.method(p.proto, 'get', function(...args) {
    const r = get.apply(this, args);
    if (!geraakt && args[0] === 'ander' && r?.val) { geraakt = true; p.schrijf(3); }
    return r;
  });
  p.poll(); assert.ok(geraakt); zelfde(p.db.data, 2);
  p.poll(); zelfde(p.db.data, 3);
});

test('initiële load hydrateert KV en audit uit dezelfde SQLite-snapshot', t => {
  const p = setup(t); p.schrijf(2);
  const all = p.proto.all; let geraakt = false;
  t.mock.method(p.proto, 'all', function(...args) {
    const r = all.apply(this, args);
    if (!geraakt && r.some(x => x.key === 'ander')) { geraakt = true; p.schrijf(3); }
    return r;
  });
  const data = p.sqlite.loadSqlite(); assert.ok(geraakt); zelfde(data, 2);
  zelfde(p.sqlite.loadSqlite(), 3);
});

test('een fout tijdens audit-read publiceert ook de eerder gelezen KV niet', t => {
  const p = setup(t); p.schrijf(2);
  const all = p.proto.all; let fail = true;
  const meldingen = []; t.mock.method(console, 'warn', (...args) => meldingen.push(args.join(' ')));
  t.mock.method(p.proto, 'all', function(...args) {
    if (fail && args[0] === 'apiSpoor' && args.length === 2) { fail = false; throw new Error('audit-read-fout'); }
    return all.apply(this, args);
  });
  p.poll(); assert.equal(p.db.data.ander.waarde, 1); assert.equal(p.db.data.handelingLog.length, 0);
  assert.equal(p.db.data.apiSpoor.commandJournaal.length, 0); assert.equal(meldingen.length, 1);
  p.poll(); zelfde(p.db.data, 2); assert.equal(meldingen.length, 1);
});

test('dezelfde standby-producers migreren niet, maar werken na promotie en reload zonder reconstructie', t => {
  const p = proef(t, { handelingLog: [{ pad: '/legacy' }] }); p.db.writable = false;
  const h = p.handeling(), a = p.api();
  assert.equal(h.lijst().totaal, 1); assert.equal(a.journaal.aantal(), 0);
  assert.equal(h.noteer({ pad: '/geweigerd' }), undefined);
  assert.equal(p.conn.prepare('SELECT COUNT(*) n FROM audit_meta').get().n, 0);
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM kv WHERE key IN ('handelingLog','apiSpoor')").get().n, 2);
  p.db.writable = true; p.db.data = require('../server/db/sqlite').loadSqlite();
  h.noteer({ pad: '/na-promotie', status: 200 }); a.journaal.noteer({ actor: 'a', actie: 'na-promotie' });
  assert.equal(p.conn.prepare('SELECT COUNT(*) n FROM audit_meta').get().n, 2);
  assert.equal(p.lees('handelingLog')[0].pad, '/na-promotie');
  assert.deepEqual(p.lees('handelingLog')[1], { pad: '/legacy' });
  assert.equal(a.journaal.controleer().heel, true);
  p.db.writable = false; assert.equal(a.journaal.noteer({ actor: 'a', actie: 'na-demotie' }), undefined);
  assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 1);
});

test('lege audit-tabellen onderdrukken de null/fallback-uitkomst van een lege opslag niet', t => {
  const p = proef(t); p.conn.exec('DELETE FROM kv');
  assert.equal(p.conn.prepare('SELECT COUNT(*) n FROM audit_meta').get().n, 0);
  assert.equal(require('../server/db/sqlite').loadSqlite(), null);
});

test('begrotingsweigering van de auditpublicatie vindt vóór COMMIT plaats', t => {
  const p = proef(t, { handelingLog: Array.from({ length: 50002 }, (_, i) => ({ at: 'legacy', id: i })) });
  const begroting = require('../server/opzet/begroting');
  let actief = false;
  p.db.data = begroting.bewaak({ ...p.db.data }, { modus: 'weigeren', grens: 1, log() {}, handeling: { huidige: () => actief ? { pad: '/proef' } : null } });
  const h = p.handeling(); actief = true;
  assert.throws(() => h.noteer({ pad: '/nieuw', status: 200 }), /begroting/);
  assert.equal(p.lees('handelingLog').length, 50002);
  assert.equal(p.db.data.handelingLog.length, 50002);
  actief = false; h.noteer({ pad: '/nieuw', status: 200 });
  assert.equal(p.lees('handelingLog').length, 50000); assert.equal(p.lees('handelingLog')[0].pad, '/nieuw');
});
