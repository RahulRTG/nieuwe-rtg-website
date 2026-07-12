/* Integratietest voor de PostgreSQL-accountsspiegel (server/pgaccounts.js).
   Draait alleen met DATABASE_URL + het pakket 'pg'; anders overgeslagen.
   Lokaal:
     DATABASE_URL=postgresql://postgres@127.0.0.1:5433/rtgtest \
       node --test test/pgaccounts.test.js

   Twee maakPgAccounts-instances stellen twee app-processen voor die dezelfde
   database delen. We controleren: globaal-unieke id-blokken (geen botsing),
   upsert/pull-rondgang, gedeelde zichtbaarheid tussen instances, en verwijderen. */
const test = require('node:test');
const assert = require('node:assert/strict');

const URL = process.env.DATABASE_URL || process.env.PG_URL;
let heeftPg = false;
try { require.resolve('pg'); heeftPg = true; } catch (e) {}

if (!URL || !heeftPg) {
  test('pg-accountsspiegel (overgeslagen: geen DATABASE_URL of pg-pakket)', { skip: true }, () => {});
} else {
  const { maakPgAccounts } = require('../server/pgaccounts');
  const nieuw = () => maakPgAccounts({ url: URL, log: { warn() {} } });

  async function leeg(a) {
    await a.pool.query('DROP TABLE IF EXISTS users');
    await a.pool.query('DROP TABLE IF EXISTS supplier_staff');
    await a.pool.query('DROP SEQUENCE IF EXISTS rtg_id_seq');
    await a.schema();
  }

  function userRow(id, over) {
    return Object.assign({
      id, email_hash: 'h' + id, username: 'u' + id, password_hash: 'p', tier: 'rtg',
      codename: 'Codenaam ' + id, enc_name: null, enc_email: null, enc_phone: null, phone_hash: null,
      created_at: new Date().toISOString(), verified: 'unverified', id_doc: null,
      member_state: null, email_verified: 0, reset_hash: null, reset_expires: null
    }, over || {});
  }

  test('pg-accounts: id-blokken van twee instances botsen niet', async () => {
    const a = nieuw(); await leeg(a);
    const b = nieuw();
    const blokA = await a.reserveerBlok();
    const blokB = await b.reserveerBlok();
    // geen overlap tussen [volgende..eind] van A en B
    const overlap = blokA.volgende <= blokB.eind && blokB.volgende <= blokA.eind;
    assert.equal(overlap, false, `blokken overlappen: ${JSON.stringify(blokA)} vs ${JSON.stringify(blokB)}`);
    await a.sluit(); await b.sluit();
  });

  test('pg-accounts: upsert op instance A is zichtbaar op instance B', async () => {
    const a = nieuw(); await leeg(a);
    await a.upsertUser(userRow(1000001, { username: 'gedeeld' }));
    const b = nieuw();
    const { users } = await b.pullAlles();
    const found = users.find(u => Number(u.id) === 1000001);
    assert.ok(found, 'B ziet de door A geschreven gebruiker');
    assert.equal(found.username, 'gedeeld');
    await a.sluit(); await b.sluit();
  });

  test('pg-accounts: upsert overschrijft dezelfde id (geen duplicaat)', async () => {
    const a = nieuw(); await leeg(a);
    await a.upsertUser(userRow(7, { verified: 'unverified' }));
    await a.upsertUser(userRow(7, { verified: 'verified' }));
    const { rows } = await a.pool.query('SELECT COUNT(*) AS c, MAX(verified) AS v FROM users WHERE id = 7');
    assert.equal(Number(rows[0].c), 1, 'precies één rij voor id 7');
    assert.equal(rows[0].v, 'verified', 'de laatste schrijver wint');
    await a.sluit();
  });

  test('pg-accounts: staff-upsert en verwijderen van een gebruiker', async () => {
    const a = nieuw(); await leeg(a);
    await a.upsertStaff({ id: 5000001, supplier_code: 'SAKURA', name: 'Marc', pin_hash: 'x', role: 'manager', active: 1, created_at: new Date().toISOString(), func: 'Beheer' });
    let s = await a.pool.query('SELECT * FROM supplier_staff WHERE id = 5000001');
    assert.equal(s.rows.length, 1);
    assert.equal(s.rows[0].supplier_code, 'SAKURA');

    await a.upsertUser(userRow(1000002));
    await a.deleteUser(1000002);
    const { users } = await a.pullAlles();
    assert.ok(!users.find(u => Number(u.id) === 1000002), 'verwijderde gebruiker is weg');
    await a.sluit();
  });
}
