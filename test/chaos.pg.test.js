/* Chaos-/concurrency-test: meerdere gelijktijdige schrijvers naar DEZELFDE
   Postgres-collectie, om te bewijzen dat er onder contentie niets verloren gaat.
   Elke "schrijver" is een eigen pg-adapterinstance (eigen versie-staat), net als
   losse app-processen. Ze duwen allemaal, door elkaar heen, hun eigen items in
   dezelfde collectie. Aan het eind moeten ALLE items er zijn: de row-lock +
   3-weg-merge mogen nooit een andermans toevoeging overschrijven.

   Draait alleen met DATABASE_URL + pg; anders overgeslagen.
     DATABASE_URL=postgresql://postgres@127.0.0.1:5433/rtgtest \
       node --test test/chaos.pg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
// De PostgreSQL-client is nu ingebouwd (server/pgwire), geen los pakket meer.
// Deze test draait dus zodra er een DATABASE_URL is -- geen stille skip op een
// afwezig 'pg'-pakket meer (dat zou een vals-groene test zijn).

if (!URL) {
  test('chaos-schrijvers (overgeslagen: geen DATABASE_URL)', { skip: true }, () => {});
} else {
  process.env.PG_POOL_MAX = process.env.PG_POOL_MAX || '4';
  const { merge3 } = require('../server/db');
  const { maakPg } = require('../server/pg');
  const kluis = require('../server/kluis');
  const nieuw = () => maakPg({ merge3, kluis, log: { warn() {} }, url: URL });

  async function leeg(a) {
    await a.pool.query('DROP TABLE IF EXISTS kv');
    await a.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq');
    await a.schema();
  }
  const slaap = (ms) => new Promise(r => setTimeout(r, ms));

  test('chaos: 5 schrijvers x 40 items in dezelfde collectie, niets gaat verloren', async () => {
    const SCHRIJVERS = 5, PER = 40;
    const opzet = nieuw();
    await leeg(opzet);
    await opzet.sluit();

    async function schrijver(nr, rngSeed) {
      const pg = nieuw();
      const data = { leden: [] };
      // begin met de bestaande gedeelde staat
      const bestaand = await pg.laadAlles();
      if (bestaand && bestaand.leden) data.leden = bestaand.leden;
      let s = rngSeed;
      const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
      for (let i = 0; i < PER; i++) {
        // af en toe eerst andermans wijzigingen ophalen (zoals een echte poll)
        if (rnd() < 0.4) await pg.haalNieuwer(data);
        data.leden.push({ id: nr * 1000 + i, van: nr });
        await pg.flush(data);
        await slaap(Math.floor(rnd() * 5)); // jitter, zodat ze echt door elkaar lopen
      }
      await pg.sluit();
    }

    const taken = [];
    for (let n = 1; n <= SCHRIJVERS; n++) taken.push(schrijver(n, n * 7 + 1));
    await Promise.all(taken);

    // controleer de eindstaat via een verse lezer
    const lezer = nieuw();
    const eind = await lezer.laadAlles();
    const ids = new Set((eind.leden || []).map(x => x.id));
    let ontbreekt = 0;
    for (let n = 1; n <= SCHRIJVERS; n++) for (let i = 0; i < PER; i++) if (!ids.has(n * 1000 + i)) ontbreekt++;
    assert.equal(ontbreekt, 0, `${ontbreekt} van de ${SCHRIJVERS * PER} items ontbreken -- er is data verloren gegaan onder contentie`);
    assert.equal(ids.size, SCHRIJVERS * PER, 'geen duplicaten of extra items');
    await lezer.sluit();
  });

  test('chaos: verschillende collecties parallel blijven onafhankelijk intact', async () => {
    const opzet = nieuw(); await leeg(opzet); await opzet.sluit();
    async function vulCollectie(naam, aantal) {
      const pg = nieuw();
      const data = {};
      const start = await pg.laadAlles(); if (start) Object.assign(data, start);
      data[naam] = data[naam] || [];
      for (let i = 0; i < aantal; i++) { data[naam].push({ id: i, c: naam }); await pg.flush(data); await slaap(1); }
      await pg.sluit();
    }
    await Promise.all([vulCollectie('alpha', 30), vulCollectie('beta', 30), vulCollectie('gamma', 30)]);
    const lezer = nieuw();
    const eind = await lezer.laadAlles();
    assert.equal((eind.alpha || []).length, 30, 'alpha compleet');
    assert.equal((eind.beta || []).length, 30, 'beta compleet');
    assert.equal((eind.gamma || []).length, 30, 'gamma compleet');
    await lezer.sluit();
  });
}
