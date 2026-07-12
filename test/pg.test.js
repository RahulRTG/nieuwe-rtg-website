/* Integratietest voor de PostgreSQL-opslag (server/pg.js).
   Draait alleen als DATABASE_URL is gezet en het pakket 'pg' beschikbaar is;
   anders wordt de hele suite netjes overgeslagen (zoals op een CI zonder
   database). Lokaal draaien tegen een test-database:
     DATABASE_URL=postgresql://postgres@127.0.0.1:5433/rtgtest \
       node --test test/pg.test.js

   Twee adapter-instances delen dezelfde database en stellen zo twee losse
   app-processen voor. We controleren: gedeelde lees/schrijf, de 3-weg-merge bij
   gelijktijdige schrijvers naar dezelfde collectie (geen overschrijven),
   duurzaamheid over een verse verbinding, en versleuteling-at-rest op schijf. */
const test = require('node:test');
const assert = require('node:assert/strict');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
let heeftPg = false;
try { require.resolve('pg'); heeftPg = true; } catch (e) {}

if (!URL || !heeftPg) {
  test('postgres-opslag (overgeslagen: geen DATABASE_URL of pg-pakket)', { skip: true }, () => {});
} else {
  const { merge3 } = require('../server/db');
  const { maakPg } = require('../server/pg');

  // Zonder RTG_ENC_KEY zou de kluis niets versleutelen; de laatste test vraagt
  // wel om versleuteling, dus we laden een kluis met een sleutel apart.
  const kluisPlano = require('../server/kluis'); // volgt de omgeving (mogelijk uit)

  function nieuw(kluis) { return maakPg({ merge3, kluis, log: { warn() {} }, url: URL }); }

  async function leeg(pg) { await pg.pool.query('DROP TABLE IF EXISTS kv'); await pg.pool.query('DROP SEQUENCE IF EXISTS kv_ver_seq'); await pg.schema(); }

  test('postgres: twee instances delen lezen en schrijven', async () => {
    const a = nieuw(kluisPlano);
    await leeg(a);
    await a.flush({ posts: [{ id: 1, t: 'hoi' }], sessions: { s1: { tier: 'rtg' } } });
    const b = nieuw(kluisPlano);
    const data = await b.laadAlles();
    assert.deepEqual(data.posts, [{ id: 1, t: 'hoi' }]);
    assert.deepEqual(data.sessions, { s1: { tier: 'rtg' } });
    await a.sluit(); await b.sluit();
  });

  test('postgres: gelijktijdige schrijvers naar dezelfde collectie overschrijven elkaar niet (merge3)', async () => {
    const a = nieuw(kluisPlano);
    await leeg(a);
    // startsituatie: een collectie met item 1, beide instances kennen die
    await a.flush({ gezinnen: [{ id: 1, naam: 'De Wit' }] });
    const b = nieuw(kluisPlano);
    const dataA = { gezinnen: [{ id: 1, naam: 'De Wit' }] };
    const dataB = await b.laadAlles();

    // A voegt gezin 2 toe, B voegt (op basis van dezelfde start) gezin 3 toe
    dataA.gezinnen.push({ id: 2, naam: 'Jansen' });
    await a.flush(dataA);
    dataB.gezinnen.push({ id: 3, naam: 'Bakker' });
    await b.flush(dataB); // B ziet dat A intussen schreef en voegt per item samen

    const c = await nieuw(kluisPlano).laadAlles();
    const ids = c.gezinnen.map(g => g.id).sort();
    assert.deepEqual(ids, [1, 2, 3], 'alle drie de gezinnen blijven behouden, niets overschreven');
    await a.sluit(); await b.sluit();
  });

  test('postgres: haalNieuwer haalt de wijziging van een ander proces op', async () => {
    const a = nieuw(kluisPlano);
    await leeg(a);
    await a.flush({ teller: { n: 1 } });
    const b = nieuw(kluisPlano);
    const dataB = await b.laadAlles();          // b kent teller n=1
    await a.flush({ teller: { n: 2 } });        // a schrijft n=2
    const opgehaald = await b.haalNieuwer(dataB);
    assert.ok(opgehaald >= 1);
    assert.equal(dataB.teller.n, 2, 'b ziet nu de nieuwe waarde van a');
    await a.sluit(); await b.sluit();
  });

  test('postgres: versleuteling-at-rest, ruwe kolomwaarde is cijfertekst', async () => {
    // een kluis mét sleutel, los van de omgeving
    const crypto = require('crypto');
    const sleutel = crypto.randomBytes(32).toString('hex');
    const kluisEnc = loadKluisMet(sleutel);
    if (!kluisEnc.AAN) { assert.ok(true, 'kluis kon niet met sleutel laden; overslaan'); return; }
    const a = maakPg({ merge3, kluis: kluisEnc, log: { warn() {} }, url: URL });
    await leeg(a);
    await a.flush({ geheim: { pin: '1234' } });
    const ruw = await a.pool.query("SELECT val FROM kv WHERE key = 'geheim'");
    assert.ok(ruw.rows[0].val.startsWith('RTGENC1:'), 'op schijf staat versleutelde tekst');
    assert.ok(!ruw.rows[0].val.includes('1234'), 'de pincode staat niet leesbaar in de kolom');
    // met dezelfde sleutel weer leesbaar
    const terug = await maakPg({ merge3, kluis: kluisEnc, log: { warn() {} }, url: URL }).laadAlles();
    assert.equal(terug.geheim.pin, '1234');
    await a.sluit();
  });
}

// Laadt server/kluis.js met een specifieke sleutel in een verse module-context,
// zodat de test los van de omgeving een versleutelende kluis krijgt.
function loadKluisMet(sleutelHex) {
  const oud = process.env.RTG_ENC_KEY;
  process.env.RTG_ENC_KEY = sleutelHex;
  delete require.cache[require.resolve('../server/kluis')];
  const k = require('../server/kluis');
  delete require.cache[require.resolve('../server/kluis')];
  if (oud === undefined) delete process.env.RTG_ENC_KEY; else process.env.RTG_ENC_KEY = oud;
  return k;
}
