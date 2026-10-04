'use strict';
/* Gerichte auditopslag blijft dezelfde synchrone transactie, zonder bij ieder
   spoor twee keer alle andere domeinen te serialiseren. Echte tijdelijke SQLite,
   geen belastingproef en geen productiegegevens. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { EventEmitter } = require('node:events');

function proef(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-audit-selectief-'));
  const env = { RTG_DATA_DIR: dir, RTG_STORE: 'sqlite', RTG_ENC_KEY: '', DATABASE_URL: '', PG_URL: '', REDIS_URL: '' };
  const oud = Object.fromEntries(Object.keys(env).map(k => [k, process.env[k]]));
  Object.assign(process.env, env);
  const prefix = path.join(__dirname, '..', 'server') + path.sep;
  for (const k of Object.keys(require.cache)) if (k.startsWith(prefix)) delete require.cache[k];
  const opslag = require('../server/db');
  opslag.db.data = { handelingLog: [], apiSpoor: {}, ander: { waarde: 1 } };
  opslag.save();
  const conn = new DatabaseSync(path.join(dir, 'store.db'));
  const lees = key => {
    const meta = conn.prepare('SELECT * FROM audit_meta WHERE naam=?').get(key);
    if (!meta) return JSON.parse(conn.prepare('SELECT val FROM kv WHERE key=?').get(key).val);
    const lijst = conn.prepare('SELECT waarde FROM audit_rij WHERE naam=? ORDER BY nr').all(key).map(r => JSON.parse(r.waarde));
    if (key === 'handelingLog') return lijst.reverse();
    return { ...JSON.parse(meta.extra), commandJournaal: lijst, commandJournaalTotaal: meta.totaal };
  };
  t.after(() => {
    conn.close();
    for (const [k, v] of Object.entries(oud)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { ...opslag, conn, lees, dir };
}

test('volledige SQLite-scan leest actuele eigen collecties zonder de begrotingsproxy te enumereren', t => {
  const p = proef(t), keys = Object.keys, data = p.db.data;
  Object.setPrototypeOf(data, { geerfd: { geheim: true } });
  Object.defineProperty(data, 'verborgen', { value: { geheim: true }, configurable: true });
  data[Symbol('intern')] = { geheim: true };
  let proxyScans = 0;
  t.mock.method(Object, 'keys', value => {
    if (value === data) proxyScans++;
    return keys(value);
  });
  data.nieuw = { waarde: 1 }; p.save();
  data.nieuw.waarde = 2;
  data.later = [3]; p.save();
  assert.deepEqual(p.lees('nieuw'), { waarde: 2 }, 'ook nested wijzigingen blijven authoritative');
  assert.deepEqual(p.lees('later'), [3], 'geen gecachete sleutellijst die nieuwe collecties mist');
  assert.equal(p.conn.prepare("SELECT count(*) n FROM kv WHERE key IN ('geerfd','verborgen')").get().n, 0);
  assert.equal(proxyScans, 0, 'de bekende wikkel voegt geen descriptorval per collectie toe');
});

function toegangSchrijvers(p) {
  const schaduw = require('../server/kern/commercie/schaduw').maakSchaduw(p);
  const gids = require('../server/kern/gids')({ ...p, liveCodename: s => s.codename,
    ledenGidsActief: () => false });
  return { weeg: () => schaduw.weeg('toegang', 'controle', { wie: 'lid' }),
    raak: cn => gids.dirTouch({ key: 'lid', tier: 'rtg', codename: cn }) };
}

test('toegangswaarneming en ledengids bewaren alleen hun eigen collectie', t => {
  const p = proef(t); p.db.data.memberDir = {}; p.save();
  const s = toegangSchrijvers(p);
  let scans = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { scans++; return { waarde: this.waarde }; } });
  p.db.data.ander.waarde = 8;
  assert.equal(s.weeg().door, true);
  s.raak('Eerste naam'); s.raak('Nieuwe naam');
  assert.equal(p.lees('schaduwregels').toegang.waarnemingen, 1);
  assert.equal(p.lees('schaduwregels').toegang.zouTegenhouden, 1);
  assert.deepEqual(p.lees('memberDir').lid, { codename: 'Nieuwe naam', tier: 'rtg' });
  assert.equal(p.lees('ander').waarde, 1, 'toegangscontrole publiceert geen vreemde lopende mutatie');
  assert.equal(scans, 0);
  p.save(); assert.equal(p.lees('ander').waarde, 8, 'de brede expliciete save blijft volledig');
});

test('toegangsschrijvers behouden volledige bundel en falen vóór bevestiging bij opslagfout', async t => {
  const p = proef(t); p.db.data.memberDir = {}; p.save();
  const s = toegangSchrijvers(p), proto = DatabaseSync.prototype, exec = proto.exec;
  let fail = true;
  t.mock.method(proto, 'exec', function(sql) {
    if (sql === 'COMMIT' && fail) { fail = false; throw new Error('toegangscommit mislukt'); }
    return exec.call(this, sql);
  });
  assert.throws(() => s.raak('Bevestigd'), /toegangscommit/);
  assert.deepEqual(p.lees('memberDir'), {});
  assert.deepEqual(p.db.data.memberDir, {}, 'een retry met dezelfde naam moet nog schrijven');
  await p.bijeen(() => {
    s.raak('Bevestigd'); s.weeg();
    p.db.data.ander.waarde = 9; p.save();
    assert.deepEqual(p.lees('memberDir'), {});
    assert.equal(p.lees('ander').waarde, 1);
  }, { duurzaam: true });
  assert.equal(p.lees('memberDir').lid.codename, 'Bevestigd');
  assert.equal(p.lees('schaduwregels').toegang.waarnemingen, 1);
  assert.equal(p.lees('ander').waarde, 9);
});

test('beide echte auditmiddlewares bewaren hun keten zonder vreemde collecties te lezen', t => {
  const p = proef(t);
  let gelezen = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { gelezen++; return { waarde: this.waarde }; }, configurable: true });
  const handeling = require('../server/lib/handelingsspoor')({ db: p.db, save: p.save });
  const audit = require('../server/opzet/auditspoor').maakAuditspoor({ db: p.db, save: p.save });
  const req = { method: 'POST', path: '/api/documenten/zet', body: { tekst: 'privé' }, session: { key: 'actor' } };
  const res = new EventEmitter(); res.statusCode = 200;
  handeling.middleware(req, res, () => {}); audit.middleware()(req, res, () => {});
  res.emit('finish');
  assert.equal(gelezen, 0, 'auditopslag serialiseert geen andere domeinen');
  assert.equal(p.lees('handelingLog').length, 1);
  assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 1);
  assert.equal(handeling.ketenstand().ok, true);
  assert.equal(audit.stand().keten.heel, true);
  assert.ok(!JSON.stringify(p.lees('handelingLog')).includes('privé'));
  assert.ok(!JSON.stringify(p.lees('apiSpoor')).includes('privé'));
  p.db.data.ander.waarde = 2;
  p.save();
  assert.ok(gelezen > 0, 'gewone save behoudt de volledige scan');
  assert.equal(p.lees('ander').waarde, 2);
});

test('systeempost bewaart alleen haar post, gewone post bewaart de bestaande lus-rem mee', t => {
  const p = proef(t), crypto = require('node:crypto');
  p.db.data.rtmail = { berichten: [] };
  p.db.data.rtmailSchrijf = { vakken: { afwezig: { beantwoord: {} } } };
  p.save();
  let scans = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { scans++; return { waarde: this.waarde }; } });
  const mail = require('../server/kern/rtmail')({ db: p.db, save: p.save, crypto, integriteitSleutel: crypto.randomBytes(32) });
  const bericht = mail.systeemStuur('lid', 'Welkom', 'Uw postvak');
  assert.equal(scans, 0, 'een systeemseintje serialiseert geen vreemde collectie');
  assert.equal(p.lees('rtmail').berichten[0].id, bericht.id);
  assert.equal(mail.controleerIntegriteit(p.lees('rtmail').berichten[0]), 'ongeschonden');
  p.db.data.rtmailSchrijf.vakken.afwezig.beantwoord.lid = 'vast';
  const antwoord = mail.stuur({ van: 'afwezig', naar: 'lid', soort: 'afwezig', tekst: 'Later' });
  assert.ok(scans > 0, 'gewone bezorging houdt de oorspronkelijke brede opslag');
  assert.equal(p.lees('rtmail').berichten[0].id, antwoord.id);
  assert.equal(p.lees('rtmailSchrijf').vakken.afwezig.beantwoord.lid, 'vast');
});

test('systeempost houdt foutinjectie en de volledige duurzame bundel', async t => {
  const p = proef(t), crypto = require('node:crypto');
  p.db.data.rtmail = { berichten: [] }; p.save();
  const mail = require('../server/kern/rtmail')({ db: p.db, save: p.save, crypto });
  let nagekomen = 0;
  mail.zetNaBezorging(() => { nagekomen++; });
  const fout = t.mock.method(require('../server/lib/verraadfase'), 'sla', name => name === 'schrijf-faalt');
  assert.throws(() => mail.systeemStuur('lid', 'Fout', 'Niet bevestigd'), /schrijf-faalt/);
  assert.equal(nagekomen, 0, 'geen naverwerking bij geweigerde opslag');
  assert.deepEqual(p.lees('rtmail').berichten, []);
  fout.mock.restore();
  p.db.data.rtmail = p.lees('rtmail');
  let id;
  await p.bijeen(() => {
    id = mail.systeemStuur('lid', 'Samen', 'Eén commit').id;
    p.db.data.ander.waarde = 9;
    p.save();
    assert.deepEqual(p.lees('rtmail').berichten, [], 'geen vroegtijdige deelcommit');
    assert.equal(p.lees('ander').waarde, 1);
  }, { duurzaam: true });
  assert.equal(p.lees('rtmail').berichten[0].id, id);
  assert.equal(p.lees('ander').waarde, 9);
  assert.equal(nagekomen, 1);
});

function activiteitPoort(p, publiceer) {
  return require('../server/opzet/leverancierpoort')({ db: p.db, save: p.save,
    crypto: require('node:crypto'), busGeef: () => ({ publish: publiceer }), kernGeef: () => ({}) });
}

/* De echte afhandelingshandlers en activiteitsschrijver, met een tweede SQLite-
   verbinding als lezer. De meldingsgrens bootst een inmiddels bewaarde melding
   na; daarna verschijnt een vreemde pending mutatie die NIET van het spoor is. */
