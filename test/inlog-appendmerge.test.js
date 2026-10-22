'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const keten = require('../server/lib/keten');
const { voegBijzonderSamen: merge } = require('../server/pg/verzoekbijzonder');
const { bewaarLogboek, logboekVoor } = require('../server/kern/leverancier/logboekzicht');
const kopie = x => structuredClone(x);
const regel = (n, staffId) => ({ who: 'Medewerker', text: 'Medewerker logde in', at: String(n), soort: 'klok-inlog', ...(staffId ? { staffId } : {}) });
const audit = (basis, n) => { const v = kopie(basis); keten.noteerIn(v, { at: String(n), kanaal: 'zaak', ok: true, wie: 'AAA', ip: '127.0.0.1' }, 5000); return v; };
const conflict = fn => assert.throws(fn, e => e.code === 'PG_REQUEST_CONFLICT');

test('hashloze legacy-staart blijft exact behouden; nieuwe hashloze audit is geen legacy', () => {
  const b = [{ at: 'oude-a', kanaal: 'zaak', ok: true }, { at: 'oude-b', kanaal: 'office', ok: false }];
  const o = audit(b, 'nieuw-a'), h = audit(b, 'nieuw-b');
  const samen = merge('securityLog', b, o, h);
  assert.deepEqual(samen.slice(2), b);
  assert.equal(keten.verifieer(samen).zonderKeten, 2);
  assert.equal(keten.verifieer(samen).ok, true);
  const gewijzigd = kopie(o); gewijzigd[2].ok = true;
  conflict(() => merge('securityLog', b, gewijzigd, h));
  const vals = [{ at: 'nieuw-hashloos' }, ...o];
  assert.throws(() => merge('securityLog', b, vals, h), e => e.code === 'PG_AUDIT_KETEN_GEBROKEN');
  conflict(() => merge('securityLog', b, [{ at: 'nieuw-hashloos' }, ...b], b));
});

test('twee oude snapshots behouden afzonderlijke auditregels en ongesleutelde activiteiten', () => {
  const b = audit([], 0), o = audit(b, 1), h = audit(b, 2);
  const samen = merge('securityLog', b, o, h);
  assert.deepEqual(samen.map(r => r.at), ['1', '2', '0']);
  assert.equal(keten.verifieer(samen).ok, true);
  assert.deepEqual(samen[2], b[0]);
  const oud = { AAA: [regel(0)], BBB: [regel('andere')] };
  const a = kopie(oud), z = kopie(oud); a.AAA.unshift(regel(1)); z.AAA.unshift(regel(2));
  assert.deepEqual(merge('supplierActivity', oud, a, z), { AAA: [regel(1), regel(2), regel(0)], BBB: oud.BBB });
  assert.deepEqual(oud.AAA, [regel(0)], 'geen invoermutatie');
});

test('gelijke nieuwe inhoud wordt niet weggefilterd of verdubbeld maar geweigerd', () => {
  const b = audit([], 0), o = audit(b, 1);
  conflict(() => merge('securityLog', b, o, kopie(o)));
  const oud = { AAA: [regel(0)] }, nieuw = { AAA: [regel(1), regel(0)] };
  conflict(() => merge('supplierActivity', oud, nieuw, kopie(nieuw)));
  assert.deepEqual(merge('securityLog', b, b, o), o, 'ongewijzigde lokale kant is gewoon synchronisatie');
  assert.deepEqual(merge('supplierActivity', oud, oud, nieuw), nieuw);
});

