/* DE RIJOPSLAG VAN DE AUDITJOURNALEN (server/db/audit-sqlite.js).

   Het command-journaal (apiSpoor) en het handelingsspoor (handelingLog) wonen
   niet als blob in de kv-tabel maar als versleutelde rijen in audit_rij, met een
   kop in audit_meta. Deze module is de enige schrijver. De bestaande toetsen
   (test/sqlite-audit-*.test.js) lopen er via de hele opslaglaag doorheen; deze
   toets zet de module LOS op een eigen SQLite-bestand, met een eigen sleutel, en
   doet wat een aanvaller met schrijfrechten op store.db, een kapotte schijf of
   een tweede proces doet.

   Wat hier niet mag sneuvelen:
   1. een rij die in SQL is gewijzigd, verwijderd of ingevoegd, wordt na het
      herlezen door de keten van het command-journaal AANGEWEZEN -- de opslag
      maakt het spoor niet stiller dan het journaal zelf;
   2. een rij die niet te ontsleutelen is (verkeerde sleutel, omgezette bit) of
      geen JSON is, laat het lezen LUID falen en laat de vorige projectie staan
      -- nooit een half gelezen journaal;
   3. migratie (import uit de kv-blob) gebeurt in EEN transactie: faalt het
      versleutelen halverwege, dan blijft de oude blob staan en is er geen halve
      rijopslag; een niet-schrijfbaar proces migreert niet;
   4. na de migratie kan een oude schrijver de kv-blob niet stil terugzetten
      (de trigger weigert);
   5. retentie snoeit de oudste rijen, het totaal blijft het echte totaal, en een
      vervanging laat het totaal nooit dalen;
   6. een vervanging op een verouderde versie wordt geweigerd: een aanroeper met
      een oude kopie overschrijft geen nieuwere toevoeging van een ander proces;
   7. een asynchrone bewerker wordt geweigerd voor er iets geschreven is;
   8. de projectie is alleen-lezen: direct muteren gooit.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - in pasToe() `op.verwacht !== m.versie` vervangen door `false`
     -> "6. een vervanging op een verouderde versie" en "6b. een aanroeper die
        de projectie vervangt" ZAKKEN (RAAK)
   - in open() `transaction(() => { ... });` vervangen door `(() => { ... })();`
     (hetzelfde werk, zonder BEGIN/ROLLBACK)
     -> "3. een migratie die halverwege faalt" ZAKT (RAAK): de eerste twee rijen
        bleven als halve rijopslag staan
   - in leesBinnen() `JSON.parse(tekst);` weggehaald
     -> "2b. een rij die geen JSON is" ZAKT (RAAK): de fout kwam pas buiten de
        snapshot, na de publicatie

   Draai: node --test test/audit-sqlite-weerbaar.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const maakAudit = require('../server/db/audit-sqlite');
const { maakJournaal } = require('../server/kern/command/journaal');

const mappen = [];
test.after(() => { for (const d of mappen) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} } });
function verseDb() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-audit-weerbaar-'));
  mappen.push(d);
  return path.join(d, 'store.db');
}

/* Een eigen sleutel, zoals server/kluis.js: AES-256-GCM met een kop. */
function codec(sleutel) {
  const key = crypto.createHash('sha256').update(sleutel).digest();
  return {
    encode(tekst) {
      const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([c.update(String(tekst), 'utf8'), c.final()]);
      return 'ENC:' + Buffer.concat([iv, c.getAuthTag(), enc]).toString('base64');
    },
    decode(waarde) {
      if (!String(waarde).startsWith('ENC:')) return waarde;
      const buf = Buffer.from(String(waarde).slice(4), 'base64');
      const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
      d.setAuthTag(buf.subarray(12, 28));
      return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
    }
  };
}

