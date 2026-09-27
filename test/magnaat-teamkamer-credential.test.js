/* De toegangscode van een Magnaat-teamkamer (magnaat.teamkamer_toegangscode),
   control voor control: 128 bit en eenmaal tonen, hash-only opslag, issuer/doel/
   scope, vervaltijd, max_gebruik, roteren en intrekken door de host, constant-
   time zoeken, en de claim in de collectietransactie. Toets 9 draait tegen een
   ECHTE server. De raceproef over twee instances staat in
   test/codedeuren-claim.pg.test.js.

   Draai los: node --test test/magnaat-teamkamer-credential.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { startServer, stop } = require('./helper');

function model() {
  return { meta: { hash: 'release-team', releaseModel: 'vier-ogen-v2' }, snapshot: {
    code: 'TEAM', naam: 'Teampraktijk', type: 'software', stad: 'Amsterdam',
    rollen: [{ id: 'operator', naam: 'Operator', rechten: ['bekijken', 'oefenen'] }],
    werkprocessen: [{ id: 'incident', naam: 'Incidentregie', doel: 'Herstel',
      stappen: ['Controleer impact', 'Stabiliseer de dienst', 'Draag aantoonbaar over'] }]
  } };
}

// een crypto die telt hoe vaak er constant-time wordt vergeleken
function wereld() {
  const db = { data: {}, writable: true };
  const sleutels = [], seintjes = [], commits = [];
  let vergelijkingen = 0;
  const telCrypto = Object.assign(Object.create(crypto), {
    timingSafeEqual: (a, b) => { vergelijkingen++; return crypto.timingSafeEqual(a, b); }
  });
  const basis = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const lobby = require('../server/kern/magnaat-trainingslobby')({ db, crypto: telCrypto,
    save() { throw new Error('het atomaire pad mag save() niet gebruiken'); },
    // wat de transactie COMMIT, en niet wat er na een leesronde in het geheugen staat
    bewerkCollectie: (s, w) => { sleutels.push(s); const r = basis(s, w); commits.push(JSON.stringify(db.data[s])); return r; },
    partnerstudio: { trainingsmodel: code => code === 'TEAM' ? model() : null },
    codenaamVan: key => key, sseToCustomer: (key, event, data) => seintjes.push(data) });
  const kamer = id => db.data.magnaatTrainingslobbies.kamers[id];
  return { db, lobby, sleutels, seintjes, commits, kamer, tel: () => vergelijkingen, nul: () => { vergelijkingen = 0; } };
}

test('1. 128 bit, kaal alleen in het antwoord op maken, en nergens anders', async () => {
  const w = wereld();
  const r = await w.lobby.maak('host', { code: 'TEAM' });
  assert.match(r.kamer.toegangscode, /^MT\.[0-9A-F]{32}$/);
  const geheim = r.kamer.toegangscode.slice(3);
  assert.equal(JSON.stringify(w.db.data).includes(geheim), false, 'de code staat niet in de opslag');
  assert.equal(w.commits.join('').includes(geheim), false, 'de code ging mee in een commit');
  const codes = [r.kamer.toegangscode];
  for (let i = 0; i < 8; i++) codes.push((await w.lobby.maak('host' + i, { code: 'TEAM' })).kamer.toegangscode);
  // elke positie van het geheim varieert: geen opgevuld of afgekapt geheim
  for (let i = 0; i < 32; i++) assert.ok(new Set(codes.map(c => c.slice(-32)[i])).size > 1, 'positie ' + i + ' van het geheim is vast');
  assert.match(w.kamer(r.kamer.id).toegang.code_hash, /^[a-f0-9]{64}$/);
  await w.lobby.deelnemen('gast', r.kamer.toegangscode);
  for (const k of [await w.lobby.mijn('host', r.kamer.id), await w.lobby.mijn('gast', r.kamer.id), await w.lobby.mijn('host')])
    assert.equal(JSON.stringify(k).includes(geheim), false, 'een overzicht toont de code opnieuw');
  assert.equal(JSON.stringify(w.seintjes).includes(geheim), false, 'een seintje draagt de code');
  assert.equal((await w.lobby.mijn('gast', r.kamer.id)).kamer.toegang, null, 'een gast ziet de toegang niet eens');
});

test('2. issuer, doel, scope en onderwerp: de code hoort bij EEN kamer', async () => {
  const w = wereld();
  const a = (await w.lobby.maak('host', { code: 'TEAM' })).kamer;
  const b = (await w.lobby.maak('host', { code: 'TEAM' })).kamer;
  const t = w.kamer(a.id).toegang;
  assert.equal(t.issuer, 'rtg.magnaat.teamkamer');
  assert.equal(t.doel, 'teamkamer-deelnemen');
  assert.deepEqual(t.scope, ['teamkamer.deelnemen']);
  assert.deepEqual(t.onderwerp, { soort: 'teamkamer', id: a.id });
  // de toegang van B op kamer A geplakt opent kamer A niet: het onderwerp klopt niet
  w.db.data.magnaatTrainingslobbies.kamers[a.id].toegang = JSON.parse(JSON.stringify(w.kamer(b.id).toegang));
  delete w.db.data.magnaatTrainingslobbies.kamers[b.id];
  assert.equal((await w.lobby.deelnemen('gast', b.toegangscode)).status, 404);
  const verkeerdDoel = (await w.lobby.maak('host', { code: 'TEAM' })).kamer;
  w.kamer(verkeerdDoel.id).toegang.doel = 'iets-anders';
  assert.equal((await w.lobby.deelnemen('gast', verkeerdDoel.toegangscode)).status, 404, 'een ander doel opent niets');
});

test('3. issued_at en expires_at: een dag geldig, en verlopen is dicht', async () => {
  const w = wereld();
  const r = (await w.lobby.maak('host', { code: 'TEAM' })).kamer;
  const t = w.kamer(r.id).toegang;
  assert.equal(Date.parse(t.expires_at) - Date.parse(t.issued_at), 24 * 3600000);
  t.expires_at = new Date(Date.now() - 1000).toISOString();
  assert.equal((await w.lobby.deelnemen('gast', r.toegangscode)).status, 404, 'een verlopen code opent de kamer');
});

test('4. max_gebruik telt deelnemers en houdt de kamer op twaalf', async () => {
  const w = wereld();
  const r = (await w.lobby.maak('host', { code: 'TEAM' })).kamer;
  assert.equal(w.kamer(r.id).toegang.max_gebruik, 11);
  await w.lobby.deelnemen('g1', r.toegangscode);
  assert.equal((await w.lobby.deelnemen('g1', r.toegangscode)).herhaald, true);
  assert.equal(w.kamer(r.id).toegang.gebruik, 1, 'een herhaling door dezelfde deelnemer telt niet');
  w.kamer(r.id).toegang.max_gebruik = 1;
  assert.equal((await w.lobby.deelnemen('g2', r.toegangscode)).status, 409, 'opgebruikt is vol');
  w.kamer(r.id).toegang.max_gebruik = 11;
  for (let i = 2; i <= 11; i++) assert.equal((await w.lobby.deelnemen('g' + i, r.toegangscode)).ok, true);
  assert.equal((await w.lobby.deelnemen('g12', r.toegangscode)).status, 409);
});

test('5. roteren en intrekken door de host, en starten sluit de code', async () => {
  const w = wereld();
  const r = (await w.lobby.maak('host', { code: 'TEAM' })).kamer;
  await w.lobby.deelnemen('gast', r.toegangscode);
  assert.equal((await w.lobby.roteerCode('gast', r.id)).status, 403, 'een gast roteert niet');
  const nieuw = await w.lobby.roteerCode('host', r.id);
  assert.match(nieuw.kamer.toegangscode, /^MT\.[0-9A-F]{32}$/);
  assert.equal(w.kamer(r.id).toegang.rotatie, 2);
  assert.equal(w.kamer(r.id).toegang.max_gebruik, 10, 'de vrije plekken na een deelnemer');
  assert.equal((await w.lobby.deelnemen('derde', r.toegangscode)).status, 404, 'de oude code werkt na roteren');
  assert.equal((await w.lobby.deelnemen('derde', nieuw.kamer.toegangscode)).ok, true);
  assert.equal((await w.lobby.intrekCode('gast', r.id)).status, 403, 'een gast trekt niet in');
  assert.equal((await w.lobby.intrekCode('host', r.id)).ok, true);
  assert.ok(w.kamer(r.id).toegang.ingetrokken_at);
  assert.equal((await w.lobby.deelnemen('vierde', nieuw.kamer.toegangscode)).status, 404, 'een ingetrokken code werkt');
  const code3 = (await w.lobby.roteerCode('host', r.id)).kamer.toegangscode;
  let k = (await w.lobby.mijn('host', r.id)).kamer;
  for (const wie of ['host', 'gast', 'derde']) {
    k = (await w.lobby.mijn(wie, r.id)).kamer;
    k = (await w.lobby.kiesRol(wie, r.id, 'operator', k.revisie)).kamer;
  }
  assert.equal((await w.lobby.start('host', r.id, k.revisie, 'start-1')).ok, true);
  assert.ok(w.kamer(r.id).toegang.ingetrokken_at, 'de start trekt de code in');
  assert.equal((await w.lobby.deelnemen('vijfde', code3)).status, 404);
  assert.equal((await w.lobby.roteerCode('host', r.id)).status, 409, 'na de start geen nieuwe code');
  assert.ok(w.sleutels.length && w.sleutels.every(s => s === 'magnaatTrainingslobbies'), 'alles in de collectietransactie');
});

test('6. constant-time: elke kamer wordt vergeleken, waar de treffer ook staat', async () => {
  const w = wereld();
  const kamers = [];
  for (let i = 0; i < 6; i++) kamers.push((await w.lobby.maak('host' + i, { code: 'TEAM' })).kamer);
  const tellingen = [];
  for (const k of [kamers[0], kamers[5]]) {
    w.nul();
    assert.equal((await w.lobby.deelnemen('gast', k.toegangscode)).ok, true);
    tellingen.push(w.tel());
  }
  w.nul();
  assert.equal((await w.lobby.deelnemen('gast', 'MT.' + '0'.repeat(32))).status, 404);
  tellingen.push(w.tel());
  assert.deepEqual(tellingen, [6, 6, 6], 'de positie van de treffer bepaalt het aantal vergelijkingen');
  w.nul();
  assert.equal((await w.lobby.deelnemen('gast', 'ABCDEFGHJ')).status, 404, 'een oude vorm opent niets');
  assert.equal(w.tel(), 0, 'een verkeerd gevormde code wordt niet eens vergeleken');
});

test('7. een kale code van voor de migratie opent niets en verdwijnt bij de eerste schrijfronde', async () => {
  const w = wereld();
  const r = (await w.lobby.maak('host', { code: 'TEAM' })).kamer;
  w.db.data.magnaatTrainingslobbies.kamers[r.id].toegangscode = 'OUDECODE9';
  assert.equal((await w.lobby.deelnemen('gast', 'OUDECODE9')).status, 404);
  assert.equal(w.commits[w.commits.length - 1].includes('OUDECODE9'), false, 'de eerste commit na de migratie droeg de kale code nog');
});

test('8. echte server: de code-routes hangen achter de ledenpas en bereiken de kamerkern', async () => {
  const geheim = require('../server/lib/eenmalig-geheim-routes');
  for (const r of ['/api/member/magnaat/teamkamer/maak', '/api/member/magnaat/teamkamer/code'])
    assert.equal(geheim.isEenmalig('POST', r), true, r + ': geen antwoordcache mag deze kale code heronthullen');
  const srv = await startServer({ env: { SMTP_URL: '' } });
  const api = async (pad, body, tok) => {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
      tok ? { Authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body || {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    const lid = (await api('/api/auth/register', { name: 'Team Lid', email: 'teamcode' + Date.now() + '@x.nl',
      password: 'geheim123', geboortedatum: '1990-01-01', pasApp: 'rtg' })).body.token;
    assert.ok(lid);
    for (const pad of ['/api/member/magnaat/teamkamer/code', '/api/member/magnaat/teamkamer/code/intrek']) {
      assert.equal((await api(pad, { id: 'kamer-bestaatniet' })).status, 401, pad + ' zonder sessie');
      const r = await api(pad, { id: 'kamer-bestaatniet' }, lid);
      assert.equal(r.status, 404, pad + ': ' + JSON.stringify(r.body));
      assert.match(String(r.body.error), /teamkamer bestaat niet/);
    }
    const d = await api('/api/member/magnaat/teamkamer/deelnemen', { code: 'MT.' + 'A'.repeat(32) }, lid);
    assert.equal(d.status, 404, JSON.stringify(d.body));
  } finally { await stop(srv); }
});