function orderAfhandeling(t) {
  const p = proef(t), routes = new Map(), signalen = [];
  p.db.data.orders = [{ ref: 'BON', supplierCode: 'AAA', customerTier: 'lid', status: 'nieuw', pickup: '42' }];
  p.db.data.supplierActivity = {}; p.db.data.notifications = {}; p.save();
  let scans = 0, antwoord;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { scans++; return { waarde: this.waarde }; } });
  const sein = naam => {
    assert.equal(p.lees('orders')[0].status, 'klaar', 'order staat op schijf vóór elk live sein');
    signalen.push(naam);
  };
  const poort = activiteitPoort(p, (kanaal, bericht) => {
    assert.equal(kanaal, 'sse'); assert.equal(bericht.match, 'AAA');
    assert.equal(bericht.data.scope, 'team');
    assert.equal(p.lees('supplierActivity').AAA.length, 1, 'activiteit staat op schijf vóór teamsync');
    sein('team');
  });
  require('../server/routes/supplier/orders/afhandeling')({
    app: { post(pad, ...handlers) { routes.set(pad, handlers.at(-1)); } },
    supplierAuth() {}, orderMetRef: ref => p.db.data.orders.find(o => o.ref === ref),
    save: p.save, logActivity: poort.logActivity,
    sectiesForOrder: () => ['warm'], stationsForOrder: () => ['keuken'],
    broadcastSync: () => sein('order'), sseToSupplier: () => sein('zaak'), sseToOffice: () => sein('kantoor'),
    notify(tier, note) {
      p.db.data.notifications[tier] = [note]; p.save(); sein('melding');
      p.db.data.ander.waarde = 9; scans = 0;
    }
  });
  const handeling = require('../server/lib/handelingsspoor')({ db: p.db, save: p.save });
  const audit = require('../server/opzet/auditspoor').maakAuditspoor({ db: p.db, save: p.save });
  const run = async (soort, body) => {
    const req = { method: 'POST', path: '/api/supplier/order/' + soort, body: { ref: 'BON', ...body },
      supplier: { code: 'AAA', name: 'Zaak' }, actor: { name: 'Sam' }, session: { key: 'actor' } };
    const res = new EventEmitter(); res.statusCode = 200;
    res.status = code => { res.statusCode = code; return res; };
    res.json = value => { antwoord = value; res.emit('finish'); return res; };
    handeling.middleware(req, res, () => {}); audit.middleware()(req, res, () => {});
    await routes.get(req.path)(req, res);
  };
  return { ...p, run, signalen, handeling, audit, scans: () => scans, antwoord: () => antwoord };
}

