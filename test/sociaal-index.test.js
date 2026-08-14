const test = require('node:test');
const assert = require('node:assert/strict');
const maakSociaal = require('../server/kern/sociaal');

function maak(connections) {
  const db = { data: { connections, blocks: [], reports: [], memberChats: {} } };
  const rtf = { profielInfoVanHandle() { return null; }, socialProfielen() { return []; } };
  return { db, sociaal: maakSociaal({ db, save() {}, sseToCustomer() {}, rtf,
    crypto: require('node:crypto'), gidsHaal: h => ({ codename: h, tier: 'rtg' }),
    gidsZoekCodenaam: async () => [], media: {} }) };
}

test('connectie-index volgt push, statusmutatie en arrayvervanging', () => {
  const a = { a: 'A', b: 'B', status: 'pending' };
  const { db, sociaal } = maak([a]);
  assert.equal(sociaal.connectieTussen('B', 'A'), a);
  a.status = 'accepted';
  assert.equal(sociaal.connectieTussen('A', 'B').status, 'accepted');
  const c = { a: 'A', b: 'C', status: 'pending' };
  db.data.connections.push(c);
  assert.equal(sociaal.connectieTussen('C', 'A'), c);
  db.data.connections = db.data.connections.filter(x => x !== a);
  assert.equal(sociaal.connectieTussen('A', 'B'), undefined);
  assert.equal(sociaal.connectieTussen('A', 'C'), c);
});

test('dubbele corrupte paren behouden Array.find-semantiek', () => {
  const eerste = { a: 'A', b: 'B', status: 'pending' };
  const tweede = { a: 'B', b: 'A', status: 'accepted' };
  const { sociaal } = maak([eerste, tweede]);
  assert.equal(sociaal.connectieTussen('A', 'B'), eerste);
});

test('blokkeerindex volgt push en arrayvervanging', () => {
  const { db, sociaal } = maak([]);
  assert.equal(sociaal.isGeblokkeerd('A', 'B'), false);
  db.data.blocks.push({ door: 'A', doel: 'B' });
  assert.equal(sociaal.isGeblokkeerd('B', 'A'), true);
  db.data.blocks = [];
  assert.equal(sociaal.isGeblokkeerd('A', 'B'), false);
});

test('indexsleutels kunnen niet botsen door bijzondere tekens in handles', () => {
  const goed = { a: 'a\0b', b: 'c', status: 'accepted' };
  const { sociaal } = maak([goed]);
  assert.equal(sociaal.connectieTussen('a\0b', 'c'), goed);
  assert.equal(sociaal.connectieTussen('a', 'b\0c'), undefined);
});
