'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

function routesMet(samenRtf) {
  const routes = {};
  const app = { post(pad, ...lagen) { routes[pad] = lagen.at(-1); } };
  const leeg = () => ({ status: 200, ok: true });
  require('../server/routes/rtfschool')({ app, samenRtf,
    rtf: { verifieerProfiel() { return { handle: 'rtf:A:1', codenaam: 'A',
      gast: false, g: { code: 'A' } }; } },
    schoolbieb: { overzicht: leeg, catalogus: leeg, installeer: leeg,
      verwijder: leeg, mijnApps: () => [] },
    beroepenbieb: { overzicht: leeg, catalogus: leeg, installeer: leeg,
      verwijder: leeg, mijnApps: () => [] },
    tooManyTries() { return false; }, noteFailedTry() {}, loginFails: new Map()
  });
  return routes;
}

const antwoord = () => ({ statusCode: 200, body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; } });

test('Foundation Samen faalt bij opslagfout dicht zonder bearer in antwoord of log', async () => {
  const geheim = 'RTFSAMEN.0123456789ABCDEF0123456789ABCDEF';
  const routes = routesMet({ doeMee() {
    throw new Error('opslag stuk voor ' + geheim);
  } });
  const req = { ip: '127.0.0.1', body: {
    code: 'GEZIN', token: 'profiel', deelcode: geheim
  }, get() { return ''; } };
  const res = antwoord(), regels = [], oud = console.error;
  console.error = (...delen) => regels.push(delen.join(' '));
  try { await routes['/api/rtf/samen/mee'](req, res); }
  finally { console.error = oud; }
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /niet veilig/);
  assert.equal(JSON.stringify(res.body).includes(geheim), false);
  assert.equal(regels.join('\n').includes(geheim), false);
});
