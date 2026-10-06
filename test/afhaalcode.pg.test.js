/* Echte productie-topologieproef voor pay.order_pickup_code.

   Twee onafhankelijke kerninstances delen de autoritatieve `afhaalToegang`-rij
   in PostgreSQL. Ze racen om dezelfde afhaalcode, om uitgifte tegen rotatie, en
   om de betaalweg van een balie-bon; in elk van die drie wint er precies een,
   en de database draagt daarna alleen hashes. Twee Redis-verbindingen bewijzen
   dat de verplichte multi-instancebus bereikbaar is; de claim zelf serialiseert
   in de PostgreSQL-collectietransactie (advisory lock + FOR UPDATE).

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/afhaalcode.pg.test.js */
'use strict';

const test = require('node:test');
const { vereistAlle } = require('./infra');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = vereistAlle([['pg', !!PG_URL], ['redis', !!REDIS_URL]], 'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances');

test('afhaalcode is hash-only en claimt atomair over twee PG/Redis-instances',
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
      const kanaal = 'rtg:test:afhaalcode:' + crypto.randomBytes(8).toString('hex');
      let ontvang, weiger;
      const gezien = new Promise((resolve, reject) => { ontvang = resolve; weiger = reject; });
      const grens = setTimeout(() => weiger(new Error('Redis multi-instancebericht niet ontvangen')), 3000);
      await rb.subscribe(kanaal, bericht => { clearTimeout(grens); ontvang(bericht); });
      await ra.publish(kanaal, 'gereed');
      assert.equal(await gezien, 'gereed');

      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ afhaalToegang: {} }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      /* De order zelf is op beide instances dezelfde: in productie komt hij uit
         het grootboek. Hier telt alleen wat in afhaalToegang serialiseert. */
      const orders = new Map();
      const order = (ref, extra) => orders.set(ref, Object.assign({ ref, supplierCode: 'ZAAK',
        customerKey: 'lid:' + ref, customerTier: 'rtg', status: 'nieuw', paid: false, aanBalie: true,
        total: 12 }, extra)).get(ref);
      const core = (pg, data) => require('../server/kern/afhaalcode')({
        db: { data, writable: true }, crypto,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk)
      });
      const ca = core(a, dataA), cb = core(b, dataB);
      const orderVan = ref => orders.get(ref);
      const lees = async () => {
        const { rows } = await a.pool.query('SELECT val, weg FROM kv WHERE key=$1', ['afhaalToegang']);
        assert.equal(rows.length, 1); assert.equal(rows[0].weg, false);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, rijen: JSON.parse(json) };
      };

      // 1. claimrace: dezelfde code tegelijk op A en B
      const o1 = order('PG-1');
      const uit = await ca.uitgeven({ order: o1, key: 'lid:PG-1' });
      assert.equal(uit.status, 200);
      const race = await Promise.all([
        ca.claim({ code: uit.code, supplierCode: 'ZAAK', actor: 'A', orderVan }),
        cb.claim({ code: uit.code, supplierCode: 'ZAAK', actor: 'B', orderVan })
      ]);
      assert.equal(race.filter(x => x.status === 200).length, 1, 'exact een instance geeft uit');
      assert.equal(race.filter(x => x.status === 409).length, 1);
      assert.equal(race.filter(x => x.afgerekend === true).length, 1, 'en er wordt precies een keer afgerekend');
      let waar = await lees();
      assert.equal(waar.json.includes(uit.code), false, 'PostgreSQL bevat alleen de hash');
      assert.equal(waar.rijen['PG-1'].toegang.gebruik, 1);

      // 2. rotatie op B terwijl A claimt: of de oude code gaf uit, of hij is vervangen -- nooit allebei
      const o2 = order('PG-2');
      const oud = await ca.uitgeven({ order: o2, key: 'lid:PG-2' });
      const [claimOud, rot] = await Promise.all([
        ca.claim({ code: oud.code, supplierCode: 'ZAAK', actor: 'A', orderVan }),
        cb.uitgeven({ order: o2, key: 'lid:PG-2' })
      ]);
      assert.equal([claimOud.status === 200, rot.status === 200].filter(Boolean).length, 1,
        'claim en rotatie sluiten elkaar uit');
      if (rot.status === 200) {
        assert.equal((await cb.claim({ code: oud.code, supplierCode: 'ZAAK', actor: 'B', orderVan })).status, 409);
        waar = await lees();
        assert.equal(waar.json.includes(rot.code), false);
      }

      // 3. betaalweg: de app op A en de kassa op B tegelijk -- nooit allebei afrekenen
      const o3 = order('PG-3');
      const c3 = await cb.uitgeven({ order: o3, key: 'lid:PG-3' });
      const [app, kassa] = await Promise.all([
        ca.betaalBegin(o3),
        cb.claim({ code: c3.code, supplierCode: 'ZAAK', actor: 'B', orderVan })
      ]);
      const appWint = app.ok === true, kassaRekent = kassa.status === 200 && kassa.afgerekend === true;
      assert.equal([appWint, kassaRekent].filter(Boolean).length, 1, 'precies een betaalweg wint');
      waar = await lees();
      assert.equal(waar.rijen['PG-3'].betaling.weg, appWint ? 'app' : 'kassa');

      // 4. intrekken op A maakt de code op B direct nutteloos
      const o4 = order('PG-4');
      const c4 = await ca.uitgeven({ order: o4, key: 'lid:PG-4' });
      await ca.sluit({ order: o4, actor: 'zaak:ZAAK', reden: 'geweigerd' });
      assert.equal((await cb.claim({ code: c4.code, supplierCode: 'ZAAK', actor: 'B', orderVan })).status, 409);
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
