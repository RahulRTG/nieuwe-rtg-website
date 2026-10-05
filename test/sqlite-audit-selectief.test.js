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

function meldingPoort(p, publiceer, push) {
  p.db.data.notifications = {};
  p.db.data.pushSubs = { lid: [{ endpoint: 'https://push.invalid/proef' }] };
  p.db.data.meldingVoorkeur = {};
  p.save();
  return require('../server/opzet/meldingen')({ db: p.db, save: p.save,
    crypto: require('node:crypto'), bus: { publish: publiceer },
    webpush: { sendNotification: (...args) => { if (push) push(...args); return Promise.resolve(); } } });
}

test('een eigen melding bewaart vóór publicatie uitsluitend notifications; de gewone ingang blijft breed', t => {
  const p = proef(t), gezien = [], pushes = [];
  const m = meldingPoort(p, (_soort, bericht) => {
    assert.equal(p.lees('notifications').lid[0].id, bericht.data.id, 'SQLite bevestigt vóór SSE');
    gezien.push(bericht);
  }, (_sub, payload) => pushes.push(JSON.parse(payload)));
  let scans = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { scans++; return { waarde: this.waarde }; } });
  p.db.data.ander.waarde = 7;
  const n = m.notify.alleenMelding('lid', { title: 'Factuur', body: 'Uw factuur staat klaar', scope: 'facturen' });
  assert.equal(scans, 0);
  assert.equal(p.lees('ander').waarde, 1, 'de melding schrijft geen vreemd pending domein');
  assert.deepEqual(p.lees('notifications').lid, [n]);
  assert.equal(gezien.length, 1); assert.equal(pushes.length, 1);
  assert.equal(pushes[0].tag, n.id);
  m.notify('lid', { title: 'Gewone melding' });
  assert.ok(scans > 0); assert.equal(p.lees('ander').waarde, 7);
  assert.equal(p.lees('notifications').lid.length, 2);
});

test('uitgeschakelde meldingsscope schrijft, seint en pusht niets via de eigen ingang', t => {
  const p = proef(t); let effecten = 0;
  const m = meldingPoort(p, () => effecten++, () => effecten++);
  p.db.data.meldingVoorkeur.lid = { facturen: false }; p.save();
  const voor = p.conn.prepare("SELECT v FROM meta WHERE k='ver'").get().v;
  const n = m.notify.alleenMelding('lid', { title: 'Niet gewenst', scope: 'facturen' });
  assert.equal(n.title, 'Niet gewenst');
  assert.deepEqual(p.lees('notifications'), {});
  assert.equal(p.conn.prepare("SELECT v FROM meta WHERE k='ver'").get().v, voor);
  assert.equal(effecten, 0);
});

test('eigen melding behoudt de echte commitfout; zonder commit geen SSE of push', t => {
  const p = proef(t); let effecten = 0;
  const m = meldingPoort(p, () => effecten++, () => effecten++);
  const exec = DatabaseSync.prototype.exec; let faal = true;
  t.mock.method(DatabaseSync.prototype, 'exec', function(sql) {
    if (sql === 'COMMIT' && faal) { faal = false; throw new Error('meldingcommit mislukt'); }
    return exec.call(this, sql);
  });
  assert.throws(() => m.notify.alleenMelding('lid', { title: 'Geen bevestiging' }), /meldingcommit/);
  assert.deepEqual(p.lees('notifications'), {});
  assert.equal(effecten, 0);
  p.db.data.notifications = p.lees('notifications');
  const n = m.notify.alleenMelding('lid', { title: 'Hersteld' });
  assert.deepEqual(p.lees('notifications').lid, [n]);
  assert.equal(effecten, 2);
});

test('eigen melding veroorzaakt geen deelcommit in een bestaande duurzame bundel', async t => {
  const p = proef(t), m = meldingPoort(p, () => {}); let id;
  await p.bijeen(() => {
    id = m.notify.alleenMelding('lid', { title: 'Samen' }).id;
    p.db.data.ander.waarde = 9; p.save();
    assert.deepEqual(p.lees('notifications'), {});
    assert.equal(p.lees('ander').waarde, 1);
  }, { duurzaam: true });
  assert.equal(p.lees('notifications').lid[0].id, id);
  assert.equal(p.lees('ander').waarde, 9);
});

