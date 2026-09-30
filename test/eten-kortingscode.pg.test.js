/* Echte productie-topologieproef voor eten.kortingscode (de promotiecode).

   Twee onafhankelijke kerninstances delen de `etenKortingGebruik`-rij in
   PostgreSQL. Twee leden claimen tegelijk het LAATSTE gebruik: precies een
   krijgt het. Een lid dat op twee instances tegelijk twee rekeningen probeert,
   krijgt zijn grens per lid een keer. En dezelfde rekening op twee instances
   telt een keer. Twee Redis-verbindingen bewijzen dat de multi-instancebus
   bereikbaar is; het tellen serialiseert in de PostgreSQL-collectietransactie
   (advisory lock + FOR UPDATE).

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/eten-kortingscode.pg.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = PG_URL && REDIS_URL ? false :
  'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances';

test('het laatste gebruik van een promotiecode gaat over twee instances naar een lid',
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
      const kanaal = 'rtg:test:etenkorting:' + crypto.randomBytes(8).toString('hex');
      let ontvang, weiger;
      const gezien = new Promise((resolve, reject) => { ontvang = resolve; weiger = reject; });
      const grens = setTimeout(() => weiger(new Error('Redis multi-instancebericht niet ontvangen')), 3000);
      await rb.subscribe(kanaal, bericht => { clearTimeout(grens); ontvang(bericht); });
      await ra.publish(kanaal, 'gereed');
      assert.equal(await gezien, 'gereed');

      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      // een lege database laadt als null: dan begint elke instance bij een lege zak
      const dataA = (await a.laadAlles()) || {}, dataB = (await b.laadAlles()) || {};
      const core = (pg, data) => require('../server/kern/eten/kortingscode')({
        db: { data, writable: true }, crypto,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk)
      });
      const ka = core(a, dataA), kb = core(b, dataB);
      const korting = ka.normaliseer({ code: 'LAATSTE', procent: 10, maxGebruik: 3, perLid: 1 }).regel;
      const lees = async () => {
        const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', ['etenKortingGebruik']);
        return JSON.parse(kluis.ontsleutel(rows[0].val))['ZAAK|LAATSTE'];
      };

      // 1. twee gebruiken gaan er gewoon af
      assert.equal((await ka.claim({ zaak: 'ZAAK', korting, lidKey: 'l1', rekeningId: 'r1' })).ok, true);
      assert.equal((await kb.claim({ zaak: 'ZAAK', korting, lidKey: 'l2', rekeningId: 'r2' })).ok, true);

      // 2. het laatste gebruik: twee leden op twee instances tegelijk -- een wint
      const race = await Promise.all([ka.claim({ zaak: 'ZAAK', korting, lidKey: 'l3', rekeningId: 'r3' }),
        kb.claim({ zaak: 'ZAAK', korting, lidKey: 'l4', rekeningId: 'r4' })]);
      assert.equal(race.filter(x => x.ok).length, 1, 'precies een lid krijgt het laatste gebruik');
      assert.equal(race.filter(x => x.reden === 'op').length, 1);
      assert.equal((await lees()).gebruik, 3, 'nooit boven het maximum');

      // 3. een lid, twee rekeningen, twee instances tegelijk: de grens per lid houdt
      const k2 = ka.normaliseer({ code: 'PERLID', procent: 10, maxGebruik: 100, perLid: 1 }).regel;
      const lid = await Promise.all([ka.claim({ zaak: 'ZAAK', korting: k2, lidKey: 'l9', rekeningId: 'x1' }),
        kb.claim({ zaak: 'ZAAK', korting: k2, lidKey: 'l9', rekeningId: 'x2' })]);
      assert.equal(lid.filter(x => x.ok).length, 1);
      assert.equal(lid.filter(x => x.reden === 'per-lid').length, 1);

      // 4. dezelfde rekening op twee instances telt een keer
      const k3 = ka.normaliseer({ code: 'REK', procent: 10, maxGebruik: 100, perLid: 5 }).regel;
      const rek = await Promise.all([ka.claim({ zaak: 'ZAAK', korting: k3, lidKey: 'l7', rekeningId: 'y1' }),
        kb.claim({ zaak: 'ZAAK', korting: k3, lidKey: 'l7', rekeningId: 'y1' })]);
      assert.equal(rek.filter(x => x.ok).length, 2);
      assert.equal(rek.filter(x => x.herhaald).length, 1);
      const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', ['etenKortingGebruik']);
      const alles = kluis.ontsleutel(rows[0].val);
      assert.equal(JSON.parse(alles)['ZAAK|REK'].gebruik, 1);
      assert.equal(alles.includes('"l7"'), false, 'het lid staat er als hash');
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
