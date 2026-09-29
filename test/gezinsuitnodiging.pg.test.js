/* Echte productie-topologieproef voor de gezinsuitnodiging (B17,
   foundation.family_profile_token_buiten_harde_poort): twee onafhankelijke
   instances delen dezelfde PostgreSQL en wisselen TEGELIJK dezelfde eenmalige
   uitnodiging in. Precies EEN krijgt een profiel met een gezinssessie, de
   uitnodiging staat op geaccepteerd, en de database draagt alleen hashes.

   De claim (server/foundation/gezinsclaim.js) is een collectietransactie op
   `foundation`: in PostgreSQL een advisory lock plus SELECT ... FOR UPDATE
   (server/pg/collectietransactie.js). Zonder die twee zien beide instances
   `open` en maken ze allebei een profiel.

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/gezinsuitnodiging.pg.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = PG_URL && REDIS_URL ? false :
  'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances';

test('dezelfde gezinsuitnodiging claimt atomair over twee PG/Redis-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const { createClient } = require('../server/redis');
    const kluis = require('../server/kluis');
    const tokens = require('../server/foundation/gezinstoken').maak({ crypto });
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    const ra = createClient({ url: REDIS_URL }), rb = createClient({ url: REDIS_URL });
    try {
      await Promise.all([ra.connect(), rb.connect()]);
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      const claimer = maakPg => require('../server/foundation/gezinsclaim').maak({ crypto, tokens,
        nu: () => new Date().toISOString(), rid: n => crypto.randomBytes(n).toString('hex'),
        ensureCodenaam: p => (p.codenaam = p.codenaam || 'Gouden Vos ' + crypto.randomBytes(2).toString('hex')),
        bewerkCollectie: maakPg });
      const hash = w => crypto.createHash('sha256').update(String(w)).digest('hex');
      const geheimen = Array.from({ length: 3 }, () => crypto.randomBytes(24).toString('base64url'));
      const gezinnen = { RACE23: { code: 'RACE23', naam: 'Gezin Race', profielen: {
        b: { id: 'b', rol: 'beheerder', naam: 'Beheerder' } },
      uitnodigingen: geheimen.map((g, i) => ({ id: 'u' + i, naam: 'Ouder ' + i, rol: i === 2 ? 'gast' : 'ouder',
        status: 'open', sleutelHash: hash(g), verlooptAt: new Date(Date.now() + 3600000).toISOString() })) } };
      await a.flush({ foundation: { lessen: {}, gezinnen } }, true);

      const dataA = await a.laadAlles();
      const dataB = await b.laadAlles();
      const CA = claimer((s, w) => a.bewerkCollectie(s, dataA, w));
      const CB = claimer((s, w) => b.bewerkCollectie(s, dataB, w));

      // 1. twee instances, dezelfde uitnodiging, tegelijk
      const [r1, r2] = await Promise.all([
        CA.claim({ code: 'RACE23', geheim: geheimen[0], metSessie: true, profiel: { pin: { salt: 'a', hash: 'a' } } }),
        CB.claim({ code: 'RACE23', geheim: geheimen[0], metSessie: true, profiel: { pin: { salt: 'b', hash: 'b' } } })]);
      assert.equal([r1, r2].filter(r => r && r.ok).length, 1, 'precies een instance claimde: ' + JSON.stringify([r1, r2]));
      assert.equal([r1, r2].filter(r => r && r.status === 404).length, 1);
      const winnaar = [r1, r2].find(r => r.ok);
      assert.match(winnaar.token, /^GZ\.[0-9A-F]{32}$/);

      // 2. twaalf gelijktijdige pogingen over beide instances op een tweede uitnodiging
      const rij = await Promise.all(Array.from({ length: 12 }, (_, i) =>
        (i % 2 ? CA : CB).claim({ code: 'RACE23', geheim: geheimen[1], metSessie: true, profiel: {} })));
      assert.equal(rij.filter(r => r.ok).length, 1, 'twaalf tikken, een profiel');

      // 3. de gastweg via een RTG-account is dezelfde claim, zonder sessie
      const [g1, g2] = await Promise.all([
        CA.claim({ code: 'RACE23', geheim: geheimen[2], alleenGast: true, profiel: { koppel: { userId: 1 } } }),
        CB.claim({ code: 'RACE23', geheim: geheimen[2], alleenGast: true, profiel: { koppel: { userId: 2 } } })]);
      assert.equal([g1, g2].filter(r => r.ok).length, 1);
      assert.equal([g1, g2].find(r => r.ok).token, null, 'de gastkoppeling geeft geen sessie; het kanaal doet dat');

      const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', ['foundation']);
      const json = kluis.ontsleutel(rows[0].val);
      const g = JSON.parse(json).gezinnen.RACE23;
      assert.equal(Object.keys(g.profielen).length, 4, 'beheerder plus drie ingewisselde uitnodigingen, geen dubbele');
      assert.ok(g.uitnodigingen.every(u => u.status === 'geaccepteerd' && !u.sleutelHash));
      assert.equal(json.includes(winnaar.token.slice(3)), false, 'PostgreSQL bevat alleen de hash van de sessie');
      assert.equal(tokens.vind(g, winnaar.token).id, winnaar.profielId, 'en die hash opent het juiste profiel');
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
