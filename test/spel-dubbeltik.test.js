/* "NODIG UIT EN START" MET EEN HERHAALSLEUTEL maakt een potje, niet twee.

   Gevonden door de voltooiproef van Spelen (scripts/lib/voltooi/spelen.js):
   twee gelijke verzoeken tegelijk gaven twee potjes en de vriend twee
   uitnodigingen. De sleutel staat op het potje (kern/spellen/dubbeltik.js), dus
   een nieuwe kern op dezelfde opslag -- een herstart -- herkent hem ook. Zonder
   die sleutel zakken de eerste drie toetsen; de laatste bewaakt dat bewust
   twee keer uitnodigen gewoon kan.

   Draai los: node --test test/spel-dubbeltik.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakSpellen = require('../server/kern/spellen');

function kernOp(db) {
  return maakSpellen({ db, save() {}, crypto: require('crypto'), zijnVrienden: () => true,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true, volwassen: () => true,
    sseClients: [], lidBoardUit: () => false });
}
function opstelling() {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  return { db, kern: kernOp(db) };
}
const wachtend = (db) => Object.values(db.data.spellen.potjes).filter((p) => p.status === 'wacht');

test('twee gelijke verzoeken met een sleutel tegelijk: een potje, en allebei krijgen hetzelfde id', async () => {
  const { db, kern } = opstelling();
  const lijf = { soort: 'schaak', grootte: 2, vrienden: ['b'], wereld: 'rtg', idem: 'tik-een' };
  const [x, y] = await Promise.all([kern.spelNieuw('a', lijf), kern.spelNieuw('a', lijf)]);
  assert.equal(x.status, 200);
  assert.equal(y.status, 200);
  assert.equal(x.id, y.id);
  assert.equal(wachtend(db).length, 1);
});

test('na een herstart (een nieuwe kern op dezelfde opslag) geeft dezelfde sleutel hetzelfde potje, ook later', async () => {
  const { db, kern } = opstelling();
  const lijf = { soort: 'schaak', grootte: 2, vrienden: ['b'], wereld: 'rtg', idem: 'tik-herstart' };
  const x = await kern.spelNieuw('a', lijf);
  const opnieuw = JSON.parse(JSON.stringify(db));
  const y = await kernOp(opnieuw).spelNieuw('a', lijf);
  assert.equal(y.status, 200);
  assert.equal(y.id, x.id);
  assert.equal(y.herhaald, true);
  assert.equal(wachtend(opnieuw).length, 1);
});

test('dezelfde sleutel voor een ander spel of andere spelers is een conflict; dezelfde sleutel van een ander lid niet', async () => {
  const { db, kern } = opstelling();
  await kern.spelNieuw('a', { soort: 'schaak', grootte: 2, vrienden: ['b'], wereld: 'rtg', idem: 'tik-x' });
  const spel = await kern.spelNieuw('a', { soort: 'woord', grootte: 2, vrienden: ['b'], wereld: 'rtg', idem: 'tik-x' });
  const vriend = await kern.spelNieuw('a', { soort: 'schaak', grootte: 2, vrienden: ['c'], wereld: 'rtg', idem: 'tik-x' });
  const ander = await kern.spelNieuw('z', { soort: 'schaak', grootte: 2, vrienden: ['b'], wereld: 'rtg', idem: 'tik-x' });
  assert.equal(spel.status, 409);
  assert.equal(vriend.status, 409);
  assert.equal(ander.status, 200);
  assert.equal(wachtend(db).length, 2);
});

test('zonder venster: bewust een tweede potje met dezelfde vriend, met een nieuwe sleutel, is gewoon een tweede', async () => {
  const { db, kern } = opstelling();
  await kern.spelNieuw('a', { soort: 'schaak', grootte: 2, vrienden: ['b'], wereld: 'rtg', idem: 'tik-1' });
  await kern.spelNieuw('a', { soort: 'schaak', grootte: 2, vrienden: ['b'], wereld: 'rtg', idem: 'tik-2' });
  await kern.spelNieuw('a', { soort: 'woord', grootte: 2, vrienden: ['b'], wereld: 'rtg' });
  assert.equal(wachtend(db).length, 3);
});
