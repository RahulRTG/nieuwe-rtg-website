'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const mount = require('../server/routes/navigatie');
const { geenNederlandsNet } = require('../server/kern/navigatie/dekking');

function route(uit) {
  const routes = new Map();
  const auth = () => {};
  mount({ app: { post: (pad, ...handlers) => routes.set(pad, handlers), get() {} }, auth,
    navRoute: () => uit });
  const handlers = routes.get('/api/nav/route');
  assert.equal(handlers[0], auth, 'de bestaande authenticatie blijft voor de route');
  const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
  handlers.at(-1)({ session: { tier: 'rtg' }, body: {} }, res);
  return res;
}

test('de echte dekkingsweigering bereikt HTTP met reden en hersteladvies', () => {
  const fout = geenNederlandsNet();
  const res = route({ ...fout, intern: 'niet openbaar', token: 'geheim' });
  assert.equal(res.code, 503);
  assert.deepEqual(res.body, { error: fout.error, hoe: fout.hoe });
});

test('geen interne objecten of lege herstelvelden in een weigering', () => {
  for (const hoe of [undefined, '', ' ', { token: 'geheim' }]) {
    const res = route({ error: 'Geen geldige bestemming.', status: 400, hoe });
    assert.equal(res.code, 400);
    assert.deepEqual(res.body, { error: 'Geen geldige bestemming.' });
  }
});

test('een geslaagde route behoudt zijn oorspronkelijke antwoord', () => {
  const payload = { routeId: 'route-test', stappen: ['eind'] };
  assert.deepEqual(route(payload).body, payload);
});
