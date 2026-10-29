'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const registreer = require('../server/routes/auth/inlog-pas');
const { tokenHash } = require('../server/kern/sessies');
function opstelling({ vervangen = false, fout = null, echtAccount = false } = {}) {
  const token = 'logout-test-token', ander = 'andere-sessie';
  const sessie = { key: 'business', sid: 'abcdefghijkl' };
  const sessions = new Map([[tokenHash(ander), sessie]]);
  if (!echtAccount) sessions.set(tokenHash(token), vervangen ? { ...sessie } : sessie);
  const volgorde = [], routes = new Map();
  const auth = () => {};
  registreer({ app: { post: (pad, ...handlers) => routes.set(pad, handlers) }, auth, sessions,
    forgetSessionDuurzaam: async hash => {
      volgorde.push(['record', hash]); if (fout) throw fout; sessions.delete(hash);
    }, accounts: {
      trekIn: async aangeboden => { volgorde.push(['account', aangeboden]); },
      wachtIntrekkingen: async () => { volgorde.push(['duurzaam']); }
    } });
  assert.equal(routes.get('/api/logout')[0], auth, 'bestaande authenticatiemiddleware blijft staan');
  const handler = routes.get('/api/logout')[1];
  return { sessions, volgorde, token, ander, async doe() {
    let antwoord, error;
    await handler({ session: sessie, get: () => 'Bearer ' + token },
      { json: x => { volgorde.push(['antwoord']); antwoord = x; } }, e => { error = e; });
    return { antwoord, error };
  } };
}
for (const vervangen of [false, true]) test('logout trekt alleen aangeboden credential in, vervangen sessieobject: ' + vervangen, async () => {
  const o = opstelling({ vervangen }); const r = await o.doe();
  assert.ifError(r.error); assert.deepEqual(r.antwoord, { ok: true });
  assert.equal(o.sessions.has(tokenHash(o.token)), false);
  assert.equal(o.sessions.has(tokenHash(o.ander)), true, 'andere credential blijft geldig, ook bij gedeeld object');
  assert.deepEqual(o.volgorde, [['record', tokenHash(o.token)], ['account', o.token], ['duurzaam'], ['antwoord']]);
});
test('logout houdt bestaande accountintrekking en duurzame bevestiging', async () => {
  const o = opstelling({ echtAccount: true }); const r = await o.doe();
  assert.ifError(r.error); assert.deepEqual(r.antwoord, { ok: true });
  assert.ok(o.volgorde.some(x => x[0] === 'account' && x[1] === o.token));
  assert.equal(o.sessions.has(tokenHash(o.ander)), true);
  assert.deepEqual(o.volgorde.slice(-2), [['duurzaam'], ['antwoord']]);
});
test('mislukte recordsessieintrekking geeft geen succesvol antwoord', async () => {
  const fout = new Error('opslag niet bevestigd'); const o = opstelling({ vervangen: true, fout });
  const r = await o.doe(); assert.equal(r.error, fout); assert.equal(r.antwoord, undefined);
  assert.equal(o.sessions.has(tokenHash(o.ander)), true);
});
