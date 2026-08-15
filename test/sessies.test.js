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

function gedeeldeBus() {
  const abonnees = new Map();
  return {
    publish(kanaal, bericht) {
      for (const fn of abonnees.get(kanaal) || []) fn(JSON.parse(JSON.stringify(bericht)));
    },
    subscribe(kanaal, fn) {
      if (!abonnees.has(kanaal)) abonnees.set(kanaal, []);
      abonnees.get(kanaal).push(fn);
    }
  };
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

test('login en intrekking zijn direct zichtbaar op een andere instance', () => {
  const bus = gedeeldeBus();
  const dbA = { data: { sessions: {} }, writable: true };
  const dbB = { data: { sessions: {} }, writable: true };
  const a = maakSessies({ db: dbA, save: () => {}, crypto });
  const b = maakSessies({ db: dbB, save: () => {}, crypto });
  a.koppelBus(bus); b.koppelBus(bus);

  a.rememberSession('gedeeld-token', { tier: 'rtg', key: 'lid-42' });
  assert.equal(b.sessionFor('gedeeld-token').key, 'lid-42', 'instance B kent een login meteen');
  const hash = a.tokenHash('gedeeld-token');
  b.forgetSession(hash);
  assert.equal(a.sessionFor('gedeeld-token'), null, 'instance A weigert een elders ingetrokken token meteen');
  assert.equal(dbA.data.sessions[hash], undefined);
  assert.equal(dbB.data.sessions[hash], undefined);
});

test('snapshot-reconciliatie verwijdert lokaal achtergebleven sessies', () => {
  const db = { data: { sessions: {} }, writable: true };
  const s = maakSessies({ db, save: () => {}, crypto });
  s.rememberSession('oud-token', { tier: 'rtg', key: 'oud' });
  const hash = s.tokenHash('oud-token');
  delete db.data.sessions[hash];
  assert.equal(s.sessions.has(hash), true, 'fixture heeft eerst bewust een stale lokale index');
  assert.equal(s.herbouwSessions(), 0);
  assert.equal(s.sessionFor('oud-token'), null);
});
