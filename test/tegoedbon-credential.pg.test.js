/* Echte PostgreSQL-proef voor de tegoedbon (CODECREDENTIALS.json, deur
   `pay.tegoedbon`, control `atomic_claim`). Twee onafhankelijke app-instances
   delen alleen de database: de bon leeft in de collectietransactie van
   `payTegoedBon`, de boeking uit de escrow in een economische transactie met
   een `pay-tegoed`-sleutel. Bewezen wordt:

     1. twee instances die TEGELIJK dezelfde oude (nog kale) code verzilveren,
        migreren hem allebei zonder dubbele rij en halen de escrow precies een
        keer leeg;
     2. een instance die na de commit van de boeking wegvalt, laat een claim
        achter die een VERSE derde instance afmaakt -- naar de oorspronkelijke
        ontvanger, met dezelfde sleutel, zonder tweede boeking;
     3. er staat daarna nergens in de database een kale code.

   MUTATIE GEZIEN ZAKKEN: in server/kern/pay/tegoed-bon.js `transactie()` de
   collectietransactie overslaan (altijd de proceslokale kopie gebruiken) --
   beide instances claimden, en de proef zakte op "precies een boeking uit de
   escrow" (kreeg 2). Teruggedraaid, daarna groen. */
'use strict';
const test = require('node:test');
const { vereist } = require('./infra');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = vereist('pg', !!URL, 'DATABASE_URL ontbreekt; deze proef vereist een echte PostgreSQL');

test('tegoedbon: claim en escrowboeking zijn atomair over twee PostgreSQL-instances en crash/hervat',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const nieuw = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    const OUD = 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF';
    const TWEEDE = '1234-5678-9ABC-DEF0-1234-5678';
    const nu = Date.parse('2030-01-01T12:00:00Z');

    const kern = (pg, data, stuk = {}) => {
      let n = 0;
      const boek = ({ van, naar, centen, soort, oms, ref }) => {
        data.paySaldi[van] = (data.paySaldi[van] || 0) - centen;
        data.paySaldi[naar] = (data.paySaldi[naar] || 0) + centen;
        const rij = { id: 'PB-' + crypto.randomBytes(4).toString('hex') + '-' + (++n), van, naar,
          centen, soort, oms, ref: ref || null, at: nu };
        data.payBoekingen.unshift(rij);
        return { ok: true, boeking: rij };
      };
      return require('../server/kern/pay/tegoed')({
        crypto, save() {}, nu: () => nu, d: () => data,
        schoon: (s, m) => String(s == null ? '' : s).slice(0, m),
        rekLid: c => 'lid:' + c, rekPartner: c => 'partner:' + c,
        saldoVan: r => Math.round((data.paySaldi || {})[r] || 0), id: p => p + (++n),
        metIdem: async (s, a, w) => w(), grootboek: () => data.payBoekingen, boek,
        boekAsync: async a => boek(a), geldModus: 'schaduw',
        bewerkCollectie: (k, w) => pg.bewerkCollectie(k, data, w),
        economischeBoekingEenmaal: async (i, w) => {
          const r = await pg.boekEenmaal(data, i, w);
          if (stuk.crash) { stuk.crash = false; throw new Error('proces viel weg na de commit'); }
          return r;
        },
        zorgSaldo: async () => ({ ok: true }), seintje() {}, bestaatLid: async () => true,
        MIN_CENTEN: 1, MAX_CENTEN: 500000
      });
    };
    const lees = async pg => {
      const { rows } = await pg.pool.query(
        "SELECT key,val FROM kv WHERE key IN ('paySaldi','payBoekingen','payTegoedBon','payTegoed') AND NOT weg");
      return { json: rows.map(r => kluis.ontsleutel(r.val)).join('\n'),
        ...Object.fromEntries(rows.map(r => [r.key, JSON.parse(kluis.ontsleutel(r.val))])) };
    };

    const a = nieuw(), b = nieuw();
    try {
      await a.pool.query('DROP TABLE IF EXISTS economische_boekingen');
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      const oudeBon = (id, code, centen) => ({ id, code, van: 'Koper', vanSoort: 'lid', aan: null,
        centen, oms: 'Oud', status: 'open', at: nu - 1000, vervalt: nu + 86400000, boeking: 'PB0' });
      await a.flushVoorrang({ paySaldi: { 'extern:tegoed': 5000, 'lid:Koper': -5000 } });
      await a.flush({ payBoekingen: [], payTegoed: [oudeBon('TG1', OUD, 3000), oudeBon('TG2', TWEEDE, 2000)] }, true);
      const da = await a.laadAlles(), db = await b.laadAlles();
      const ka = kern(a, da), kb = kern(b, db);

      /* 1. De race, met de migratie erin. */
      const race = await Promise.all([
        ka.tegoedVerzilver({ codenaam: 'Links', code: OUD, idem: 'l' }),
        kb.tegoedVerzilver({ codenaam: 'Rechts', code: OUD, idem: 'r' })
      ]);
      assert.equal(race.filter(x => x.ok).length, 1, JSON.stringify(race));
      assert.equal(race.filter(x => x.status === 409).length, 1);
      let waar = await lees(a);
      assert.equal(waar.payBoekingen.filter(x => x.van === 'extern:tegoed').length, 1, 'precies een boeking uit de escrow');
      assert.equal(waar.paySaldi['extern:tegoed'], 2000);
      assert.deepEqual(waar.payTegoed, [], 'de oude lijst is leeg');
      assert.equal(Object.keys(waar.payTegoedBon).length, 2, 'geen dubbele rij door twee migraties');
      assert.equal(waar.payTegoedBon.TG1.status, 'verzilverd');

      /* 2. Instance A valt weg NA de commit van de boeking. */
      const kaStuk = kern(a, da, { crash: true });
      const weg = await kaStuk.tegoedVerzilver({ codenaam: 'Eerste', code: TWEEDE, idem: 'e' });
      assert.equal(weg.status, 503, JSON.stringify(weg));
      waar = await lees(b);
      assert.equal(waar.payTegoedBon.TG2.status, 'claimend', 'de claim staat in de database');
      const c = nieuw();
      try {
        const dc = await c.laadAlles();
        const kc = kern(c, dc);
        const ander = await kc.tegoedVerzilver({ codenaam: 'Tweede', code: TWEEDE, idem: 't' });
        assert.equal(ander.status, 409, 'een ander maakt de claim af en krijgt zelf niets');
        waar = await lees(c);
        assert.equal(waar.payBoekingen.filter(x => x.van === 'extern:tegoed').length, 2, 'geen tweede boeking voor TG2');
        assert.equal(waar.paySaldi['lid:Eerste'], 2000, 'het geld ging naar de oorspronkelijke claimer');
        assert.equal(waar.paySaldi['lid:Tweede'] || 0, 0);
        assert.equal(waar.paySaldi['extern:tegoed'], 0, 'de escrow sluit op nul');
        assert.equal(waar.payTegoedBon.TG2.status, 'verzilverd');

        /* 3. Nergens een kale code. */
        for (const code of [OUD, TWEEDE])
          assert.equal(waar.json.toUpperCase().replace(/[^0-9A-Z]/g, '').includes(code.replace(/-/g, '')), false);
        const sleutels = await a.pool.query('SELECT sleutel FROM economische_boekingen');
        assert.ok(sleutels.rows.length >= 2);
        assert.ok(sleutels.rows.every(x => /^pay-tegoed:[a-f0-9]{64}$/.test(x.sleutel)));
      } finally { await c.sluit(); }
    } finally {
      await a.sluit();
      await b.sluit();
    }
  });
