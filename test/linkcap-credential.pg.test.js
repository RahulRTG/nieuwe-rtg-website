/* Echte productie-topologieproef voor link.capability_aanvaarden (besluit B15).

   Twee onafhankelijke instances delen `linkCapToegang` in PostgreSQL. De drager
   werd tot deze migratie in een Map in het procesgeheugen bijgehouden, dus een
   claim op instance A bestond niet voor instance B. Hier moet blijken:
   1. twee claims tegelijk op dezelfde code, op twee instances: precies een wint;
   2. een intrekking op B tegelijk met een claim op A: precies een van de twee;
   3. na de claim op A krijgt een ander op B `weg` en dezelfde aanvaarder `bezig`;
   4. PostgreSQL draagt alleen de hash -- niet de kale code en niet de opdracht.

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/linkcap-credential.pg.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = PG_URL && REDIS_URL ? false :
  'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances';
const GEHEIM = 'KC-GEHEIM-IN-DE-OPDRACHT';

test('de Link-drager claimt en trekt in als een transactie over twee PG-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const maakBak = require('../server/kern/link/cap-bak');
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    try {
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ linkCapToegang: {} }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const bak = (pg, data) => maakBak({ db: { data, writable: true }, crypto,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk) });
      const ba = bak(a, dataA), bb = bak(b, dataB);
      const uitgeven = (x) => x.uitgeven({ handeling: 'geld.kassa', ttlMs: 300000, eenmalig: true,
        uitgever: { id: 'LID-1', key: 'LID-1', soort: 'lid' }, opdracht: { code: GEHEIM, maxCenten: 5000 },
        beschrijving: { wat: 'Afrekenen' } });

      // 1. twee claims tegelijk op twee instances
      const g1 = await uitgeven(ba);
      const [x, y] = await Promise.all([ba.claim(g1.code, { door: 'supplier:A', invoer: { centen: 10 } }),
        bb.claim(g1.code, { door: 'supplier:B', invoer: { centen: 20 } })]);
      const winnaars = [x, y].filter(r => !r.fout);
      assert.equal(winnaars.length, 1, 'precies een claim wint: ' + JSON.stringify([x.fout, y.fout]));
      assert.deepEqual([x, y].find(r => r.fout).fout, 'weg');
      assert.equal(winnaars[0].opdracht.code, GEHEIM, 'de winnaar kan de opdracht openen');

      // 3. na de claim: een ander krijgt weg, dezelfde aanvaarder bezig -- ook op de andere instance
      const door = x.fout ? 'supplier:B' : 'supplier:A';
      const ander = x.fout ? ba : bb;
      assert.equal((await ander.claim(g1.code, { door: 'supplier:C' })).fout, 'weg');
      assert.equal((await ander.claim(g1.code, { door })).fout, 'bezig');
      assert.equal(await (x.fout ? bb : ba).afronden(winnaars[0], true), true);
      assert.equal((await ander.claim(g1.code, { door })).fout, 'weg', 'gebruikt is weg, ook voor de winnaar');

      // 2. intrekken op B tegelijk met een claim op A
      const g2 = await uitgeven(ba);
      const [t, c] = await Promise.all([bb.intrekken({ code: g2.code, door: 'LID-1' }),
        ba.claim(g2.code, { door: 'supplier:A' })]);
      assert.equal([t.ok === true, !c.fout].filter(Boolean).length, 1,
        'intrekken of claimen, nooit allebei: ' + JSON.stringify([t, c.fout]));

      // 4. alleen hashes in PostgreSQL
      const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', ['linkCapToegang']);
      const opslag = kluis.ontsleutel(rows[0].val);
      for (const geheim of [g1.code, g2.code, GEHEIM])
        assert.ok(!opslag.includes(geheim) && !opslag.includes(geheim.toLowerCase()), 'niet kaal in PostgreSQL');
      assert.equal(Object.keys(JSON.parse(opslag)).length, 2);
    } finally {
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
