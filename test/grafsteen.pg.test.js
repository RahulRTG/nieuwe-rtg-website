/* DE GRAFSTEEN: EEN GEWISTE COLLECTIE BLIJFT GEWIST (TAKEN.md 4.38).

   HET GAT DAT DIT DICHT

   Elke node houdt een lokale snapshot als warme cache. Bij het opstarten wint
   Postgres alleen "voor elke collectie die hij HEEFT". Een rij die met
   `DELETE FROM kv` is verdwenen, heeft hij niet -- dus won de verouderde
   snapshot, en de node schreef die staat daarna zelfs terug. De collectie
   herrees. Dat is gereproduceerd voor er iets aan is veranderd: rij aanmaken,
   wissen, herstarten, en de rij stond er weer.

   Sindsdien laat wissen via `pg.wisCollectie()` (het commando `npm run kvwis`)
   een GRAFSTEEN achter: de rij blijft staan met `weg = true`. Elke node past
   dat verwijderen alsnog toe -- bij het opstarten en, tijdens het draaien, via
   NOTIFY.

   WAT DEZE TOETS NIET KAN BEWIJZEN: dat een handmatige `DELETE FROM kv` niet
   meer herrijst. Dat kan namelijk niet -- zonder rij is er geen spoor. Daarvoor
   is er de luide melding bij het opstarten, en schrijft RUNBOOK.md die weg af.

   Draait alleen met DATABASE_URL. Vraagt de database VOOR ZICHZELF (drop kv),
   dus serieel via `npm run test:pg`. */
const test = require('node:test');
const assert = require('node:assert/strict');

const URL = process.env.DATABASE_URL || process.env.PG_URL;