const orderFasen = [
  ['sectie', { sectie: 'warm', phase: 'klaar' }],
  ['station', { station: 'keuken', phase: 'klaar' }],
  ['status', { status: 'klaar' }]
];
for (const [soort, body] of orderFasen) {
  test('orderafhandeling ' + soort + ': bewaart order, melding en audit zonder vreemde pending mutatie', async t => {
    const p = orderAfhandeling(t);
    await p.run(soort, body);
    assert.equal(p.antwoord().ok, true);
    assert.equal(p.lees('orders')[0].status, 'klaar');
    assert.equal(p.lees('notifications').lid.length, 1);
    assert.equal(p.lees('supplierActivity').AAA[0].who, 'Sam');
    assert.match(p.lees('supplierActivity').AAA[0].text, /BON/);
    assert.equal(p.signalen.at(-1), 'team');
    assert.equal(p.lees('ander').waarde, 1, 'het activiteitspoor publiceert geen vreemde lopende mutatie');
    assert.equal(p.db.data.ander.waarde, 9, 'de lopende mutatie wordt ook niet weggegooid');
    assert.equal(p.scans(), 0, 'het spoor leest geen vreemde collectie');
    assert.equal(p.lees('handelingLog').length, 1); assert.equal(p.handeling.ketenstand().ok, true);
    assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 1); assert.equal(p.audit.stand().keten.heel, true);
  });
  for (const [grens, commit] of [['order', 1], ['activiteit', 3]]) {
    test('orderafhandeling ' + soort + ': ' + grens + '-commitfout bevestigt geen onbewaard resultaat', async t => {
      const p = orderAfhandeling(t), exec = DatabaseSync.prototype.exec;
      let commits = 0;
      t.mock.method(DatabaseSync.prototype, 'exec', function(sql) {
        if (sql === 'COMMIT' && ++commits === commit) throw new Error(grens + 'commit mislukt');
        return exec.call(this, sql);
      });
      await assert.rejects(p.run(soort, body), new RegExp(grens + 'commit'));
      assert.equal(p.antwoord(), undefined);
      assert.deepEqual(p.lees('supplierActivity'), {});
      assert.equal(p.signalen.includes('team'), false);
      assert.equal(p.lees('ander').waarde, 1);
      if (grens === 'order') {
        assert.equal(p.lees('orders')[0].status, 'nieuw');
        assert.deepEqual(p.lees('notifications'), {}); assert.deepEqual(p.signalen, []);
      } else {
        assert.equal(p.lees('orders')[0].status, 'klaar', 'eerdere echte ordercommit blijft geldig');
        assert.equal(p.lees('notifications').lid.length, 1);
      }
      assert.equal(p.lees('handelingLog').length, 0);
      assert.equal(p.lees('apiSpoor').commandJournaalTotaal || 0, 0);
    });
  }
}