function verbinding(bestand) {
  const kv = new DatabaseSync(bestand);
  kv.exec('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, val TEXT, ver INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0)');
  kv.exec('CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER)');
  kv.exec("INSERT INTO meta(k,v) VALUES('ver',0) ON CONFLICT(k) DO NOTHING");
  return kv;
}
/* Een "proces": een eigen verbinding, een eigen db.data en een eigen motor. */
function proces(t, bestand, { data = {}, writable = true, sleutel = 'goede-sleutel', codecOverride } = {}) {
  const kv = verbinding(bestand);
  t.after(() => { try { kv.close(); } catch (e) {} });
  const c = codecOverride || codec(sleutel);
  const db = { data, writable };
  let bumps = 0;
  const audit = maakAudit({ db, kv, decode: c.decode, encode: c.encode, bump: () => { bumps++; } });
  return { kv, db, audit, codec: c, bumps: () => bumps };
}
function transactie(kv, werk) {
  kv.exec('BEGIN IMMEDIATE');
  try { const uit = werk(); kv.exec('COMMIT'); return uit; } catch (e) { try { kv.exec('ROLLBACK'); } catch (x) {} throw e; }
}
/* De poort waarlangs het command-journaal schrijft, zoals server/db/sqlite.js hem bouwt. */
function poort(p, naam = 'apiSpoor') {
  p.audit.open(naam);
  return {
    view: () => p.audit.view(naam),
    append: (maak) => transactie(p.kv, () => p.audit.pasToe({ type: 'append', naam, maak }).resultaat),
    rewrite: (werk) => transactie(p.kv, () => p.audit.pasToe({ type: 'rewrite', naam, werk }).resultaat)
  };
}
const meta = (kv, naam) => kv.prepare('SELECT * FROM audit_meta WHERE naam=?').get(naam);
const rijen = (kv, naam) => kv.prepare('SELECT nr, waarde FROM audit_rij WHERE naam=? ORDER BY nr').all(naam);
/* Wat een schrijvend proces na een wijziging doet: de versie ophogen, zodat
   lezers opnieuw lezen. Een aanvaller die gezien wil worden doet niets anders. */
const versieOp = (kv, naam, epoch) => kv.prepare(`UPDATE audit_meta SET versie=versie+1${epoch ? ',epoch=epoch+1' : ''} WHERE naam=?`).run(naam);

test('1. een in SQL gewijzigde rij wordt na herlezen door de keten aangewezen', (t) => {
  const bestand = verseDb();
  const p = proces(t, bestand);
  const j = maakJournaal({ db: p.db, save: null, crypto, auditOpslag: poort(p) });
  const regels = [j.noteer({ actor: 'lid-1', actie: 'een' }), j.noteer({ actor: 'lid-2', actie: 'twee' }), j.noteer({ actor: 'lid-3', actie: 'drie' })];
  assert.deepEqual(j.controleer(), { heel: true, regels: 3 });
  for (const r of rijen(p.kv, 'apiSpoor')) assert.ok(!r.waarde.includes('lid-'), 'de actor staat niet leesbaar in de rij');

  /* De aanvaller heeft de sleutel: hij ontsleutelt rij 2, verandert de actor en versleutelt opnieuw. */
  const r2 = JSON.parse(p.codec.decode(rijen(p.kv, 'apiSpoor')[1].waarde));
  r2.actor = 'iemand-anders';
  p.kv.prepare('UPDATE audit_rij SET waarde=? WHERE naam=? AND nr=2').run(p.codec.encode(JSON.stringify(r2)), 'apiSpoor');
  versieOp(p.kv, 'apiSpoor', true);
  assert.deepEqual(j.controleer(), { heel: false, bij: regels[1].id, waarom: 'de regel is gewijzigd na het noteren' });
});

test('1b. een in SQL verwijderde of ingevoegde rij wordt aangewezen', (t) => {
  const p = proces(t, verseDb());
  const j = maakJournaal({ db: p.db, save: null, crypto, auditOpslag: poort(p) });
  const regels = [1, 2, 3, 4].map(i => j.noteer({ actor: 'lid-' + i }));
  p.kv.prepare('DELETE FROM audit_rij WHERE naam=? AND nr=2').run('apiSpoor');
  versieOp(p.kv, 'apiSpoor', true);
  assert.equal(j.controleer().bij, regels[2].id, 'de regel na het gat wordt aangewezen');
  assert.equal(j.aantal(), 4, 'en het totaal in de kop telt de weggehaalde rij nog mee');

  const q = proces(t, verseDb());
  const k = maakJournaal({ db: q.db, save: null, crypto, auditOpslag: poort(q) });
  k.noteer({ actor: 'a' }); k.noteer({ actor: 'b' });
  /* Een vervalste rij achteraan, met een verzonnen verwijzing, en de kop netjes bijgewerkt. */
  const vals = { id: 'vals', at: new Date().toISOString(), actor: 'aanvaller', actie: 'toegang', vorig: '0'.repeat(32) };
  vals.zegel = crypto.createHash('sha256').update(JSON.stringify(vals)).digest('hex').slice(0, 32);
  q.kv.prepare('INSERT INTO audit_rij VALUES(?,?,?)').run('apiSpoor', 3, q.codec.encode(JSON.stringify(vals)));
  q.kv.prepare('UPDATE audit_meta SET kop=kop+1, totaal=totaal+1, versie=versie+1 WHERE naam=?').run('apiSpoor');
  assert.deepEqual(k.controleer(), { heel: false, bij: 'vals', waarom: 'de verwijzing naar de vorige regel klopt niet' });
});

