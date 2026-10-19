/* De lescredentials van RTFoundation-onderwijs tegen een ECHTE server (B17):
   elke nieuwe route krijgt hier een treffer, met de montage, de deur en de
   generieke antwoordcaches ervoor. Zie test/foundation-lescredential.test.js
   voor de module en test/foundation-lescredential.pg.test.js voor de race.

   Draai los: node --test test/foundation-lescredential-server.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtf-lescred-'));
let srv, BASE;
test.before(async () => {
  srv = await startServer({ env: { RTG_DATA_DIR: TMP, SMTP_URL: '' }, wachtPad: '/api/foundation/health' });
  BASE = srv.base;
});
test.after(() => { stop(srv && srv.child); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });

const post = async (pad, body) => {
  const r = await fetch(BASE + (pad.startsWith('/api/') ? pad : '/api/foundation' + pad), { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data, cache: r.headers.get('cache-control') };
};
const lees = async (pad, token) => (await fetch(BASE + (pad.startsWith('/api/') ? pad : '/api/foundation' + pad),
  { headers: token ? { Authorization: 'Bearer ' + token } : {} })).status;

test('maken, meedoen en een herhaling: de codes staan een keer in een antwoord', async () => {
  const een = await post('/api/foundation/les/maak', { vak: 'Zelfde', naam: 'Juf', idem: 'k-1' });
  assert.equal(een.status, 200);
  assert.match(een.data.lescode, /^LES\.[0-9A-F]{32}$/);
  assert.equal(een.cache, 'no-store');
  const twee = await post('/api/foundation/les/maak', { vak: 'Zelfde', naam: 'Juf', idem: 'k-1' });
  assert.equal(twee.status, 409, 'dezelfde idem maakt geen tweede les');
  assert.equal(twee.data.lescode, undefined, 'en de generieke cache heronthult niets');
  assert.equal(twee.data.token, undefined);
  const zonderIdem = await post('/api/foundation/les/maak', { vak: 'Zelfde', naam: 'Juf' });
  assert.notEqual(zonderIdem.data.lescode, een.data.lescode, 'een woordelijk gelijk verzoek krijgt nooit de bewaarde codes');
  const mee = await post('/api/foundation/les/join', { lescode: een.data.lescode, naam: 'Sam' });
  assert.equal(mee.status, 200);
  assert.equal((await post('/api/foundation/les/join', { lescode: een.data.lescode, naam: 'Sam' })).status, 409);
});

test('roteren, intrekken, een leerling eruit en de les sluiten -- elk op een echte route', async () => {
  const d = (await post('/api/foundation/les/maak', { vak: 'Beheer', naam: 'Meester' })).data;
  const id = d.lesId;
  const sam = (await post('/api/foundation/les/join', { lescode: d.lescode, naam: 'Sam' })).data;
  const noor = (await post('/api/foundation/les/join', { lescode: d.lescode, naam: 'Noor' })).data;

  // een leerling mag niets beheren
  assert.equal((await post('/api/foundation/les/code/roteer', { code: id, token: sam.token })).status, 403);
  assert.equal((await post('/api/foundation/les/sluit', { code: id, token: sam.token })).status, 403);

  const rot = await post('/api/foundation/les/code/roteer', { code: id, token: d.token });
  assert.equal(rot.status, 200);
  assert.match(rot.data.lescode, /^LES\.[0-9A-F]{32}$/);
  assert.equal((await post('/api/foundation/les/join', { lescode: d.lescode, naam: 'Kim' })).status, 410, 'de oude lescode is vervangen');
  assert.equal((await post('/api/foundation/les/join', { lescode: rot.data.lescode, naam: 'Kim' })).status, 200);

  const trek = await post('/api/foundation/les/code/intrekken', { code: id, token: d.token });
  assert.equal(trek.status, 200);
  assert.ok(trek.data.toegang.ingetrokken_at);
  assert.equal(trek.data.toegang.code_hash, undefined, 'het antwoord toont geen hash');
  assert.equal((await post('/api/foundation/les/join', { lescode: rot.data.lescode, naam: 'Lot' })).status, 410);
  assert.equal((await post('/api/foundation/les/code/intrekken', { code: id, token: d.token })).status, 200, 'een tweede keer verandert niets');

  assert.equal(await lees('/schrift/' + id, sam.token), 200);
  /* Een OPEN live-stroom van Sam hoort bij de intrekking dicht te gaan; anders
     keek hij gewoon door na zijn intrekking. */
  /* B25: de stroom opent met een eenmalig stroomticket, nooit met de sleutel in het adres. */
  const tik = async tok => (await fetch(BASE + '/api/foundation/les/stroomticket', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ code: id }) }));
  const samTicket = (await (await tik(sam.token)).json()).ticket;
  const open = await fetch(BASE + '/api/foundation/les/' + id + '/stream?role=leerling&ticket=' + samTicket);
  assert.equal(open.status, 200);
  const lezer = open.body.getReader();
  await lezer.read();
  const eruit = await post('/api/foundation/les/leerling/intrekken', { code: id, token: d.token, studentId: sam.studentId });
  const einde = await Promise.race([(async () => { for (;;) { const x = await lezer.read(); if (x.done) return 'dicht'; } })(),
    new Promise(r => setTimeout(() => r('nog open'), 3000))]);
  assert.equal(einde, 'dicht', 'de open stroom van Sam is gesloten');
  assert.equal(eruit.status, 200);
  assert.equal(await lees('/schrift/' + id, sam.token), 403, 'Sam komt niet meer in zijn schrift');
  assert.equal(await lees('/schrift/' + id, noor.token), 200, 'Noor wel');
  assert.equal((await tik(sam.token)).status, 403, 'en krijgt geen stroomticket meer');

  const dicht = await post('/api/foundation/les/sluit', { code: id, token: d.token });
  assert.equal(dicht.status, 200);
  assert.equal(await lees('/les/' + id, d.token), 403, 'de leraarssleutel opent niets meer');
  assert.equal(await lees('/schrift/' + id, noor.token), 403);
  assert.equal((await post('/api/foundation/les/sluit', { code: id, token: d.token })).status, 403, 'een gesloten les opent ook voor de leraar niets meer');
});

