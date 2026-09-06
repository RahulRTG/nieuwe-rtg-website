/* Achtergrondtelemetrie mag PostgreSQL niet via raw db.data + save() passeren.
   Deze proeven houden de collectietransactie expres even open en laten haar
   eenmaal falen: pending cijfers blijven zichtbaar en worden exact eenmaal
   opnieuw aangeboden. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const later = fn => new Promise((resolve, reject) => setImmediate(() => {
  try { resolve(fn()); } catch (e) { reject(e); }
}));

test('kostenmeter bewaart een mislukte achtergrondbatch voor exact één retry', async () => {
  const db = { data: {} };
  let saves = 0, poging = 0;
  const economie = require('../server/kern/economie')({ db, save: () => {} }).economie;
  const bewerkCollectie = (sleutel, werk) => {
    assert.equal(sleutel, 'kosten');
    const kopie = JSON.parse(JSON.stringify(db.data.kosten || {}));
    werk(kopie); poging++;
    return later(() => {
      if (poging === 1) throw new Error('PostgreSQL tijdelijk weg');
      db.data.kosten = kopie;
    });
  };
  const kosten = require('../server/kern/kosten')({ db, save: () => { saves++; },
    bewerkCollectie, accounts: {}, economie, klok: () => new Date('2026-09-06T12:00:00Z') }).kosten;

  for (let i = 0; i < 500; i++) kosten.meet(kosten.drager('lid', 'achtergrond-' + i), 'verzoek', 1);
  assert.equal(kosten.kijk('2026-09', 'lid:achtergrond-0').verzoek, 1,
    'de batch blijft tijdens de transactie zichtbaar');
  await new Promise(resolve => setImmediate(resolve));
  kosten.meet(kosten.drager('lid', 'retry-kick'), 'verzoek', 1);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(db.data.kosten.meters['2026-09']['lid:achtergrond-0'].verzoek, 1,
    'de retry telde de batch niet dubbel');
  assert.equal(poging, 2);
  assert.equal(saves, 0, 'het achtergrondpad gebruikte geen raw save()');
});

test('RTG-AI toont pending telemetrie en herneemt een mislukte collectietransactie', async () => {
  const db = { data: {}, writable: true, leider: true };
  let saves = 0, poging = 0;
  const bewerkCollectie = (sleutel, werk) => {
    assert.equal(sleutel, 'rtgai');
    const kopie = JSON.parse(JSON.stringify(db.data.rtgai || {}));
    const antwoord = werk(kopie); poging++;
    return later(() => {
      if (poging === 1) throw new Error('PostgreSQL tijdelijk weg');
      db.data.rtgai = kopie;
      return antwoord;
    });
  };
  const rtgai = require('../server/kern/rtgai')({ db, save: () => { saves++; }, bewerkCollectie }).rtgai;
  rtgai.lees('GET', '/api/reis/lijst', 200);
  rtgai.lees('POST', '/api/pay/boek', 503);
  rtgai.lees('GET', '/api/reis/detail', 200);
  assert.equal(rtgai.status().waarnemingen, 3);
  assert.equal(db.data.rtgai, undefined, 'meelezen muteerde de gedeelde werkkopie niet');

  await assert.rejects(rtgai.train('automaat'), /tijdelijk weg/);
  assert.equal(rtgai.status().waarnemingen, 3, 'de mislukte batch bleef zichtbaar');
  await rtgai.train('automaat');
  const stand = rtgai.status();
  assert.equal(stand.waarnemingen, 3, 'de retry telde waarnemingen niet dubbel');
  assert.equal(stand.fouten, 1);
  assert.equal(stand.domeinen, 2);
  assert.equal(poging, 2);
  assert.equal(saves, 0, 'automatisch trainen gebruikte geen raw save()');
});

test('handmatig RTG-AI-trainen bewaart pending telling bij een opslagfout', async () => {
  const db = { data: { rtgai: { fase: 'aan-het-roer', gestart: 1, waarnemingen: 0,
    domeinen: {}, fouten: 0, rondes: 0, roerSinds: 1, roerRondes: 0, journaal: [] } },
  writable: true, leider: true };
  let poging = 0, zelfzorg = 0;
  const bewerkCollectie = (_sleutel, werk) => {
    const kopie = JSON.parse(JSON.stringify(db.data.rtgai));
    const antwoord = werk(kopie); poging++;
    return later(() => {
      if (poging === 1) throw new Error('commit geweigerd');
      db.data.rtgai = kopie; return antwoord;
    });
  };
  const rtgai = require('../server/kern/rtgai')({ db, save() {}, bewerkCollectie,
    zelfzorgVan: () => { zelfzorg++; return {}; } }).rtgai;
  rtgai.lees('GET', '/api/reis/lijst', 200);
  await assert.rejects(rtgai.train('kantoor'), /commit geweigerd/);
  assert.equal(rtgai.status().waarnemingen, 1, 'de afgewezen telling bleef pending');
  const uit = await rtgai.train('kantoor');
  assert.equal(uit.door, 'kantoor');
  assert.equal(db.data.rtgai.waarnemingen, 1);
  assert.equal(db.data.rtgai.roerRondes, 1, 'alleen de geslaagde ronde landde');
  assert.equal(zelfzorg, 0, 'trainen start geen los achtergrondschrijfpad');
});

test('kosten lezen schrijft niet en een oudere batch zet tijd of pas niet terug', async () => {
  let tijd = '2026-09-06T12:00:00.000Z';
  const db = { data: { kosten: { meters: { '2026-09': { huis: {
    verzoek: 2, laatst: '2026-09-06T13:00:00.000Z', pas: 'business',
    pasGezien: '2026-09-06T13:00:00.000Z'
  } } } } } };
  let saves = 0, commits = 0;
  const meter = require('../server/kern/kosten/meter')({
    d: () => db.data.kosten, kijkD: () => db.data.kosten, save: () => { saves++; },
    nu: () => tijd,
    bewerkCollectie: (_sleutel, werk) => { commits++; return werk(db.data.kosten); }
  });
  assert.equal(meter.meet({ drager: 'huis', soort: 'verzoek', aantal: 1, pas: 'basic' }), true);
  assert.equal(meter.kijk('2026-09', 'huis').verzoek, 3, 'de lezer ziet de pending teller');
  assert.equal(commits, 0, 'een lezer opent geen verborgen schrijftransactie');
  assert.equal(saves, 0, 'een lezer gebruikt geen raw save');
  meter.spoel();
  assert.equal(commits, 1);
  assert.equal(db.data.kosten.meters['2026-09'].huis.laatst, '2026-09-06T13:00:00.000Z');
  assert.equal(db.data.kosten.meters['2026-09'].huis.pas, 'business');
  assert.equal(db.data.kosten.meters['2026-09'].huis.pasGezien, '2026-09-06T13:00:00.000Z');
});

test('PostgreSQL-start laat zelfzorg niet buiten requestcommit schrijven', () => {
  const timers = [];
  const oud = global.setInterval;
  global.setInterval = (...a) => { timers.push(a); return { unref() {} }; };
  try {
    const zelfzorg = require('../server/kern/zelfzorg')({ db: { data: {} }, save() {},
      achtergrondMutaties: false }).zelfzorg;
    assert.equal(zelfzorg.automaatAan(), false);
    assert.equal(zelfzorg.autoStart(), null);
    assert.equal(timers.length, 0, 'geen onveilige achtergrondtimer gestart');
  } finally { global.setInterval = oud; }
});

test('lokale zelfzorgrondes wachten op elkaar en vangen een async fout af', async () => {
  const zelfzorg = require('../server/kern/zelfzorg')({
    db: { data: {}, leider: true }, save() {}, achtergrondMutaties: true
  }).zelfzorg;
  let opruim = 0, bescherm = 0, laatLos;
  zelfzorg.opruim = () => { opruim++; return {}; };
  zelfzorg.bescherm = () => {
    bescherm++;
    return new Promise(resolve => { laatLos = resolve; });
  };
  const eerste = zelfzorg.autoRonde();
  const tweede = zelfzorg.autoRonde();
  assert.equal(eerste, tweede, 'een trage ronde krijgt geen overlappende tweede ronde');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(opruim, 1); assert.equal(bescherm, 1);
  laatLos({ ok: true }); await eerste;
  const derde = zelfzorg.autoRonde();
  assert.notEqual(derde, eerste, 'na afronding kan de volgende ronde starten');
  await new Promise(resolve => setImmediate(resolve));
  laatLos({ ok: true }); await derde;
});
