/* Echte productie-topologieproef voor identity.algpin_herstelsleutel.

   Twee onafhankelijke kerninstances delen de autoritatieve `algPinHerstel` in
   PostgreSQL. Ze racen om dezelfde herstelsleutel (precies een claim wint), om
   twee aanvragen van hetzelfde lid tegelijk (er blijft precies een werkende
   sleutel over), en een aanvraag op B trekt de sleutel in die A net uitgaf --
   ook al heeft A die intrekking nog niet in zijn eigen werkkopie gezien. De
   database draagt alleen hashes. De serialisatie is die van
   db.bewerkCollectie (advisory lock + FOR UPDATE, pg/collectietransactie.js).

   MUTATIE (gedraaid tegen een echte PostgreSQL): claim() als lezen-dan-
   schrijven in TWEE transacties in plaats van een -> "precies een instance
   claimt de sleutel" zakt, want beide instances lazen hem voordat een van beide
   hem verwijderde.

   Draai los: DATABASE_URL=... node --test test/algpin-herstel.pg.test.js */
'use strict';

const test = require('node:test');
const { vereist } = require('./infra');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = vereist('pg', !!PG_URL, 'vereist een echte DATABASE_URL voor twee onafhankelijke instances');

test('de herstelsleutel is hash-only, trekt atomair in bij heruitgifte en claimt een keer over twee instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    try {
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ algPinHerstel: {} }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const sleutelHash = t => crypto.createHash('sha256').update(String(t)).digest('hex');
      const kern = (pg, data) => require('../server/kern/algpin-herstel')({ crypto, sleutelHash,
        HERSTEL_MS: 3600000, bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk) });
      const ka = kern(a, dataA), kb = kern(b, dataB);
      const lees = async () => {
        const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', ['algPinHerstel']);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, rijen: JSON.parse(json) };
      };

      // 1. dezelfde sleutel tegelijk op A en B: precies een claim wint
      const r1 = await ka.geef('lid-1');
      const h1 = sleutelHash(r1.sleutel);
      const [x, y] = await Promise.all([ka.claim(h1), kb.claim(h1)]);
      assert.equal([x, y].filter(Boolean).length, 1, 'precies een instance claimt de sleutel');
      assert.equal((x || y).key, 'lid-1');
      assert.equal(Object.keys((await lees()).rijen).length, 0, 'en daarna is hij weg');

      // 2. twee aanvragen van hetzelfde lid tegelijk: er blijft EEN werkende sleutel over
      const [g1, g2] = await Promise.all([ka.geef('lid-2'), kb.geef('lid-2')]);
      const waar = await lees();
      assert.equal(Object.values(waar.rijen).filter(r => r.key === 'lid-2').length, 1, 'een rij voor lid-2, niet twee');
      assert.equal(waar.json.includes(g1.sleutel) || waar.json.includes(g2.sleutel), false, 'PostgreSQL bevat alleen hashes');
      const werkend = [];
      for (const g of [g1, g2]) if (await ka.claim(sleutelHash(g.sleutel))) werkend.push(g);
      assert.equal(werkend.length, 1, 'van de twee verstuurde links werkt er precies een');

      // 3. uitgeven op A, opnieuw aanvragen op B: de link van A is dood, ook op A
      const opA = await ka.geef('lid-3');
      const opB = await kb.geef('lid-3');
      assert.equal(await ka.claim(sleutelHash(opA.sleutel)), null, 'de eerste link is ingetrokken door de aanvraag op B');
      assert.deepEqual(await ka.claim(sleutelHash(opB.sleutel)), { key: 'lid-3' });
    } finally {
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