test('zelfstandig activiteitspoor bewaart alleen zichzelf; gewone activiteit bewaart de domeinmutatie mee', t => {
  const p = proef(t);
  p.db.data.supplierActivity = { AAA: Array.from({ length: 80 }, (_, n) => ({ who: 'Oud', text: String(n) })) };
  p.db.data.suppliers = [{ code: 'AAA', events: [] }]; p.save();
  let scans = 0, signalen = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { scans++; return { waarde: this.waarde }; } });
  const poort = activiteitPoort(p, (kanaal, bericht) => {
    signalen++;
    assert.equal(kanaal, 'sse'); assert.equal(bericht.match, 'AAA');
    assert.deepEqual(bericht.data, { scope: 'team' });
    assert.equal(p.lees('supplierActivity').AAA[0].text, signalen === 1 ? 'logde in' : 'event gemaakt',
      'SQLite heeft de activiteit vóór het live sein vastgelegd');
  });
  poort.logActivity.alleenActiviteit('AAA', { name: 'Sam' }, 'logde in');
  assert.equal(scans, 0);
  const regels = p.lees('supplierActivity').AAA;
  assert.equal(regels.length, 80); assert.equal(regels[0].who, 'Sam');
  assert.equal(regels[79].text, '78'); assert.ok(Number.isFinite(Date.parse(regels[0].at)));
  p.db.data.suppliers[0].events.push({ id: 'nieuw' });
  poort.logActivity('AAA', { name: 'Sam' }, 'event gemaakt');
  assert.ok(scans > 0, 'het oorspronkelijke brede opslagcontract blijft bestaan');
  assert.deepEqual(p.lees('suppliers')[0].events, [{ id: 'nieuw' }]);
  assert.equal(signalen, 2);
});