test('het les-id is geen geloofsbrief, en de AI-bijles vraagt een geldige sleutel', async () => {
  const d = (await post('/api/foundation/les/maak', { vak: 'Id', naam: 'Juf' })).data;
  const k = (await post('/api/foundation/les/join', { lescode: d.lescode, naam: 'Kim' })).data;
  for (const pad of ['/les/', '/bord/', '/schrift/', '/opgaven/']) assert.equal(await lees(pad + d.lesId), 403, pad);
  assert.equal((await post('/api/foundation/ai', { code: d.lesId, messages: [{ role: 'user', content: 'hoi' }] })).status, 403);
  const ai = await post('/api/foundation/ai', { code: d.lesId, token: k.token, messages: [{ role: 'user', content: 'breuken' }] });
  assert.equal(ai.status, 200);
  const ander = (await post('/api/foundation/les/maak', { vak: 'Ander', naam: 'Juf' })).data;
  assert.equal(await lees('/bord/' + ander.lesId, k.token), 403, 'een sleutel van een andere les opent niets');
});

/* Gevonden door de voltooiproef (scripts/lib/voltooi/rtfbord.js): een dubbele
   tik op "+" of "Zet" op het bord -- twee gelijke verzoeken tegelijk, of opnieuw
   na een afgebroken verzoek -- zette het agendapunt of de opgave twee keer voor
   de klas. */
/* De 409 voor dezelfde sleutel met een andere tekst staat in de route, maar
   zolang de server draait staat de centrale antwoordkas ervoor: deze router hangt
   onder app.use('/api/foundation') en de EIGEN-lijst kent hem niet
   (test/idempotentie.test.js scant alleen app.post). Gemeld aan de integrator. */
test('een herhaalsleutel per opgave en per agendapunt: dezelfde sleutel een keer, een bewust tweede gelijke wel', async () => {
  const d = (await post('/api/foundation/les/maak', { vak: 'Dubbel', naam: 'Juf' })).data;
  const D = (b) => Object.assign({ code: d.lesId, token: d.token }, b);
  const [o1, o2] = await Promise.all([post('/api/foundation/opgave', D({ tekst: 'Som 1 tot 8', idem: 'opg-1' })), post('/api/foundation/opgave', D({ tekst: 'Som 1 tot 8', idem: 'opg-1' }))]);
  assert.equal(o1.status, 200); assert.equal(o2.status, 200);
  assert.equal(o1.data.opgave.id, o2.data.opgave.id, 'een dubbele tik gaf twee opgaven');
  const tweede = await post('/api/foundation/opgave', D({ tekst: 'Som 1 tot 8', idem: 'opg-2' }));
  assert.notEqual(tweede.data.opgave.id, o1.data.opgave.id, 'een bewust tweede gelijke opgave werd opgeslokt');
  const [, a2] = await Promise.all([post('/api/foundation/agenda', D({ tekst: 'Toets', datum: '2026-11-02', idem: 'ag-1' })), post('/api/foundation/agenda', D({ tekst: 'Toets', datum: '2026-11-02', idem: 'ag-1' }))]);
  assert.equal(a2.data.agenda.filter(x => x.tekst === 'Toets').length, 1, 'een dubbele tik zette het agendapunt twee keer neer');
});