test('1c. een wissing via de rijopslag herschrijft atomair en de keten klopt daarna weer', (t) => {
  const p = proces(t, verseDb(), { data: {} });
  const j = maakJournaal({ db: p.db, save: null, crypto, auditOpslag: poort(p) });
  j.noteer({ actor: 'te-wissen' }); j.noteer({ actor: 'blijft' });
  const epoch = meta(p.kv, 'apiSpoor').epoch;
  assert.equal(j.wisActor('te-wissen').geraakt, 1);
  assert.equal(meta(p.kv, 'apiSpoor').epoch, epoch + 1, 'een herschrijving is een nieuw tijdperk: lezers lezen alles opnieuw');
  assert.equal(j.controleer().heel, true);
  assert.equal(j.aantal(), 3);
  const alles = rijen(p.kv, 'apiSpoor').map(r => p.codec.decode(r.waarde)).join('');
  assert.ok(!alles.includes('te-wissen'), 'de gewiste actor staat nergens meer in de rijen');
});

test('2. een verkeerde sleutel of een omgezette bit laat het lezen luid falen', (t) => {
  const bestand = verseDb();
  const a = proces(t, bestand);
  const j = maakJournaal({ db: a.db, save: null, crypto, auditOpslag: poort(a) });
  j.noteer({ actor: 'x' }); j.noteer({ actor: 'y' });

  const b = proces(t, bestand, { sleutel: 'verkeerde-sleutel' });
  assert.throws(() => b.audit.open('apiSpoor'), /authenticate|auth/i, 'met een andere sleutel geen journaal, en ook geen leeg journaal');
  assert.equal(b.audit.beheert('apiSpoor'), false, 'er is niets in de cache gepubliceerd');

  /* Een bit omzetten in rij 2 en de versie ophogen: de lezer van A faalt, en zijn oude projectie blijft staan. */
  const voor = a.audit.view('apiSpoor');
  const r = rijen(a.kv, 'apiSpoor')[1];
  const buf = Buffer.from(r.waarde.slice(4), 'base64'); buf[buf.length - 1] ^= 1;
  a.kv.prepare('UPDATE audit_rij SET waarde=? WHERE naam=? AND nr=2').run('ENC:' + buf.toString('base64'), 'apiSpoor');
  versieOp(a.kv, 'apiSpoor', true);
  assert.throws(() => a.audit.view('apiSpoor'), /auth/i);
  assert.equal(a.db.data.apiSpoor, voor, 'de laatst geldige projectie is niet vervangen door een halve');
  assert.throws(() => j.noteer({ actor: 'z' }), /auth/i, 'een append bovenop een onleesbare kop faalt ook luid');
  assert.equal(meta(a.kv, 'apiSpoor').kop, 2, 'en er is niets bijgeschreven');
  /* De verbinding is niet in een open transactie blijven hangen. */
  assert.doesNotThrow(() => transactie(a.kv, () => 1));
});

test('2b. een rij die geen JSON is faalt binnen de snapshot', (t) => {
  const p = proces(t, verseDb());
  const j = maakJournaal({ db: p.db, save: null, crypto, auditOpslag: poort(p) });
  j.noteer({ actor: 'a' });
  const voor = p.audit.view('apiSpoor');
  p.kv.prepare('INSERT INTO audit_rij VALUES(?,?,?)').run('apiSpoor', 2, p.codec.encode('{"half'));
  p.kv.prepare('UPDATE audit_meta SET kop=2, totaal=2, versie=versie+1 WHERE naam=?').run('apiSpoor');
  assert.throws(() => p.audit.view('apiSpoor'), SyntaxError);
  assert.equal(p.db.data.apiSpoor, voor);
  assert.throws(() => p.audit.view('apiSpoor'), SyntaxError, 'ook bij de volgende lezing: geen stille lege lijst na een eerste fout');
});

