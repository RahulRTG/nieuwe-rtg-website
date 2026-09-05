'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function bouw(samen) {
  const routes = {};
  const app = { post(pad, ...lagen) { routes[pad] = lagen.at(-1); } };
  require('../server/routes/samen')({ app, samen, auth() {},
    liveCodename() { return 'Amber'; }, tooManyTries() { return false; },
    noteFailedTry() {}, loginFails: new Map() });
  return routes;
}
const antwoord = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

test('Samen faalt bij een opslagfout dicht zonder de bearer in antwoord of log', async () => {
  const geheim = 'SAMEN.0123456789ABCDEF0123456789ABCDEF';
  const routes = bouw({ doeMee() { throw new Error('opslag stuk voor ' + geheim); } });
  const req = { ip: '127.0.0.1', body: { code: geheim },
    session: { key: 'lid:A', tier: 'rtg' }, get() { return ''; } };
  const res = antwoord(), regels = [], oud = console.error;
  console.error = (...delen) => regels.push(delen.join(' '));
  try { await routes['/api/samen/mee'](req, res); }
  finally { console.error = oud; }
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /niet veilig/);
  assert.equal(JSON.stringify(res.body).includes(geheim), false);
  assert.equal(regels.join('\n').includes(geheim), false);
});
