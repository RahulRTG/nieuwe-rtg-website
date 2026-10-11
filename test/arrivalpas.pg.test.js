/* Echte productie-topologieproef voor livingos.invisible_arrival_pass.

   Twee onafhankelijke kerninstances delen de autoritatieve `arrivalToegang`
   in PostgreSQL. Ze racen om dezelfde aanvraag (er ontstaat EEN aankomst en er
   werkt daarna EEN pass), om de voorbereidingsclaim (EEN missie), om rotatie
   tegen een puls, en een intrekking op A maakt de pass op B meteen nutteloos
   voor elke handeling met een effect. De database draagt alleen hashes.

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/arrivalpas.pg.test.js */
'use strict';

const test = require('node:test');
const { vereistAlle } = require('./infra');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = vereistAlle([['pg', !!PG_URL], ['redis', !!REDIS_URL]], 'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances');

test('de Arrival Pass is hash-only en claimt atomair over twee PG/Redis-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const { createClient } = require('../server/redis');
    const kluis = require('../server/kluis');
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    const ra = createClient({ url: REDIS_URL }), rb = createClient({ url: REDIS_URL });
    try {
      await Promise.all([ra.connect(), rb.connect()]);
      const kanaal = 'rtg:test:arrival:' + crypto.randomBytes(8).toString('hex');
      let ontvang, weiger;
      const gezien = new Promise((resolve, reject) => { ontvang = resolve; weiger = reject; });
      const grens = setTimeout(() => weiger(new Error('Redis multi-instancebericht niet ontvangen')), 3000);
      await rb.subscribe(kanaal, bericht => { clearTimeout(grens); ontvang(bericht); });
      await ra.publish(kanaal, 'gereed');
      assert.equal(await gezien, 'gereed');

      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ arrivalToegang: {} }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const reserveringen = new Map();
      const reserveringVan = id => reserveringen.get(id);
      const core = (pg, data) => require('../server/kern/arrivalpas')({
        db: { data, writable: true }, crypto,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk)
      });
      const ca = core(a, dataA), cb = core(b, dataB);
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const vraag = (c, n, rid) => {
        reserveringen.set(rid, { id: rid, supplierCode: 'ZAAK', status: 'aangevraagd' });
        return c.aanvraag({ requestToken: 'pgaanvraag' + n + 'abcdefghijklmnopqrstuvw', supplierCode: 'ZAAK',
          reserveringId: rid, datum: morgen, tijd: '20:00' });
      };
      const lees = async () => {
        const { rows } = await a.pool.query('SELECT val, weg FROM kv WHERE key=$1', ['arrivalToegang']);
        assert.equal(rows.length, 1); assert.equal(rows[0].weg, false);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, rijen: JSON.parse(json) };
      };

      // 1. dezelfde aanvraag tegelijk op A en B: EEN aankomst, en daarna werkt EEN pass
      const [x, y] = await Promise.all([vraag(ca, 1, 'RA'), vraag(cb, 1, 'RB')]);
      assert.equal(x.status, 200); assert.equal(y.status, 200);
      assert.equal(x.id, y.id, 'beide instances wijzen dezelfde aankomst aan');
      assert.equal([x.nieuw, y.nieuw].filter(Boolean).length, 1, 'precies een instance maakte hem');
      let waar = await lees();
      assert.equal(Object.keys(waar.rijen).length, 1, 'een rij, niet twee');
      assert.equal(waar.json.includes(x.code.slice(3)) || waar.json.includes(y.code.slice(3)), false,
        'PostgreSQL bevat alleen hashes');
      const geldig = [];
      for (const r of [x, y]) if ((await ca.roteer(r.code, reserveringVan)).status === 200) geldig.push(r);
      assert.equal(geldig.length, 1, 'van de twee getoonde passen werkt er precies een');

      // 2. twee nabije pulsen tegelijk: EEN voorbereidingsclaim, twee keer gebruik
      const p1 = await vraag(ca, 2, 'R2');
      const [pa, pb] = await Promise.all([
        ca.puls(p1.code, 'in-de-buurt', reserveringVan),
        cb.puls(p1.code, 'gearriveerd', reserveringVan)
      ]);
      assert.equal(pa.status, 200); assert.equal(pb.status, 200);
      assert.equal([pa.prep, pb.prep].filter(Boolean).length, 1, 'precies een missie');
      waar = await lees();
      assert.equal(waar.rijen[p1.id].toegang.gebruik, 2, 'geen puls verloren');

      // 3. rotatie op B tegen een puls op A: de puls telt op de oude of wordt geweigerd -- nooit allebei half
      const p3 = await vraag(ca, 3, 'R3');
      const [puls, rot] = await Promise.all([
        ca.puls(p3.code, 'onderweg', reserveringVan),
        cb.roteer(p3.code, reserveringVan)
      ]);
      assert.equal(rot.status, 200);
      assert.ok(puls.status === 200 || puls.status === 401, 'de puls ging voor de rotatie of vond de pass niet meer');
      assert.equal((await ca.puls(p3.code, 'onderweg', reserveringVan)).status, 401, 'na de rotatie opent de oude niets');
      assert.equal((await ca.puls(rot.code, 'onderweg', reserveringVan)).status, 200);

      // 4. intrekken op A maakt de pass op B meteen nutteloos voor elke handeling met een effect
      const p4 = await vraag(ca, 4, 'R4');
      assert.equal((await ca.intrek(p4.code)).status, 200);
      assert.equal((await cb.puls(p4.code, 'onderweg', reserveringVan)).status, 410);
      assert.equal((await cb.roteer(p4.code, reserveringVan)).status, 410);
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