test('3. een migratie die halverwege faalt laat de oude blob staan en geen halve rijopslag', (t) => {
  const bestand = verseDb();
  const c = codec('goede-sleutel');
  let teller = 0;
  const brak = { decode: c.decode, encode: (x) => { if (++teller === 3) throw new Error('schijf vol'); return c.encode(x); } };
  const kv = verbinding(bestand);
  const blob = { eigen: 'meta', commandJournaal: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], commandJournaalTotaal: 9 };
  kv.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,1)').run('apiSpoor', c.encode(JSON.stringify(blob)));
  kv.close();
  const p = proces(t, bestand, { codecOverride: brak });
  assert.throws(() => p.audit.open('apiSpoor'), /schijf vol/);
  assert.equal(meta(p.kv, 'apiSpoor'), undefined, 'geen kop');
  assert.equal(rijen(p.kv, 'apiSpoor').length, 0, 'geen halve rijen');
  assert.ok(p.kv.prepare('SELECT 1 FROM kv WHERE key=?').get('apiSpoor'), 'de oude blob staat er nog');
  assert.equal(p.bumps(), 0);

  /* Een volgende poging (schijf weer leeg) migreert alles, in volgorde, met teller en eigen metadata. */
  const q = proces(t, bestand);
  q.audit.open('apiSpoor');
  const v = q.audit.view('apiSpoor');
  assert.deepEqual(v.commandJournaal.map(r => r.id), ['a', 'b', 'c']);
  assert.equal(v.commandJournaalTotaal, 9, 'het totaal van voor de migratie blijft');
  assert.equal(v.eigen, 'meta');
  assert.equal(q.kv.prepare('SELECT 1 FROM kv WHERE key=?').get('apiSpoor'), undefined, 'de blob is pas NA de geslaagde migratie weg');
  assert.equal(q.bumps(), 1);
  assert.equal(q.audit.bestaat('apiSpoor'), true);
});

test('3b. een kapotte blob of een niet-schrijfbaar proces migreert niet', (t) => {
  const bestand = verseDb();
  const kv = verbinding(bestand);
  kv.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,1)').run('handelingLog', '[{"half');
  kv.close();
  const lezer = proces(t, bestand, { writable: false });
  assert.throws(() => lezer.audit.open('handelingLog'), /schrijfbaar proces/);
  assert.equal(lezer.audit.bestaat('handelingLog'), false);
  const schrijver = proces(t, bestand);
  assert.throws(() => schrijver.audit.open('handelingLog'), SyntaxError);
  assert.ok(schrijver.kv.prepare('SELECT 1 FROM kv WHERE key=?').get('handelingLog'), 'de kapotte blob blijft liggen voor onderzoek');
  assert.throws(() => schrijver.audit.open('zomaarIets'), /Onbekend auditjournaal/, 'alleen de twee bekende journalen');
  /* Een lezer mag wel openen wat al gemigreerd is. */
  const derde = proces(t, verseDb(), { data: { handelingLog: [{ pad: '/b' }, { pad: '/a' }] } });
  derde.audit.open('handelingLog');
  const ro = proces(t, derde.kv.location(), { writable: false });
  assert.deepEqual([...ro.audit.view('handelingLog')].map(r => r.pad), ['/b', '/a'], 'nieuwste eerst, net als de bron');
});

test('4. na de migratie weigert de kv-tabel een oude schrijver die de blob terugzet', (t) => {
  const p = proces(t, verseDb(), { data: { apiSpoor: { commandJournaal: [] } } });
  p.audit.open('apiSpoor');
  assert.throws(() => p.kv.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,1)').run('apiSpoor', '{}'), /Auditrijopslag actief/);
  p.kv.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,1)').run('ander', '{}');
  assert.throws(() => p.kv.prepare("UPDATE kv SET key='apiSpoor' WHERE key='ander'").run(), /Auditrijopslag actief/, 'ook niet via een hernoeming');
});

