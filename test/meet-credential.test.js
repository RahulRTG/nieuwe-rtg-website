'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { maakMeet } = require('../server/kern/meet');

const namen = Object.fromEntries('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(x => [x, 'Code' + x]));
function bouw(begin = []) {
  const db = { data: { meetKamers: JSON.parse(JSON.stringify(begin)), agendas: {} } };
  let rij = Promise.resolve();
  const bewerkCollectie = (sleutel, werk) => {
    const beurt = rij.then(() => {
      const kopie = JSON.parse(JSON.stringify(db.data[sleutel] || []));
      const antwoord = werk(kopie);
      db.data[sleutel] = kopie;
      return antwoord;
    });
    rij = beurt.then(() => undefined, () => undefined);
    return beurt;
  };
  const seinen = [];
  const meet = maakMeet({ db, save() {}, bewerkCollectie, crypto,
    schoon: (v, n) => String(v || '').slice(0, n), codenaamVan: k => namen[k] || null,
    sseToCustomer: (key, soort, data) => seinen.push({ key, soort, data }) });
  return { db, meet, seinen };
}

test('Meet bewaart alleen hash+lifecycle en onthult de 128-bit code eenmaal', async () => {
  const { db, meet } = bouw();
  const eerste = await meet.meetMaak('A', { titel: 'Bestuurskamer' }, 'verzoek-1');
  assert.match(eerste.code, /^MEET\.[A-F0-9]{32}$/);
  assert.equal(eerste.eenmalig, true);
  assert.equal(eerste.kamer.code, undefined);
  const opslag = JSON.stringify(db.data.meetKamers);
  assert.ok(!opslag.includes(eerste.code));
  const toegang = db.data.meetKamers[0].toegang;
  assert.match(toegang.code_hash, /^[a-f0-9]{64}$/);
  assert.equal(toegang.doel, 'livingos-meet-kamer');
  assert.deepEqual(toegang.scope, ['meet.join']);
  assert.ok(Date.parse(toegang.expires_at) > Date.parse(toegang.issued_at));
  assert.equal(toegang.max_gebruik, 12);

  const retry = await meet.meetMaak('A', { titel: 'Bestuurskamer' }, 'verzoek-1');
  assert.equal(retry.status, 409);
  assert.equal(retry.code, undefined);
  assert.ok(!JSON.stringify(retry).includes(eerste.code));
  assert.equal(db.data.meetKamers.length, 1);

  const lijst = await meet.meetMijn('A');
  assert.equal(lijst.kamers.length, 1);
  assert.equal(lijst.kamers[0].code, undefined);
  assert.ok(!JSON.stringify(lijst).includes('code_hash'));
});

test('gelijktijdige joins claimen capaciteit en gebruiksteller atomair', async () => {
  const { db, meet } = bouw();
  const uit = await meet.meetMaak('A', { titel: 'Racekamer' }, 'race-1');
  assert.equal((await meet.meetKom('A', { id: uit.id })).kamer.id, uit.id);
  const pogingen = await Promise.all('BCDEFGHIJKLM'.split('').map(key =>
    meet.meetKom(key, { code: uit.code })));
  assert.equal(pogingen.filter(x => x && !x.error).length, 11);
  assert.equal(pogingen.filter(x => x && x.status === 409).length, 1);
  const kamer = db.data.meetKamers[0];
  assert.equal(kamer.aanwezig.length, 12);
  assert.equal(kamer.toegang.gebruik, 11);
  assert.equal(new Set(kamer.aanwezig.map(x => x.key)).size, 12);
  const nogmaals = await meet.meetKom('B', { code: uit.code });
  assert.equal(nogmaals.al, true);
  assert.equal(db.data.meetKamers[0].toegang.gebruik, 11);
});

test('rotatie en sluiting maken oude codes server-side nutteloos', async () => {
  const { db, meet } = bouw();
  const oud = await meet.meetMaak('A', { titel: 'Rotatiekamer' }, 'maak-1');
  const nieuw = await meet.meetCode('A', oud.id, 'roteer-1');
  assert.match(nieuw.code, /^MEET\.[A-F0-9]{32}$/);
  assert.notEqual(nieuw.code, oud.code);
  assert.equal((await meet.meetKom('B', { code: oud.code })).status, 404);
  assert.equal((await meet.meetKom('B', { code: nieuw.code })).kamer.id, oud.id);
  const retry = await meet.meetCode('A', oud.id, 'roteer-1');
  assert.equal(retry.status, 409);
  assert.equal(retry.code, undefined);
  assert.ok(!JSON.stringify(db.data.meetKamers).includes(nieuw.code));
  assert.equal((await meet.meetWeg('A', oud.id)).ok, true);
  assert.equal((await meet.meetKom('C', { code: nieuw.code })).status, 404);
  assert.ok(db.data.meetKamers[0].toegang.ingetrokken_at);
  assert.ok(db.data.meetKamers[0].gesloten_at);
});

test('legacy zes-teken-codes worden hash-only maar fail-closed ingetrokken', async () => {
  const legacy = [{ id: 'mklegacy', code: 'ABC234', titel: 'Oud', host: 'A',
    wieMag: [], agendaId: null, aanwezig: [], op: new Date().toISOString(),
    laatst: new Date().toISOString() }];
  const { db, meet } = bouw(legacy);
  const lijst = await meet.meetMijn('A');
  assert.equal(lijst.kamers[0].toegang.stand, 'gesloten');
  assert.equal(db.data.meetKamers[0].code, undefined);
  assert.ok(!JSON.stringify(db.data.meetKamers).includes('ABC234'));
  assert.equal((await meet.meetKom('B', { code: 'ABC234' })).status, 404);
  const nieuw = await meet.meetCode('A', 'mklegacy', 'legacy-roteer');
  assert.match(nieuw.code, /^MEET\.[A-F0-9]{32}$/);
});

test('UI, Agenda-deeplink en generieke caches heronthullen de code niet', () => {
  const root = path.join(__dirname, '..');
  const app = fs.readFileSync(path.join(root, 'public/apps/meet/app.js'), 'utf8');
  const agenda = fs.readFileSync(path.join(root, 'public/apps/agenda/paneel.js'), 'utf8');
  const kamer = fs.readFileSync(path.join(root, 'public/apps/meet/kamer.js'), 'utf8');
  const geheim = require('../server/lib/eenmalig-geheim-routes');
  assert.doesNotMatch(app, /k\.code|data-kom="[^\n]*k\.code/);
  assert.match(app, /binnen\(\{ id:/);
  assert.match(agenda, /#kamer=' \+ encodeURIComponent\(d\.id\)/);
  assert.doesNotMatch(agenda, /#kamer=' \+ d\.code/);
  assert.doesNotMatch(kamer, /kamer\.code/);
  assert.equal(geheim.isEenmalig('POST', '/api/meet/maak'), true);
  assert.equal(geheim.isEenmalig('POST', '/api/meet/code'), true);
  const nooit = require('../server/lib/idemsleutels-nooit').NOOIT;
  assert.match(nooit['POST /api/meet/maak'], /eenmalige Meet-code/);
  assert.match(nooit['POST /api/meet/code'], /eenmalige Meet-code/);
});
