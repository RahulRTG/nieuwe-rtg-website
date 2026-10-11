/* Echte productie-topologieproef voor pay.giftcard_value_code.

   Twee onafhankelijke kerninstances delen de autoritatieve `giftcards`-rij in
   PostgreSQL. Ze racen om hetzelfde saldo, om een rotatie tegen een
   inwisseling, om dezelfde idempotentiesleutel en om de migratie van een oude
   kaart; in elk geval wint er precies een, en de database draagt daarna alleen
   hashes. Twee Redis-verbindingen bewijzen dat de verplichte
   multi-instancebus bereikbaar is; de claim zelf serialiseert in de
   PostgreSQL-collectietransactie (advisory lock + FOR UPDATE).

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/giftcard-credential.pg.test.js */
'use strict';

const test = require('node:test');
const { vereistAlle } = require('./infra');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = vereistAlle([['pg', !!PG_URL], ['redis', !!REDIS_URL]], 'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances');

test('cadeaukaart is hash-only en verzilvert atomair over twee PG/Redis-instances',
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
      const kanaal = 'rtg:test:cadeaukaart:' + crypto.randomBytes(8).toString('hex');
      let ontvang, weiger;
      const gezien = new Promise((resolve, reject) => { ontvang = resolve; weiger = reject; });
      const grens = setTimeout(() => weiger(new Error('Redis multi-instancebericht niet ontvangen')), 3000);
      await rb.subscribe(kanaal, bericht => { clearTimeout(grens); ontvang(bericht); });
      await ra.publish(kanaal, 'gereed');
      assert.equal(await gezien, 'gereed');

      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      const OUD = 'RTG-GC-0FF1CE';
      await a.flush({ giftcards: [{ code: OUD, supplierCode: 'ZAAK', supplierName: 'De Zaak', bedrag: 80,
        saldo: 80, customerKey: null, at: '2026-01-01T00:00:00.000Z', verzilveringen: [] }],
      posSales: { ZAAK: [{ id: 'B0', method: 'cadeaukaart', kaartCode: OUD, gcCode: OUD }] } }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const core = (pg, data) => require('../server/kern/cadeaukaart')({
        db: { data, writable: true }, crypto,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk)
      });
      const ca = core(a, dataA), cb = core(b, dataB);
      const lees = async (sleutel = 'giftcards') => {
        const { rows } = await a.pool.query('SELECT val, weg FROM kv WHERE key=$1', [sleutel]);
        assert.equal(rows.length, 1); assert.equal(rows[0].weg, false);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, waarde: JSON.parse(json) };
      };
      const koop = c => c.uitgeef({ supplierCode: 'ZAAK', supplierName: 'De Zaak', bedrag: 100,
        kocht: 'Kobalt', customerKey: 'lid-1', issuer: 'rtg.lid.cadeaukaart' });
      const inwissel = (c, code, bedrag, extra) => c.verzilver(Object.assign({ supplierCode: 'ZAAK', code,
        bedrag, actor: 'k' }, extra));

      // 0. twee instances migreren dezelfde oude kaart tegelijk: waarde blijft, code verdwijnt
      await Promise.all([ca.zorg(), cb.zorg()]);
      let waar = await lees();
      assert.equal(waar.json.includes('0FF1CE'), false, 'PostgreSQL bevat de oude kale code niet meer');
      assert.equal(waar.waarde.length, 1, 'een kaart, niet twee');
      assert.equal(waar.waarde[0].legacy24, true);
      assert.equal((await lees('posSales')).json.includes('0FF1CE'), false, 'ook de bon niet');
      const oudRace = await Promise.all([inwissel(ca, OUD, 80), inwissel(cb, OUD, 80)]);
      assert.equal(oudRace.filter(x => x.ok).length, 1, 'de houder betaalt een keer met wat hij had');

      // 1. saldorace: hetzelfde volle saldo tegelijk op A en B
      const k1 = await koop(ca);
      const race = await Promise.all([inwissel(ca, k1.code, 100), inwissel(cb, k1.code, 100)]);
      assert.equal(race.filter(x => x.ok).length, 1, 'exact een instance boekt af');
      assert.equal(race.filter(x => x.status === 409).length, 1);
      waar = await lees();
      const r1 = waar.waarde.find(g => g.id === k1.kaart.id);
      assert.equal(r1.saldo, 0);
      assert.equal(r1.verzilveringen.length, 1);
      assert.equal(waar.json.includes(k1.code.replace(/-/g, '').slice(2)), false, 'PostgreSQL bevat alleen de hash');

      // 2. deelbedragen: 60 + 60 op 100 -- nooit onder nul
      const k2 = await koop(cb);
      const deel = await Promise.all([inwissel(ca, k2.code, 60), inwissel(cb, k2.code, 60)]);
      assert.equal(deel.filter(x => x.ok).length, 1);
      assert.equal((await lees()).waarde.find(g => g.id === k2.kaart.id).saldo, 40);

      // 3. dezelfde kassasleutel op twee instances: een afboeking, twee keer dezelfde bon
      const k3 = await koop(ca);
      const idem = await Promise.all([inwissel(ca, k3.code, 30, { idem: 'bon-1', viaBon: 'BA' }),
        inwissel(cb, k3.code, 30, { idem: 'bon-1', viaBon: 'BB' })]);
      assert.equal(idem.filter(x => x.ok).length, 2);
      assert.equal(idem[0].verzilvering.viaBon, idem[1].verzilvering.viaBon, 'beide zien dezelfde bon');
      assert.equal((await lees()).waarde.find(g => g.id === k3.kaart.id).saldo, 70);

      // 4. rotatie op B terwijl A met de oude code inwisselt: nooit allebei geldig na afloop
      const k4 = await koop(ca);
      const [claimOud, rot] = await Promise.all([inwissel(ca, k4.code, 10),
        cb.roteer({ vind: g => g.id === k4.kaart.id, door: 'lid:K', idem: 'rot-1' })]);
      assert.equal(rot.ok, true);
      assert.equal((await inwissel(cb, k4.code, 1)).status, 409, 'na de rotatie opent de oude code niets');
      assert.equal((await inwissel(ca, rot.code, 1)).ok, true);
      waar = await lees();
      assert.equal(waar.waarde.find(g => g.id === k4.kaart.id).saldo, claimOud.ok ? 89 : 99);
      assert.equal(waar.json.includes(rot.code.replace(/-/g, '').slice(2)), false);

      // 5. intrekken op A maakt de code op B direct nutteloos
      const k5 = await koop(ca);
      await ca.intrek({ vind: g => g.id === k5.kaart.id, door: 'zaak:ZAAK' });
      assert.equal((await inwissel(cb, k5.code, 1)).status, 409);
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