test('factuur bewaart alleen haar domein en gebruikt daarna de eigen meldingsschrijver', t => {
  const p = proef(t), m = meldingPoort(p, () => {});
  p.db.data.facturen = []; p.db.data.factuurTeller = 0; p.save();
  let scans = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { scans++; return { waarde: this.waarde }; } });
  p.db.data.ander.waarde = 2;
  const motor = require('../server/kern/facturatie/motor')({ db: p.db, save: p.save,
    crypto: require('node:crypto'), SOORTEN: ['verkoop'], nu: () => '2026-10-03T12:00:00.000Z',
    scho: (waarde, max) => String(waarde || '').slice(0, max), rond: n => Math.round(n * 100) / 100,
    findSupplier: () => null, publiek: f => f, notify: m.notify,
    sseToCustomer: () => {
      assert.equal(p.lees('facturen').length, 1, 'factuur is vóór haar seintje opgeslagen');
      assert.equal(p.lees('factuurTeller'), 1);
      p.db.data.ander.waarde = 3;
    } });
  const r = motor.boek({ totaal: 24.20, btw: 21, koper: { key: 'lid' },
    verkoperNaam: 'De zaak', verkoperCode: 'AAA', methode: 'rtg', ref: 'bon-1' });
  assert.equal(r.ok, true);
  assert.equal(scans, 0, 'factuur en melding serialiseren geen vreemd domein');
  assert.equal(p.lees('ander').waarde, 1, 'vreemde pending wijzigingen worden niet door de factuur of melding geflusht');
  assert.equal(p.lees('facturen')[0].id, r.factuur.id);
  assert.equal(p.lees('notifications').lid.length, 1);
  assert.equal(p.lees('notifications').lid[0].title, 'Nieuwe factuur');
  assert.equal(motor.factuurBetaald(r.factuur.id, 'AAA', false).ok, true);
  assert.equal(motor.factuurBetaald(r.factuur.id, 'AAA', true).ok, true);
  const voor = p.conn.prepare("SELECT v FROM meta WHERE k='ver'").get().v;
  assert.equal(motor.factuurBetaald(r.factuur.id, 'AAA', true).ongewijzigd, true);
  assert.equal(p.conn.prepare("SELECT v FROM meta WHERE k='ver'").get().v, voor, 'retry geeft geen tweede write');
  assert.equal(p.lees('facturen').length, 1);
  assert.equal(p.lees('notifications').lid.length, 1);
});

function leveranciersMeldingPoort(p, publiceer, save = p.save) {
  return require('../server/opzet/leverancierpoort')({ db: p.db, save,
    crypto: require('node:crypto'), rtgKlok: { datum: () => new Date('2026-10-04T12:00:00Z') },
    busGeef: () => ({ publish: publiceer }), kernGeef: () => ({}) }).notifySupplier;
}

test('eigen leveranciersmelding bewaart vóór SSE alleen haar collectie; gewone en oude save blijven breed', t => {
  const p = proef(t), gezien = [];
  p.db.data.supplierNotifications = { BBB: [{ id: 'ander', title: 'Andere zaak' }] }; p.save();
  const publiceer = (_topic, event) => {
    assert.equal(event.match, 'AAA'); assert.equal(event.event, 'notify');
    assert.equal(p.lees('supplierNotifications').AAA[0].id, event.data.id, 'tweede verbinding ziet commit vóór SSE');
    gezien.push(event);
  };
  const notify = leveranciersMeldingPoort(p, publiceer);
  let scans = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { scans++; return { waarde: this.waarde }; } });
  p.db.data.ander.waarde = 7;
  const eigen = notify.naOpslag('AAA', { title: 'Nieuwe aanvraag' });
  assert.equal(scans, 0); assert.equal(p.lees('ander').waarde, 1);
  assert.deepEqual(p.lees('supplierNotifications').AAA, [eigen]);
  assert.deepEqual(p.lees('supplierNotifications').BBB, [{ id: 'ander', title: 'Andere zaak' }]);
  notify('AAA', { title: 'Gewone ingang' });
  assert.equal(scans, 1); assert.equal(p.lees('ander').waarde, 7);
  p.db.data.ander.waarde = 8;
  const oud = leveranciersMeldingPoort(p, publiceer, () => p.save());
  oud.naOpslag('AAA', { title: 'Opslag zonder selectieve API' });
  assert.equal(scans, 2); assert.equal(p.lees('ander').waarde, 8);
  assert.equal(gezien.length, 3); assert.equal(p.lees('supplierNotifications').AAA.length, 3);
});

