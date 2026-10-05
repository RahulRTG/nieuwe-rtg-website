/* Echte productie-topologieproef voor de gezinsdeur (B18,
   foundation.family_profile_access): twee onafhankelijke instances delen
   dezelfde PostgreSQL.

   1. Hetzelfde STROOMTICKET wordt op beide instances tegelijk ingewisseld:
      precies EEN stroom gaat open, en het ticket is daarna weg.
   2. Twaalf inlogs met dezelfde GEZINSCODE over beide instances tegelijk: de
      gebruiksteller staat daarna op precies twaalf -- geen verloren telling.
   3. Na een rotatie op instance A opent de vorige gezinscode op instance B
      niets meer, ook als B de oude stand nog in zijn werkkopie had.

   De inwisseling en de claim zijn collectietransacties op hun EIGEN collectie
   (foundationGezinsStroom, foundationGezinscode): in PostgreSQL een advisory
   lock plus SELECT ... FOR UPDATE (server/pg/collectietransactie.js). Zonder die
   twee zien beide instances het ticket nog staan en openen ze allebei een stroom.

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/gezinsdeur.pg.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = PG_URL && REDIS_URL ? false :
  'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances';

test('stroomticket en gezinscode claimen atomair over twee PG/Redis-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const { createClient } = require('../server/redis');
    const kluis = require('../server/kluis');
    const C = require('../server/foundation/gezinscode');
    const S = require('../server/foundation/gezinsstroom');
    const tokens = require('../server/foundation/gezinstoken').maak({ crypto });
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    const ra = createClient({ url: REDIS_URL }), rb = createClient({ url: REDIS_URL });
    try {
      await Promise.all([ra.connect(), rb.connect()]);
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      const gezin = { id: 'g1', code: 'RACE23', naam: 'Gezin Race', profielen: { b: { id: 'b', rol: 'beheerder' } } };
      const sessie = tokens.geef(gezin, gezin.profielen.b);
      await a.flush({ foundation: { lessen: {}, gezinnen: { RACE23: gezin } } }, true);

      const dataA = await a.laadAlles();
      const dataB = await b.laadAlles();
      const bouw = (pg, data) => {
        const bewerkCollectie = (s, w) => pg.bewerkCollectie(s, data, w);
        const G = () => data.foundation.gezinnen;
        return { code: C.maak({ db: { data }, crypto, bewerkCollectie, G }),
          stroom: S.maak({ db: { data }, crypto, bewerkCollectie, gezinstoken: tokens, G }) };
      };
      const A = bouw(a, dataA), B = bouw(b, dataB);

      // 1. hetzelfde ticket, tegelijk op twee instances
      const t = await A.stroom.geef(dataA.foundation.gezinnen.RACE23, sessie, 'gezin');
      assert.match(t.ticket, /^GS\.[0-9A-F]{32}$/);
      const [o1, o2] = await Promise.all([A.stroom.open('RACE23', t.ticket, 'gezin'), B.stroom.open('RACE23', t.ticket, 'gezin')]);
      assert.equal([o1, o2].filter(o => o.ok).length, 1, 'precies een stroom: ' + JSON.stringify([o1.status, o2.status]));
      assert.equal([o1, o2].filter(o => o.status === 401).length, 1);
      const rij = await a.pool.query('SELECT val FROM kv WHERE key=$1', [S.COLLECTIE]);
      const tickets = rij.rows.length ? JSON.parse(kluis.ontsleutel(rij.rows[0].val)) : {};
      assert.equal(JSON.stringify(tickets).includes(t.ticket.slice(3)), false, 'nooit het ticket zelf');
      assert.deepEqual(tickets, {}, 'het ingewisselde ticket is weg');

      // 2. twaalf inlogs, een teller
      const raw = await A.code.geef(dataA.foundation.gezinnen.RACE23, 'b');
      const claims = await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? A : B).code.claim(raw, 'RACE23')));
      assert.equal(claims.filter(Boolean).length, 12);
      const cr = await a.pool.query('SELECT val FROM kv WHERE key=$1', [C.COLLECTIE]);
      const opgeslagen = JSON.parse(kluis.ontsleutel(cr.rows[0].val));
      assert.equal(opgeslagen.RACE23.gebruik, 12, 'twaalf tegelijk, twaalf geteld');
      assert.equal(JSON.stringify(opgeslagen).includes(raw.slice(3)), false, 'PostgreSQL draagt alleen de hash');

      // 3. roteren op A, de oude code op B
      const nieuw = await A.code.geef(dataA.foundation.gezinnen.RACE23, 'b');
      assert.equal(await B.code.claim(raw, 'RACE23'), false, 'de vorige gezinscode opent op de andere instance niets');
      assert.equal(await B.code.claim(nieuw, 'RACE23'), true);
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
