/* Echte productie-topologieproef voor travelos.airport_boarding_pass.

   Twee onafhankelijke kerninstances delen de autoritatieve luchthavenrij in
   PostgreSQL. Twee afzonderlijke Redis-verbindingen bewijzen daarnaast dat de
   verplichte multi-instancebus werkelijk bereikbaar is; boarding-passclaims
   zelf serialiseren terecht in de bestaande PostgreSQL-collectietransactie. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = PG_URL && REDIS_URL ? false :
  'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances';

test('boarding-pass is hash-only en claimt atomair over twee PG/Redis-instances',
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
      assert.equal(await ra.ping(), 'PONG');
      assert.equal(await rb.ping(), 'PONG');
      const kanaal = 'rtg:test:boarding-pass:' + crypto.randomBytes(8).toString('hex');
      let ontvang, weiger;
      const gezien = new Promise((resolve, reject) => { ontvang = resolve; weiger = reject; });
      const grens = setTimeout(() => weiger(new Error('Redis multi-instancebericht niet ontvangen')), 3000);
      await rb.subscribe(kanaal, bericht => { clearTimeout(grens); ontvang(bericht); });
      await ra.publish(kanaal, 'gereed');
      assert.equal(await gezien, 'gereed');

      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      const dag = new Date().toISOString().slice(0, 10);
      await a.flush({ luchthaven: {
        vluchten: [{ id: 'vl_pg', nummer: 'RT205', soort: 'vertrek',
          bestemming: 'Ibiza', datum: dag, tijd: '17:30', gate: 'A1', status: 'inchecken' }],
        boekingen: [{ id: 'bk_legacy', code: 'VL-ABC123', vluchtId: 'vl_pg',
          key: 'legacy', codenaam: 'Legacy', status: 'ingecheckt', stoel: '1A',
          koffers: 0, at: '2025-01-01T00:00:00.000Z' }],
        koffers: [], security: [], charters: [], vips: [], lounge: []
      } }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const core = (pg, data) => require('../server/kern/luchthaven/boarding-pass')({
        db: { data, writable: true }, crypto,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk),
        vandaag: () => dag
      });
      const ca = core(a, dataA), cb = core(b, dataB);
      const lees = async () => {
        const { rows } = await a.pool.query('SELECT val, weg FROM kv WHERE key=$1', ['luchthaven']);
        assert.equal(rows.length, 1); assert.equal(rows[0].weg, false);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, lucht: JSON.parse(json) };
      };

      await ca.migreerAlles();
      let waar = await lees();
      assert.equal(waar.json.includes('VL-ABC123'), false);
      assert.ok(waar.lucht.boekingen[0].pass_historie[0].ingetrokken_at,
        'de startupmigratie sloot de zwakke legacycode');

      const boekRace = await Promise.all([
        ca.boek({ key: 'lid-pg', codenaam: 'Kobalt', vluchtId: 'vl_pg' }),
        cb.boek({ key: 'lid-pg', codenaam: 'Kobalt', vluchtId: 'vl_pg' })
      ]);
      assert.equal(boekRace.filter(x => x.status === 200).length, 1);
      assert.equal(boekRace.filter(x => x.status === 409).length, 1);
      const boekingId = boekRace.find(x => x.status === 200).boekingId;

      const checkRace = await Promise.all([
        ca.incheck({ key: 'lid-pg', boekingId, koffers: 1 }),
        cb.incheck({ key: 'lid-pg', boekingId, koffers: 1 })
      ]);
      assert.equal(checkRace.filter(x => x.status === 200).length, 1,
        'exact één instance geeft de kale code uit');
      assert.equal(checkRace.filter(x => x.status === 409).length, 1);
      const code = checkRace.find(x => x.status === 200).pass.code;
      assert.match(code, /^BP\.[A-F0-9]{32}$/);
      assert.equal(JSON.stringify(checkRace.find(x => x.status === 409)).includes(code), false);
      waar = await lees();
      assert.equal(waar.json.includes(code), false, 'PostgreSQL bevat alleen de hash');
      assert.equal(waar.lucht.koffers.filter(x => x.boekingId === boekingId).length, 1,
        'ook bagage werd door de dubbele check-in maar eenmaal gemaakt');
      assert.equal(JSON.stringify(await cb.mijnVeilig('lid-pg')).includes(code), false,
        'de tweede instance heronthult de pass niet via Mijn');

      const scanRace = await Promise.all([
        ca.controleerEnClaim({ code, partnerCode: 'AIRSHOP', actor: 'A' }),
        cb.controleerEnClaim({ code, partnerCode: 'AIRSHOP', actor: 'B' })
      ]);
      assert.equal(scanRace.filter(x => x.geldig).length, 2);
      assert.equal(scanRace.filter(x => x.herhaald).length, 1);
      waar = await lees();
      let rij = waar.lucht.boekingen.find(x => x.id === boekingId);
      assert.equal(rij.toegang.gebruik, 1);
      assert.equal(rij.pass_claims.filter(x => x.soort === 'partner-check').length, 1);

      const lounges = { salon: { naam: 'Salon Lounge', capaciteit: 40 } };
      const loungeRace = await Promise.all([
        ca.loungeIn({ actor: 'A', loungeId: 'salon', code, lounges }),
        cb.loungeIn({ actor: 'B', loungeId: 'salon', code, lounges })
      ]);
      assert.equal(loungeRace.filter(x => x.status === 200).length, 1);
      assert.equal(loungeRace.filter(x => x.status === 409).length, 1);
      waar = await lees(); rij = waar.lucht.boekingen.find(x => x.id === boekingId);
      assert.equal(rij.toegang.gebruik, 2);
      assert.equal(waar.lucht.lounge.filter(x => x.boekingId === boekingId && !x.uit).length, 1);

      const nieuw = await ca.roteer({ key: 'lid-pg', boekingId, verwachteRotatie: 1 });
      assert.equal(nieuw.status, 200);
      assert.equal((await cb.controleerEnClaim({ code, partnerCode: 'AIRSHOP' })).geldig, false);
      await cb.intrekken({ key: 'lid-pg', boekingId, verwachteRotatie: 2 });
      assert.equal((await ca.controleerEnClaim({ code: nieuw.pass.code, partnerCode: 'AIRSHOP' })).geldig, false);
      const laatste = await ca.roteer({ key: 'lid-pg', boekingId, verwachteRotatie: 2 });
      await cb.annuleerVlucht({ vluchtId: 'vl_pg', actor: 'operations-B' });
      assert.equal((await ca.controleerEnClaim({ code: laatste.pass.code, partnerCode: 'AIRSHOP' })).geldig, false,
        'annuleren op B maakt de pass op A direct nutteloos');
      waar = await lees(); rij = waar.lucht.boekingen.find(x => x.id === boekingId);
      assert.equal(rij.status, 'geannuleerd');
      assert.ok(rij.toegang.ingetrokken_at);
      assert.equal(waar.json.includes(nieuw.pass.code), false);
      assert.equal(waar.json.includes(laatste.pass.code), false);
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
