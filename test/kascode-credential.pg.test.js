/* Echte PostgreSQL-proef voor de kas- en tikcode (CODECREDENTIALS.json, deuren
   pay.kascode_en_vooraf en pay.tikcode, control `atomic_claim`). Twee app-
   instances delen alleen de database: de codes leven in de collectietransactie
   van payKasToegang en payTikToegang, de boekingen onder een claim in een
   economische transactie met een `pay-kas`-sleutel. Bewezen wordt:

     1. twee instances die TEGELIJK dezelfde kascode innen voor twee zaken:
        precies een betaling, precies een grootboekregel;
     2. een instance die na de commit van de boeking wegvalt laat een claim
        achter die een verse derde instance na de lease afmaakt -- naar de
        oorspronkelijke zaak, met dezelfde sleutel, zonder tweede boeking --
        terwijl die derde zelf niets krijgt;
     3. tikken vanaf twee instances tegelijk verliest geen gebruik;
     4. er staat daarna nergens in de database een kale code.

   MUTATIE GEZIEN ZAKKEN: in server/kern/pay/kasbak.js `transactieOp` de
   collectietransactie overslaan (altijd de proceslokale kopie) -- beide
   instances claimden en de proef zakte op "precies een betaling". */
'use strict';
const test = require('node:test');
const { vereist } = require('./infra');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = vereist('pg', !!URL, 'DATABASE_URL ontbreekt; deze proef vereist een echte PostgreSQL');