test('5. retentie snoeit de oudste rijen; het totaal blijft het echte totaal', (t) => {
  const p = proces(t, verseDb());
  p.audit.open('apiSpoor');
  const veel = Array.from({ length: 5000 }, (_, i) => ({ id: 'r' + i }));
  transactie(p.kv, () => p.audit.pasToe({ type: 'vervang', naam: 'apiSpoor', verwacht: meta(p.kv, 'apiSpoor').versie,
    waarde: { commandJournaal: veel, commandJournaalTotaal: 7000 } }));
  let top, totaal;
  transactie(p.kv, () => p.audit.pasToe({ type: 'append', naam: 'apiSpoor', maak: (t0, n) => { top = t0; totaal = n; return { id: 'nieuw' }; } }));
  assert.equal(top.id, 'r4999', 'de bewerker krijgt de echte kop');
  assert.equal(totaal, 7000);
  const m = meta(p.kv, 'apiSpoor');
  assert.equal(m.totaal, 7001);
  assert.equal(p.kv.prepare('SELECT COUNT(*) n, MIN(nr) laag FROM audit_rij WHERE naam=?').get('apiSpoor').n, 5000, 'nooit meer dan het maximum');
  const v = p.audit.view('apiSpoor');
  assert.equal(v.commandJournaal.length, 5000);
  assert.equal(v.commandJournaal[0].id, 'r1', 'de oudste is weg');
  assert.equal(v.commandJournaal.at(-1).id, 'nieuw');
  assert.equal(v.commandJournaalTotaal, 7001);
  /* Een vervanging met een lager totaal laat het totaal niet dalen. */
  transactie(p.kv, () => p.audit.pasToe({ type: 'vervang', naam: 'apiSpoor', verwacht: meta(p.kv, 'apiSpoor').versie,
    waarde: { commandJournaal: [], commandJournaalTotaal: 0 } }));
  assert.equal(p.audit.view('apiSpoor').commandJournaalTotaal, 7001, 'wissen of inkorten maakt het verleden niet korter');
});

test('5b. een kopTest slaat ongeschikte koppen over; zonder geschikte kop krijgt de bewerker null', (t) => {
  const p = proces(t, verseDb());
  p.audit.open('handelingLog');
  const append = (maak, kopTest) => transactie(p.kv, () => p.audit.pasToe({ type: 'append', naam: 'handelingLog', maak, kopTest }).resultaat);
  append(() => ({ pad: '/a', hash: 'h1' }));
  append(() => ({ pad: '/b' }));
  let gezien = 'niets';
  append((top) => { gezien = top; return { pad: '/c' }; }, (r) => !!r.hash);
  assert.deepEqual(gezien, { pad: '/a', hash: 'h1' }, 'de laatste rij MET hash, niet de laatste rij');
  append((top) => { gezien = top; return { pad: '/d' }; }, () => false);
  assert.equal(gezien, null);
  assert.deepEqual([...p.audit.view('handelingLog')].map(r => r.pad), ['/d', '/c', '/b', '/a'], 'het handelingsspoor is nieuwste-eerst');
});

test('6. een vervanging op een verouderde versie wordt geweigerd', (t) => {
  const bestand = verseDb();
  const a = proces(t, bestand, { data: {} });
  const b = proces(t, bestand, { data: {} });
  a.audit.open('apiSpoor'); b.audit.open('apiSpoor');
  const verouderd = meta(b.kv, 'apiSpoor').versie;
  transactie(a.kv, () => a.audit.pasToe({ type: 'append', naam: 'apiSpoor', maak: () => ({ id: 'van-a' }) }));
  assert.throws(() => transactie(b.kv, () => b.audit.pasToe({ type: 'vervang', naam: 'apiSpoor', verwacht: verouderd,
    waarde: { commandJournaal: [] } })), /verouderd/);
  assert.deepEqual(b.audit.view('apiSpoor').commandJournaal.map(r => r.id), ['van-a'], 'de toevoeging van A is niet overschreven');
  assert.throws(() => b.audit.pasToe({ type: 'append', naam: 'handelingLog', maak: () => ({}) }), /niet geopend/);
});

test('6b. een aanroeper die de projectie vervangt terwijl een ander proces toevoegt: de vervanging is verouderd', (t) => {
  const bestand = verseDb();
  const a = proces(t, bestand, { data: {} });
  const b = proces(t, bestand, { data: {} });
  a.audit.open('apiSpoor'); b.audit.open('apiSpoor');
  transactie(a.kv, () => a.audit.pasToe({ type: 'append', naam: 'apiSpoor', maak: () => ({ id: 'eerste' }) }));
  b.audit.view('apiSpoor');
  /* B vervangt zijn projectie (bv. een retentierapport) ... */
  b.db.data.apiSpoor = { commandJournaal: [], commandJournaalTotaal: 1 };
  /* ... terwijl A nog een regel toevoegt, die B daarna ziet. */
  transactie(a.kv, () => a.audit.pasToe({ type: 'append', naam: 'apiSpoor', maak: () => ({ id: 'tweede' }) }));
  b.audit.view('apiSpoor');
  assert.deepEqual(b.db.data.apiSpoor.commandJournaal, [], 'de werkkopie van B is niet stil overschreven');
  const ops = b.audit.vervangingen(b.db.data);
  assert.equal(ops.length, 1);
  assert.throws(() => transactie(b.kv, () => b.audit.pasToe(ops[0])), /verouderd/,
    'een vervanging op de versie die B zag, gooit de regel van A niet weg');
  assert.equal(meta(a.kv, 'apiSpoor').kop, 2);
});