test('activiteit krijgt geen live bevestiging na een echte SQLite-commitfout en blijft in de volledige bundel', async t => {
  const p = proef(t), proto = DatabaseSync.prototype, exec = proto.exec;
  p.db.data.supplierActivity = {}; p.save();
  let signalen = 0, fail = true;
  const poort = activiteitPoort(p, () => { signalen++; });
  const fout = t.mock.method(proto, 'exec', function(sql) {
    if (sql === 'COMMIT' && fail) { fail = false; throw new Error('activiteitcommit mislukt'); }
    return exec.call(this, sql);
  });
  assert.throws(() => poort.logActivity.alleenActiviteit('AAA', null, 'niet bevestigd'), /activiteitcommit/);
  assert.deepEqual(p.lees('supplierActivity'), {}); assert.equal(signalen, 0);
  fout.mock.restore();
  p.db.data = require('../server/db/sqlite').loadSqlite();
  await p.bijeen(() => {
    poort.logActivity.alleenActiviteit('AAA', null, 'samen bewaard');
    p.db.data.ander.waarde = 11; p.save();
    assert.deepEqual(p.lees('supplierActivity'), {}, 'geen vroege deelcommit');
    assert.equal(p.lees('ander').waarde, 1);
  }, { duurzaam: true });
  assert.equal(p.lees('supplierActivity').AAA[0].text, 'samen bewaard');
  assert.equal(p.lees('supplierActivity').AAA[0].who, 'Beheer');
  assert.equal(p.lees('ander').waarde, 11);
});

test('demo-login bewaart zelfstandig; personeelslogin behoudt de werkvensterinitialisatie', async t => {
  const p = proef(t), crypto = require('node:crypto');
  p.db.data.supplierActivity = {}; p.db.data.securityLog = [];
  p.db.data.suppliers = [{ code: 'AAA', type: 'hotel' }]; p.save();
  const sessies = require('../server/kern/sessies').maakSessies({ db: p.db, save: p.save, crypto });
  let scans = 0, signalen = 0, antwoord;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { scans++; return { waarde: this.waarde }; } });
  const poort = activiteitPoort(p, () => {
    signalen++;
    assert.equal(Object.keys(p.lees('sessions')).length, signalen);
    assert.equal(p.lees('securityLog')[0].ok, true);
    assert.equal(p.lees('supplierActivity').AAA[0].text, (signalen === 1 ? 'Beheer' : 'Sam') + ' logde in');
  });
  const routes = new Map();
  require('../server/routes/supplier/toegang')({
    app: { post(pad, ...handlers) { routes.set(pad, handlers.at(-1)); } },
    DEMO: true, DEMO_SUPPLIER: 'AAA', crypto,
    accounts: { legacyStaffPinToegestaan: () => true,
      verifyStaffPin: async () => ({ id: 77, supplier_code: 'AAA', name: 'Sam', role: 'staff' }) },
    pinSlot: { personeel: () => 'AAA:77', dicht: () => false, goed() {} },
    magWerken: require('../server/kern/werkvenster').maakWerkvenster(p).magWerken,
    hasCred: () => true, checkCred: () => true, tooManyTries: () => false,
    loginFails: new Map(), findSupplier: () => p.db.data.suppliers[0], persoonsPoort: () => ({ ok: true }),
    logActivity: poort.logActivity, rememberSession: sessies.rememberSession,
    logInlog(kanaal, ok) { p.db.data.securityLog.push({ kanaal, ok }); p.save.sleutels(['securityLog']); },
    supplierState: s => ({ code: s.code })
  });
  const res = { status() { assert.fail('de toegestane proeflogin moet slagen'); }, json(x) { antwoord = x; } };
  await routes.get('/api/supplier/login')({ body: { username: 'proef', password: 'proef' }, ip: '127.0.0.1' }, res);
  assert.equal(scans, 0, 'de loginroute kiest geen brede activiteit-save');
  assert.equal(signalen, 1); assert.equal(antwoord.state.code, 'AAA');
  const bewaard = p.lees('sessions')[sessies.tokenHash(antwoord.token)];
  assert.equal(bewaard.role, 'supplier'); assert.equal(bewaard.code, 'AAA');
  assert.equal(p.lees('suppliers')[0].settings, undefined);
  await routes.get('/api/supplier/login')({ body: { code: 'AAA', staffId: 77, pin: 'proef' } }, res);
  assert.ok(scans > 0, 'personeelslogin behoudt de brede save');
  assert.deepEqual(p.lees('suppliers')[0].settings.werkvenster,
    { aan: false, dagen: {}, vrijgesteld: [], perStaff: {} }, 'impliciete defaults moeten op schijf staan');
  assert.equal(p.lees('sessions')[sessies.tokenHash(antwoord.token)].staffId, 77);
  assert.equal(signalen, 2);
});