test('kascode en tikcode: claim en boeking zijn atomair over twee PostgreSQL-instances en crash/hervat',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const nieuw = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    const klok = { t: Date.parse('2030-01-01T12:00:00Z') };

    const kern = (pg, data, stuk = {}) => {
      let n = 0;
      const boek = ({ van, naar, centen, soort, oms, ref }) => {
        if (!van.startsWith('extern:') && (data.paySaldi[van] || 0) < centen) return { status: 402, error: 'Onvoldoende.' };
        data.paySaldi[van] = (data.paySaldi[van] || 0) - centen;
        data.paySaldi[naar] = (data.paySaldi[naar] || 0) + centen;
        const rij = { id: 'PB-' + crypto.randomBytes(4).toString('hex') + '-' + (++n), van, naar,
          centen, soort, oms, ref: ref || null, at: klok.t };
        data.payBoekingen.unshift(rij);
        return { ok: true, boeking: rij };
      };
      const ctx = { crypto, save() {}, nu: () => klok.t, d: () => data, db: { data },
        schoon: (s, m) => String(s == null ? '' : s).slice(0, m), rekLid: c => 'lid:' + c, rekPartner: c => 'partner:' + c,
        saldoVan: r => Math.round((data.paySaldi || {})[r] || 0), grootboek: () => data.payBoekingen, boek,
        boekAsync: async a => boek(a), geldModus: 'schaduw', waarde: null,
        bewerkCollectie: (k, w) => pg.bewerkCollectie(k, data, w),
        economischeBoekingEenmaal: async (i, w) => {
          const r = await pg.boekEenmaal(data, i, w);
          if (stuk.crash) { stuk.crash = false; throw new Error('proces viel weg na de commit'); }
          return r;
        },
        zorgSaldo: async () => ({ ok: true, bijgeladen: 0 }), seintje() {}, betaaldienstKosten: () => 0,
        bijOntvangst: () => ({}), opdrachten: { registreerTeruggang() {} },
        MIN_CENTEN: 1, MAX_CENTEN: 500000, KASCODE_MS: 300000, KASCODE_MAX: 50000 };
      Object.assign(ctx, require('../server/kern/pay/samen')(ctx));
      const kassa = require('../server/kern/pay/kassa')(ctx);
      const tik = require('../server/kern/pay/tik')(Object.assign({}, ctx, { stuur: async () => ({ ok: true }) }));
      return { kassa, tik };
    };
    const lees = async pg => {
      const { rows } = await pg.pool.query("SELECT key,val FROM kv WHERE key IN " +
        "('paySaldi','payBoekingen','payKasToegang','payTikToegang') AND NOT weg");
      return { json: rows.map(r => kluis.ontsleutel(r.val)).join('\n'),
        ...Object.fromEntries(rows.map(r => [r.key, JSON.parse(kluis.ontsleutel(r.val))])) };
    };
    const kassaRegels = w => w.payBoekingen.filter(b => b.soort === 'kassa');

    const a = nieuw(), b = nieuw();
    try {
      await a.pool.query('DROP TABLE IF EXISTS economische_boekingen');
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flushVoorrang({ paySaldi: { 'lid:A': 20000, 'lid:B': 3000, 'extern:oplaad': -23000 } });
      await a.flush({ payBoekingen: [], payKasToegang: {}, payTikToegang: {} }, true);
      const da = await a.laadAlles();
      const ka = kern(a, da);
      const k1 = await ka.kassa.kasCode({ codenaam: 'A', maxCenten: 5000 });
      const k2 = await ka.kassa.kasCode({ codenaam: 'B', maxCenten: 5000 });
      const t = await ka.tik.tikCode({ codenaam: 'T' });
      const db = await b.laadAlles();
      const kb = kern(b, db);

      /* 1. De race om een kascode. */
      const race = await Promise.all([
        ka.kassa.kasInt({ supplierCode: 'Z1', code: k1.code, centen: 1200, idem: 'l' }),
        kb.kassa.kasInt({ supplierCode: 'Z2', code: k1.code, centen: 1300, idem: 'r' })]);
      assert.equal(race.filter(x => x.ok).length, 1, JSON.stringify(race));
      assert.equal(race.filter(x => x.status === 404).length, 1);
      let waar = await lees(a);
      assert.equal(kassaRegels(waar).length, 1, 'precies een betaling');
      assert.equal(Object.values(waar.payKasToegang).find(r => r.codenaam === 'A').stand, 'betaald');

      /* 2. Instance B valt weg NA de commit van de boeking. */
      const kStuk = kern(b, await b.laadAlles(), { crash: true });
      const stil = await kStuk.kassa.kasInt({ supplierCode: 'Z1', code: k2.code, centen: 900, idem: 'e' });
      assert.equal(stil.status, 503, JSON.stringify(stil));
      waar = await lees(a);
      assert.equal(Object.values(waar.payKasToegang).find(r => r.codenaam === 'B').stand, 'claimend');
      const c = nieuw();
      try {
        klok.t += 61000;
        const kc = kern(c, await c.laadAlles());
        const ander = await kc.kassa.kasInt({ supplierCode: 'Z3', code: k2.code, centen: 2000, idem: 'x' });
        assert.equal(ander.status, 404, 'een ander maakt de claim af en krijgt zelf niets');
        waar = await lees(c);
        assert.equal(kassaRegels(waar).length, 2, 'geen tweede boeking voor de hervatte claim');
        assert.equal(waar.paySaldi['partner:Z1'], (race[0].ok ? 1200 : 0) + 900, 'het geld ging naar de zaak van de claim');
        assert.equal(waar.paySaldi['partner:Z3'] || 0, 0);
        assert.equal(Object.values(waar.payKasToegang).find(r => r.codenaam === 'B').stand, 'betaald');
        const sleutels = await a.pool.query('SELECT sleutel FROM economische_boekingen');
        assert.ok(sleutels.rows.length >= 2 && sleutels.rows.every(x => /^pay-kas:[a-f0-9]{64}$/.test(x.sleutel)));

        /* 3. Tikken vanaf twee instances tegelijk verliest geen gebruik. */
        const kd = kern(a, await a.laadAlles()), ke = kern(b, await b.laadAlles());
        const tik = await Promise.all([1, 2, 3].flatMap(i => [
          kd.tik.tikBetaal({ van: 'A', code: t.code, centen: 10, idem: 'a' + i }),
          ke.tik.tikBetaal({ van: 'C', code: t.code, centen: 10, idem: 'c' + i })]));
        assert.equal(tik.filter(x => x.ok).length, 6, JSON.stringify(tik));
        waar = await lees(a);
        assert.equal(Object.values(waar.payTikToegang)[0].toegang.gebruik, 6, 'elk gebruik telt precies een keer');

        /* 4. Nergens een kale code. */
        const plat = waar.json.toUpperCase().replace(/[^0-9A-Z]/g, '');
        for (const code of [k1.code, k2.code, t.code]) assert.equal(plat.includes(code.replace(/[^0-9A-Z]/g, '').slice(2)), false);
      } finally { await c.sluit(); }
    } finally {
      await a.sluit();
      await b.sluit();
    }
  });