test('6c. vervangingen: een gelijke kopie wordt teruggekoppeld, een andere inhoud wordt een vervanging', (t) => {
  const p = proces(t, verseDb(), { data: {} });
  p.audit.open('handelingLog');
  transactie(p.kv, () => p.audit.pasToe({ type: 'append', naam: 'handelingLog', maak: () => ({ pad: '/a' }) }));
  const v = p.audit.view('handelingLog');
  assert.equal(p.audit.bezit(p.db.data, 'handelingLog'), true);
  assert.deepEqual(p.audit.vervangingen(p.db.data), [], 'de eigen projectie is geen vervanging');
  p.db.data.handelingLog = [{ pad: '/a' }];
  assert.deepEqual(p.audit.vervangingen(p.db.data), [], 'een gelijke kopie ook niet');
  assert.equal(p.db.data.handelingLog, v, 'die wordt teruggekoppeld aan de projectie');
  p.db.data.handelingLog = [{ pad: '/b' }];
  const [op] = p.audit.vervangingen(p.db.data);
  assert.equal(op.type, 'vervang');
  assert.equal(op.verwacht, meta(p.kv, 'handelingLog').versie);
  transactie(p.kv, () => p.audit.pasToe(op));
  assert.deepEqual([...p.audit.view('handelingLog')].map(r => r.pad), ['/b']);
  delete p.db.data.handelingLog;
  const [leeg] = p.audit.vervangingen(p.db.data);
  assert.deepEqual(leeg.waarde, [], 'een verdwenen collectie wordt een lege vervanging, geen stille terugkeer');
  assert.equal(p.audit.bezit({ handelingLog: [] }, 'apiSpoor'), false);
});

test('7. een asynchrone bewerker wordt geweigerd voor er iets geschreven is', async (t) => {
  const p = proces(t, verseDb());
  p.audit.open('apiSpoor');
  const kop = meta(p.kv, 'apiSpoor');
  assert.throws(() => transactie(p.kv, () => p.audit.pasToe({ type: 'append', naam: 'apiSpoor', maak: async () => ({ id: 'x' }) })), /synchroon/);
  assert.throws(() => transactie(p.kv, () => p.audit.pasToe({ type: 'rewrite', naam: 'apiSpoor', werk: async () => ({}) })), /synchroon/);
  assert.deepEqual(meta(p.kv, 'apiSpoor'), kop, 'de kop is ongemoeid');
  assert.equal(rijen(p.kv, 'apiSpoor').length, 0);
  const doos = { open: true };
  assert.throws(() => p.audit.stage(doos, { type: 'rewrite', naam: 'apiSpoor', werk: async () => ({}), resultaat: {} }), /synchroon/);
  await Promise.resolve();
});

test('8. de projectie is alleen-lezen: muteren, verwijderen of herdefinieren gooit', (t) => {
  const p = proces(t, verseDb(), { data: {} });
  const j = maakJournaal({ db: p.db, save: null, crypto, auditOpslag: poort(p) });
  j.noteer({ actor: 'a' });
  const v = p.audit.view('apiSpoor');
  assert.throws(() => { v.commandJournaal[0].actor = 'b'; }, /alleen leesbaar/);
  assert.throws(() => { delete v.commandJournaal[0].actor; }, /alleen leesbaar/);
  assert.throws(() => { v.commandJournaal.push({}); }, /alleen leesbaar/);
  assert.throws(() => Object.defineProperty(v, 'x', { value: 1 }), /alleen leesbaar/);
  assert.throws(() => Object.setPrototypeOf(v, null), /alleen leesbaar/);
  assert.throws(() => Object.preventExtensions(v), /alleen leesbaar/);
  assert.equal(Object.getOwnPropertyDescriptor(v.commandJournaal, '0').value.actor, 'a');
  assert.equal(j.controleer().heel, true);
});

