/* De code van een concernuitnodiging als credential (workos.concern_uitnodiging),
   control voor control: 128 bit en eenmaal tonen, hash-only opslag, issuer/doel/
   scope, vervaltijd, max_gebruik 1, intrekken en roteren door de werkgever,
   constant-time zoeken, en de claim die met het dienstverband in EEN
   collectietransactie landt. Toets 9 draait tegen een ECHTE server; de raceproef
   over twee instances staat in test/codedeuren-claim.pg.test.js.

   Draai los: node --test test/concern-uitnodiging-credential.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

function wereld(vandaag) {
  const db = { data: {}, writable: true };
  const sleutels = [];
  let vergelijkingen = 0;
  const telCrypto = Object.assign(Object.create(crypto), {
    timingSafeEqual: (a, b) => { vergelijkingen++; return crypto.timingSafeEqual(a, b); } });
  const basis = require('../server/db/collectie-bewerken')({ store: 'json', db, save() {} });
  const K = require('../server/kern/concern')({ db, save() {}, crypto: telCrypto,
    schoon: (v, n) => String(v == null ? '' : v).trim().slice(0, n), findSupplier: () => null,
    vandaag: () => vandaag || new Date().toISOString().slice(0, 10),
    bewerkCollectie: (s, w) => { sleutels.push(s); return basis(s, w); } });
  const e = K.entiteitVind(K.entiteitNieuw('lid_a', { naam: 'Hotel BV', land: 'NL', rechtsvorm: 'bv' }).entiteit.id);
  const v = K.vestigingNieuw(e, { naam: 'Amsterdam', plaats: 'Amsterdam' }).vestiging;
  const nodig = () => K.uitnodigingNieuw('lid_a', { entiteit: e.id, vestiging: v.id, rol: 'receptie' });
  const rij = id => db.data.concern.uitnodigingen[id];
  return { db, K, e, v, nodig, rij, sleutels, tel: () => vergelijkingen, nul: () => { vergelijkingen = 0; } };
}

test('1. 128 bit, kaal alleen in het antwoord op uitnodigen, nergens anders', async () => {
  const w = wereld();
  const u = w.nodig();
  assert.match(u.code, /^CU\.[0-9A-F]{32}$/);
  assert.equal(JSON.stringify(w.db.data).includes(u.code.slice(3)), false, 'de code staat in de opslag');
  assert.match(w.rij(u.uitnodiging.id).toegang.code_hash, /^[a-f0-9]{64}$/);
  const codes = [u.code];
  for (let i = 0; i < 8; i++) codes.push(w.nodig().code);
  // elke positie van het geheim varieert: geen opgevuld of afgekapt geheim
  for (let i = 0; i < 32; i++) assert.ok(new Set(codes.map(c => c.slice(-32)[i])).size > 1, 'positie ' + i + ' van het geheim is vast');
  assert.equal(JSON.stringify(w.K.uitnodigingVanEntiteit(w.e.id)).includes(u.code.slice(3)), false, 'het overzicht toont de code');
  assert.equal(JSON.stringify(w.K.uitnodigingVanEntiteit(w.e.id)).includes('code_hash'), false);
  assert.equal(JSON.stringify(u.uitnodiging).includes(u.code.slice(3)), false);
  const bulk = w.K.uitnodigingBulkVerstuur('lid_a', w.e.id, [{ contact: 'a', rol: 'bar' }, { contact: 'b', rol: 'keuken' }]);
  assert.equal(bulk.uitnodigingen.length, 2);
  for (const x of bulk.uitnodigingen) assert.match(x.code, /^CU\.[0-9A-F]{32}$/, 'bulk geeft elke code een keer terug');
  assert.equal(JSON.stringify(w.K.uitnodigingVanEntiteit(w.e.id)).includes(bulk.uitnodigingen[0].code.slice(3)), false);
});

test('2. issuer, doel, scope en onderwerp', async () => {
  const w = wereld();
  const u = w.nodig();
  const t = w.rij(u.uitnodiging.id).toegang;
  assert.equal(t.issuer, 'rtg.concern.werkgever');
  assert.equal(t.doel, 'concern-uitnodiging-accepteren');
  assert.deepEqual(t.scope, ['concern.dienstverband.accepteren']);
  assert.deepEqual(t.onderwerp, { soort: 'concern-uitnodiging', id: u.uitnodiging.id, entiteit: w.e.id });
  t.doel = 'iets-anders';
  assert.equal((await w.K.uitnodigingAccepteer(u.code, 'lid_n')).status, 404, 'een ander doel opent niets');
  t.doel = 'concern-uitnodiging-accepteren';
  t.onderwerp.id = 'uit_andere';
  assert.equal((await w.K.uitnodigingAccepteer(u.code, 'lid_n')).status, 404, 'een vreemd onderwerp opent niets');
  assert.equal(w.K.employmentVanEntiteit(w.e.id, true).length, 0);
});

test('3. issued_at en expires_at: tot het eind van de geldigheidsdag, en daarna dicht', async () => {
  const w = wereld('2027-06-14');
  const u = w.nodig();
  const t = w.rij(u.uitnodiging.id).toegang;
  assert.equal(t.expires_at, u.uitnodiging.geldigTot + 'T23:59:59.000Z');
  t.expires_at = new Date(Date.now() - 1000).toISOString();
  const r = await w.K.uitnodigingAccepteer(u.code, 'lid_n');
  assert.equal(r.status, 409);
  assert.match(r.error, /verlopen/);
  assert.equal(w.rij(u.uitnodiging.id).stand, 'verlopen');
});

test('4. max_gebruik 1: eenmalig, en de teller staat op de credential', async () => {
  const w = wereld();
  const u = w.nodig();
  assert.equal(w.rij(u.uitnodiging.id).toegang.max_gebruik, 1);
  assert.equal((await w.K.uitnodigingAccepteer(u.code, 'lid_n')).ok, true);
  assert.equal(w.rij(u.uitnodiging.id).toegang.gebruik, 1);
  // ook als iemand de stand terugzet, houdt de teller hem dicht
  w.rij(u.uitnodiging.id).stand = 'open';
  assert.equal((await w.K.uitnodigingAccepteer(u.code, 'lid_o')).status, 409);
  assert.equal(w.K.employmentVanEntiteit(w.e.id, true).length, 1);
});

test('5. intrekken en roteren: server-side, op de verse stand', async () => {
  const w = wereld();
  const u = w.nodig();
  const r = await w.K.uitnodigingRoteer(u.uitnodiging, 'lid_a');
  assert.match(r.code, /^CU\.[0-9A-F]{32}$/);
  assert.equal(w.rij(u.uitnodiging.id).toegang.rotatie, 2);
  assert.equal((await w.K.uitnodigingAccepteer(u.code, 'lid_n')).status, 404, 'de oude code werkt na roteren');
  assert.equal((await w.K.uitnodigingIntrek(u.uitnodiging, 'lid_a')).ok, true);
  assert.ok(w.rij(u.uitnodiging.id).toegang.ingetrokken_at);
  w.rij(u.uitnodiging.id).stand = 'open';
  assert.equal((await w.K.uitnodigingAccepteer(r.code, 'lid_n')).status, 409, 'de ingetrokken credential opent niets, ook met stand open');
  const u2 = w.nodig();
  await w.K.uitnodigingAccepteer(u2.code, 'lid_p');
  assert.equal((await w.K.uitnodigingRoteer(u2.uitnodiging)).status, 409, 'een geaccepteerde uitnodiging roteert niet');
  assert.equal((await w.K.uitnodigingIntrek(u2.uitnodiging)).status, 409);
});

test('6. constant-time: elke uitnodiging wordt vergeleken, en een oude vorm niet eens', async () => {
  const w = wereld();
  const lijst = [];
  for (let i = 0; i < 5; i++) lijst.push(w.nodig());
  const tellingen = [];
  for (const u of [lijst[0], lijst[4]]) { w.nul(); await w.K.uitnodigingAccepteer(u.code, 'lid_' + tellingen.length); tellingen.push(w.tel()); }
  assert.deepEqual(tellingen, [5, 5]);
  w.nul();
  assert.equal((await w.K.uitnodigingAccepteer('1A2B3C4D', 'lid_z')).status, 404, 'de oude vorm van acht hextekens');
  assert.equal(w.tel(), 0);
});

test('7. claim en dienstverband in EEN transactie: mislukt het dienstverband, dan is er niets verbruikt', async () => {
  const w = wereld();
  const u = w.nodig();
  w.K.vestigingSluit(w.K.vestigingVind(w.v.id));
  const r = await w.K.uitnodigingAccepteer(u.code, 'lid_n');
  assert.equal(r.status, 409, JSON.stringify(r));
  assert.equal(w.rij(u.uitnodiging.id).toegang.gebruik, 0, 'de claim bleef staan zonder dienstverband');
  assert.equal(w.rij(u.uitnodiging.id).stand, 'open');
  assert.ok(w.sleutels.length && w.sleutels.every(s => s === 'concern'), 'alles in de collectietransactie op concern');
  const zonder = require('../server/kern/concern')({ db: { data: {} }, save() {}, crypto,
    schoon: (x) => String(x || ''), findSupplier: () => null });
  assert.equal((await zonder.uitnodigingAccepteer('CU.' + '0'.repeat(32), 'lid_n')).status, 503, 'zonder transactie geen claim');
});

test('8. een kale code van voor de migratie opent niets; roteren houdt de uitnodiging', async () => {
  const w = wereld();
  const u = w.nodig();
  const oud = w.rij(u.uitnodiging.id);
  delete oud.toegang; oud.code = '1A2B3C4D';
  assert.equal((await w.K.uitnodigingAccepteer('1A2B3C4D', 'lid_n')).status, 404);
  assert.equal('code' in w.rij(u.uitnodiging.id), false, 'de kale oude code bleef op schijf staan');
  const r = await w.K.uitnodigingRoteer(u.uitnodiging, 'lid_a');
  assert.equal((await w.K.uitnodigingAccepteer(r.code, 'lid_n')).ok, true, 'de werkgever hield de uitnodiging');
});

async function post(base, pad, body, token) {
  const r = await fetch(base + pad, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' },
    token ? { Authorization: 'Bearer ' + token } : {}), body: JSON.stringify(body || {}) });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test('9. echte server: roteren en intrekken zijn van de werkgever, en de oude code opent niets', async () => {
  const geheim = require('../server/lib/eenmalig-geheim-routes');
  for (const r of ['/api/concern/uitnodigen', '/api/concern/bulk/verstuur', '/api/concern/uitnodiging/roteer'])
    assert.equal(geheim.isEenmalig('POST', r), true, r + ': geen antwoordcache mag deze kale code heronthullen');
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-concerncode-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  const lid = async (n) => (await post(srv.base, '/api/auth/register', { name: 'Concern ' + n,
    email: 'cc' + Date.now() + n + '@e.test', password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })).body.token;
  try {
    const baas = await lid(1), werker = await lid(2), ander = await lid(3);
    const ent = (await post(srv.base, '/api/concern/entiteit/nieuw', { naam: 'Hotel Code BV', land: 'NL', rechtsvorm: 'bv' }, baas)).body.entiteit.id;
    const v = (await post(srv.base, '/api/concern/vestiging/nieuw', { entiteit: ent, naam: 'Utrecht', plaats: 'Utrecht' }, baas)).body.vestiging;
    const u = (await post(srv.base, '/api/concern/uitnodigen', { entiteit: ent, vestiging: v.id, rol: 'receptie' }, baas)).body;
    assert.match(u.code, /^CU\.[0-9A-F]{32}$/);
    const lijst = await post(srv.base, '/api/concern/uitnodigingen', { entiteit: ent }, baas);
    assert.equal(JSON.stringify(lijst.body).includes(u.code.slice(3)), false, 'het overzicht toont de code opnieuw');
    assert.equal((await post(srv.base, '/api/concern/uitnodiging/roteer', { uitnodiging: u.uitnodiging.id }, ander)).status, 404,
      'een ander lid roteert andermans uitnodiging');
    const rot = await post(srv.base, '/api/concern/uitnodiging/roteer', { uitnodiging: u.uitnodiging.id }, baas);
    assert.equal(rot.status, 200, JSON.stringify(rot.body));
    assert.equal((await post(srv.base, '/api/concern/uitnodiging/accepteer', { code: u.code }, werker)).status, 404);
    const u2 = (await post(srv.base, '/api/concern/uitnodigen', { entiteit: ent, vestiging: v.id, rol: 'bar' }, baas)).body;
    assert.equal((await post(srv.base, '/api/concern/uitnodiging/intrek', { uitnodiging: u2.uitnodiging.id }, baas)).status, 200);
    assert.equal((await post(srv.base, '/api/concern/uitnodiging/accepteer', { code: u2.code }, werker)).status, 409);
    const acc = await post(srv.base, '/api/concern/uitnodiging/accepteer', { code: rot.body.code }, werker);
    assert.equal(acc.status, 200, JSON.stringify(acc.body));
    const bulk = await post(srv.base, '/api/concern/bulk/verstuur', { entiteit: ent, voorstel: [{ contact: 'x', rol: 'bar' }] }, baas);
    assert.equal(bulk.status, 200, JSON.stringify(bulk.body));
    assert.match(bulk.body.uitnodigingen[0].code, /^CU\.[0-9A-F]{32}$/);
  } finally {
    await stop(srv);
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  }
});
