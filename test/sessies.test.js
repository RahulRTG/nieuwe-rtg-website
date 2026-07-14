/* De sessie-opslag: gelijktijdige sessies mogen niet stilletjes op 400 vastlopen
   (dat gooide vroeger de 401e ingelogde gebruiker eruit). Verlopen sessies gaan
   wel weg. Draai: npm test */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { maakSessies, TOKEN_TTL_MS } = require('../server/kern/sessies');

function nieuweStore() {
  const db = { data: { sessions: {} }, writable: true };
  const save = () => {};
  return maakSessies({ db, save, crypto });
}

test('meer dan 400 actieve sessies blijven allemaal bestaan', () => {
  const s = nieuweStore();
  const tokens = [];
  for (let i = 0; i < 1200; i++) {
    const t = 'tok-' + i;
    tokens.push(t);
    s.rememberSession(t, { tier: 'rtg', key: 'lid' + i });
  }
  // alle 1200 zijn nog opzoekbaar (vroeger overleefden er maar 400)
  for (const t of tokens) assert.ok(s.sessionFor(t), 'sessie ' + t + ' bestaat nog');
  assert.equal(s.sessions.size, 1200);
});

test('verlopen sessies worden opgeruimd bij een nieuwe login boven de grens', () => {
  process.env.RTG_MAX_SESSIONS = '10';
  // opnieuw laden met de lage grens
  delete require.cache[require.resolve('../server/kern/sessies')];
  const { maakSessies: maak } = require('../server/kern/sessies');
  const db = { data: { sessions: {} }, writable: true };
  const s = maak({ db, save: () => {}, crypto });

  // 10 verse sessies
  for (let i = 0; i < 10; i++) s.rememberSession('vers-' + i, { tier: 'rtg', key: 'v' + i });
  // 1 kunstmatig verlopen sessie erin schuiven
  const oudH = s.tokenHash('oud');
  const oudeTijd = new Date(Date.now() - TOKEN_TTL_MS - 60000).toISOString();
  db.data.sessions[oudH] = { tier: 'rtg', key: 'oud', at: oudeTijd };
  s.sessions.set(oudH, db.data.sessions[oudH]);

  // nieuwe login duwt over de grens: de verlopen sessie hoort te sneuvelen,
  // de verse sessies blijven
  s.rememberSession('nieuw', { tier: 'rtg', key: 'n' });
  assert.equal(s.sessionFor('oud'), null, 'verlopen sessie is opgeruimd');
  assert.ok(s.sessionFor('nieuw'), 'de nieuwe sessie leeft');
  assert.ok(s.sessionFor('vers-9'), 'verse sessies blijven');

  delete process.env.RTG_MAX_SESSIONS;
  delete require.cache[require.resolve('../server/kern/sessies')];
});
