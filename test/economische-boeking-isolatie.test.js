'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const maak = require('../server/pg/economische-boeking');
const { merge3 } = require('../server/db/merge');

test('PG economic werkt geïsoleerd over awaits en publiceert beide saldodeltas', async () => {
  const data = { paySaldi: { extern: -100, lid: 100 }, payBoekingen: [] };
  const basis = { paySaldi: JSON.stringify(data.paySaldi), payBoekingen: '[]' };
  const toegepast = new Map([['paySaldi', 1], ['payBoekingen', 1]]);
  const laatsteJson = new Map(Object.entries(basis));
  const laatsteGrootte = new Map(), laatsteLengte = new Map(), laatsteCheck = new Map();
  let laatInsertDoor;
  const insertWacht = new Promise(r => { laatInsertDoor = r; });
  let bijInsert;
  const insertBereikt = new Promise(r => { bijInsert = r; });
  let versie = 1, gepauzeerd = false;
  const client = {
    async query(sql, args = []) {
      if (/SELECT afdruk, antwoord/.test(sql)) return { rows: [] };
      if (/SELECT val, ver, weg FROM kv/.test(sql)) {
        const k = args[0]; return { rows: [{ val: basis[k], ver: 1, weg: false }] };
      }
      if (/nextval/.test(sql)) return { rows: [{ v: ++versie }] };
      if (/INSERT INTO kv/.test(sql) && !gepauzeerd) {
        gepauzeerd = true; bijInsert(); await insertWacht;
      }
      return { rows: [] };
    },
    release() {}
  };
  const boekEenmaal = maak({ pool: { connect: async () => client }, merge3,
    uitStore: x => x, naarStore: x => x, toegepast, laatsteJson,
    laatsteGrootte, laatsteLengte, laatsteCheck }).boekEenmaal;
  const identiteit = { domein: 'pay', van: 'extern', naar: 'lid', centen: 10,
    soort: 'terug', ref: 'R/ met spatie' };
  const invoer = { sleutel: 'payout-terug:' + 'a'.repeat(64), afdruk: 'b'.repeat(64),
    identiteit, collecties: ['paySaldi', 'payBoekingen'] };
  const bezig = boekEenmaal(data, invoer, () => {
    const rij = { id: 'ECON-1', van: 'extern', naar: 'lid', centen: 10,
      soort: 'terug', ref: identiteit.ref };
    data.paySaldi.extern -= 10; data.paySaldi.lid += 10;
    data.payBoekingen.unshift(rij);
    return { ok: true, boeking: rij };
  });
  await insertBereikt;
  assert.deepEqual(data.paySaldi, { extern: -100, lid: 100 },
    'geen half-gecommitte conceptstand zichtbaar tijdens DB-await');
  data.paySaldi.extern -= 50; data.paySaldi.lid += 50;
  data.payBoekingen.unshift({ id: 'GEWOON-1', van: 'extern', naar: 'lid', centen: 50,
    soort: 'gewoon', ref: null });
  laatInsertDoor();
  const antwoord = await bezig;
  assert.equal(antwoord.ok, true);
  assert.deepEqual(data.paySaldi, { extern: -160, lid: 160 },
    'gewone en economische delta blijven beide staan');
  assert.deepEqual(new Set(data.payBoekingen.map(x => x.id)), new Set(['ECON-1', 'GEWOON-1']));
  assert.deepEqual(JSON.parse(laatsteJson.get('paySaldi')), { extern: -110, lid: 110 },
    'cachebasis is exact de DB-commit, zodat gewone delta nog vuil blijft');
});
