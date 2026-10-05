/* Echte productie-topologieproef voor partnerkanaal.personeels_en_partnercode (B14).

   Twee onafhankelijke kerninstances delen de autoritatieve
   `partnerPersoneelscodes` in PostgreSQL. Drie dingen mogen niet racen:
   1. twee boekingen tegelijk op de LAATSTE plek van een code (max_gebruik 1):
      precies een claimt, nooit allebei;
   2. een rotatie op A terwijl B met de oude code boekt: na afloop werkt alleen
      de nieuwe code, en de teller van de plek is hooguit een;
   3. een intrekking op A terwijl B een andere plek uitgeeft: de intrekking gaat
      niet verloren (geen herrijzende code door een oude werkkopie).
   De database draagt alleen hashes. Daarna B21 (oude codes gewist bij de uitrol).

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/partnerpersoneelscode.pg.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = PG_URL && REDIS_URL ? false :
  'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances';

test('de personeelscode claimt, roteert en trekt in als een transactie over twee PG-instances',
  { skip: OVERSLAAN, timeout: 360000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const { maakPersoneelscodes, COLLECTIE } = require('../server/kern/partnerpersoneelscode');
    const PARTNERS = [{ code: 'ATLAS', name: 'Atlas', staff: { serviceRate: 0 } }];
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    try {
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ [COLLECTIE]: {} }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const core = (pg, data) => maakPersoneelscodes({ db: { data, writable: true }, crypto,
        zoekPartner: code => PARTNERS.find(p => p.code === code) || null,
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk) });
      const ca = core(a, dataA), cb = core(b, dataB);
      // de waarheid: een verse kern op wat er NU in PostgreSQL staat
      const waar = async () => {
        const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', [COLLECTIE]);
        const json = kluis.ontsleutel(rows[0].val);
        const data = { [COLLECTIE]: JSON.parse(json) };
        return { json, kern: maakPersoneelscodes({ db: { data, writable: true }, crypto,
          zoekPartner: code => PARTNERS.find(p => p.code === code) || null,
          bewerkCollectie: () => { throw new Error('alleen lezen'); } }) };
      };

      // 1. twee boekingen tegelijk op het laatste gebruik
      const r = await ca.geef({ partner: 'ATLAS', maxGebruik: 1, door: 'a' });
      await b.haalNieuwer(dataB, () => {}); // B kent de code als geldig
      const [x, y] = await Promise.all([ca.claim(r.code), cb.claim(r.code)]);
      assert.equal([x, y].filter(Boolean).length, 1, 'precies een van de twee boekingen claimt');
      let w = await waar();
      assert.equal(w.kern.lijst('ATLAS').find(c => c.id === r.id).gebruik, 1, 'de teller staat op een');
      assert.ok(!w.json.includes(r.code.slice(3)), 'PostgreSQL bevat alleen hashes');

      // 2. rotatie op A tegen een boeking met de oude code op B
      const s = await ca.geef({ partner: 'ATLAS', maxGebruik: 5, door: 'a' });
      await b.haalNieuwer(dataB, () => {});
      const [rot, cl] = await Promise.all([ca.roteer({ id: s.id, door: 'a' }), cb.claim(s.code)]);
      assert.equal(rot.ok, true);
      w = await waar();
      assert.equal(w.kern.welke(s.code), null, 'de oude code opent niets meer');
      assert.ok(w.kern.welke(rot.code), 'de nieuwe wel');
      assert.ok(!w.json.includes(rot.code.slice(3)), 'ook de nieuwe code staat er alleen als hash');
      if (cl) assert.ok(w.kern.lijst('ATLAS').find(c => c.id === s.id), 'een claim die voor de rotatie viel is geldig');

      // 3. intrekken op A terwijl B een andere plek uitgeeft
      const t = await ca.geef({ partner: 'ATLAS', door: 'a' });
      await b.haalNieuwer(dataB, () => {});
      const [weg, nieuw] = await Promise.all([ca.trekIn({ id: t.id, door: 'a' }), cb.geef({ partner: 'ATLAS', door: 'b' })]);
      assert.equal(weg.ingetrokken, true);
      assert.equal(nieuw.ok, true);
      w = await waar();
      assert.equal(w.kern.welke(t.code), null, 'de intrekking ging niet verloren');
      assert.ok(w.kern.welke(nieuw.code), 'en de uitgifte van B staat er ook');
    } finally {
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
    /* B21 hangt aan DEZELFDE poort (geen tweede zelfpoortende toets, NORM.json
       zelfpoortendeToetsen): de wismigratie over twee instances, en een echte
       server op PostgreSQL. */
    await b21TweeInstances();
    await b21Server();
  });