test('leveranciersmelding houdt commitfailure gesloten en behoudt de bestaande bundelgrens', async t => {
  const p = proef(t); p.db.data.supplierNotifications = {}; p.save();
  let effecten = 0;
  const notify = leveranciersMeldingPoort(p, () => effecten++);
  const exec = DatabaseSync.prototype.exec; let faal = true;
  t.mock.method(DatabaseSync.prototype, 'exec', function(sql) {
    if (sql === 'COMMIT' && faal) { faal = false; throw new Error('leveranciersmeldingcommit mislukt'); }
    return exec.call(this, sql);
  });
  assert.throws(() => notify.naOpslag('AAA', { title: 'Niet bevestigd' }), /leveranciersmeldingcommit/);
  assert.deepEqual(p.lees('supplierNotifications'), {}); assert.equal(effecten, 0);
  p.db.data.supplierNotifications = p.lees('supplierNotifications');
  const n = notify.naOpslag('AAA', { title: 'Hersteld' });
  assert.deepEqual(p.lees('supplierNotifications').AAA, [n]); assert.equal(effecten, 1);
  await p.bijeen(() => {
    notify.naOpslag('AAA', { title: 'Samen' });
    p.db.data.ander.waarde = 9; p.save();
    assert.deepEqual(p.lees('supplierNotifications').AAA, [n], 'geen voortijdige deelcommit');
    assert.equal(p.lees('ander').waarde, 1);
  }, { duurzaam: true });
  assert.equal(p.lees('supplierNotifications').AAA.length, 2);
  assert.equal(p.lees('ander').waarde, 9);
});

// Alleen de omringende domeindiensten zijn doubles. De twee echte handlers,
// leverancierspoort en SQLite bewaren de bestelling/rit en de melding zelf.
function aanvraagMetMelding(t, soort, oudeMelding = false) {
  const p = proef(t), signalen = [];
  const zaak = { code: 'AAA', name: 'De zaak', type: soort === 'rit' ? 'taxi' : 'restaurant',
    settings: {}, menu: [{ id: 'eten', name: 'Lunch', price: 12, publiekePrijs: 12 }] };
  Object.assign(p.db.data, { suppliers: [zaak], orders: [], rides: [], live: {}, supplierNotifications: {} });
  p.save(); p.db.capsVan = () => ['rides'];
  let scans = 0, breed = 0;
  Object.defineProperty(p.db.data.ander, 'toJSON', { value() { scans++; return { waarde: this.waarde }; } });
  const save = () => {
    p.save(); breed++;
    // Een onafhankelijk domein kan na de eerste commit nog werk hebben.
    // Alleen diens eigen brede save mag die wijziging later publiceren.
    if (breed === 1) p.db.data.ander.waarde = 3;
  };
  save.sleutels = p.save.sleutels;
  const collectie = soort === 'rit' ? 'rides' : 'orders';
  function sein(naam) {
    assert.equal(p.lees(collectie).length, 1, naam + ': domein opgeslagen');
    assert.equal(p.lees('supplierNotifications').AAA.length, 1, naam + ': melding opgeslagen');
    signalen.push(naam);
  }
  const notify = leveranciersMeldingPoort(p, (_topic, event) => {
    assert.equal(event.match, zaak.code); sein('notify');
  }, save);
  const ctx = { db: p.db, save, crypto: require('node:crypto'),
    schoon: (v, n) => String(v ?? '').slice(0, n), PERSONAS: { rtg: { codename: 'Anna' } },
    findSupplier: code => code === zaak.code ? zaak : null, ledenPrijs: (_publiek, prijs) => prijs,
    optieAan: (_s, naam) => naam !== 'betaalVooraf', leeftijdVan: () => 35, geborenVan: () => '1991-01-01',
    idGeverifieerd: () => true, pickupCode: () => '42', zorgVoor: () => null, zorgMee: () => null,
    liveCodename: () => 'Anna', haversine: () => null, openLijnVoor() {},
    ordersVoegToe: order => p.db.data.orders.push(order),
    notifySupplier: oudeMelding ? (code, note) => notify(code, note) : notify,
    sseToSupplier: () => sein('supplier'), sseToOffice: () => sein('office'), pushLive: () => sein('push'),
    fooiUit: () => 0, pasTegoedToe: () => 0, ledenvoordeelVoor: () => 0,
    herstelTegoed() {}, verdienPunten() {}, factuurVoorLid() {},
    pay: { betaalZaak: async () => ({ ok: true, betaaldCenten: 1200, bijgelegdCenten: 0 }) } };
  const actor = { key: 'lid', tier: 'rtg' };
  const plaats = () => soort === 'rit'
    ? require('../server/kern/lidacties/ritten')(ctx).vraagRitVoor(actor, { supplierCode: zaak.code })
    : require('../server/kern/lidacties/bestellen')(ctx).plaatsOrderVoor(actor,
      { supplierCode: zaak.code, items: [{ id: 'eten', qty: 1 }] });
  return { ...p, plaats, ctx, actor, zaak, signalen, collectie, scans: () => scans, breed: () => breed };
}

