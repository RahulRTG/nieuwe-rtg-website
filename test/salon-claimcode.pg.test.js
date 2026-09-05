/* Echte PostgreSQL-proef voor Salon-claimcodes. Twee onafhankelijke app-
   instances delen alleen de posts-rij en moeten uitgifte en gebruik onder
   hetzelfde advisory slot serialiseren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = URL ? false : 'DATABASE_URL ontbreekt; deze proef vereist een echte PostgreSQL';

test('Salon-claimcodes zijn hash-only en atomair over twee PostgreSQL-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const nieuw = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    const a = nieuw(), b = nieuw();
    try {
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ posts: [
        { id: 77, partnerCode: 'ZAAK', deal: { titel: 'Chefsmenu',
          geldigTot: '2031-12-31', claims: [] } },
        { id: 78, partnerCode: 'ZAAK', deal: { titel: 'Oud menu',
          geldigTot: '2031-12-31', claims: [{ code: 'RTG-D-ABC123',
            key: 'user-oud', codename: 'Oud', used: false,
            at: '2025-01-01T00:00:00.000Z' }] } }
      ] }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const core = (pg, data) => require('../server/kern/salon-claimcode')({
        db: { data, writable: true }, save() {}, crypto,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk),
        nu: () => Date.parse('2030-01-01T12:00:00.000Z')
      });
      const ca = core(a, dataA), cb = core(b, dataB);
      const lees = async () => {
        const { rows } = await a.pool.query('SELECT val, weg FROM kv WHERE key=$1', ['posts']);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].weg, false);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, posts: JSON.parse(json) };
      };

      const migratie = await ca.migreerAlles();
      assert.equal(migratie.gewijzigd, true);
      let waar = await lees();
      assert.equal(waar.json.includes('RTG-D-ABC123'), false,
        'de expliciete startupmigratie verwijdert een kale code vóór klantverkeer');
      assert.equal(waar.posts[1].deal.claims[0].status, 'legacy-gesloten');

      const claim = { postId: 77, key: 'user-1', codename: 'Kobalt',
        idempotentieSleutel: 'salon-pg-claim-00000001' };
      const race = await Promise.all([ca.uitgeven(claim), cb.uitgeven(claim)]);
      const uit = race.find(x => x.status === 200), retry = race.find(x => x.status === 409);
      assert.ok(uit && retry, 'precies één instance geeft het geheim uit');
      assert.equal(retry.herhaald, true);
      assert.equal(retry.code, undefined);
      assert.match(uit.code, /^SAL\.[A-F0-9]{32}$/);

      waar = await lees();
      assert.equal(waar.json.includes(uit.code), false);
      assert.equal(waar.posts[0].deal.claims.length, 1);

      const rotatie = await cb.roteer({ postId: 77, key: 'user-1',
        idempotentieSleutel: 'salon-pg-rotate-0000001' });
      assert.equal(rotatie.status, 200);
      assert.notEqual(rotatie.code, uit.code);
      assert.equal((await ca.verzilver({ code: uit.code, partnerCode: 'ZAAK',
        actor: 'kassa-1', idempotentieSleutel: 'salon-pg-oud-000000001' })).status, 404);

      const innen = { code: rotatie.code, partnerCode: 'ZAAK', actor: 'kassa-1',
        idempotentieSleutel: 'salon-pg-redeem-00001' };
      const innenRace = await Promise.all([ca.verzilver(innen), cb.verzilver(innen)]);
      assert.equal(innenRace.filter(x => x.status === 200).length, 2,
        'de winnaar en zijn exacte retry krijgen een veilig succes');
      assert.equal(innenRace.filter(x => x.herhaald).length, 1);
      waar = await lees();
      const rij = waar.posts[0].deal.claims[0];
      assert.equal(rij.toegang.gebruik, 1, 'de code werd ondanks twee instances eenmaal gebruikt');
      assert.equal(waar.json.includes(rotatie.code), false);

      const tweede = await ca.uitgeven({ postId: 77, key: 'user-2', codename: 'Amber',
        idempotentieSleutel: 'salon-pg-claim-00000002' });
      assert.equal(tweede.status, 200);
      const intrek = { postId: 77, key: 'user-2',
        idempotentieSleutel: 'salon-pg-revoke-000001' };
      const intrekRace = await Promise.all([ca.intrekken(intrek), cb.intrekken(intrek)]);
      assert.deepEqual(intrekRace.map(x => x.status), [200, 200]);
      assert.equal(intrekRace.filter(x => x.herhaald).length, 1);
      assert.equal((await cb.verzilver({ code: tweede.code, partnerCode: 'ZAAK',
        actor: 'kassa-2', idempotentieSleutel: 'salon-pg-na-intrek-0001' })).status, 404);
      waar = await lees();
      assert.equal(waar.json.includes(tweede.code), false);
      assert.equal(waar.posts[0].deal.claims.find(x => x.key === 'user-2').status, 'ingetrokken');
    } finally {
      await a.sluit();
      await b.sluit();
    }
  });
