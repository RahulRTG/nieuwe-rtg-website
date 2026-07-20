/* Test voor de eigen rate-limiter (server/rem.js): binnen het venster mag een
   sleutel tot `limit` verzoeken, daarboven springt de rem aan; sleutels tellen
   los; `skip` slaat over; een verlopen venster telt weer vanaf nul. Dit verving
   express-rate-limit -- geen dependency, puur telwerk. */
const { test } = require('node:test');
const assert = require('node:assert');
const rem = require('../server/rem');

// Een minimale nep-req/res om de middleware te draaien.
function nep(ip) {
  const req = { ip: ip || '198.51.100.1', path: '/api/x' };
  let code = 200, body = null, geeind = false;
  const res = {
    status(c) { code = c; return res; },
    json(b) { body = b; return res; },
    end() { geeind = true; return res; }
  };
  return { req, res, uit: () => ({ code, body, geeind }) };
}
// Draai de middleware een keer, geef terug of next() is aangeroepen + de res-staat.
function raak(mw, ctx) {
  let door = false;
  mw(ctx.req, ctx.res, () => { door = true; });
  return Object.assign({ door }, ctx.uit());
}

test('tot de grens door, daarboven 429', () => {
  const mw = rem({ windowMs: 60000, limit: 3 });
  const ip = '203.0.113.5';
  for (let i = 0; i < 3; i++) {
    const r = raak(mw, nep(ip));
    assert.strictEqual(r.door, true, 'verzoek ' + (i + 1) + ' hoort door te mogen');
  }
  const vierde = raak(mw, nep(ip));
  assert.strictEqual(vierde.door, false, 'het vierde verzoek wordt geremd');
  assert.strictEqual(vierde.code, 429);
});

test('elke sleutel telt apart', () => {
  const mw = rem({ windowMs: 60000, limit: 1 });
  assert.strictEqual(raak(mw, nep('10.0.0.1')).door, true, 'eerste sleutel: eerste verzoek door');
  assert.strictEqual(raak(mw, nep('10.0.0.1')).door, false, 'eerste sleutel: tweede geremd');
  assert.strictEqual(raak(mw, nep('10.0.0.2')).door, true, 'andere sleutel heeft een eigen teller');
});

test('een eigen sleutel-functie (bv. per gebruiker i.p.v. per IP)', () => {
  const mw = rem({ windowMs: 60000, limit: 1, key: req => req.gebruiker });
  const mk = (u) => { const c = nep(); c.req.gebruiker = u; return c; };
  assert.strictEqual(raak(mw, mk('anna')).door, true);
  assert.strictEqual(raak(mw, mk('anna')).door, false, 'anna is over de grens');
  assert.strictEqual(raak(mw, mk('bram')).door, true, 'bram telt los van anna');
});

test('skip slaat verzoeken volledig over (tellen niet mee)', () => {
  const mw = rem({ windowMs: 60000, limit: 1, skip: req => req.path === '/api/x/stream' });
  const stream = nep(); stream.req.path = '/api/x/stream';
  for (let i = 0; i < 5; i++) assert.strictEqual(raak(mw, stream).door, true, 'stream telt nooit mee');
  assert.strictEqual(raak(mw, nep('9.9.9.9')).door, true, 'gewoon verzoek: eerste door');
  assert.strictEqual(raak(mw, nep('9.9.9.9')).door, false, 'gewoon verzoek: tweede geremd');
});

test('een verlopen venster telt weer vanaf nul', () => {
  const mw = rem({ windowMs: 60000, limit: 1 });
  const ip = '192.0.2.50';
  assert.strictEqual(raak(mw, nep(ip)).door, true);
  assert.strictEqual(raak(mw, nep(ip)).door, false, 'binnen het venster geremd');
  // het venster kunstmatig laten verlopen (bakken is inzichtelijk gemaakt)
  mw.bakken.get(ip).vanaf = Date.now() - 60001;
  assert.strictEqual(raak(mw, nep(ip)).door, true, 'na het venster mag het weer');
});

test('eigen handler wordt gebruikt boven de grens', () => {
  let geraakt = 0;
  const mw = rem({ windowMs: 60000, limit: 1, handler: (req, res) => { geraakt++; res.status(429).end(); } });
  const ip = '198.51.100.9';
  raak(mw, nep(ip));
  const r = raak(mw, nep(ip));
  assert.strictEqual(geraakt, 1, 'de eigen handler is precies een keer aangeroepen');
  assert.strictEqual(r.geeind, true, 'de eigen handler heeft de response afgesloten');
});
