'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function bouw(begin = {}) {
  const db = { data: { samenKamers: JSON.parse(JSON.stringify(begin)) } };
  const events = [];
  let rij = Promise.resolve();
  const bewerkCollectie = (naam, werk) => {
    assert.equal(naam, 'samenKamers');
    const beurt = rij.then(() => {
      const kopie = JSON.parse(JSON.stringify(db.data.samenKamers));
      const r = werk(kopie);
      db.data.samenKamers = kopie;
      return r;
    });
    rij = beurt.then(() => undefined, () => undefined);
    return beurt;
  };
  const samen = require('../server/kern/samen')({ db, save() {}, bewerkCollectie,
    crypto, schoon: (v, n) => String(v || '').slice(0, n),
    sseToCustomer: (key, soort, data) => events.push({ key, soort, data }) }).samen;
  return { db, events, samen };
}

test('Samen geeft 128 bits eenmaal uit en bewaart alleen hash plus lifecycle', async () => {
  const { db, samen } = bouw();
  const uit = await samen.maak('lid:A', 'Amber', 'maak-1');
  assert.match(uit.code, /^SAMEN\.[A-F0-9]{32}$/);
  assert.match(uit.kamer.id, /^sk[a-f0-9]{32}$/);
  assert.equal(uit.kamer.code, undefined);
  assert.equal(uit.eenmalig, true);
  const opslag = JSON.stringify(db.data.samenKamers);
  assert.equal(opslag.includes(uit.code), false);
  assert.match(opslag, /"code_hash":"[a-f0-9]{64}"/);
  const t = Object.values(db.data.samenKamers)[0].toegang;
  assert.equal(t.doel, 'livingos-samen-kamer');
  assert.deepEqual(t.scope, ['samen.join']);
  assert.equal(t.max_gebruik, 11);
  assert.ok(Date.parse(t.expires_at) > Date.parse(t.issued_at));

  const retry = await samen.maak('lid:A', 'Amber', 'maak-1');
  assert.equal(retry.status, 409);
  assert.equal(retry.code, undefined);
  assert.equal(Object.keys(db.data.samenKamers).length, 1);
});

test('gelijktijdige claims boeken gebruik en capaciteit precies eenmaal', async () => {
  const { db, samen } = bouw();
  const uit = await samen.maak('lid:A', 'Amber', 'race-maak');
  const pogingen = await Promise.all('BCDEFGHIJKLM'.split('').map(letter =>
    samen.doeMee('lid:' + letter, 'Code' + letter, uit.code)));
  assert.equal(pogingen.filter(r => r && r.ok).length, 11);
  assert.equal(pogingen.filter(r => r && r.status === 404).length, 1,
    'een opgebruikte credential verraadt geen bestaande kamer');
  const k = db.data.samenKamers[uit.kamer.id];
  assert.equal(k.leden.length, 12);
  assert.equal(k.toegang.gebruik, 11);
  assert.equal(new Set(k.leden.map(l => l.key)).size, 12);
  const herhaal = await samen.staat('lid:B', uit.kamer.id);
  assert.equal(herhaal.ok, true, 'na de eerste claim gebruikt een lid alleen de kamer-id');
  assert.equal(k.toegang.gebruik, 11);
});