if (!URL) {
  test('grafsteen (overgeslagen: geen DATABASE_URL)', { skip: true }, () => {});
} else {
  const { merge3 } = require('../server/db');
  const { maakPg } = require('../server/pg');
  const kluis = require('../server/kluis');
  const nieuw = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });

  async function verseTabel(a) {
    await a.pool.query('DROP TABLE IF EXISTS kv');
    await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
    await a.schema();
  }

  test('een gewiste collectie komt niet terug uit de snapshot van een andere node', async () => {
    const schrijver = nieuw();
    await verseTabel(schrijver);

    // node 1 schrijft de collectie
    await schrijver.flush({ lastafworp: [{ id: 'AW-1' }], leden: [{ k: 'a' }] }, true);
    let uit = await schrijver.laadAlles();
    assert.deepEqual(uit.lastafworp, [{ id: 'AW-1' }], 'de collectie staat erin');
    assert.deepEqual(uit.__grafstenen, [], 'en er is nog niets gewist');

    // en wist hem daarna netjes
    assert.equal(await schrijver.wisCollectie('lastafworp'), true, 'wissen lukt');
    assert.equal(await schrijver.wisCollectie('lastafworp'), false, 'een tweede keer wissen doet niets');

    /* NODE 2 is een VERSE adapter: hij heeft de wis niet zien gebeuren en kent
       alleen zijn eigen (verouderde) beeld. Precies de node die het probleem
       veroorzaakte. */
    const laatkomer = nieuw();
    uit = await laatkomer.laadAlles();
    assert.equal(uit.lastafworp, undefined, 'de gewiste collectie komt niet terug in de data');
    assert.deepEqual(uit.__grafstenen, ['lastafworp'], 'hij komt terug als grafsteen, zodat de beller hem kan verwijderen');
    assert.deepEqual(uit.leden, [{ k: 'a' }], 'de rest van de data is ongemoeid');

    await schrijver.sluit(); await laatkomer.sluit();
  });

  test('een draaiende node pikt het wissen op via haalNieuwer, en zet het niet terug', async () => {
    const a = nieuw(), b = nieuw();
    await verseTabel(a);
    await a.flush({ lastafworp: [{ id: 'AW-1' }] }, true);

    // node b draait al en heeft de collectie in zijn werkkopie
    const dataB = await b.laadAlles();
    assert.deepEqual(dataB.lastafworp, [{ id: 'AW-1' }]);

    await a.wisCollectie('lastafworp');
    await b.haalNieuwer(dataB, null);
    assert.equal(dataB.lastafworp, undefined, 'b heeft het wissen toegepast op zijn eigen werkkopie');

    /* En de proef op de som: b flusht daarna. Zonder de behandeling hierboven
       zou b de collectie uit zijn werkkopie terugschrijven en was het wissen
       alleen gelukt op de machine waar het commando liep. */
    await b.flush(dataB, true);
    const na = await nieuw();
    const uit = await na.laadAlles();
    assert.equal(uit.lastafworp, undefined, 'na de flush van b staat hij er nog steeds niet');
    assert.deepEqual(uit.__grafstenen, ['lastafworp'], 'de grafsteen staat er nog');

    await a.sluit(); await b.sluit(); await na.sluit();
  });

  test('het hele opstartpad: na een wis herrijst de collectie niet bij de volgende start', async () => {
    /* De drie toetsen hierboven meten de ADAPTER. Deze meet de SERVER, want daar
       zat het gat: server/db/postgres.js voegt de lokale snapshot en Postgres
       samen, en dat is de plek waar de gewiste collectie terugkwam. Twee echte
       starts op DEZELFDE datamap, met het wissen ertussen -- precies het
       scenario uit TAKEN.md 4.38, dat voor de reparatie reproduceerbaar een
       herrezen rij opleverde. */
    const { startServer, stopHard } = require('./helper');
    const fs = require('fs'), os = require('os'), path = require('path');
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-grafsteen-'));
    const env = { SMTP_URL: '', RTG_DATA_DIR: TMP, DATABASE_URL: URL, RTG_STORE: 'postgres' };
    const opzet = nieuw();
    await verseTabel(opzet);
    await opzet.flush({ lastafworp: [{ id: 'AW-1', reden: 'registratie op 503' }] }, true);
    const leeft = async () => (await opzet.pool.query(
      "SELECT count(*)::int AS n FROM kv WHERE key = 'lastafworp' AND weg = false")).rows[0].n;
    try {
      const een = await startServer({ env });
      await stopHard(een.child);
      assert.equal(await leeft(), 1, 'na de eerste start staat de collectie er gewoon');

      assert.equal(await opzet.wisCollectie('lastafworp'), true, 'de beheerder wist hem');
      assert.equal(await leeft(), 0, 'en hij is weg');

      const twee = await startServer({ env });   // dezelfde datamap, dus dezelfde snapshot
      await stopHard(twee.child);
      assert.equal(await leeft(), 0,
        'na de tweede start staat hij er NOG STEEDS niet -- zonder grafsteen herrees hij hier');
    } finally {
      await opzet.sluit().catch(() => {});
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  });

  /* DE TWEE SCHAKELS APART. Er zitten twee sloten op hetzelfde gat: het
     opstartpad verwijdert een grafsteen uit db.data, en de flush weigert over
     een verse grafsteen heen te schrijven. Bij het namuteren bleek dat ze elkaar
     AFDEKKEN -- haal er een weg en de toetsen bleven groen, want de ander ving
     het op. Twee sloten zijn goed, maar een slot dat niemand mist als het
     verdwijnt is geen slot. Daarom deze twee, die elk precies een schakel
     aanwijzen. */
  test('SCHAKEL 1 -- de flush weigert over een verse grafsteen heen te schrijven', async () => {
    const a = nieuw(), b = nieuw();
    await verseTabel(a);
    await a.flush({ lastafworp: [{ id: 'AW-1' }] }, true);
    const dataB = await b.laadAlles();          // b kent de collectie
    await a.wisCollectie('lastafworp');

    /* b moet de collectie ECHT gewijzigd hebben, anders slaat de flush hem
       sowieso over als onveranderd en bewijst deze toets niets -- dat was de
       eerste versie hiervan, en de mutatie kwam er ongestraft doorheen. */
    dataB.lastafworp.push({ id: 'AW-2' });
    await b.flush(dataB, true);                 // ZONDER haalNieuwer: b weet van niets

    const uit = await nieuw().laadAlles();
    assert.equal(uit.lastafworp, undefined, 'de flush van een onwetende node zet hem niet terug');
    assert.deepEqual(uit.__grafstenen, ['lastafworp'], 'de grafsteen staat er nog');
    /* En de eerlijke keerzijde, met zoveel woorden: b's toevoeging is WEG. Het
       wissen is een expliciete beheershandeling en wint van een write-behind
       flush die er nog niets van wist. Dat is de bedoelde ruil, geen bijvangst. */
    assert.equal(dataB.lastafworp, undefined, 'b past het wissen ook op zijn eigen werkkopie toe');
    await a.sluit(); await b.sluit();
  });

  test('SCHAKEL 2 -- het opstartpad haalt de grafsteen uit db.data', async () => {
    /* Hier gaat het om wat de node IN HANDEN heeft, niet om wat er in Postgres
       staat. Past het opstartpad de grafsteen niet toe, dan werkt de server
       gewoon door met gewiste gegevens -- ook als de flush ze nooit wegschrijft.
       Een kindproces, want server/db draagt module-state en kan maar een keer
       per proces opstarten. */
    const cp = require('child_process');
    const fs = require('fs'), os = require('os'), path = require('path');
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-grafsteen2-'));
    const a = nieuw();
    await verseTabel(a);
    await a.flush({ lastafworp: [{ id: 'AW-1' }] }, true);
    const start = () => {
      const r = cp.spawnSync(process.execPath, ['--experimental-sqlite', '-e',
        "const d=require('./server/db');(async()=>{d.load();await d.startPostgres();" +
        "console.log('HEEFT:'+(d.db.data.lastafworp!==undefined));process.exit(0);})()" +
        ".catch(e=>{console.log('FOUT:'+e.message);process.exit(1);});"],
        { encoding: 'utf8', cwd: path.join(__dirname, '..'),
          env: { ...process.env, RTG_DATA_DIR: TMP, DATABASE_URL: URL, RTG_STORE: 'postgres', SMTP_URL: '' } });
      return ((r.stdout || '') + (r.stderr || ''));
    };
    try {
      assert.match(start(), /HEEFT:true/, 'eerst heeft de node de collectie gewoon');
      await a.wisCollectie('lastafworp');
      assert.match(start(), /HEEFT:false/,
        'na de wis heeft hij hem niet meer -- ook al staat hij nog in de lokale snapshot');
    } finally {
      await a.sluit().catch(() => {});
      try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
    }
  });

  test('een gewiste naam mag opnieuw gevuld worden: een grafsteen is geen verbod', async () => {
    /* Belangrijk onderscheid. De grafsteen zegt "die staat van toen is weg",
       niet "deze naam mag nooit meer bestaan". Zou hij dat wel zeggen, dan zou
       een collectie die de applicatie later opnieuw aanmaakt stilzwijgend
       verdwijnen -- en dan hadden we het herrijzen geruild voor dataverlies. */
    const a = nieuw();
    await verseTabel(a);
    await a.flush({ lastafworp: [{ id: 'AW-1' }] }, true);
    await a.wisCollectie('lastafworp');

    await a.flush({ lastafworp: [{ id: 'AW-2' }] }, true);
    const uit = await nieuw().laadAlles();
    assert.deepEqual(uit.lastafworp, [{ id: 'AW-2' }], 'opnieuw vullen werkt gewoon');
    assert.deepEqual(uit.__grafstenen, [], 'en de grafsteen is daarmee opgeheven');
    await a.sluit();
  });
}
