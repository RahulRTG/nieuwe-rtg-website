/* HET SESSIEREGISTER TAK VOOR TAK (server/kern/identiteit/sessieregister.js).

   Wat dit bestand vasthoudt: een ongeldige of onbekende sid opent, vult,
   leest, raakt en sluit niets; een register zonder lidsleutel bewaart null;
   aanvullen met dezelfde graad of hoger mag, verzwakken niet, en een ander
   anker (sleutel of toestel) wordt alles-of-niets geweigerd; lezen ruimt een
   rij op die over de termijn is; raken schrijft hoogstens eens per uur; het
   vangnet per lid laat de oudste wijken; wissen van een lid neemt al zijn rijen
   mee, ook die over de termijn. De tijd wordt verzet door het opgeslagen
   gezienOp terug te zetten, niet door de klok. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { maakSessieregister, REGISTER_TTL_MS } = require('../server/kern/identiteit/sessieregister');

const hk = (methode) => ({ bron: 'toets', methode, vastgesteldOp: new Date().toISOString(), regelversie: 'v1' });
const SID = 'abcdefABCDEF';
const sid = (n) => ('s' + String(n).padStart(11, '0')).slice(0, 12);
const SLEUTEL_A = 'a'.repeat(32), SLEUTEL_B = 'b'.repeat(32);

function opzet({ metSleutels = false } = {}) {
  const db = { data: {} };
  const bewaard = [];
  const save = () => bewaard.push('alles');
  if (metSleutels) save.sleutels = (s) => bewaard.push(s.join(','));
  return { r: maakSessieregister({ db, save }), db, bewaard };
}
const terug = (db, s, ms) => { db.data.sessiecontext[s].gezienOp = new Date(Date.now() - ms).toISOString(); };

test('open: een ongeldige sid wordt geweigerd en schrijft niets', () => {
  const { r, bewaard } = opzet();
  for (const fout of ['kort', 'a'.repeat(13), 'abc def ghij', 12, null])
    assert.deepEqual(r.open(fout, 'user-1', {}), { ok: false, reden: 'geen geldige sid' });
  assert.equal(bewaard.length, 0);
});

test('open: zonder lidsleutel en zonder context, en via save.sleutels', () => {
  const { r, db, bewaard } = opzet({ metSleutels: true });
  const uit = r.open(SID, '', undefined);
  assert.equal(uit.ok, true);
  assert.equal(uit.sid, SID);
  assert.equal(db.data.sessiecontext[SID].lidKey, null);
  assert.deepEqual(db.data.sessiecontext[SID].context, {});
  assert.deepEqual(bewaard, ['sessiecontext'], 'alleen de eigen collectie wordt bewaard');
});

test('open: een geweigerde claim komt terug met zijn reden', () => {
  const { r } = opzet();
  const uit = r.open(SID, 'user-1', { toestel: { toestelId: 't1' } });
  assert.equal(uit.ok, true);
  assert.equal(uit.geweigerd.length, 1);
  assert.match(uit.geweigerd[0].reden, /herkomst/);
});

test('vul: ongeldige of onbekende sid', () => {
  const { r } = opzet();
  assert.deepEqual(r.vul('x', {}), { ok: false, reden: 'onbekende sessie' });
  assert.deepEqual(r.vul(SID, {}), { ok: false, reden: 'onbekende sessie' });
});

test('vul: een nieuwe claim komt erbij, zonder context verandert er niets', () => {
  const { r, db } = opzet();
  r.open(SID, 'user-1', {});
  const leeg = r.vul(SID);
  assert.equal(leeg.ok, true);
  assert.deepEqual(db.data.sessiecontext[SID].context, {});
  const uit = r.vul(SID, { toestel: { toestelId: 't1', herkomst: hk('gemeten') } });
  assert.equal(uit.ok, true);
  assert.equal(db.data.sessiecontext[SID].context.toestel.toestelId, 't1');
});

test('vul: verzwakken wordt afgewezen, versterken en gelijk blijven mag', () => {
  const { r, db } = opzet();
  r.open(SID, 'user-1', { authenticator: { type: 'wachtwoord', herkomst: hk('gemeten') } });
  const zwakker = r.vul(SID, { authenticator: { type: 'wachtwoord', herkomst: hk('opgegeven') } });
  assert.equal(zwakker.ok, true);
  assert.equal(zwakker.geweigerd.length, 1);
  assert.match(zwakker.geweigerd[0].reden, /verzwakken/);
  assert.equal(db.data.sessiecontext[SID].context.authenticator.herkomst.methode, 'gemeten');
  const sterker = r.vul(SID, { authenticator: { type: 'passkey', herkomst: hk('cryptografisch') } });
  assert.equal(sterker.ok, true);
  assert.equal(db.data.sessiecontext[SID].context.authenticator.type, 'passkey');
});

test('vul: een ander anker wordt alles-of-niets geweigerd, hetzelfde anker mag', () => {
  const { r, db } = opzet();
  r.open(SID, 'user-1', { sleutelbinding: { keyRef: SLEUTEL_A, schema: 's1', herkomst: hk('cryptografisch') } });
  const dief = r.vul(SID, {
    sleutelbinding: { keyRef: SLEUTEL_B, schema: 's1', herkomst: hk('cryptografisch') },
    toestel: { toestelId: 'dief', herkomst: hk('cryptografisch') }
  });
  assert.equal(dief.ok, false);
  assert.equal(dief.reden, 'herbinding');
  assert.equal(dief.geweigerd.filter(g => g.veld === 'sleutelbinding').length, 1);
  assert.equal(db.data.sessiecontext[SID].context.sleutelbinding.keyRef, SLEUTEL_A);
  assert.equal(db.data.sessiecontext[SID].context.toestel, undefined, 'ook het toestel is niet geschreven');
  const zelfde = r.vul(SID, { sleutelbinding: { keyRef: SLEUTEL_A, schema: 's2', herkomst: hk('cryptografisch') } });
  assert.equal(zelfde.ok, true);
  assert.equal(db.data.sessiecontext[SID].context.sleutelbinding.schema, 's2');
});

test('lees: ongeldig, onbekend, binnen en over de termijn', () => {
  const { r, db } = opzet();
  assert.equal(r.lees('nee'), null);
  assert.equal(r.lees(SID), null);
  r.open(SID, 'user-1', {});
  assert.equal(r.lees(SID).lidKey, 'user-1');
  terug(db, SID, REGISTER_TTL_MS + 1000);
  assert.equal(r.lees(SID), null);
  assert.equal(SID in db.data.sessiecontext, false, 'een verlopen rij wordt meteen opgeruimd');
});

test('lees: een rij zonder gezienOp geldt als verlopen', () => {
  const { r, db } = opzet();
  r.open(SID, 'user-1', {});
  delete db.data.sessiecontext[SID].gezienOp;
  assert.equal(r.lees(SID), null);
});

test('raak: hoogstens eens per uur een nieuw venster', () => {
  const { r, db, bewaard } = opzet();
  assert.equal(r.raak('x'), false);
  assert.equal(r.raak(SID), false);
  r.open(SID, 'user-1', {});
  const voor = bewaard.length;
  assert.equal(r.raak(SID), false, 'net geopend: niets te schrijven');
  assert.equal(bewaard.length, voor);
  terug(db, SID, 2 * 3600 * 1000);
  const oud = db.data.sessiecontext[SID].gezienOp;
  assert.equal(r.raak(SID), true);
  assert.notEqual(db.data.sessiecontext[SID].gezienOp, oud);
  assert.equal(bewaard.length, voor + 1);
});

test('sluit: ongeldig, onbekend en bestaand', () => {
  const { r, db } = opzet();
  assert.equal(r.sluit('x'), false);
  assert.equal(r.sluit(SID), false);
  r.open(SID, 'user-1', {});
  assert.equal(r.sluit(SID), true);
  assert.equal(SID in db.data.sessiecontext, false);
  assert.equal(r.sluit(SID), false);
});

test('vangnet per lid: boven het maximum wijkt de oudste, nooit de nieuwste', () => {
  const { r, db } = opzet();
  for (let i = 0; i < r.MAX_PER_LID; i++) {
    r.open(sid(i), 'user-1', {});
    db.data.sessiecontext[sid(i)].gezienOp = new Date(Date.now() - (r.MAX_PER_LID - i) * 1000).toISOString();
  }
  r.open(sid(999), 'user-2', {});
  assert.equal(Object.keys(db.data.sessiecontext).length, r.MAX_PER_LID + 1);
  r.open(sid(500), 'user-1', {});
  const van1 = Object.entries(db.data.sessiecontext).filter(([, x]) => x.lidKey === 'user-1').map(([s]) => s);
  assert.equal(van1.length, r.MAX_PER_LID);
  assert.ok(!van1.includes(sid(0)), 'de oudste is weg');
  assert.ok(van1.includes(sid(500)), 'de zojuist geopende blijft');
  assert.ok(van1.includes(sid(1)));
  assert.ok(sid(999) in db.data.sessiecontext, 'een ander lid wordt niet geraakt');
});

test('wisLid: zonder sleutel niets, anders al zijn rijen, ook die over de termijn', () => {
  const { r, db, bewaard } = opzet();
  assert.equal(r.wisLid(''), 0);
  assert.equal(r.wisLid('user-9'), 0);
  r.open(sid(1), 'user-1', {});
  r.open(sid(2), 'user-1', {});
  r.open(sid(3), 'user-2', {});
  terug(db, sid(2), REGISTER_TTL_MS * 2);
  const voor = bewaard.length;
  assert.equal(r.wisLid('user-9'), 0);
  assert.equal(bewaard.length, voor, 'niets gewist, niets bewaard');
  assert.equal(r.wisLid('user-1'), 2);
  assert.equal(bewaard.length, voor + 1);
  assert.deepEqual(Object.keys(db.data.sessiecontext), [sid(3)]);
});

test('vanLid: de projectie leest de huidige stand', () => {
  const { r } = opzet();
  r.open(sid(1), 'user-1', {});
  r.open(sid(2), 'user-2', {});
  const lijst = r.vanLid('user-1');
  assert.equal(Array.isArray(lijst) ? lijst.length : Object.keys(lijst).length, 1);
});
