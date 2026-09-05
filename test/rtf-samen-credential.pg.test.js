/* Echte PostgreSQL-proef voor FoundationOS Samen. Twee onafhankelijke app-
   instances delen alleen de kamercollectie; uitgifte, capaciteit, gebruik,
   rotatie en intrekking moeten onder hetzelfde advisory slot serialiseren. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
const OVERSLAAN = URL ? false
  : 'DATABASE_URL ontbreekt; deze proef vereist een echte PostgreSQL';
const sessie = (letter, gezin = 'GEZIN-A') => ({
  handle: 'rtf:' + gezin + ':' + letter,
  codenaam: 'Profiel ' + letter,
  g: { code: gezin }
});

test('Foundation Samen is hash-only en atomair over twee PostgreSQL-instances',
  { skip: OVERSLAAN, timeout: 120000 }, async () => {
    const { maakPg } = require('../server/pg');
    const { merge3 } = require('../server/db/merge');
    const kluis = require('../server/kluis');
    const nieuw = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });
    const a = nieuw(), b = nieuw();
    try {
      await a.pool.query('DROP TABLE IF EXISTS kv');
      await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
      await a.schema();
      await a.flush({ samenRtfKamers: { ABC234: {
        code: 'ABC234', gastheer: 'rtf:GEZIN-A:oud',
        gastheerGezin: 'GEZIN-A', gastheerNaam: 'Oud', leden: [
          { handle: 'rtf:GEZIN-A:oud', gezin: 'GEZIN-A', codenaam: 'Oud' }
        ], chat: [], at: Date.parse('2029-12-31T00:00:00.000Z')
      } } }, true);
      const dataA = await a.laadAlles(), dataB = await b.laadAlles();
      const core = (pg, data) => require('../server/kern/samenrtf')({
        db: { data, writable: true }, save() {}, crypto,
        bewerkCollectie: (sleutel, werk) =>
          pg.bewerkCollectie(sleutel, data, werk),
        schoon: (v, n) => String(v || '').trim().slice(0, n),
        zijnVrienden() { return false; },
        tijd: () => Date.parse('2030-01-01T12:00:00.000Z')
      }).samenRtf;
      const ca = core(a, dataA), cb = core(b, dataB);
      const lees = async () => {
        const { rows } = await a.pool.query(
          'SELECT val, weg FROM kv WHERE key=$1', ['samenRtfKamers']);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].weg, false);
        const json = kluis.ontsleutel(rows[0].val);
        return { json, kamers: JSON.parse(json) };
      };

      await ca.ruimOp();
      let waar = await lees();
      assert.equal(waar.json.includes('ABC234'), false,
        'startupmigratie verwijdert de kale legacycode');
      assert.ok(Object.values(waar.kamers)[0].gesloten_at);

      const host = sessie('host');
      const race = await Promise.all([
        ca.maak(host, 'rtf-samen-pg-maak-0001'),
        cb.maak(host, 'rtf-samen-pg-maak-0001')
      ]);
      const uit = race.find(x => x.status === 200);
      const retry = race.find(x => x.status === 409);
      assert.ok(uit && retry, 'exact één instance geeft de deelcode uit');
      assert.equal(retry.deelcode, undefined);
      assert.match(uit.deelcode, /^RTFSAMEN\.[A-F0-9]{32}$/);

      waar = await lees();
      assert.equal(waar.json.includes(uit.deelcode), false);
      assert.equal(Object.values(waar.kamers)
        .filter(k => k.gastheer === host.handle && !k.gesloten_at).length, 1);

      const kandidaten = 'BCDEFGHIJKLM'.split('').map(x => sessie(x));
      const claims = await Promise.all(kandidaten.map((s, i) =>
        (i % 2 ? ca : cb).doeMee(s, uit.deelcode)));
      assert.equal(claims.filter(x => x.status === 200).length, 11);
      assert.equal(claims.filter(x => x.status === 404).length, 1);
      waar = await lees();
      const kamer = waar.kamers[uit.kamer.id];
      assert.equal(kamer.leden.length, 12);
      assert.equal(kamer.toegang.gebruik, 11);
      assert.equal(waar.json.includes(uit.deelcode), false);

      const winnaar = kandidaten.find(s => kamer.leden
        .some(l => l.handle === s.handle));
      const verlorenAntwoord = await cb.doeMee(winnaar, uit.deelcode);
      assert.equal(verlorenAntwoord.status, 200);
      assert.equal(verlorenAntwoord.al, true);
      waar = await lees();
      assert.equal(waar.kamers[uit.kamer.id].toegang.gebruik, 11);

      const geroteerd = await ca.roteer(host, uit.kamer.id,
        'rtf-samen-pg-code-0001');
      assert.equal(geroteerd.status, 200);
      assert.notEqual(geroteerd.deelcode, uit.deelcode);
      assert.equal((await cb.doeMee(sessie('laat'), uit.deelcode)).status, 404);
      const sluitRace = await Promise.all([
        ca.sluit(host, uit.kamer.id), cb.sluit(host, uit.kamer.id)
      ]);
      assert.equal(sluitRace.filter(x => x.status === 200).length, 1);
      assert.equal(sluitRace.filter(x => x.status === 404).length, 1);
      assert.equal((await cb.doeMee(sessie('nieuw'),
        geroteerd.deelcode)).status, 404);
      waar = await lees();
      assert.equal(waar.json.includes(geroteerd.deelcode), false);
      assert.ok(waar.kamers[uit.kamer.id].toegang.ingetrokken_at);
    } finally {
      await a.sluit();
      await b.sluit();
    }
  });
