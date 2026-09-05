/* Echte PostgreSQL-proef: twee onafhankelijke opslagmotoren delen alleen de
   database. Sleutel en beide grootboekprojecties moeten samen committen; een
   rollback laat niets achter, een verloren antwoord mag bij retry niet dubbel
   boeken, en sleutel/projectie-drift geeft nooit vals succes. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = URL ? false : 'DATABASE_URL ontbreekt; deze proef vereist een echte PostgreSQL';

test('payout-teruggang is atomair over twee PostgreSQL-instances en crash/retry',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const terug = require('../server/kern/betaalopdracht/terugboeking');
    const nieuw = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    const sleutelVan = ref => 'payout-terug:' + crypto.createHash('sha256')
      .update(['v1', 'pay', 'terug', ref].join('\u001f')).digest('hex');
    const identiteit = (ref, centen = 211) => ({ domein: 'pay', van: 'extern:uitbetaald',
      naar: 'partner:Z', centen, soort: 'terug', ref });
    const leesWaarheid = async pg => {
      const { rows } = await pg.pool.query(
        "SELECT key,val FROM kv WHERE key IN ('paySaldi','payBoekingen')");
      return Object.fromEntries(rows.map(r => [r.key, JSON.parse(kluis.ontsleutel(r.val))]));
    };
    const a = nieuw(), b = nieuw();
    try {
      await a.pool.query('DROP TABLE IF EXISTS economische_boekingen');
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flushVoorrang({ paySaldi: { 'extern:uitbetaald': -1000, 'partner:Z': 1000 } });
      await a.flush({ payBoekingen: [] }, true);
      const da = await a.laadAlles(), db = await b.laadAlles();
      let uitgevoerd = 0;
      const boek = data => ({ van, naar, centen, soort, oms, ref }) => {
        uitgevoerd++;
        const rij = { id: 'PB-' + uitgevoerd, van, naar, centen, soort, oms, ref, at: 1 };
        data.paySaldi[van] = (data.paySaldi[van] || 0) - centen;
        data.paySaldi[naar] = (data.paySaldi[naar] || 0) + centen;
        data.payBoekingen.unshift(rij);
        return { ok: true, boeking: rij };
      };
      const doe = (pg, data, ref = 'heen-race') => terug({
        domein: 'pay', geldModus: 'schaduw', grootboek: () => data.payBoekingen,
        boek: boek(data), boekAsync: async x => boek(data)(x),
        boekEenmaal: (i, w) => pg.boekEenmaal(data, i, w),
        van: 'extern:uitbetaald', naar: 'partner:Z', centen: 137,
        soort: 'terug', oms: 'rail weigerde', ref
      });

      const race = await Promise.all([doe(a, da), doe(b, db)]);
      assert.equal(uitgevoerd, 1, 'beide processen voerden dezelfde economische mutatie uit');
      assert.equal(new Set(race.map(x => x.boeking.id)).size, 1);
      assert.equal(race.filter(x => x.herhaald).length, 1);
      let waar = await leesWaarheid(a);
      assert.equal(waar.paySaldi['partner:Z'], 1137);
      assert.equal(waar.payBoekingen.length, 1);
      assert.equal(da.paySaldi['partner:Z'], 1137);
      assert.equal(db.paySaldi['partner:Z'], 1137);

      /* Een sleutelrij handmatig kwijt terwijl de beweging nog bestaat is
         herstelwerk, geen toestemming om dezelfde delta opnieuw te boeken. */
      const bewaard = await a.pool.query(
        'DELETE FROM economische_boekingen WHERE sleutel=$1 RETURNING sleutel,afdruk,antwoord',
        [sleutelVan('heen-race')]);
      assert.equal(bewaard.rows.length, 1);
      const voorOntbrekend = uitgevoerd;
      const ontbrekend = await doe(b, db, 'heen-race');
      assert.equal(ontbrekend.status, 503);
      assert.equal(ontbrekend.code, 'ECONOMISCHE_SLEUTEL_ONTBREEKT');
      assert.equal(uitgevoerd, voorOntbrekend);
      await a.pool.query('INSERT INTO economische_boekingen(sleutel,afdruk,antwoord) VALUES($1,$2,$3)',
        [bewaard.rows[0].sleutel, bewaard.rows[0].afdruk, bewaard.rows[0].antwoord]);

      /* Crash vóór commit: werk had RAM al geraakt maar gooit. De transactie en
         lokale werkkopie rollen terug; een tweede instance kan veilig retryen. */
      const sleutel = sleutelVan('heen-crash');
      const afdruk = crypto.createHash('sha256').update('crash').digest('hex');
      await assert.rejects(a.boekEenmaal(da, { sleutel, afdruk,
        identiteit: identiteit('heen-crash'),
        collecties: ['paySaldi', 'payBoekingen'] }, () => {
        da.paySaldi['partner:Z'] += 211;
        da.payBoekingen.unshift({ id: 'HALF', van: 'x', naar: 'partner:Z', centen: 211 });
        throw new Error('proces viel vóór commit weg');
      }), /vóór commit/);
      waar = await leesWaarheid(b);
      assert.equal(waar.paySaldi['partner:Z'], 1137);
      assert.equal(waar.payBoekingen.some(x => x.id === 'HALF'), false);
      const retry = await b.boekEenmaal(db, { sleutel, afdruk,
        identiteit: identiteit('heen-crash'),
        collecties: ['paySaldi', 'payBoekingen'] }, () => boek(db)({
          van: 'extern:uitbetaald', naar: 'partner:Z', centen: 211,
          soort: 'terug', oms: 'retry', ref: 'heen-crash' }));
      assert.equal(retry.ok, true);

      /* Commit gelukt, antwoord verloren: een verse derde instance krijgt
         dezelfde regel terug en boekt geen tweede delta. */
      const verloren = await doe(a, da, 'heen-antwoord-weg');
      const c = nieuw();
      try {
        const dc = await c.laadAlles();
        const weer = await doe(c, dc, 'heen-antwoord-weg');
        assert.equal(weer.herhaald, true);
        assert.equal(weer.boeking.id, verloren.boeking.id);
        waar = await leesWaarheid(c);
        assert.equal(waar.paySaldi['partner:Z'], 1485);
        assert.equal(waar.payBoekingen.length, 3);

        /* Herstel-/corruptiedrift: sleutel blijft staan, gekoppelde projectie
           verdwijnt. Nooit opnieuw boeken en nooit opgeslagen succes veinzen. */
        const beschadigd = JSON.parse(JSON.stringify(waar.payBoekingen));
        const doel = beschadigd.find(x => x.id === verloren.boeking.id);
        doel.ref = 'zelfde-id-andere-ref';
        await c.pool.query("UPDATE kv SET val=$1, ver=nextval('kv_ver_seq') WHERE key='payBoekingen'",
          [kluis.versleutel(JSON.stringify(beschadigd))]);
        const d = nieuw();
        try {
          const dd = await d.laadAlles();
          let nieuwWerk = 0;
          const drift = await terug({ domein: 'pay', geldModus: 'schaduw',
            grootboek: () => dd.payBoekingen, boek: () => { nieuwWerk++; return { ok: true }; },
            boekAsync: async () => ({ ok: true }), boekEenmaal: (i, w) => d.boekEenmaal(dd, i, w),
            van: 'extern:uitbetaald', naar: 'partner:Z', centen: 137,
            soort: 'terug', oms: 'retry', ref: 'heen-antwoord-weg' });
          assert.equal(drift.status, 503);
          assert.equal(drift.code, 'ECONOMISCHE_PROJECTIE_ONTBREEKT');
          assert.equal(nieuwWerk, 0);
        } finally { await d.sluit(); }
      } finally { await c.sluit(); }
      const n = await a.pool.query('SELECT count(*)::int AS n FROM economische_boekingen');
      assert.equal(Number(n.rows[0].n), 3);
      const sleutels = await a.pool.query('SELECT sleutel FROM economische_boekingen');
      assert.ok(sleutels.rows.every(x => /^payout-terug:[a-f0-9]{64}$/.test(x.sleutel)),
        'permanente sleutels bevatten alleen een vaste hash');
    } finally {
      await a.sluit();
      await b.sluit();
    }
  });
