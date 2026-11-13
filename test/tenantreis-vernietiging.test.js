'use strict';
// De bestaande levensloop met in-memory opslag. Geen nieuwe retentie-/exitregel.
const test = require('node:test'), assert = require('node:assert/strict');
const maakUitgang = require('../server/kern/tenant/uitgang');
const maakLevensloop = require('../server/kern/tenant/levensloop');
function huis(reisAanvragen) {
  const t = { org: 'O-A', werkruimtes: ['WA'], zaken: ['B-A'], levensloop: {
    stand: 'bewaring', sinds: '2020-01-01', bewaarTot: '2020-02-01', legalHold: false, log: [] } };
  const db = { data: { werkruimtes: { WA: { code: 'WA', naam: 'Bron', leden: {} } }, tenants: { 'O-A': t }, reisAanvragen } };
  let saves = 0; const save = () => saves++;
  const register = { haal: () => t, vanWerkruimte: () => t };
  const uitgang = maakUitgang({ db, save, register });
  const leven = maakLevensloop({ db, save, register, uitgang, schoon: x => String(x || '') });
  return { db, t, leven, uitgang, saves: () => saves };
}
test('eigen verkoop-, offerte- en leveringshistorie blokkeert vernietiging zonder data of stand te wijzigen', () => {
  for (const keten of [{ verkoper: { org: 'O-A', supplierCode: 'B-A' } },
    { verkoper: { org: 'O-B' }, offerte: { onderdelen: [{ org: 'O-A', supplierCode: 'B-A' }] } },
    { verkoper: { org: 'O-B' }, offerteVersies: [{ onderdelen: [{ org: 'O-A', supplierCode: 'B-A' }] }] },
    { verkoper: { org: 'O-B' }, leveringen: [{ org: 'O-A', supplierCode: 'B-A' }] },
    { verkoper: { org: 'O-OUD', supplierCode: 'B-A' } }]) {
    const h = huis([{ ref: 'PERSOONLIJKE-REISREF', keten }]), voor = structuredClone(h.db.data);
    const r = h.leven.vernietig('O-A', { door: 'bevoegde-testactor' });
    assert.equal(r.status, 409); assert.equal(r.code, 'REISKETEN_VERNIETIGING_ONGEKWALIFICEERD');
    assert.doesNotMatch(JSON.stringify(r), /PERSOONLIJKE-REISREF/);
    assert.deepEqual(h.db.data, voor); assert.equal(h.saves(), 0);
    assert.equal(h.uitgang.exporteer('WA').ok, true, 'bestaande uitgang blijft zoals hij was');
  }
});
test('onzekere reishistorie kan niet als afwezig worden behandeld', () => {
  for (const bron of [{}, [{ keten: null }], [{ keten: { verkoper: { org: 'O-B' }, leveringen: {} } }],
    ...[false, 0, ''].map(offerte => [{ keten: { verkoper: { org: 'O-B' }, offerte } }])]) {
    const h = huis(bron), voor = structuredClone(h.db.data);
    const r = h.leven.vernietig('O-A', { door: 'bevoegde-testactor' });
    assert.equal(r.status, 503); assert.deepEqual(h.db.data, voor); assert.equal(h.saves(), 0);
  }
});
test('andermans reis, klassieke reis en inert archief veranderen het bestaande vernietigingsrecht niet', () => {
  const h = huis([{ ref: 'ANDERMANS', keten: { verkoper: { org: 'O-B', supplierCode: 'B-B' }, leveringen: [] } },
    { ref: 'KLASSIEK', org: 'O-A' }]);
  h.db.data.werkruimtes.WA.reisarchief = { status: 'documentair' };
  const reizenVoor = structuredClone(h.db.data.reisAanvragen);
  const r = h.leven.vernietig('O-A', { door: 'bevoegde-testactor' });
  assert.equal(r.ok, true); assert.equal(h.t.levensloop.stand, 'vernietigd');
  assert.equal(h.db.data.werkruimtes.WA, undefined); assert.deepEqual(h.db.data.reisAanvragen, reizenVoor);
});