test('9. een tweede proces ziet toevoegingen incrementeel en een herschrijving volledig', (t) => {
  const bestand = verseDb();
  const a = proces(t, bestand, { data: {} });
  const b = proces(t, bestand, { data: {} });
  a.audit.open('apiSpoor'); b.audit.open('apiSpoor');
  const ja = maakJournaal({ db: a.db, save: null, crypto, auditOpslag: poort(a) });
  const jb = maakJournaal({ db: b.db, save: null, crypto, auditOpslag: poort(b) });
  for (let i = 0; i < 300; i++) ja.noteer({ actor: i % 2 ? 'oneven' : 'even', actie: 'tik ' + i });
  assert.equal(jb.venster(), 300, 'B leest de 300 regels van A (over meer dan een pagina)');
  const r = jb.noteer({ actor: 'van-b' });
  assert.equal(r.vorig, b.audit.view('apiSpoor').commandJournaal[299].zegel, 'B hangt aan de kop van A');
  assert.equal(ja.venster(), 301);
  assert.equal(ja.controleer().heel, true);
  ja.wisActor('oneven');
  assert.equal(jb.controleer().heel, true, 'na de herschrijving van A leest B alles opnieuw en klopt de keten');
  assert.equal(jb.recent(400, { actor: 'oneven' }).length, 0);
  assert.equal(jb.aantal(), 302);
  /* Wat B vasthoudt is een momentopname: een oude rij behoudt haar identiteit zolang hij haar vasthoudt. */
  const rij0 = b.audit.view('apiSpoor').commandJournaal[0];
  assert.equal(b.audit.view('apiSpoor').commandJournaal[0], rij0);
});

test('10. een bundel: voorlopige regels zijn alleen in de doos te zien en worden pas na commit gepubliceerd', (t) => {
  const p = proces(t, verseDb(), { data: {} });
  p.audit.open('apiSpoor'); p.audit.open('handelingLog');
  const doos = { open: true, committen: true };
  p.audit.context(() => doos);
  assert.equal(p.audit.doos(), doos);
  const resA = {}, resH = {};
  p.audit.stage(doos, { type: 'append', naam: 'apiSpoor', maak: (top, n) => ({ id: 'a' + n }), resultaat: resA });
  p.audit.stage(doos, { type: 'append', naam: 'handelingLog', maak: () => ({ pad: '/h' }), resultaat: resH });
  p.audit.stage(doos, { type: 'rewrite', naam: 'apiSpoor', werk: (w) => ({ lengte: w.commandJournaal.length }), resultaat: {} });
  assert.equal(p.audit.view('apiSpoor').commandJournaal.length, 1, 'in de doos is de voorlopige regel te zien');
  assert.equal(meta(p.kv, 'apiSpoor').kop, 0, 'maar hij staat nog niet in de opslag');
  assert.equal(p.db.data.apiSpoor.commandJournaal.length, 0, 'en niet in de gedeelde projectie');
  assert.deepEqual(resA, { id: 'a0' }, 'het resultaat is voorlopig gepubliceerd in het eigen object');
  assert.throws(() => p.audit.stage(doos, { type: 'append', naam: 'apiSpoor', maak: () => ({}), resultaat: new Proxy({}, {}) }), /gewoon schrijfbaar/,
    'een resultaatobject met een eigen val wordt geweigerd');
  assert.throws(() => p.audit.stage(doos, { type: 'append', naam: 'apiSpoor', maak: () => ({ id: 2 }), resultaat: Object.freeze({ id: 1 }) }), /niet-schrijfbaar/);
  /* Commit: de ops worden toegepast, publicaties voorbereid VOOR de commit, gepubliceerd erna. */
  const ops = doos.auditOps.slice(0, 3);
  let voorbereid, results;
  transactie(p.kv, () => { results = ops.map(op => p.audit.pasToe(op)); voorbereid = p.audit.publicaties(results); });
  p.audit.naCommit(results, doos, voorbereid);
  assert.equal(doos.auditOps.length, 0, 'de doos is leeg na de commit');
  assert.equal(meta(p.kv, 'apiSpoor').kop, 1);
  assert.equal(p.db.data.apiSpoor.commandJournaal[0].id, 'a0');
  assert.equal(p.db.data.handelingLog[0].pad, '/h');
  doos.open = false;
  assert.equal(p.audit.view('apiSpoor').commandJournaal.length, 1);
  p.audit.context(() => ({ open: false }));
  assert.equal(p.audit.doos(), null, 'zonder commitbundel geen doos');
});

