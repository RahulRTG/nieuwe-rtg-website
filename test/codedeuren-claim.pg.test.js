/* Echte productie-topologieproef voor vier codedeuren die op 27 september 2026
   van `remaining` naar `migrated` gingen: workos.concern_uitnodiging,
   office.kantooruitnodiging, service.balie_bevestigingscode en
   magnaat.teamkamer_toegangscode.

   Twee onafhankelijke kerninstances delen dezelfde PostgreSQL. Ze racen om
   dezelfde eenmalige code: er ontstaat precies EEN dienstverband, EEN
   kantoorkoppeling en EEN machtiging, en een teamkamer laat nooit meer mensen
   toe dan zijn code toestaat. De database draagt alleen hashes.

   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/codedeuren-claim.pg.test.js */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = PG_URL && REDIS_URL ? false :
  'vereist echte DATABASE_URL en REDIS_URL voor twee onafhankelijke instances';

test('vier eenmalige codes claimen atomair over twee PG/Redis-instances',
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
      const kanaal = 'rtg:test:codedeuren:' + crypto.randomBytes(8).toString('hex');
      let ontvang, weiger;
      const gezien = new Promise((resolve, reject) => { ontvang = resolve; weiger = reject; });
      const grens = setTimeout(() => weiger(new Error('Redis multi-instancebericht niet ontvangen')), 3000);
      await rb.subscribe(kanaal, bericht => { clearTimeout(grens); ontvang(bericht); });
      await ra.publish(kanaal, 'gereed');
      assert.equal(await gezien, 'gereed');

      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ concern: {}, kantoorUitnodigingen: [], serviceBevestigingen: [],
        magnaatTrainingslobbies: { versie: 1, kamers: {} } }, true);
      const lees = async (sleutel) => {
        const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', [sleutel]);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, waarde: JSON.parse(json) };
      };
      const bewerk = (pg, data) => (s, w) => pg.bewerkCollectie(s, data, w);
      const schoon = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

      /* Alles wat een instance nodig heeft, eerst op A gemaakt en weggeschreven. */
      const dataA = await a.laadAlles();
      const concern = (pg, data) => require('../server/kern/concern')({ db: { data, writable: true }, save() {}, crypto,
        schoon, findSupplier: () => null, bewerkCollectie: bewerk(pg, data) });
      const KA = concern(a, dataA);
      const e = KA.entiteitVind(KA.entiteitNieuw('lid_a', { naam: 'Race BV', land: 'NL', rechtsvorm: 'bv' }).entiteit.id);
      const v = KA.vestigingNieuw(e, { naam: 'Utrecht', plaats: 'Utrecht' }).vestiging;
      const uit = KA.uitnodigingNieuw('lid_a', { entiteit: e.id, vestiging: v.id, rol: 'receptie' });

      const service = (pg, data) => {
        const db = { data, writable: true };
        const zaken = require('../server/kern/service/zaak')({ db, save() {}, crypto });
        const machtigingen = require('../server/kern/service/machtiging')({ db, save() {}, crypto, zaken, inzagelog: { noteerVast: async () => ({ ok: true }) } });
        return { zaken, bev: require('../server/kern/service/bevestiging')({ db, save() {}, crypto, zaken, machtigingen,
          bewerkCollectie: bewerk(pg, data) }) };
      };
      const SA = service(a, dataA);
      const z = SA.zaken.open({ melder: 'user-7', onderwerp: 'zaak', titel: 'Werkruimte reageert niet' }).zaak;
      const vraag = () => SA.bev.vraag({ zaakId: z.id, mens: 'nadia', capabilities: ['organisatie.stand'],
        reden: 'de operationele werkruimte reageert niet' }).bevestiging;
      const b1 = vraag();
      await a.flush(dataA, true);
      const dataB = await b.laadAlles();
      const KB = concern(b, dataB), SB = service(b, dataB);

      // 1. concern: dezelfde uitnodiging tegelijk op A en B -> EEN dienstverband
      const [c1, c2] = await Promise.all([KA.uitnodigingAccepteer(uit.code, 'lid_x'), KB.uitnodigingAccepteer(uit.code, 'lid_y')]);
      assert.equal([c1, c2].filter(r => r.ok).length, 1, 'precies een instance claimde de uitnodiging: ' + JSON.stringify([c1, c2]));
      assert.equal([c1, c2].filter(r => r.status === 409).length, 1);
      const cw = await lees('concern');
      assert.equal(Object.values(cw.waarde.employments).length, 1, 'een dienstverband, niet twee');
      assert.equal(cw.waarde.uitnodigingen[uit.uitnodiging.id].toegang.gebruik, 1);
      assert.equal(cw.json.includes(uit.code.slice(3)), false, 'PostgreSQL bevat alleen de hash');

      // 2. kantoor: dezelfde uitnodiging tegelijk op A en B -> EEN verzilvering
      const maak = (pg, data) => require('../server/kern/kantoor/uitnodiging').maakUitnodiging({
        db: { data, writable: true }, save() {}, crypto, bewerkCollectie: bewerk(pg, data) });
      const UA = maak(a, dataA), UB = maak(b, dataB);
      const ku = await UA.maak({ voorKey: 'user-5', door: 'eigenaar' });
      const [k1, k2] = await Promise.all([UA.verzilver('user-5', ku.code), UB.verzilver('user-5', ku.code)]);
      assert.equal([k1, k2].filter(r => r.ok).length, 1, 'precies een koppeling: ' + JSON.stringify([k1, k2]));
      const kw = await lees('kantoorUitnodigingen');
      assert.equal(kw.waarde.find(x => x.id === ku.id).toegang.gebruik, 1);
      assert.equal(kw.json.includes(ku.code.slice(3)), false);

      // 3. service: dezelfde voorgelezen code tegelijk op A en B -> EEN machtiging
      const t1 = await SA.bev.toon(b1.id, { melder: 'user-7' });
      const [s1, s2] = await Promise.all([SA.bev.metCode(t1.code, { mens: 'nadia', zaak: z.id }),
        SB.bev.metCode(t1.code, { mens: 'nadia', zaak: z.id })]);
      assert.equal([s1, s2].filter(r => r.ok).length, 1, 'precies een claim: ' + JSON.stringify([s1, s2]));
      let sw = await lees('serviceBevestigingen');
      const rij1 = sw.waarde.find(x => x.id === b1.id);
      assert.ok(rij1.gebruiktAt && rij1.machtiging && rij1.code_hash === null);
      // en de knop van het lid op A tegen de code op B: een van beide
      const b2 = await (async () => { const x = vraag(); await a.flush(dataA, true); return x; })();
      const t2 = await SA.bev.toon(b2.id, { melder: 'user-7' });
      const [p1, p2] = await Promise.all([SA.bev.bevestig(b2.id, { melder: 'user-7' }),
        SB.bev.metCode(t2.code, { mens: 'nadia', zaak: z.id })]);
      assert.equal([p1, p2].filter(r => r.ok).length, 1, 'knop en code verbruikten hetzelfde verzoek: ' + JSON.stringify([p1, p2]));
      sw = await lees('serviceBevestigingen');
      assert.equal(sw.json.includes('"code":'), false, 'een kale code staat in PostgreSQL');

      // 4. magnaat: twaalf spelers tegelijk op een kamer met elf vrije plekken
      const model = { meta: { hash: 'race', releaseModel: 'vier-ogen-v2' }, snapshot: { code: 'TEAM', naam: 'Race',
        type: 'software', stad: 'Utrecht', rollen: [{ id: 'op', naam: 'Operator', rechten: ['oefenen'] }],
        werkprocessen: [{ id: 'w', naam: 'Werk', doel: 'Doel', stappen: ['Een', 'Twee', 'Drie'] }] } };
      const lobby = (pg, data) => require('../server/kern/magnaat-trainingslobby')({ db: { data, writable: true },
        save() {}, crypto, bewerkCollectie: bewerk(pg, data), codenaamVan: k => k,
        partnerstudio: { trainingsmodel: () => model } });
      const LA = lobby(a, dataA), LB = lobby(b, dataB);
      const kamer = (await LA.maak('host', { code: 'TEAM' })).kamer;
      const pogingen = Array.from({ length: 12 }, (_, i) => (i % 2 ? LB : LA).deelnemen('speler' + i, kamer.toegangscode));
      const uitslag = await Promise.all(pogingen);
      assert.equal(uitslag.filter(r => r.ok).length, 11, 'meer of minder dan elf spelers kwamen binnen');
      assert.equal(uitslag.filter(r => r.status === 409).length, 1);
      const mw = await lees('magnaatTrainingslobbies');
      assert.equal(mw.waarde.kamers[kamer.id].toegang.gebruik, 11);
      assert.equal(mw.waarde.kamers[kamer.id].deelnemers.length, 12);
      assert.equal(mw.json.includes(kamer.toegangscode.slice(3)), false);
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
