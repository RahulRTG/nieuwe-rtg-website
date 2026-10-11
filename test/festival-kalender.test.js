'use strict';
/* De kalender van RTG Festival (server/kern/festival/model.js): festival,
   editie en dag, met alle weigeringen.

   test/festival.test.js bewijst wat er over middernacht heen moet kloppen. Wat
   daar niet werd beproefd zijn de deuren ervoor: een festival zonder naam of
   zonder eigenaar, een editie buiten een redelijk jaar, een dag met een
   onleesbare tijd, een dubbele datum, de dertigste dag, en wat de publieke vorm
   wel en niet meegeeft. Elke weigering hoort een status en een reden te dragen,
   en geen weigering mag iets halfs achterlaten. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { schoon } = require('../server/kern/util');
const maakFestival = require('../server/kern/festival');
const model = require('../server/kern/festival/model');

function wereld() {
  let bewaard = 0;
  const db = { data: {} };
  const k = maakFestival({ db, save() { bewaard++; }, crypto, schoon });
  return { k, db, bewaard: () => bewaard };
}

test('1. een festival vraagt een naam en een eigenaar, en de eigenaar is een verwijzing', () => {
  const { k, bewaard } = wereld();
  assert.equal(k.festivalNieuw('ZAAK1', {}).status, 400);
  assert.equal(k.festivalNieuw('ZAAK1').status, 400);
  assert.equal(k.festivalNieuw('', { naam: 'Testival' }).status, 400);
  assert.equal(bewaard(), 0);
  const r = k.festivalNieuw('ZAAK1', { naam: 'Testival' });
  assert.equal(r.ok, true);
  assert.match(r.festival.id, /^fes[0-9a-f]{8}$/);
  assert.deepEqual(r.festival, { id: r.festival.id, naam: 'Testival', eigenaar: 'ZAAK1', edities: [] });
  assert.equal(k.festivalVind(r.festival.id).naam, 'Testival');
  assert.equal(k.festivalVind('bestaat-niet'), null);
  assert.equal(k.festivalVind(undefined), null);
  assert.equal(k.festivalAlle().length, 1);
});

test('2. een editie hangt aan een festival en draagt een geldig jaar', () => {
  const { k } = wereld();
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  assert.equal(k.editieNieuw('fes-weg', { jaar: 2027 }).status, 404);
  for (const jaar of [1999, 2101, 'volgend jaar', undefined]) assert.equal(k.editieNieuw(fid, { jaar }).status, 400, String(jaar));
  const zonderNaam = k.editieNieuw(fid, { jaar: '2027' });
  assert.equal(zonderNaam.editie.naam, 'Testival');
  assert.equal(zonderNaam.editie.jaar, 2027);
  const metNaam = k.editieNieuw(fid, { jaar: 2028, naam: 'Jubileum' });
  assert.equal(metNaam.editie.naam, 'Jubileum');
  assert.deepEqual(Object.keys(metNaam.editie).sort(), ['dagen', 'id', 'jaar', 'naam', 'passen', 'plekken']);
  assert.equal(k.publiekFestival(k.festivalVind(fid)).edities.length, 2);
  assert.equal(k.editieVind(fid, 'ed-weg'), null);
  assert.equal(k.editieVind('fes-weg', metNaam.editie.id), null);
});

test('3. een dag vraagt een datum, twee tijden die verschillen, en een curfew binnen de dag', () => {
  const { k } = wereld();
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  const dag = (d) => k.dagZet(fid, eid, Object.assign({ datum: '2027-07-03', open: '12:00', sluit: '02:00' }, d));

  assert.equal(k.dagZet(fid, 'ed-weg', {}).status, 404);
  assert.match(k.dagZet(fid, eid).error, /jjjj-mm-dd/);
  assert.match(dag({ datum: '3 juli' }).error, /jjjj-mm-dd/);
  assert.match(dag({ open: '24:00' }).error, /uu:mm/);
  assert.match(dag({ sluit: '2:00' }).error, /uu:mm/);
  assert.match(dag({ sluit: '12:00' }).error, /niet gelijk/);
  assert.match(dag({ curfew: '1u' }).error, /curfew als uu:mm/);
  assert.match(dag({ curfew: '10:00' }).error, /buiten de openingstijden/);

  const goed = dag({ curfew: '01:00' });
  assert.equal(goed.ok, true);
  assert.equal(goed.dag.curfew, '01:00');
  assert.equal(dag({}).status, 409);
  const zonderCurfew = dag({ datum: '2027-07-02', curfew: '' });
  assert.equal(zonderCurfew.dag.curfew, null);

  // de dagen staan op datum, ook als ze in een andere volgorde binnenkomen
  assert.deepEqual(k.editieVind(fid, eid).dagen.map((d) => d.datum), ['2027-07-02', '2027-07-03']);
  assert.equal(k.dagVind(k.editieVind(fid, eid), goed.dag.id).id, goed.dag.id);
  assert.equal(k.dagVind(k.editieVind(fid, eid), 'dag-weg'), null);
  assert.equal(k.dagVind(null, goed.dag.id), null);
});

test('4. een editie kent ten hoogste dertig dagen', () => {
  const { k } = wereld();
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  for (let i = 1; i <= 30; i++) {
    const datum = '2027-06-' + String(i).padStart(2, '0');
    assert.equal(k.dagZet(fid, eid, { datum, open: '10:00', sluit: '22:00' }).ok, true, datum);
  }
  assert.match(k.dagZet(fid, eid, { datum: '2027-07-01', open: '10:00', sluit: '22:00' }).error, /dertig/);
});

test('5. welke dag hoort bij een moment: precies een, of geen', () => {
  const { k } = wereld();
  const fid = k.festivalNieuw('ZAAK1', { naam: 'Testival' }).festival.id;
  const eid = k.editieNieuw(fid, { jaar: 2027 }).editie.id;
  k.dagZet(fid, eid, { datum: '2027-07-03', open: '12:00', sluit: '02:00' });
  k.dagZet(fid, eid, { datum: '2027-07-04', open: '12:00', sluit: '02:00' });
  const e = k.editieVind(fid, eid);
  assert.equal(k.dagOpMoment(e, '2027-07-04', '01:12').datum, '2027-07-03');
  assert.equal(k.dagOpMoment(e, '2027-07-04', '13:00').datum, '2027-07-04');
  assert.equal(k.dagOpMoment(e, '2027-07-04', '05:00'), null);
  assert.equal(k.dagOpMoment(null, '2027-07-04', '13:00'), null);
  assert.equal(k.dagOpMoment({}, '2027-07-04', '13:00'), null);
});

test('6. de rekenhulpen weigeren wat ze niet kunnen lezen in plaats van te gokken', () => {
  const dag = { datum: '2027-07-03', open: '12:00', sluit: '02:00' };
  assert.equal(model.offset(dag, '13:00'), 60);
  assert.equal(model.offset(dag, '02:00'), 840);
  assert.equal(model.offset(dag, '03:00'), null);
  assert.equal(model.offset(null, '13:00'), null);
  assert.equal(model.offset(dag, '25:00'), null);
  assert.equal(model.offset(dag, undefined), null);
  assert.equal(model.momentOffset(dag, '2027-07-04', '01:12'), 792);
  assert.equal(model.momentOffset(dag, '2027-07-02', '13:00'), null);
  assert.equal(model.momentOffset(dag, 'gisteren', '13:00'), null);
  assert.equal(model.momentOffset(dag, '2027-07-03', 'nu'), null);
  assert.equal(model.momentOffset(null, '2027-07-03', '13:00'), null);
  assert.equal(model.duurVan(dag), 840);
  assert.equal(model.duurVan(null), 0);
  assert.equal(model.duurVan({ open: '09:00', sluit: '17:00' }), 480);
});
