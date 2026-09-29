'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { van } = require('../server/opzet/envelop');

test('gezinsbeelden gebruiken uitsluitend de geverifieerde actor voor de privékluis', async () => {
  const routes = new Map(), calls = [];
  const profile = { id: 'eigen-profiel' };
  require('../server/routes/presentatie-gezinsbeelden')({
    app: { post: (path, ...handlers) => routes.set(path, handlers) },
    rtf: { verifieerProfiel: (code, token) => code === 'HUIS' && token === 'eigen-token'
      ? { p: profile, handle: 'rtf:HUIS:eigen-profiel' } : null },
    bestanden: { bestandenLijst: key => { calls.push(key); return { items: [] }; } }, save() {}
  });
  async function request(body) {
    const req = { body, id: 'verzoek-1', method: 'POST', path: '/api/foundation/gezin/beelden/mijn' };
    const res = { statusCode: 200, status(n) { this.statusCode=n; return this; }, json(value) { this.body=value; } };
    const [auth, action] = routes.get(req.path);
    await auth(req, res, () => action(req, res)); return { req, res };
  }
  const denied = await request({ code: 'HUIS', token: 'verkeerd', handle: 'rtf:HUIS:ander' });
  assert.equal(denied.res.statusCode, 401); assert.equal(van(denied.req), null);
  assert.deepEqual(calls, []);
  const own = await request({ code: 'HUIS', token: 'eigen-token', handle: 'rtf:HUIS:ander' });
  assert.equal(own.res.statusCode, 200);
  assert.deepEqual(calls, ['rtf:HUIS:eigen-profiel']);
  assert.equal(van(own.req).actor.id, 'rtf:HUIS:eigen-profiel');
  assert.equal(van(own.req).actor.identiteit, 'bewezen');
  assert.deepEqual(van(own.req).tenant, { soort: 'gezin', id: 'HUIS' });
  assert.equal(van(own.req).correlatie, 'verzoek-1');
});
