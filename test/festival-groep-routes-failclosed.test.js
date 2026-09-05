'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

const bouw = festival => {
  const routes = {};
  const app = { post(pad, ...lagen) { routes[pad] = lagen.at(-1); } };
  require('../server/routes/festival/groep')({
    app, auth() {}, festival, geenGast() { return false; },
    liveCodename() { return 'Kobalt'; }
  });
  return routes;
};

const antwoord = () => ({
  statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; }
});

test('festivalgroep-route faalt gesloten zonder kale code in antwoord of log', async () => {
  const geheim = 'GRP.0123456789ABCDEF0123456789ABCDEF';
  const routes = bouw({
    festivalVind() { return { id: 'festival-1' }; },
    groepDeelnemen() { throw new Error('opslag stuk voor ' + geheim); }
  });
  const req = { body: { festival: 'festival-1', editie: 'editie-1', code: geheim },
    session: {}, get() { return ''; } };
  const res = antwoord(), regels = [], oud = console.error;
  console.error = (...delen) => regels.push(delen.join(' '));
  try { await routes['/api/festival/groep/mee'](req, res); }
  finally { console.error = oud; }

  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /niet veilig/);
  assert.ok(!JSON.stringify(res.body).includes(geheim));
  assert.ok(!regels.join('\n').includes(geheim));
});