for (const soort of ['order', 'rit']) {
  test(soort + ': opgeslagen aanvraag gebruikt eigen melding vóór alle SSE/push', t => {
    const p = aanvraagMetMelding(t, soort);
    p.db.data.ander.waarde = 2;
    const r = p.plaats(); assert.equal(r.ok, true);
    assert.equal(p.scans(), 1, 'alleen domeinsave leest de andere collectie');
    assert.equal(p.breed(), 1); assert.equal(p.lees('ander').waarde, 2);
    assert.equal(p.db.data.ander.waarde, 3, 'de later gewijzigde vreemde collectie blijft pending');
    assert.equal(p.lees(p.collectie)[0].ref, (r.order || r.ride).ref);
    assert.deepEqual(p.signalen, soort === 'rit' ? ['notify', 'supplier', 'office', 'push'] : ['notify', 'supplier', 'office']);
  });

  test(soort + ': oude meldingsfunctie zonder naOpslag blijft bruikbaar en breed', t => {
    const p = aanvraagMetMelding(t, soort, true);
    assert.equal(p.plaats().ok, true);
    assert.equal(p.breed(), 2); assert.equal(p.scans(), 2);
    assert.equal(p.lees('ander').waarde, 3);
    assert.equal(p.lees('supplierNotifications').AAA.length, 1);
    assert.ok(p.signalen.includes('notify'));
  });

  test(soort + ': mislukte meldingscommit laat aanvraag staan maar publiceert geen succes', t => {
    const p = aanvraagMetMelding(t, soort), exec = DatabaseSync.prototype.exec; let commits = 0;
    t.mock.method(DatabaseSync.prototype, 'exec', function(sql) {
      if (sql === 'COMMIT' && ++commits === 2) throw new Error('melding na aanvraag mislukt');
      return exec.call(this, sql);
    });
    assert.throws(() => p.plaats(), /melding na aanvraag/);
    assert.equal(commits, 2);
    assert.equal(p.lees(p.collectie).length, 1, 'reeds bevestigde aanvraag wordt niet teruggedraaid');
    assert.deepEqual(p.lees('supplierNotifications'), {}, 'mislukte meldingswrite is teruggerold');
    assert.deepEqual(p.signalen, [], 'geen notify, sync of push na de mislukte commit');
  });
}

test('betaalde order behoudt brede leveranciersmelding voor nog onbehouden keukeninitialisatie', async t => {
  const p = aanvraagMetMelding(t, 'order');
  const order = { ref: 'BETAAL', customerKey: p.actor.key, supplierCode: p.zaak.code,
    supplierName: p.zaak.name, customerCodename: 'Anna', total: 12, paid: false, status: 'nieuw',
    items: [{ id: 'eten', name: 'Lunch', price: 12, qty: 1 }] };
  p.db.data.orders.push(order); p.save();
  assert.equal(p.zaak.recepten, undefined);
  p.ctx.orderMetRef = ref => p.db.data.orders.find(o => o.ref === ref);
  p.ctx.keuken = require('../server/kern/keuken')({ db: p.db, save: p.ctx.save,
    crypto: p.ctx.crypto, schoon: p.ctx.schoon, notifySupplier: p.ctx.notifySupplier }).keuken;
  p.ctx.notifySupplier.naOpslag = () => assert.fail('betaalOrderVoor heeft nog een brede opslaggrens nodig');
  const betaal = require('../server/kern/lidacties/betalen')(p.ctx).betaalOrderVoor;
  assert.equal((await betaal(p.actor, { ref: order.ref })).ok, true);
  assert.equal(p.lees('orders')[0].paid, true);
  assert.deepEqual(p.lees('suppliers')[0].recepten, {}, 'echte keuken initialiseert zonder geboekte voorraadregel of eigen save');
  assert.equal(p.breed(), 2); assert.equal(p.scans(), 3, 'fixture, betaaldomein en brede melding');
  assert.equal(p.lees('ander').waarde, 3);
  assert.deepEqual(p.signalen, ['notify', 'supplier', 'office']);
  assert.equal((await betaal(p.actor, { ref: order.ref })).status, 409);
  assert.equal(p.lees('supplierNotifications').AAA.length, 1, 'retry maakt geen tweede melding');
});
