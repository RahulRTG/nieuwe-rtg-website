/* Echte PostgreSQL-proef voor de projectiecredential. Twee app-instanties
   delen uitsluitend de autoritatieve spellenrij. Daarmee wordt bewezen dat
   een koppeling maar eenmaal wint en dat intrekking zonder cachevenster op de
   andere instance geldt. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = URL ? false : 'DATABASE_URL ontbreekt; deze proef vereist een echte PostgreSQL';

test('spelprojectie koppelt en trekt atomair in over twee PG-instanties',
  { skip: OVERSLAAN }, async () => {
    const { merge3 } = require('../server/db');
    const { maakPg } = require('../server/pg');
    const kluis = require('../server/kluis');
    const register = require('../server/kern/spellen/register')({ save() {}, crypto,
      schud: x => x, beurtDoor() {}, codenaamVan: x => x, nudge() {} });
    const nieuw = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    const pa = nieuw(), pb = nieuw();
    try {
      await pa.pool.query('DROP TABLE IF EXISTS kv');
      await pa.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await pa.schema();
      const spellen = { wachtrij: {}, potjes: { p1: {
        id: 'p1', soort: 'seconden', spelers: ['a', 'b'], status: 'bezig',
        beurt: 0, teams: [0, 1], modus: 'teams', winnaar: null,
        staat: { bezig: true, rader: 0, scores: [0, 0] }
      } } };
      await pa.flush({ spellen }, true);
      const dataA = await pa.laadAlles(), dataB = await pb.laadAlles();
      const bouw = (pg, data) => require('../server/kern/spellen/projectie')({
        S: () => data.spellen, save() {},
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk),
        crypto, nu: () => new Date().toISOString(), SPEL: register.SPEL,
        SOORTEN: register.SOORTEN, ZICHT: register.ZICHT,
        codenaamVan: x => 'CN-' + x
      });
      const a = bouw(pa, dataA), b = bouw(pb, dataB);
      const uitgifte = await a.projectieOpen('a', 'p1', 'pg-projectie-' + 'a'.repeat(32));
      assert.match(uitgifte.code, /^GAME\.[A-F0-9]{32}$/);

      const race = await Promise.all([
        a.projectieKoppel(uitgifte.code),
        b.projectieKoppel(uitgifte.code)
      ]);
      assert.equal(race.filter(x => x.status === 200).length, 1,
        'dezelfde eenmalige koppeling gaf twee schermsessies');
      assert.equal(race.filter(x => x.status === 404).length, 1);
      const token = race.find(x => x.token).token;
      assert.equal((await b.projectieStand(token)).status, 200);

      assert.equal((await a.projectieSluit('b', 'p1')).status, 200);
      assert.equal((await b.projectieStand(token)).status, 404,
        'instance B vertrouwde na de intrekcommit nog zijn oude cache');

      const { rows } = await pa.pool.query('SELECT val FROM kv WHERE key = $1 AND weg = false', ['spellen']);
      const opgeslagen = kluis.ontsleutel(rows[0].val);
      assert.ok(!opgeslagen.includes(uitgifte.code), 'kale koppeling stond in Postgres');
      assert.ok(!opgeslagen.includes(token), 'kale schermsessie stond in Postgres');
    } finally {
      await pa.sluit(); await pb.sluit();
    }
  });