test('expliciete auditopslag stelt grote bestaande collecties niet uit', t => {
  const p = proef(t);
  p.db.data.apiSpoor = { tekst: 'a'.repeat(600000), nummer: 1 };
  p.save.sleutels(['apiSpoor']);
  p.db.data.apiSpoor.nummer = 2;
  p.save.sleutels(['apiSpoor', 'apiSpoor']);
  assert.equal(p.lees('apiSpoor').nummer, 2);
  for (const keys of [null, [], ['ontbreekt'], [42]]) assert.throws(() => p.save.sleutels(keys), /bestaande collecties/);
});

test('selectieve save houdt foutinjectie en de gewone duurzame bundel intact', async t => {
  const p = proef(t), verraad = require('../server/lib/verraadfase');
  const fout = t.mock.method(verraad, 'sla', name => name === 'schrijf-faalt');
  p.db.data.apiSpoor = { nummer: 1 };
  assert.throws(() => p.save.sleutels(['apiSpoor']), /schrijf-faalt/);
  assert.deepEqual(p.lees('apiSpoor'), {});
  fout.mock.restore();
  await p.bijeen(() => {
    p.save.sleutels(['apiSpoor']);
    p.db.data.ander.waarde = 3;
    p.save();
    assert.deepEqual(p.lees('apiSpoor'), {}, 'de bundel commit pas aan het eind');
  });
  assert.equal(p.lees('apiSpoor').nummer, 1);
  assert.equal(p.lees('ander').waarde, 3);
});

test('mislukte SQLite-commit publiceert geen cacheversie die een retry verliest', t => {
  const p = proef(t), proto = DatabaseSync.prototype, exec = proto.exec;
  let fail = true;
  t.mock.method(proto, 'exec', function (sql) {
    if (sql === 'COMMIT' && fail) { fail = false; throw new Error('geïsoleerde commitfout'); }
    return exec.call(this, sql);
  });
  p.db.data.apiSpoor = { nummer: 2 };
  p.db.data.handelingLog.push({ id: 'een' });
  assert.throws(() => p.save.sleutels(['apiSpoor', 'handelingLog']), /commitfout/);
  assert.deepEqual(p.lees('apiSpoor'), {});
  assert.deepEqual(p.lees('handelingLog'), []);
  p.save.sleutels(['apiSpoor', 'handelingLog']);
  assert.equal(p.lees('apiSpoor').nummer, 2);
  assert.deepEqual(p.lees('handelingLog'), [{ id: 'een' }]);
});

test('een expliciet opgeslagen spoor overleeft een onderbroken schrijfproces', t => {
  const p = proef(t);
  const { spawnSync } = require('node:child_process');
  const child = spawnSync(process.execPath, ['-e', `
    const opslag = require('./server/db');
    opslag.db.data = require('./server/db/sqlite').loadSqlite();
    opslag.db.data.apiSpoor = { commandJournaalTotaal: 1, commandJournaal: [{ id: 'duurzaam' }] };
    opslag.save.sleutels(['apiSpoor']);
    process.kill(process.pid, 'SIGKILL');
  `], { cwd: path.join(__dirname, '..'), env: process.env, encoding: 'utf8' });
  assert.equal(child.signal, 'SIGKILL', child.stderr);
  assert.equal(p.lees('apiSpoor').commandJournaalTotaal, 1);
  const herstart = spawnSync(process.execPath, ['-e', `
    const data = require('./server/db/sqlite').loadSqlite();
    console.log(JSON.stringify(data.apiSpoor));
  `], { cwd: path.join(__dirname, '..'), env: process.env, encoding: 'utf8' });
  assert.equal(herstart.status, 0, herstart.stderr);
  assert.deepEqual(JSON.parse(herstart.stdout), p.lees('apiSpoor'));
});


