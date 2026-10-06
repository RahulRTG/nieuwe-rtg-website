'use strict';
/* De kritieke poort (opzet/kritiekspoor.js) schrijft in PostgreSQL-modus ook een
   regel in het AUDITBOEK, vóór de handeling. Echte PostgreSQL; faalt het boek,
   dan 503 en gaat de handeling niet door. Zonder PostgreSQL loopt alleen het
   handelingsspoor (ongewijzigd). */
const test = require('node:test');
const assert = require('node:assert/strict');
const BRON = process.env.DATABASE_URL || process.env.PG_URL;
assert.ok(BRON, 'DATABASE_URL ontbreekt: draai dit via npm run test:pg');
const { Pool } = require('../server/pgwire');
const maakDb = require('./lib/living-world-pg-database');
const boekMod = require('../server/kern/auditboek');
const spoor = require('../server/opzet/kritiekspoor');

let db, pool, echt;
const origineel = { deelbaar: boekMod.deelbaar, actief: boekMod.actief };
test.before(async () => {
  db = await maakDb(BRON);
  pool = new Pool({ connectionString: db.url, max: 3 });
  echt = boekMod.maak({ pool, env: { NODE_ENV: 'test' } });
  boekMod.actief = () => true; boekMod.deelbaar = () => echt;
  spoor.haak({ handelingsspoor: { noteer() {} }, vastleggen: f => f() });
});
test.after(async () => { boekMod.deelbaar = origineel.deelbaar; boekMod.actief = origineel.actief; await pool.end(); await db.close(); });

function roep(methode, pad, wie) {
  return new Promise(res => {
    const uit = { status: null, body: null };
    const r = { status(s) { uit.status = s; return r; }, json(b) { uit.body = b; res(uit); } };
    spoor.poort({ method: methode, path: pad }, r, wie, () => { uit.doorgelaten = true; res(uit); });
  });
}
const rijen = async () => (await pool.query("SELECT actor, regel FROM auditboek WHERE type = 'kritiek.toegestaan' ORDER BY nr")).rows;

test('1. een kritieke handeling laat een auditregel `toegestaan` achter met de actor uit de sessie, en gaat daarna door', async () => {
  const u = await roep('POST', '/api/pay/overboeking', 'amberen-vos');
  assert.equal(u.doorgelaten, true);
  const r = (await rijen()).pop();
  assert.equal(r.actor, 'lid:amberen-vos');
  const x = JSON.parse(r.regel);
  assert.equal(x.uitkomst, 'toegestaan'); assert.equal(x.context.pad, '/api/pay/overboeking'); assert.equal(x.context.methode, 'POST');
  assert.equal((await echt.verifieer({ strikt: false })).stats.regels >= 1, true);
});

test('2. actorsoort volgt de deur (kantoor, zaak), en een sleutel die geen codenaam is wordt gepseudonimiseerd -- nooit ruw in het boek', async () => {
  await roep('POST', '/api/office/bank/incasso', 'kantoor-a');
  await roep('POST', '/api/supplier/pay/uitbetaal', 'zaak:CAFE1');
  await roep('POST', '/api/pay/overboeking', 'iemand@voorbeeld.nl');
  const a = (await rijen()).map(r => r.actor);
  assert.ok(a.includes('kantoor:kantoor-a')); assert.ok(a.includes('zaak:zaak:CAFE1'));
  const gh = a.find(x => x.startsWith('lid:h:'));
  assert.ok(gh, 'gepseudonimiseerd: ' + a.join(','));
  assert.ok(!(await rijen()).some(r => /@/.test(r.regel)), 'geen e-mailadres in het boek');
});

test('3. een querystring of ongewone tekens in het pad komen niet ruw in het boek', async () => {
  await roep('POST', '/api/pay/overboeking/abc?token=geheim', 'amberen-vos');
  const laatste = JSON.parse((await rijen()).pop().regel);
  assert.ok(!/token|geheim|\?/.test(laatste.context.pad), laatste.context.pad);
});

test('4. NEGATIEF: kan het boek niet schrijven (PostgreSQL weg), dan 503 en `volgende` wordt NIET aangeroepen', async () => {
  const dood = boekMod.maak({ env: { DATABASE_URL: 'postgresql://rtg:rtg@127.0.0.1:1/geen', NODE_ENV: 'test', PG_CONNECT_MS: '300' } });
  boekMod.deelbaar = () => dood;
  try {
    const u = await roep('POST', '/api/pay/overboeking', 'amberen-vos');
    assert.equal(u.status, 503); assert.equal(u.doorgelaten, undefined); assert.equal(u.body.spoor, 'niet-vastgelegd');
  } finally { boekMod.deelbaar = () => echt; await dood.sluit(); }
});

test('5. een niet-kritiek pad en een lees-verzoek laten geen regel achter; zonder PostgreSQL-modus loopt alles als voorheen', async () => {
  const voor = (await rijen()).length;
  assert.equal((await roep('POST', '/api/agenda/bewaar', 'amberen-vos')).doorgelaten, true);
  assert.equal((await roep('GET', '/api/pay/overboeking', 'amberen-vos')).doorgelaten, true);
  assert.equal((await rijen()).length, voor);
  boekMod.actief = () => false;
  try { assert.equal((await roep('POST', '/api/pay/overboeking', 'amberen-vos')).doorgelaten, true); }
  finally { boekMod.actief = () => true; }
  assert.equal((await rijen()).length, voor, 'zonder PG-modus geen boekregel');
});
