/* Echte productie-topologieproef voor horeca.bon_en_polsbandsaldo.

   Twee onafhankelijke kerninstances delen de autoritatieve `horecaBonnen`-rij
   in PostgreSQL. Ze racen om hetzelfde saldo, om deelbedragen, om dezelfde
   idempotentiesleutel, om een koppeling aan twee gastsessies en om de migratie
   van een oude 32-bitbon; in elk geval wint er precies een, en de database
   draagt daarna alleen hashes. Twee Redis-verbindingen bewijzen dat de
   verplichte multi-instancebus bereikbaar is; de claim zelf serialiseert in de
   PostgreSQL-collectietransactie (advisory lock + FOR UPDATE).

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/horecabon-credential.pg.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = PG_URL && REDIS_URL ? false :
  'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances';

test('horecabon is hash-only en boekt atomair af over twee PG/Redis-instances',
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
      const kanaal = 'rtg:test:horecabon:' + crypto.randomBytes(8).toString('hex');
      let ontvang, weiger;
      const gezien = new Promise((resolve, reject) => { ontvang = resolve; weiger = reject; });
      const grens = setTimeout(() => weiger(new Error('Redis multi-instancebericht niet ontvangen')), 3000);
      await rb.subscribe(kanaal, bericht => { clearTimeout(grens); ontvang(bericht); });
      await ra.publish(kanaal, 'gereed');
      assert.equal(await gezien, 'gereed');

      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      const OUD = '0FF1CE42';
      await a.flush({ horeca: { ZAAK: { rekeningen: {}, instel: {}, wachtrij: [],
        bonnen: { [OUD]: { code: OUD, soort: 'cadeaubon', uitgegeven: 8000, saldo: 8000, at: '2026-01-01T00:00:00.000Z', mutaties: [] } } } } }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const core = (pg, data) => require('../server/kern/horeca/bon')({
        db: { data, writable: true }, crypto,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk)
      });
      const ca = core(a, dataA), cb = core(b, dataB);
      const lees = async (sleutel = 'horecaBonnen') => {
        const { rows } = await a.pool.query('SELECT val, weg FROM kv WHERE key=$1', [sleutel]);
        assert.equal(rows.length, 1); assert.equal(rows[0].weg, false);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, waarde: JSON.parse(json) };
      };
      const boek = (c, code, centen, extra) => c.boek(Object.assign({ zaak: 'ZAAK', vind: c.opCode('ZAAK', code), centen }, extra));

      // 0. twee instances migreren dezelfde oude bon tegelijk: waarde blijft, code verdwijnt
      await Promise.all([ca.zorg(), cb.zorg()]);
      let waar = await lees();
      assert.equal(waar.json.includes(OUD), false, 'PostgreSQL bevat de oude kale code niet meer');
      assert.equal(Object.keys(waar.waarde).length, 1, 'een bon, niet twee');
      assert.equal((await lees('horeca')).json.includes(OUD), false, 'ook de horecadoos niet');
      const oudRace = await Promise.all([boek(ca, OUD, 8000), boek(cb, OUD, 8000)]);
      assert.equal(oudRace.filter(x => x.ok).length, 1, 'de houder betaalt een keer met wat hij had');

      // 1. saldorace: hetzelfde volle saldo tegelijk op A en B
      const k1 = await ca.maak({ zaak: 'ZAAK', centen: 10000 });
      const race = await Promise.all([boek(ca, k1.code, 10000), boek(cb, k1.code, 10000)]);
      assert.equal(race.filter(x => x.ok).length, 1, 'exact een instance boekt af');
      assert.equal(race.filter(x => x.code === 'bon-leeg').length, 1);
      waar = await lees();
      assert.equal(waar.waarde[k1.bon.id].saldo, 0);
      assert.equal(waar.json.includes(k1.code.replace(/-/g, '').slice(2)), false, 'PostgreSQL bevat alleen de hash');

      // 2. deelbedragen: 6000 + 6000 op 10000 -- de tweede krijgt de rest, nooit onder nul
      const k2 = await cb.band({ zaak: 'ZAAK', nummer: 'B1', centen: 10000 });
      const deel = await Promise.all([boek(ca, k2.code, 6000), boek(cb, k2.code, 6000)]);
      assert.deepEqual(deel.map(x => x.geboekt).sort((p, q) => p - q), [4000, 6000]);
      assert.equal((await lees()).waarde[k2.bon.id].saldo, 0);

      // 3. dezelfde kassasleutel op twee instances: een afboeking, twee keer dezelfde ref
      const k3 = await ca.maak({ zaak: 'ZAAK', centen: 10000 });
      const idem = await Promise.all([boek(ca, k3.code, 3000, { idem: 'bon-1' }), boek(cb, k3.code, 3000, { idem: 'bon-1' })]);
      assert.equal(idem.filter(x => x.ok).length, 2);
      assert.equal(idem[0].ref, idem[1].ref, 'beide zien dezelfde afboeking');
      assert.equal((await lees()).waarde[k3.bon.id].saldo, 7000);

      // 4. twee telefoons koppelen dezelfde band tegelijk: een wint, de ander niet
      const k4 = await ca.band({ zaak: 'ZAAK', nummer: 'B2', centen: 5000 });
      const leeft = () => true;
      const kop = await Promise.all([ca.koppel({ zaak: 'ZAAK', code: k4.code, rekeningId: 'R1', deelnemer: 'd1', leeft }),
        cb.koppel({ zaak: 'ZAAK', code: k4.code, rekeningId: 'R2', deelnemer: 'd2', leeft })]);
      assert.equal(kop.filter(x => x.ok).length, 1, 'precies een sessie heeft de band');
      assert.equal(kop.filter(x => x.code === 'bon-elders-gekoppeld').length, 1);

      // 5. rotatie op B terwijl A met de oude code afboekt: nooit allebei geldig na afloop
      const k5 = await ca.maak({ zaak: 'ZAAK', centen: 10000 });
      const [claimOud, rot] = await Promise.all([boek(ca, k5.code, 1000),
        cb.roteer({ zaak: 'ZAAK', id: k5.bon.id, door: 'zaak:ZAAK', idem: 'rot-1' })]);
      assert.equal(rot.ok, true);
      assert.equal((await boek(cb, k5.code, 1)).code, 'bon-vervangen', 'na de rotatie opent de oude code niets');
      assert.equal((await boek(ca, rot.code, 1)).ok, true);
      assert.equal((await lees()).waarde[k5.bon.id].saldo, claimOud.ok ? 8999 : 9999);
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
