/* Echte productie-topologieproef voor devices.zaakdoos_sleutel (besluit B12).

   Twee onafhankelijke kerninstances delen de autoritatieve `doosSleutels` in
   PostgreSQL. Er is geen eenmalige claim -- een apparaatsleutel wordt bij elke
   melding gebruikt -- maar er zijn drie mutaties die niet mogen racen:
   1. twee rotaties van dezelfde doos tegelijk: daarna werkt precies een van de
      twee getoonde sleutels, nooit allebei;
   2. het plafond per zaak: twee uitgiftes tegelijk voor de laatste plek, en er
      komt er precies een door;
   3. een intrekking op A terwijl B een andere doos uitgeeft: de intrekking gaat
      niet verloren (geen herrijzende sleutel door een oude werkkopie).
   De database draagt alleen hashes.

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/zaakdoos-sleutel.pg.test.js */
'use strict';

const test = require('node:test');
const { vereistAlle } = require('./infra');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = vereistAlle([['pg', !!PG_URL], ['redis', !!REDIS_URL]], 'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances');

test('de zaakdoossleutel roteert, telt en trekt in als een transactie over twee PG-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const { maakDoosSleutels, MAX_DOZEN_PER_ZAAK } = require('../server/kern/zaakdoos/sleutels');
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    try {
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ doosSleutels: {} }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const core = (pg, data) => maakDoosSleutels({ db: { data, writable: true }, save: () => {}, crypto,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk) });
      const ca = core(a, dataA), cb = core(b, dataB);
      // de waarheid: een verse kern op wat er NU in PostgreSQL staat
      const waar = async () => {
        const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', ['doosSleutels']);
        const json = kluis.ontsleutel(rows[0].val);
        const data = { doosSleutels: JSON.parse(json) };
        return { json, kern: maakDoosSleutels({ db: { data, writable: true }, save: () => {}, crypto,
          bewerkCollectie: () => { throw new Error('alleen lezen'); } }) };
      };

      // 1. twee rotaties van dezelfde doos tegelijk
      const [x, y] = await Promise.all([
        ca.geef({ doos: 'race', zaak: 'ZAAKA', door: 'a' }), cb.geef({ doos: 'race', zaak: 'ZAAKA', door: 'b' })]);
      assert.equal(x.ok, true); assert.equal(y.ok, true);
      let w = await waar();
      const geldig = [x, y].filter(r => w.kern.welke('race', r.sleutel, 'meting'));
      assert.equal(geldig.length, 1, 'van de twee getoonde sleutels werkt er precies een');
      assert.deepEqual([x.rotatie, y.rotatie].sort(), [1, 2], 'de tweede rotatie zag de eerste');
      assert.ok(!w.json.includes(x.sleutel.slice(3)) && !w.json.includes(y.sleutel.slice(3)), 'PostgreSQL bevat alleen hashes');

      // 2. het plafond per zaak: twee uitgiftes tegelijk voor de laatste plek
      for (let i = 0; i < MAX_DOZEN_PER_ZAAK - 1; i++)
        assert.equal((await ca.geef({ doos: 'vol-' + i, zaak: 'ZAAKB', door: 'a' })).ok, true);
      const [p, q] = await Promise.all([
        ca.geef({ doos: 'laatst-a', zaak: 'ZAAKB', door: 'a' }), cb.geef({ doos: 'laatst-b', zaak: 'ZAAKB', door: 'b' })]);
      assert.deepEqual([p.ok === true, q.ok === true].filter(Boolean).length, 1, 'precies een past nog');
      assert.equal([p, q].find(r => !r.ok).status, 409);
      w = await waar();
      assert.equal(w.kern.dozen('ZAAKB').filter(d => d.geldig).length, MAX_DOZEN_PER_ZAAK, 'niet over het plafond');

      // 3. intrekken op A terwijl B een andere doos uitgeeft: de intrekking blijft staan
      const r1 = await ca.geef({ doos: 'weg', zaak: 'ZAAKC', door: 'a' });
      await b.haalNieuwer(dataB, () => {}); // B kent de sleutel van 'weg' als geldig
      const [t, g] = await Promise.all([
        ca.trekIn({ doos: 'weg', door: 'a' }), cb.geef({ doos: 'ander', zaak: 'ZAAKC', door: 'b' })]);
      assert.equal(t.ingetrokken, true); assert.equal(g.ok, true);
      w = await waar();
      assert.deepEqual(w.kern.welke('weg', r1.sleutel, 'meting'), { fout: 'ingetrokken' }, 'de intrekking ging niet verloren');
      assert.equal(w.kern.welke('ander', g.sleutel, 'meting').zaak, 'ZAAKC');
    } finally {
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