test('11. laden, momentopnamen en de poll nemen de projectie uit EEN snapshot over', (t) => {
  const bestand = verseDb();
  const a = proces(t, bestand, { data: {} });
  a.audit.open('apiSpoor'); a.audit.open('handelingLog');
  transactie(a.kv, () => a.audit.pasToe({ type: 'append', naam: 'handelingLog', maak: () => ({ pad: '/x' }) }));
  const b = proces(t, bestand, { data: {} });
  const snaps = b.audit.snapshots();
  assert.deepEqual(snaps.map(([n]) => n).sort(), ['apiSpoor', 'handelingLog']);
  const data = b.audit.laad({}, snaps);
  assert.deepEqual([...data.handelingLog].map(r => r.pad), ['/x']);
  assert.equal(b.audit.beheert('handelingLog'), true);
  b.db.data = data;
  transactie(a.kv, () => a.audit.pasToe({ type: 'append', naam: 'handelingLog', maak: () => ({ pad: '/y' }) }));
  b.audit.poll();
  assert.deepEqual([...b.db.data.handelingLog].map(r => r.pad), ['/y', '/x'], 'de poll neemt de nieuwe regel van A over');
  b.audit.publiceerSnapshots([['apiSpoor', null]]);
  assert.ok(b.db.data.apiSpoor, 'een lege momentopname wist niets');
});

test('12. terug naar de kv-blob (downgrade): alles of niets, en een onleesbare rij laat de rijopslag staan', (t) => {
  const { materialiseer } = require('../server/db/audit-compat');
  const bestand = verseDb();
  const p = proces(t, bestand, { data: { apiSpoor: { eigen: 'meta' } } });
  const kluis = { ontsleutel: p.codec.decode, versleutel: p.codec.encode };
  const j = maakJournaal({ db: p.db, save: null, crypto, auditOpslag: poort(p) });
  j.noteer({ actor: 'a' }); j.noteer({ actor: 'b' });
  p.audit.open('handelingLog');
  transactie(p.kv, () => p.audit.pasToe({ type: 'append', naam: 'handelingLog', maak: () => ({ pad: '/oud' }) }));
  transactie(p.kv, () => p.audit.pasToe({ type: 'append', naam: 'handelingLog', maak: () => ({ pad: '/nieuw' }) }));

  /* Een rij die niet te ontsleutelen is: de downgrade faalt, en NIETS is veranderd. */
  const goed = rijen(p.kv, 'handelingLog')[0].waarde;
  p.kv.prepare("UPDATE audit_rij SET waarde='ENC:AAAA' WHERE naam='handelingLog' AND nr=1").run();
  assert.throws(() => materialiseer(p.kv, kluis));
  assert.ok(meta(p.kv, 'apiSpoor'), 'de rijopslag staat er nog');
  assert.throws(() => p.kv.prepare('INSERT INTO kv(key,val,ver) VALUES(?,?,1)').run('apiSpoor', '{}'), /Auditrijopslag actief/,
    'en de trigger die oude schrijvers tegenhoudt ook');
  assert.equal(p.kv.prepare("SELECT v FROM meta WHERE k='ver'").get().v, 0, 'de versieteller is niet opgehoogd');

  p.kv.prepare("UPDATE audit_rij SET waarde=? WHERE naam='handelingLog' AND nr=1").run(goed);
  assert.deepEqual(materialiseer(p.kv, kluis), { collecties: 2, regels: 4 });
  const blob = (k) => JSON.parse(p.codec.decode(p.kv.prepare('SELECT val FROM kv WHERE key=?').get(k).val));
  assert.deepEqual(blob('handelingLog').map(r => r.pad), ['/nieuw', '/oud'], 'het handelingsspoor weer nieuwste-eerst, zoals de oude release het leest');
  const spoor = blob('apiSpoor');
  assert.equal(spoor.eigen, 'meta');
  assert.equal(spoor.commandJournaalTotaal, 2);
  assert.deepEqual(spoor.commandJournaal.map(r => r.actor), ['a', 'b']);
  assert.ok(!p.kv.prepare('SELECT val FROM kv WHERE key=?').get('apiSpoor').val.includes('"a"'), 'de blob is weer versleuteld');
  /* De keten is na de terugweg nog steeds te controleren. */
  const vak = { ...spoor, commandJournaal: spoor.commandJournaal.map(r => ({ ...r })) };
  assert.equal(maakJournaal({ db: {}, save: null, crypto, vak: () => vak }).controleer().heel, true);
  assert.equal(p.kv.prepare("SELECT 1 FROM sqlite_master WHERE name='audit_meta'").get(), undefined);
  assert.deepEqual(materialiseer(p.kv, kluis), { collecties: 0, regels: 0 }, 'een tweede keer is er niets meer te doen');
});