test('herschreven historie en stille verwijdering blijven gesloten', () => {
  const b = audit(audit([], 'onbekende-datum'), 'recent'), h = audit(b, 'nieuw');
  const nieuwGeketen = audit(audit([], 'vervalst'), 'recent');
  conflict(() => merge('securityLog', b, nieuwGeketen, h));
  conflict(() => merge('securityLog', b, b.slice(0, 1), b));
  const kapot = kopie(h); kapot[0].hash = 'vals';
  assert.throws(() => merge('securityLog', b, kapot, b), e => e.code === 'PG_AUDIT_KETEN_GEBROKEN');
  const oud = { AAA: [regel(1), regel(0)] };
  conflict(() => merge('supplierActivity', oud, { AAA: [regel(2), regel('vervalst')] }, oud));
  conflict(() => merge('supplierActivity', oud, { AAA: [regel(1)] }, oud));
  conflict(() => merge('supplierActivity', oud, {}, { AAA: [regel(2), ...oud.AAA] }));
});

test('hele-zaakopruiming behoudt het bestaande conflictvaste verwijdercontract', () => {
  const b = { AAA: [regel(1)], BBB: [regel(2)] }, weg = { BBB: b.BBB };
  assert.deepEqual(merge('supplierActivity', b, weg, b), weg);
  assert.deepEqual(merge('supplierActivity', b, b, weg), weg);
  assert.deepEqual(merge('supplierActivity', b, weg, weg), weg);
  conflict(() => merge('supplierActivity', b, weg, { ...b, AAA: [regel(3), ...b.AAA] }));
});

