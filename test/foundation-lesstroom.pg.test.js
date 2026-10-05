/* Echte productie-topologieproef voor het stroomticket van RTFoundation-
   onderwijs (B25, CODECREDENTIALS.json foundation.onderwijs_les_tokens).

   Twee onafhankelijke instances delen dezelfde PostgreSQL. Een ticket dat op A
   is uitgegeven wordt acht keer tegelijk geclaimd, verdeeld over A en B:
   precies een claim opent de stroom. PostgreSQL draagt alleen de hash. Daarna
   racen een intrekking van de leerling op A en een claim van zijn ticket op B:
   de claim mag alleen slagen als hij voor de intrekking viel, en een tweede
   claim faalt altijd.

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/foundation-lesstroom.pg.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = PG_URL && REDIS_URL ? false :
  'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances';

test('een stroomticket claimt atomair een keer over twee PG/Redis-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const { createClient } = require('../server/redis');
    const kluis = require('../server/kluis');
    const T = require('../server/foundation/onderwijs/toegang');
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    const ra = createClient({ url: REDIS_URL }), rb = createClient({ url: REDIS_URL });
    try {
      await Promise.all([ra.connect(), rb.connect()]);
      const kanaal = 'rtg:test:lesstroom:' + crypto.randomBytes(8).toString('hex');
      let ontvang, weiger;
      const gezien = new Promise((resolve, reject) => { ontvang = resolve; weiger = reject; });
      const grens = setTimeout(() => weiger(new Error('Redis multi-instancebericht niet ontvangen')), 3000);
      await rb.subscribe(kanaal, bericht => { clearTimeout(grens); ontvang(bericht); });
      await ra.publish(kanaal, 'gereed');
      assert.equal(await gezien, 'gereed');

      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ [T.COLLECTIE]: {} }, true);
      const lees = async () => {
        const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', [T.COLLECTIE]);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, waarde: JSON.parse(json) };
      };
      const toegang = (pg, data) => T({ db: { data, writable: true }, crypto, productie: true,
        bewerkCollectie: (s, w) => pg.bewerkCollectie(s, data, w) });

      const dataA = await a.laadAlles();
      const TA = toegang(a, dataA);
      const les = await TA.nieuweLes();
      const mee = await TA.claim(les.lescode);
      assert.ok(mee.ok, JSON.stringify(mee));
      const TB = toegang(b, await b.laadAlles());

      // 1. acht gelijktijdige claims op een ticket, verdeeld over twee instances
      const g = await TA.stroomticket(les.lesId, mee.token);
      assert.ok(g.ok, JSON.stringify(g));
      let db = await lees();
      assert.equal(db.json.includes(g.ticket.split('.')[1]), false, 'PostgreSQL bevat het kale ticket');
      assert.equal(db.waarde[les.lesId].stroomtickets.length, 1, 'de hash staat er');
      const uitslag = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? TB : TA).claimStroom(les.lesId, g.ticket)));
      assert.equal(uitslag.filter(r => r.ok).length, 1, 'meer of minder dan een claim opende de stroom: ' +
        JSON.stringify(uitslag.map(r => r.status || 'ok')));
      assert.equal(uitslag.find(r => r.ok).studentId, mee.studentId, 'gebonden aan de leerling');
      db = await lees();
      assert.equal(db.waarde[les.lesId].stroomtickets.length, 0, 'en het ticket is weg');

      // 2. intrekken op A tegen een claim op B
      const h = await TB.stroomticket(les.lesId, mee.token);
      const [trek, open] = await Promise.all([TA.intrekLeerling(les.lesId, les.token, mee.studentId),
        TB.claimStroom(les.lesId, h.ticket)]);
      assert.ok(trek.ok, JSON.stringify(trek));
      if (!open.ok) assert.equal(open.status, 403, 'na de intrekking opent het ticket niets: ' + JSON.stringify(open));
      assert.equal((await TA.claimStroom(les.lesId, h.ticket)).status, 403, 'een tweede claim opent nooit');
      assert.equal((await TB.stroomticket(les.lesId, mee.token)).status, 403, 'en een ingetrokken leerling krijgt geen nieuw');
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
