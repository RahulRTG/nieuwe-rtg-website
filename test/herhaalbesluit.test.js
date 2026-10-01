'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { besluitVoor, inventaris } = require('../scripts/lib/herhaalbesluit');
const route = { methode: 'POST', pad: '/api/proef' };
const sleutel = 'POST /api/proef';
const contract = {
  mutatieId: 'proef', herkomst: 'mens', semantiek: { klasse: 'idempotent' },
  toegang: { klasse: 'AUTHENTICATED' }, stand: 'PROTECTED',
  bewijs: { gemeten: 'de herhaling schreef geen tweede effect', op: '2026-09-30' },
  afgetekend: { door: 'regressiefixture, geen productieattest', op: '2026-09-30' }
};
const legacy = { klassen: { berekening: 'leest', tebeslissen: 'open' }, routes: { '/api/proef': { klasse: 'berekening' } } };
test('bestaande centrale besluiten worden herleidbaar gelezen, nooit verzonnen', () => {
  const b = besluitVoor(route, { [sleutel]: contract }, legacy);
  assert.equal(b.bron, 'server/lib/mutatiecontracten.js');
  assert.equal(b.klasse, 'idempotent');
  assert.deepEqual(b.afgetekend, contract.afgetekend);
  assert.equal(besluitVoor(route, {}, legacy).bron, 'IDEMBESLUIT.json');
  assert.equal(besluitVoor(route, {}, { routes: {} }), null);
  assert.equal(besluitVoor({ ...route, methode: 'DELETE' }, {}, legacy), null);
});
test('een nieuwe open of ongeldige stand valt niet terug op een oud besluit', () => {
  for (const wijziging of [{ stand: 'BLOCKED_BY_TEST_FIXTURE' }, { semantiek: { klasse: 'onbekend' } },
    { bewijs: null }, { afgetekend: null }, { herkomst: 'afgeleid' }, { stand: 'NOT_APPLICABLE' }]) {
    assert.equal(besluitVoor(route, { [sleutel]: { ...contract, ...wijziging } }, legacy), null);
  }
  assert.equal(besluitVoor(route, {}, { ...legacy, routes: { '/api/proef': { klasse: 'tebeslissen' } } }), null);
});
test('geen werk is geen classificatiebewijs; verlies van een besluit heropent de schuld', () => {
  const rijen = [route, { pad: '/api/niet-bereikt', reden: 'geen werk' }];
  const goed = inventaris(rijen, { [sleutel]: contract }, {});
  assert.equal(goed.besluiten.length, 1);
  assert.deepEqual(goed.ontbreekt, []);
  const stuk = inventaris(rijen, {}, {});
  assert.deepEqual(stuk.ontbreekt, [sleutel]);
  assert.deepEqual(stuk.besluiten, []);
});
