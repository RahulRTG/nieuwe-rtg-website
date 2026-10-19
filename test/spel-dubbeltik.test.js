/* DE DUBBELE TIK OP "NODIG UIT EN START" maakt een potje, niet twee.

   Gevonden door de voltooiproef van Spelen (scripts/lib/voltooi/spelen.js):
   twee gelijke verzoeken tegelijk gaven twee potjes en de vriend twee
   uitnodigingen. Zonder kern/spellen/dubbeltik.js zakt de eerste toets. De
   andere twee bewaken dat het geen rem op gewoon uitnodigen werd.

   Draai los: node --test test/spel-dubbeltik.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const maakSpellen = require('../server/kern/spellen');
const { dubbeltik, VENSTER_MS } = require('../server/kern/spellen/dubbeltik');

function opstelling() {
  const db = { data: { spellen: { potjes: {}, wachtrij: {} } } };
  const kern = maakSpellen({ db, save() {}, crypto: require('crypto'), zijnVrienden: () => true,
    codenaamVan: (x) => 'CN-' + x, sseToCustomer() {}, isGeblokkeerd: () => false,
    socialZoek: async () => [], sociaalRate: () => true, volwassen: () => true,
    sseClients: [], lidBoardUit: () => false });
  return { db, kern };
}
const wachtend = (db) => Object.values(db.data.spellen.potjes).filter((p) => p.status === 'wacht');

test('twee gelijke verzoeken tegelijk: een potje, en allebei krijgen hetzelfde id', async () => {
  const { db, kern } = opstelling();
  const lijf = { soort: 'schaak', grootte: 2, vrienden: ['b'], wereld: 'rtg' };
  const [x, y] = await Promise.all([kern.spelNieuw('a', lijf), kern.spelNieuw('a', lijf)]);
  assert.equal(x.status, 200);
  assert.equal(y.status, 200);
  assert.equal(x.id, y.id);
  assert.equal(wachtend(db).length, 1);
});

test('een ander spel of een andere vriend is gewoon een nieuw potje', async () => {
  const { db, kern } = opstelling();
  await kern.spelNieuw('a', { soort: 'schaak', grootte: 2, vrienden: ['b'], wereld: 'rtg' });
  await kern.spelNieuw('a', { soort: 'schaak', grootte: 2, vrienden: ['c'], wereld: 'rtg' });
  await kern.spelNieuw('a', { soort: 'woord', grootte: 2, vrienden: ['b'], wereld: 'rtg' });
  assert.equal(wachtend(db).length, 3);
});

test('buiten het venster, of zodra de vriend ja zei, telt het niet meer als dezelfde tik', () => {
  const at = new Date(0).toISOString();
  const p = { id: 'p', status: 'wacht', soort: 'schaak', grootte: 2, spelers: ['a'], uitgenodigd: ['b'], at };
  const vraag = { soort: 'schaak', grootte: 2, uitgenodigd: ['b'] };
  assert.equal(dubbeltik({ p }, 'a', vraag, 1000), p);
  assert.equal(dubbeltik({ p }, 'a', vraag, VENSTER_MS), null);
  assert.equal(dubbeltik({ p: Object.assign({}, p, { status: 'bezig' }) }, 'a', vraag, 1000), null);
  assert.equal(dubbeltik({ p }, 'z', vraag, 1000), null);
});