/* B21: twee instances starten tegelijk bij de uitrol en draaien allebei de
   wismigratie (kern/partnerpersoneelscode-migratie.js) op dezelfde `partners`.
   Na afloop staat de oude code nergens in PostgreSQL, precies een instance wiste
   hem, en een derde ronde schrijft niets (de versie van de rij beweegt niet). */
async function b21TweeInstances() {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const maakMigratie = require('../server/kern/partnerpersoneelscode-migratie');
    const OUD = 'ATLAS-PERSONEEL-2024';
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    try {
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ partners: [{ code: 'NOVA', name: 'Nova' },
        { code: 'ATLAS', name: 'Atlas', staff: { serviceRate: 0, code: OUD } }] }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const m = (pg, data, t) => maakMigratie({ log() {}, nu: () => t,
        bewerkCollectie: (s, w) => pg.bewerkCollectie(s, data, w) });
      const [x, y] = await Promise.all([m(a, dataA, 1000).migreerOudeCodes(), m(b, dataB, 2000).migreerOudeCodes()]);
      assert.equal(x.gewist + y.gewist, 1, 'precies een instance wist hem; de ander vindt niets meer');
      const rij = async () => (await a.pool.query('SELECT val, ver FROM kv WHERE key=$1', ['partners'])).rows[0];
      const een = await rij();
      const json = kluis.ontsleutel(een.val);
      assert.ok(!json.includes(OUD), 'de oude code staat niet meer in PostgreSQL');
      const atlas = JSON.parse(json).find(p => p.code === 'ATLAS');
      assert.equal(atlas.staff.serviceRate, 0, 'het tarief blijft');
      assert.ok(['1970-01-01T00:00:01.000Z', '1970-01-01T00:00:02.000Z'].includes(atlas.staff.oude_code_gewist_at));
      assert.ok(!JSON.stringify(dataA.partners).includes(OUD), 'ook de werkkopie van A draagt hem niet meer');
      assert.equal((await m(a, dataA, 3000).migreerOudeCodes()).gewist, 0, 'een herhaling vindt niets');
      assert.equal(String((await rij()).ver), String(een.ver), 'en schrijft niets');
    } finally {
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
}

/* B21 op een echte server met PostgreSQL: de opstart wist de code voor de deur
   opengaat (server.js, de PostgreSQL-tak van de opstartmigraties), en een
   herstart schrijft de partners niet opnieuw. */
async function b21Server() {
  const fs = require('fs'), os = require('os'), path = require('path');
  const { startServer, stopHard } = require('./helper');
  const { maakPg } = require('../server/pg');
  const { merge3 } = require('../server/db/merge');
  const kluis = require('../server/kluis');
  const OUD = 'ATLAS-SERVER-2024';
  const pg = maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-b21pg-'));
  const env = { SMTP_URL: '', RTG_DATA_DIR: map, DATABASE_URL: PG_URL, REDIS_URL, RTG_STORE: 'postgres' };
  const rij = async () => (await pg.pool.query("SELECT val, ver FROM kv WHERE key = 'partners'")).rows[0];
  try {
    await pg.pool.query('DROP TABLE IF EXISTS kv');
    await pg.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
    await pg.schema();
    await pg.flush({ partners: [{ code: 'ATLAS', name: 'Atlas', staff: { serviceRate: 0, code: OUD } }] }, true);
    const een = await startServer({ env });
    await stopHard(een.child);
    const na = await rij();
    const json = kluis.ontsleutel(na.val);
    assert.ok(!json.includes(OUD), 'server: de oude code staat niet meer in PostgreSQL');
    assert.ok(JSON.parse(json).find(p => p.code === 'ATLAS').staff.oude_code_gewist_at, 'met een stempel');
    const twee = await startServer({ env });
    await stopHard(twee.child);
    assert.equal(String((await rij()).ver), String(na.ver), 'een herstart schrijft de partners niet opnieuw');
  } finally {
    await pg.sluit().catch(() => {});
    try { fs.rmSync(map, { recursive: true, force: true }); } catch (e) {}
  }
}