test('na toetreding werkt alleen kamer-id; rotatie en sluiting trekken server-side in', async () => {
  const { db, events, samen } = bouw();
  const eerste = await samen.maak('lid:A', 'Amber', 'maak-2');
  const id = eerste.kamer.id;
  assert.equal((await samen.doeMee('lid:B', 'Beryl', eerste.code)).ok, true);
  assert.equal((await samen.staat('lid:B', id)).ok, true);
  assert.equal((await samen.staat('lid:B', eerste.code)).status, 404,
    'de credential is geen dagelijkse kamer-id');
  assert.equal((await samen.staat('lid:C', id)).status, 404,
    'een kamer-id geeft een buitenstaander geen toegang');

  const nieuw = await samen.roteer('lid:A', id, 'rotatie-1');
  assert.match(nieuw.code, /^SAMEN\.[A-F0-9]{32}$/);
  assert.equal((await samen.doeMee('lid:C', 'Ceder', eerste.code)).status, 404);
  assert.equal((await samen.doeMee('lid:C', 'Ceder', nieuw.code)).ok, true);
  const retry = await samen.roteer('lid:A', id, 'rotatie-1');
  assert.equal(retry.status, 409);
  assert.equal(retry.code, undefined);

  await samen.zet('lid:A', id, '/apps/mall.html', 'Mall');
  assert.equal(events.some(e => e.data.id === id && e.data.kind === 'kijk'), true);
  assert.equal(events.some(e => JSON.stringify(e).includes(eerste.code) ||
    JSON.stringify(e).includes(nieuw.code)), false);

  const reset = 'ZEER-GEHEIME-HERSTELCODE';
  const gelekt = await samen.zet('lid:A', id, '/apps/app.html?pinherstel=' + reset, 'Herstel');
  assert.equal(gelekt.status, 400);
  assert.equal(JSON.stringify(db.data.samenKamers).includes(reset), false);
  assert.equal(JSON.stringify(events).includes(reset), false);

  db.data.samenKamers[id].pad = '/apps/app.html?reset=' + reset;
  db.data.samenKamers[id].titel = 'Oud hersteladres';
  const opgeschoond = await samen.staat('lid:A', id);
  assert.equal(opgeschoond.kamer.pad, null, 'een bestaand querypad wordt vóór uitlezen gewist');
  assert.equal(db.data.samenKamers[id].pad, null);

  assert.equal((await samen.sluit('lid:B', id)).status, 403);
  assert.equal((await samen.sluit('lid:A', id)).ok, true);
  assert.ok(db.data.samenKamers[id].gesloten_at);
  assert.ok(db.data.samenKamers[id].toegang.ingetrokken_at);
  assert.equal((await samen.staat('lid:B', id)).status, 404);
  assert.equal((await samen.doeMee('lid:D', 'Dadel', nieuw.code)).status, 404);
  assert.equal((await samen.sluit('lid:A', id)).status, 404);
});

test('zwakke legacy-code wordt verwijderd en fail-closed gesloten', async () => {
  const oud = { ABC234: { code: 'ABC234', gastheer: 'Oud', gastheerKey: 'lid:A',
    leden: [{ key: 'lid:A', codenaam: 'Oud' }], chat: [], at: Date.now() } };
  const { db, samen } = bouw(oud);
  await samen.ruimOp();
  const tekst = JSON.stringify(db.data.samenKamers);
  assert.equal(tekst.includes('ABC234'), false);
  assert.match(tekst, /"code_hash":"[a-f0-9]{64}"/);
  assert.ok(Object.values(db.data.samenKamers)[0].gesloten_at);
  assert.equal((await samen.doeMee('lid:B', 'Beryl', 'ABC234')).status, 404);
});

test('browser bewaart uitsluitend kamer-id en caches herhalen uitgifte nooit', () => {
  const root = path.join(__dirname, '..');
  const bron = fs.readFileSync(path.join(root, 'public/shared/metgezel/metgezel-03.js'), 'utf8');
  const muziek = fs.readFileSync(path.join(root, 'public/apps/muziek.html'), 'utf8');
  assert.match(bron, /localStorage\.setItem\(KAMERKEY, id\)/);
  assert.doesNotMatch(bron, /localStorage\.setItem\([^\n]*[cC]ode/);
  assert.doesNotMatch(bron, /kamer\.code|k\.code/);
  assert.doesNotMatch(bron, /location\.pathname\s*\+\s*location\.search/,
    'Samen deelt nooit querycredentials met de kamer');
  assert.match(muziek, /sesId = j\.kamer\.id/);
  assert.doesNotMatch(muziek, /sesCode|j\.kamer\.code/);
  const geheim = require('../server/lib/eenmalig-geheim-routes');
  const nooit = require('../server/lib/idemsleutels-nooit').NOOIT;
  for (const route of ['/api/samen/maak', '/api/samen/code']) {
    assert.equal(geheim.isEenmalig('POST', route), true);
    assert.ok(nooit['POST ' + route]);
  }
});
