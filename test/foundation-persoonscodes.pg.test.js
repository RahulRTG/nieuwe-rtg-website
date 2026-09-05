/* Echte PostgreSQL-proef voor Foundation-persoonscodes. Twee onafhankelijke
   contexts delen alleen de database en raken tegelijk dezelfde `rtfos`-rij.
   Daarmee bewijst deze toets wat een geheugenproef niet kan: max-use,
   intrekking en rollback houden ook tussen app-instances stand. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = URL ? false : 'DATABASE_URL ontbreekt; deze proef vereist een echte PostgreSQL';

test('Foundation-persoonscode is één multi-instance collectietransactie',
  { skip: OVERSLAAN }, async () => {
    const { merge3 } = require('../server/db');
    const { maakPg } = require('../server/pg');
    const kluis = require('../server/kluis');
    const maakCyclus = require('../server/kern/codelevenscyclus');
    const nieuw = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    const a = nieuw(), b = nieuw();
    try {
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ rtfos: {
        vrijwilligers: [
          { id: 'v-race', naam: 'Race', persoonscode_id: null },
          { id: 'v-fout', naam: 'Rollback', persoonscode_id: null },
          { id: 'v-los', naam: 'Los', persoonscode_id: null },
          { id: 'v-overlap', naam: 'Overlap', persoonscode_id: null }
        ], codelevenscycli: [], audit: []
      } }, true);

      const dataA = await a.laadAlles();
      const dataB = await b.laadAlles();
      /* Gebruik de actieve a/b-instanties na bootstrap niet nogmaals als
         inspectielezer. `laadAlles()` initialiseert ook hun synchronisatiebasis;
         die basis vervangen zonder de bijbehorende levende dataA/dataB te
         vervangen maakt een kunstmatige stale-cachecombinatie die in een
         draaiende server niet voorkomt. Lees bewijs daarom rechtstreeks en
         zonder toestand uit dezelfde autoritatieve rij. */
      const leesWaar = async pg => {
        const { rows } = await pg.pool.query('SELECT val, weg FROM kv WHERE key = $1', ['rtfos']);
        assert.equal(rows.length, 1, 'de rtfos-bewijsrij ontbreekt');
        assert.equal(rows[0].weg, false, 'de rtfos-bewijsrij is gewist');
        return JSON.parse(kluis.ontsleutel(rows[0].val));
      };
      const cyclus = (pg, data) => maakCyclus({
        opslag: () => data.rtfos.codelevenscycli,
        staat: () => data.rtfos,
        nu: () => '2030-01-01T12:00:00.000Z',
        rid: () => crypto.randomBytes(8).toString('hex'), crypto, save() {},
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk)
      });
      const ca = cyclus(a, dataA), cb = cyclus(b, dataB);
      const invoer = id => ({ prefix: 'RTFV', issuer: 'bestuur-1',
        doel: 'foundation-persoonsportaal', scope: ['vrijwilliger:lezen'],
        onderwerp: { soort: 'vrijwilliger', id }, max_gebruik: 1 });
      const verwacht = { doel: 'foundation-persoonsportaal', soort: 'vrijwilliger',
        scope: 'vrijwilliger:lezen' };
      const binding = (staat, toegang) => staat.vrijwilligers.find(v =>
        v.id === toegang.onderwerp.id && v.persoonscode_id === toegang.id) || null;
      const audit = (staat, wat, doel) => staat.audit.unshift({
        id: crypto.randomBytes(6).toString('hex'), wie: 'bestuur-1', wat, doel,
        extra: '', at: '2030-01-01T12:00:00.000Z'
      });

      const uitgegeven = await ca.transactie(tx => {
        const v = tx.staat.vrijwilligers.find(x => x.id === 'v-race');
        const r = tx.uitgeven(invoer(v.id));
        v.persoonscode_id = r.toegang.id;
        audit(tx.staat, 'vrijwilliger.code-uitgegeven', v.id);
        return r;
      });
      let waar = await leesWaar(b);
      assert.equal(waar.vrijwilligers[0].persoonscode_id, uitgegeven.toegang.id);
      assert.equal(waar.codelevenscycli.length, 1);
      assert.equal(waar.audit[0].wat, 'vrijwilliger.code-uitgegeven');

      const race = await Promise.all([
        ca.controleer(uitgegeven.code, verwacht, binding),
        cb.controleer(uitgegeven.code, verwacht, binding)
      ]);
      assert.equal(race.filter(x => x.ok).length, 1, 'max-use gaf meer dan één instance toegang');
      assert.equal(race.filter(x => x.reden === 'opgebruikt').length, 1);
      waar = await leesWaar(a);
      assert.equal(waar.codelevenscycli[0].gebruik, 1, 'autoritatieve teller ging boven max-use');

      const geroteerd = await cb.transactie(tx => {
        const v = tx.staat.vrijwilligers.find(x => x.id === 'v-race');
        const r = tx.roteer(v.persoonscode_id, { prefix: 'RTFV', issuer: 'bestuur-1' });
        v.persoonscode_id = r.toegang.id;
        audit(tx.staat, 'vrijwilliger.code-geroteerd', v.id);
        return r;
      });
      await ca.transactie(tx => {
        const v = tx.staat.vrijwilligers.find(x => x.id === 'v-race');
        const r = tx.intrekken(v.persoonscode_id, 'bestuur-1', 'proef');
        audit(tx.staat, 'vrijwilliger.code-ingetrokken', v.id);
        return r;
      });
      const naIntrekking = await cb.controleer(geroteerd.code, verwacht, binding);
      assert.equal(naIntrekking.reden, 'ingetrokken', 'na de intrekcommit kwam een andere instance nog binnen');
      waar = await leesWaar(b);
      assert.ok(waar.codelevenscycli.find(x => x.id === geroteerd.toegang.id).ingetrokken_at);
      assert.ok(waar.audit.some(x => x.wat === 'vrijwilliger.code-ingetrokken'));

      const los = await ca.transactie(tx => {
        const v = tx.staat.vrijwilligers.find(x => x.id === 'v-los');
        const r = tx.uitgeven(invoer(v.id));
        v.persoonscode_id = r.toegang.id;
        return r;
      });
      await cb.transactie(tx => {
        tx.staat.vrijwilligers.find(x => x.id === 'v-los').persoonscode_id = null;
        return { ok: true };
      });
      assert.equal((await ca.controleer(los.code, verwacht, binding)).reden, 'binding-ontbreekt');
      waar = await leesWaar(b);
      assert.equal(waar.codelevenscycli.find(x => x.id === los.toegang.id).gebruik, 0,
        'een verbroken binding verbruikte toch een toegang');

      await assert.rejects(ca.transactie(tx => {
        const v = tx.staat.vrijwilligers.find(x => x.id === 'v-fout');
        const r = tx.uitgeven(invoer(v.id));
        v.persoonscode_id = r.toegang.id;
        audit(tx.staat, 'mislukte-uitgifte', v.id);
        throw new Error('uitgelokte transactiefout');
      }), /uitgelokte transactiefout/);
      waar = await leesWaar(b);
      assert.equal(waar.vrijwilligers.find(x => x.id === 'v-fout').persoonscode_id, null);
      assert.equal(waar.codelevenscycli.some(x => x.onderwerp.id === 'v-fout'), false,
        'rollback liet een verweesde coderij achter');
      assert.equal(waar.audit.some(x => x.wat === 'mislukte-uitgifte'), false,
        'rollback liet een halve auditregel achter');

      /* Houd het echte advisory slot vast, laat de collectietransactie daarop
         wachten en muteer intussen de gewone live S()-staat. Dit is precies het
         venster waarin een post-commit assignment vroeger de gewone mutatie
         uit RAM en later uit Postgres wiste. */
      const blocker = await a.pool.connect();
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', ['rtfos']);
        const lopend = ca.transactie(tx => {
          tx.staat.vrijwilligers.find(x => x.id === 'v-overlap').persoonscode_id = 'tx-binding';
          return { ok: true };
        });
        let wacht = false;
        for (let i = 0; i < 100 && !wacht; i++) {
          const q = await b.pool.query("SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory' AND NOT granted");
          wacht = Number(q.rows[0].n) > 0;
          if (!wacht) await new Promise(r => setTimeout(r, 10));
        }
        assert.equal(wacht, true, 'de overlapopstelling bereikte het echte PG-slot niet');
        dataA.rtfos.audit.unshift({ id: 'live-overlap', wie: 'gewoon', wat: 'gewone-mutatie',
          doel: 'naast-tx', extra: '', at: '2030-01-01T12:00:00.000Z' });
        dataA.rtfos.vrijwilligers.find(x => x.id === 'v-overlap').persoonscode_id = 'stale-live';
        await blocker.query('COMMIT');
        await lopend;
      } finally {
        try { await blocker.query('ROLLBACK'); } catch (e) {}
        blocker.release();
      }
      waar = await leesWaar(b);
      assert.equal(waar.vrijwilligers.find(x => x.id === 'v-overlap').persoonscode_id, 'tx-binding',
        'een live collision draaide de transactionele securitybinding terug');
      assert.ok(waar.audit.some(x => x.id === 'live-overlap'),
        'een gewone live mutatie tijdens PG-I/O ging verloren');
    } finally {
      await a.sluit();
      await b.sluit();
    }
  });
