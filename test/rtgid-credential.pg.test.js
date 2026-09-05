/* Echte PostgreSQL-proef voor RTG-iD. Twee onafhankelijke processen delen
   alleen de autoritatieve collectie: uitgifte, rotatie en intrekking moeten
   daardoor serialiseren, terwijl geen van beide kale credentials ooit in de
   database belandt. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = URL ? false : 'DATABASE_URL ontbreekt; deze proef vereist een echte PostgreSQL';

test('RTG-iD credentials zijn hash-only en atomair over twee PostgreSQL-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const { maakRtgid } = require('../server/kern/rtgid');
    const nieuwPg = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    const a = nieuwPg(), b = nieuwPg();
    try {
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ rtgid: {
        koppels: [{ id: 'legacy-koppel', code: 'ID-OUDE-KALE-CODE',
          tokenEenmalig: 'OUDE-KALE-STATUS', dienst: 'Oud', status: 'wacht',
          gemaakt: '2020-01-01T00:00:00.000Z', verloopt: 1 }],
        sessies: [], logs: {}, machtigingen: []
      } }, true);
      const dataA = await a.laadAlles();
      const dataB = await b.laadAlles();
      const core = (pg, data) => maakRtgid({
        db: { data, writable: true }, save() {},
        bewerkCollectie: (sleutel, werk) => pg.bewerkCollectie(sleutel, data, werk),
        crypto, accounts: {
          getUserById(id) { return id === 1 ? { id: 1, verified: 'verified' } : null; },
          getMemberState() { return { faceMatch: true }; },
          realNameOf() { return 'PG Lid'; }
        },
        schoon: (v, n) => String(v || '').trim().slice(0, n),
        leeftijdVan() { return null; }, gidsHaal() { return null; },
        async keyVanCodenaam() { return null; },
        async stapOp() { return { status: 200, ok: true }; },
        passkeysVan() { return 0; }, vakbewijsBron() { return {}; }
      }).rtgid;
      const ra = core(a, dataA), rb = core(b, dataB);
      const idem = 'rtgid-pg-start-00000001';
      const invoer = { dienst: 'PG Dienst', attributen: ['codenaam'], idem };
      const race = await Promise.all([ra.start(invoer, 'dienst-a'), rb.start(invoer, 'dienst-a')]);
      const uitgegeven = race.find(x => x.status === 200);
      const herhaling = race.find(x => x.status === 409);
      assert.ok(uitgegeven && herhaling, 'exact één instance geeft credentials uit');
      assert.equal(herhaling.herhaald, true);
      assert.equal(herhaling.code, undefined);
      assert.equal(herhaling.koppelId, undefined);
      assert.match(uitgegeven.code, /^ID\.[A-F0-9]{32}$/);
      assert.match(uitgegeven.koppelId, /^RID\.[A-F0-9]{32}$/);

      const leesWaarheid = async () => {
        const { rows } = await a.pool.query('SELECT val, weg FROM kv WHERE key=$1', ['rtgid']);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].weg, false);
        return { json: kluis.ontsleutel(rows[0].val), data: JSON.parse(kluis.ontsleutel(rows[0].val)) };
      };
      let waar = await leesWaarheid();
      for (const geheim of [uitgegeven.code, uitgegeven.koppelId,
        'ID-OUDE-KALE-CODE', 'OUDE-KALE-STATUS']) assert.equal(waar.json.includes(geheim), false);
      assert.equal(waar.data.koppels.filter(x => x.dienst === 'PG Dienst').length, 1);
      assert.equal(waar.data.koppels.find(x => x.id === 'legacy-koppel').status, 'legacy-gesloten');

      const bevestigStart = await ra.start({ dienst: 'Confirmatie Dienst',
        attributen: ['codenaam'], idem: 'rtgid-pg-confirm-start-0001' }, 'dienst-b');
      assert.equal(bevestigStart.status, 200);
      const bekeken = await ra.koppelZoek('user-1', bevestigStart.code);
      assert.equal(bekeken.status, 200);
      const bevestigRace = await Promise.all([
        ra.bevestig('user-1', bekeken.koppelId, null, {}),
        rb.bevestig('user-1', bekeken.koppelId, null, {})
      ]);
      assert.equal(bevestigRace.filter(x => x.status === 200).length, 1,
        'precies een instance mag de passkeybevestiging vastleggen');
      assert.equal(bevestigRace.filter(x => x.status === 409).length, 1,
        'de verliezende instance ziet dat de koppeling al is afgehandeld');
      const bevestigStatus = await rb.statusVan(bevestigStart.koppelId);
      assert.equal(bevestigStatus.status, 200);
      assert.equal(bevestigStatus.stand, 'bevestigd');
      assert.equal(bevestigStatus.idToken, bevestigStart.koppelId);
      waar = await leesWaarheid();
      const bevestigd = waar.data.koppels.find(x => x.dienst === 'Confirmatie Dienst');
      assert.equal(bevestigd.koppel_toegang.gebruik, 1);
      assert.equal(waar.data.sessies.filter(x => x.dienst === 'Confirmatie Dienst').length, 1,
        'de race maakte geen dubbele identiteitssessie');
      for (const geheim of [bevestigStart.code, bevestigStart.koppelId])
        assert.equal(waar.json.includes(geheim), false);

      const rotatie = await rb.roteer(uitgegeven.koppelId,
        'rtgid-pg-rotate-0000001', 'dienst-a');
      assert.equal(rotatie.status, 200);
      assert.notEqual(rotatie.code, uitgegeven.code);
      assert.notEqual(rotatie.koppelId, uitgegeven.koppelId);
      assert.equal((await ra.statusVan(uitgegeven.koppelId)).status, 404,
        'de andere instance accepteert de oude statuscredential niet');

      const intrekIdem = 'rtgid-pg-cancel-0000001';
      const ingetrokken = await Promise.all([
        ra.annuleer(rotatie.koppelId, intrekIdem, 'dienst-a'),
        rb.annuleer(rotatie.koppelId, intrekIdem, 'dienst-a')
      ]);
      assert.deepEqual(ingetrokken.map(x => x.status), [200, 200]);
      assert.equal(ingetrokken.filter(x => x.herhaald).length, 1,
        'precies één instance ziet de duurzame eerdere intrekking');
      assert.equal((await rb.statusVan(rotatie.koppelId)).status, 404);

      waar = await leesWaarheid();
      for (const geheim of [uitgegeven.code, uitgegeven.koppelId,
        rotatie.code, rotatie.koppelId]) assert.equal(waar.json.includes(geheim), false);
      const rij = waar.data.koppels.find(x => x.dienst === 'PG Dienst');
      assert.ok(rij.koppel_toegang.ingetrokken_at);
      assert.ok(rij.status_toegang.ingetrokken_at);
      assert.match(rij.koppel_toegang.code_hash, /^[a-f0-9]{64}$/);
      assert.match(rij.status_toegang.code_hash, /^[a-f0-9]{64}$/);
    } finally {
      await a.sluit();
      await b.sluit();
    }
  });