test('retentie en zicht gebruiken dezelfde policy zonder pg-naar-domeinimport', () => {
  const gedeeld = require('../server/lib/logboekretentie');
  const domein = require('../server/kern/leverancier/logboekzicht');
  const soorten = require('../server/kern/leverancier/beschermdesoorten');
  assert.equal(gedeeld.bewaarLogboek, domein.bewaarLogboek);
  assert.equal(gedeeld.KLOKSOORTEN, soorten.KLOKSOORTEN);
  assert.equal(gedeeld.OUDE_KLOKTEKST, soorten.OUDE_KLOKTEKST);
  const fs = require('node:fs');
  for (const bestand of ['../server/lib/logboekretentie.js', '../server/pg/verzoekinlog.js'])
    assert.doesNotMatch(fs.readFileSync(require.resolve(bestand), 'utf8'), /require\([^\n]*kern\//);
});

test('bestaande retentie en medewerkersprivacy gelden na de merge', () => {
  const oud = { AAA: [] };
  for (let i = 79; i >= 0; i--) oud.AAA.push(regel(i, 7), regel(i, 8), { who: 'Medewerker', text: 'gewone ' + i, at: String(i) });
  const o = { AAA: bewaarLogboek([regel(80, 7), ...oud.AAA]) };
  const h = { AAA: bewaarLogboek([regel(81, 8), ...oud.AAA]) };
  const samen = merge('supplierActivity', oud, o, h).AAA;
  assert.equal(samen.length, 240);
  assert.equal(samen.filter(r => r.staffId === 7).length, 80);
  assert.equal(samen.filter(r => r.staffId === 8).length, 80);
  const zicht = logboekVoor(samen, { staffId: 7, manager: false }, 1000);
  assert.equal(zicht.totaal, 160);
  assert.equal(zicht.regels.some(r => r.at === '81'), false, 'collegaklok blijft onzichtbaar');
  assert.ok(zicht.regels.every(r => Object.keys(r).join(',') === 'who,text,at'));
  let b = []; for (let i = 0; i < 5000; i++) keten.noteerIn(b, { at: String(i) }, 5000);
  const s = merge('securityLog', b, audit(b, 'a'), audit(b, 'b'));
  assert.equal(s.length, 5000); assert.equal(keten.verifieer(s).ok, true);
  assert.deepEqual(s.slice(2), b.slice(0, 4998));
});

test('tijdretentie volgt bestaand beleid: strikt vóór grens, niet op of na grens', t => {
  const klok = require('../server/lib/klok');
  const { BELEID, DAG } = require('../server/bewaarbeleid');
  const nu = Date.parse('2026-10-23T12:00:00Z');
  t.mock.method(klok, 'nu', () => nu);
  const grens = nu - BELEID.find(r => r.tak === 'securityLog').dagen * DAG;
  const maak = tijd => { const b = []; keten.noteerIn(b, { at: new Date(tijd).toISOString() }, 5000); keten.noteerIn(b, { at: new Date(nu).toISOString() }, 5000); return b; };
  const oud = maak(grens - 1), gesnoeid = oud.slice(0, 1);
  assert.deepEqual(merge('securityLog', oud, gesnoeid, oud), gesnoeid);
  assert.deepEqual(merge('securityLog', oud, oud, gesnoeid), gesnoeid);
  for (const tijd of [grens, grens + 1]) {
    const b = maak(tijd); conflict(() => merge('securityLog', b, b.slice(0, 1), b));
  }
  conflict(() => merge('securityLog', oud, gesnoeid, audit(oud, 'nieuwe-login')));
});

/* De echte requesttransactie met een deterministische transactionele SQL-double.
   Geen netwerk/concurrencyclaim: twee requests lezen exact dezelfde beginstand,
   waarna de echte schrijver beide stale delta's moet verwerken. Een schrijffout
   na securityLog/sessions moet de volledige tweede transactie terugrollen. */
test('één requestcommit bewaart sessies plus beide logs, of rolt alles terug', async () => {
  const basis = { securityLog: audit([], 0), sessions: {}, supplierActivity: { AAA: [regel(0)] } };
  let duurzaam = Object.fromEntries(Object.entries(basis).map(([k, v]) => [k, { val: JSON.stringify(v), ver: 1, weg: false }]));
  let seq = 1, faal = false;
  const client = { async query(sql, args = []) {
    if (sql === 'BEGIN') { this.tx = kopie(duurzaam); return {}; }
    if (sql === 'COMMIT') { duurzaam = this.tx; return {}; }
    if (sql === 'ROLLBACK') { this.tx = null; return {}; }
    if (sql.startsWith('SELECT val,')) return { rows: this.tx[args[0]] ? [this.tx[args[0]]] : [] };
    if (sql.includes("nextval('kv_ver_seq')")) return { rows: [{ v: ++seq }] };
    if (sql.startsWith('INSERT INTO kv')) {
      if (faal && args[0] === 'supplierActivity') throw new Error('geforceerde opslagfout');
      this.tx[args[0]] = { val: args[1], ver: args[2], weg: false };
    }
    return { rows: [] };
  }, release() {} };
  const ctx = { pool: { connect: async () => client }, uitStore: x => x, naarStore: x => x };
  for (const k of ['toegepast', 'laatsteJson', 'laatsteGrootte', 'laatsteLengte', 'laatsteCheck']) ctx[k] = new Map();
  const motor = require('../server/pg/verzoektransactie')(ctx), live = kopie(basis);
  const wijzig = n => {
    const waarde = { securityLog: audit(basis.securityLog, n), sessions: { [n]: { role: 'supplier', code: 'AAA' } }, supplierActivity: { AAA: [regel(n), ...basis.supplierActivity.AAA] } };
    return Object.keys(waarde).map(sleutel => ({ sleutel, basisBestaat: true, basisJson: JSON.stringify(basis[sleutel]), waardeBestaat: true, waardeJson: JSON.stringify(waarde[sleutel]) }));
  };
  await motor.commitVerzoek(live, wijzig(1));
  const voor = kopie(duurzaam), liveVoor = kopie(live); faal = true;
  await assert.rejects(motor.commitVerzoek(live, wijzig(2)), /geforceerde opslagfout/);
  assert.deepEqual(duurzaam, voor); assert.deepEqual(live, liveVoor);
  faal = false; await motor.commitVerzoek(live, wijzig(2));
  assert.deepEqual(Object.keys(live.sessions), ['1', '2']);
  assert.deepEqual(live.securityLog.map(r => r.at), ['2', '1', '0']);
  assert.deepEqual(live.supplierActivity.AAA.map(r => r.at), ['2', '1', '0']);
});