test('sessie en context bewaren alleen hun eigendom, ook bij wijziging en intrekking', async t => {
  const p = proef(t), crypto = require('node:crypto');
  const s = require('../server/kern/sessies').maakSessies({ db: p.db, save: p.save, crypto });
  const c = require('../server/kern/identiteit/sessieregister').maakSessieregister(p);
  let gelezen = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { gelezen++; return { waarde: this.waarde }; } });
  s.rememberSession('eigen-token', { tier: 'rtg', key: 'user-1' });
  const hash = s.tokenHash('eigen-token'), sid = p.db.data.sessions[hash].sid;
  c.open(sid, 'user-1', {});
  assert.equal(p.lees('sessions')[hash].key, 'user-1');
  assert.equal(p.lees('sessiecontext')[sid].lidKey, 'user-1');
  assert.equal(gelezen, 0);
  assert.equal(await s.forgetSessionDuurzaam(hash), true);
  c.sluit(sid);
  assert.deepEqual(p.lees('sessions'), {});
  assert.deepEqual(p.lees('sessiecontext'), {});
  assert.equal(gelezen, 0, 'geen vreemde domeinen gescand voor een sessiemutatie');
  p.db.data = require('../server/db/sqlite').loadSqlite();
  s.herbouwSessions();
  assert.equal(s.sessionFor('eigen-token'), null, 'reload wekt de ingetrokken sessie niet tot leven');
});

test('een mislukte sessiecommit geeft geen bruikbaar token; retry bewaart sessie en context', t => {
  const p = proef(t), crypto = require('node:crypto'), proto = DatabaseSync.prototype, exec = proto.exec;
  const s = require('../server/kern/sessies').maakSessies({ db: p.db, save: p.save, crypto });
  let fail = true;
  t.mock.method(proto, 'exec', function(sql) {
    if (sql === 'COMMIT' && fail) { fail = false; throw new Error('sessiecommit mislukt'); }
    return exec.call(this, sql);
  });
  assert.throws(() => s.rememberSession('retry', { tier: 'rtg', key: 'user-2' }), /sessiecommit mislukt/);
  assert.equal(s.sessionFor('retry'), null);
  assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM kv WHERE key='sessions'").get().n, 0);
  s.rememberSession('retry', { tier: 'rtg', key: 'user-2' });
  assert.equal(p.lees('sessions')[s.tokenHash('retry')].key, 'user-2');
});

test('selectieve sessies en context blijven samen met vreemd domein en audit in één bundel', async t => {
  const p = proef(t), crypto = require('node:crypto');
  const s = require('../server/kern/sessies').maakSessies({ db: p.db, save: p.save, crypto });
  const c = require('../server/kern/identiteit/sessieregister').maakSessieregister(p);
  const h = require('../server/lib/handelingsspoor')({ db: p.db, save: p.save });
  await p.bijeen(() => {
    s.rememberSession('bundel', { key: 'user-3', tier: 'rtg' });
    c.open(p.db.data.sessions[s.tokenHash('bundel')].sid, 'user-3', {});
    p.db.data.ander.waarde = 9;
    p.save();
    h.noteer({ wie: 'user-3', methode: 'POST', pad: '/api/sessie-proef', status: 200 });
    assert.equal(p.conn.prepare("SELECT COUNT(*) n FROM kv WHERE key='sessions'").get().n, 0);
    assert.equal(p.lees('ander').waarde, 1);
    assert.equal(p.lees('handelingLog').length, 0);
  }, { duurzaam: true });
  assert.equal(p.lees('sessions')[s.tokenHash('bundel')].key, 'user-3');
  assert.equal(Object.values(p.lees('sessiecontext'))[0].lidKey, 'user-3');
  assert.equal(p.lees('ander').waarde, 9);
  assert.equal(p.lees('handelingLog').length, 1);
  assert.equal(h.ketenstand().ok, true);
});
