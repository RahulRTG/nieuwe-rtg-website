/* Twee kerninstances delen de collectie in PostgreSQL en racen per restdeur van
   B9 om dezelfde claim: er wint er een, en de database draagt alleen hashes.
   Draai los: DATABASE_URL=... REDIS_URL=... node --test test/restdeuren.pg.test.js */
'use strict';

const test = require('node:test');
const { vereistAlle } = require('./infra');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const PG_URL = process.env.DATABASE_URL || process.env.PG_URL;
const REDIS_URL = process.env.REDIS_URL;
const OVERSLAAN = vereistAlle([['pg', !!PG_URL], ['redis', !!REDIS_URL]], 'vereist DATABASE_URL en REDIS_URL');

test('vier restdeuren claimen atomair en hash-only over twee PG/Redis-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const { createClient } = require('../server/redis');
    const kluis = require('../server/kluis');
    const { schoon } = require('../server/kern/util');
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: PG_URL });
    const a = nieuwPg(), b = nieuwPg();
    const ra = createClient({ url: REDIS_URL }), rb = createClient({ url: REDIS_URL });
    try {
      await Promise.all([ra.connect(), rb.connect()]);
      const kanaal = 'rtg:test:restdeuren:' + crypto.randomBytes(8).toString('hex');
      const gezien = new Promise((ok, nee) => {
        const grens = setTimeout(() => nee(new Error('Redis-bericht niet ontvangen')), 3000);
        rb.subscribe(kanaal, m => { clearTimeout(grens); ok(m); }).then(() => ra.publish(kanaal, 'gereed'));
      });
      assert.equal(await gezien, 'gereed');

      // festival en activiteit lokaal opgebouwd, dan als begintoestand weggeschreven
      const lokaal = { data: {} };
      const fk = require('../server/kern/festival')({ db: lokaal, save() {}, crypto, schoon });
      const fid = fk.festivalNieuw('ZAAK', { naam: 'Race' }).festival.id;
      const eid = fk.editieNieuw(fid, { jaar: 2027 }).editie.id;
      const dag = fk.dagZet(fid, eid, { datum: '2027-07-02', open: '00:00', sluit: '23:59' }).dag;
      const terrein = fk.plekZet(fid, eid, { naam: 'T', soort: 'terrein', capaciteit: 10 }).plek;
      const poort = fk.plekZet(fid, eid, { naam: 'P', soort: 'ingang', ouder: terrein.id }).plek;
      const pas = fk.pasUitgeven(fid, eid, { drager: 'KOBALT', rechten: [{ soort: 'festival.entree', dagen: [dag.id] }] }).pas;
      const wanneer = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ ovIncheckToegang: {}, modeBezorgCode: {}, festivals: lokaal.data.festivals,
        rtfos: { codelevenscycli: [], audit: [], activiteiten: [{ id: 'A1', stad: 'S1', naam: 'Buurtdag',
          status: 'open', capaciteit: 50, wanneer, inschrijvingen: [] }] } }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const tx = (pg, data) => (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk);
      const lees = async sleutel => {
        const { rows } = await a.pool.query('SELECT val FROM kv WHERE key=$1', [sleutel]);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, waarde: JSON.parse(json) };
      };

      // 1. OV-incheckcode: dezelfde code op A en B tegelijk start een rit
      const ov = (pg, data) => require('../server/kern/ov/incheckcode')({ crypto, bewerkCollectie: tx(pg, data), CODE_TTL_MS: 300000 });
      const ova = ov(a, dataA), ovb = ov(b, dataB);
      const oc = await ova.uitgeven({ key: 'lid:1', zaak: 'TRANSIT' });
      const vrij = () => null;
      const ovRace = await Promise.all([ova.claim({ code: oc.code, zaak: 'TRANSIT', controleer: vrij }),
        ovb.claim({ code: oc.code, zaak: 'TRANSIT', controleer: vrij })]);
      assert.equal(ovRace.filter(x => x.status === 200).length, 1, 'OV: een rit');
      let w = await lees('ovIncheckToegang');
      assert.equal(w.json.includes(oc.code.slice(4)), false, 'OV: hash-only');
      const oc2 = await ova.uitgeven({ key: 'lid:1', zaak: 'TRANSIT' });
      await ovb.intrekken({ key: 'lid:1' });
      assert.equal((await ova.claim({ code: oc2.code, zaak: 'TRANSIT', controleer: vrij })).status, 404,
        'OV: intrekken op B sluit A');

      // 2. bezorgcode: dezelfde code tegelijk, en foute pogingen van twee kanten
      const mb = (pg, data) => require('../server/kern/modebezorg/bezorgcode')({ crypto, bewerkCollectie: tx(pg, data), geheim: 'pg-proef' });
      const mba = mb(a, dataA), mbb = mb(b, dataB);
      const bc = await mba.uitgeven({ ref: 'R1', supplierCode: 'MAISON', houder: 'h' });
      const mbRace = await Promise.all([mba.claim({ ref: 'R1', supplierCode: 'MAISON', code: bc.code }),
        mbb.claim({ ref: 'R1', supplierCode: 'MAISON', code: bc.code })]);
      assert.equal(mbRace.filter(x => x.status === 200).length, 1, 'bezorg: een keer');
      const bc2 = await mbb.uitgeven({ ref: 'R2', supplierCode: 'MAISON', houder: 'h' });
      const mis = String((Number(bc2.code) + 1) % 10000).padStart(4, '0');
      await Promise.all(Array.from({ length: 6 }, (_, i) =>
        (i % 2 ? mba : mbb).claim({ ref: 'R2', supplierCode: 'MAISON', code: mis })));
      w = await lees('modeBezorgCode');
      assert.equal(w.waarde.R2.toegang.fout, 5, 'bezorg: elke fout telt');
      assert.ok(w.waarde.R2.toegang.ingetrokken_at, 'bezorg: vergrendeld');
      assert.equal((await mba.claim({ ref: 'R2', supplierCode: 'MAISON', code: bc2.code })).status, 403);
      const bc3 = await mba.uitgeven({ ref: 'R3', supplierCode: 'MAISON', houder: 'h' });
      const [lever, retour] = await Promise.all([mba.claim({ ref: 'R3', supplierCode: 'MAISON', code: bc3.code }),
        mbb.sluit({ ref: 'R3', supplierCode: 'MAISON', door: 'k', waarom: 'retour' })]);
      assert.equal([lever.status, retour.status].filter(s => s === 200).length, 1, 'bezorg: leveren of retour');

      // 3. festivalpas: twee poorten scannen dezelfde pas tegelijk
      const fest = (pg, data) => require('../server/kern/festival')({ db: { data }, save() {}, crypto, schoon, bewerkCollectie: tx(pg, data) });
      const fa = fest(a, dataA), fb = fest(b, dataB);
      const scan = (k, code) => k.scan(fid, eid, { code, plek: poort.id, datum: '2027-07-02', tijd: '13:00', poort: 'P' });
      const fRace = await Promise.all([scan(fa, pas.code), scan(fb, pas.code)]);
      assert.equal(fRace.filter(x => x.stand === 'groen').length, 1, 'festival: een groen');
      assert.equal(fRace.filter(x => x.stand === 'oranje').length, 1, 'festival: een oranje');
      w = await lees('festivals');
      const e = w.waarde[fid].edities[eid];
      assert.equal(e.passen[pas.id].toegang.gebruik, 1);
      assert.equal(w.json.includes(pas.code.slice(3)), false, 'festival: hash-only');
      await fa.pasIntrekken(fid, eid, pas.id, 'gestolen');
      assert.equal((await scan(fb, pas.code)).stand, 'rood', 'festival: intrekken sluit B');

      // 4. activiteit: twee deuren checken dezelfde inschrijving tegelijk in
      const act = (pg, data) => {
        const bewerk = tx(pg, data);
        const nu = () => new Date().toISOString();
        const levens = require('../server/kern/codelevenscyclus')({ opslag: () => [], staat: null, nu,
          rid: () => crypto.randomBytes(4).toString('hex'), crypto, save() {}, bewerkCollectie: bewerk });
        return require('../server/kern/rtfos/activiteiten-deur')({ nu, rid: () => crypto.randomBytes(4).toString('hex'),
          schoon, audit() {}, crypto, codelevenscyclus: levens, wieIn: () => ({ key: 'z' }),
          poortIn: (x, stad) => ({ ok: true, stad: { id: stad } }) },
        { beeld: x => ({ id: x.id }), ingeschreven: x => x.inschrijvingen.filter(i => ['ingeschreven', 'aanwezig'].includes(i.status)),
          wachtlijst: x => x.inschrijvingen.filter(i => i.status === 'wachtlijst'), schuifOp: () => [] });
      };
      const da = act(a, dataA), db2 = act(b, dataB);
      const ins = await da.inschrijven({}, 'A1', { codenaam: 'HV-RACE' });
      // de tweede inschrijving eerst: na een check-in staat de activiteit op 'bezig'
      const ins2 = await da.inschrijven({}, 'A1', { codenaam: 'HV-ROT' });
      assert.ok(ins.ok && ins2.ok, JSON.stringify([ins, ins2]));
      const aRace = await Promise.all([da.inchecken({}, 'A1', ins.inschrijving.checkinCode),
        db2.inchecken({}, 'A1', ins.inschrijving.checkinCode)]);
      assert.equal(aRace.filter(x => x.ok && !x.alBinnen).length, 1, 'activiteit: een binnen');
      assert.equal(aRace.filter(x => x.alBinnen).length, 1, 'activiteit: een al binnen');
      const [claim, rot] = await Promise.all([da.inchecken({}, 'A1', ins2.inschrijving.checkinCode),
        db2.nieuweCode({}, 'A1', ins2.inschrijving.id)]);
      assert.equal([claim.ok === true, rot.ok === true].filter(Boolean).length, 1,
        'activiteit: claim of rotatie');
      w = await lees('rtfos');
      const rijen = w.waarde.activiteiten[0].inschrijvingen;
      assert.equal(rijen.find(i => i.codenaam === 'HV-RACE').checkin_toegang.gebruik, 1);
      assert.equal(w.json.includes(ins.inschrijving.checkinCode.slice(3)), false, 'activiteit: hash-only');
    } finally {
      await Promise.allSettled([ra.quit(), rb.quit()]);
      await Promise.allSettled([a.sluit(), b.sluit()]);
    }
  });
