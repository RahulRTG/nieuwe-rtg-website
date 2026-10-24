/* De persona `personeel` uit scripts/lib/proefsessies.js: een echte
   PDA-sessie van de vervoerder TRANSIT, langs de rooster- en pin-inlog. Met
   die sessie opent OV-routes (/api/staff/ov/lijnen); met een lidsessie niet. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');
const { ROLLEN, haalSessies } = require('../scripts/lib/proefsessies');

let srv;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-proefsessies-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
});
test.after(() => stop(srv && srv.child));

const lijnen = (tok) => fetch(srv.base + '/api/staff/ov/lijnen', { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: '{}' })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test('de persona personeel geeft een geldige PDA-sessie voor OV-routes, een lid niet', async () => {
  const { sessies, overgeslagen } = await haalSessies(srv.base, ['personeel', 'lid']);
  assert.deepEqual(overgeslagen, []);
  assert.equal(sessies.personeel.sleutel, 'rtg_pda_token');
  const pda = await lijnen(sessies.personeel.waarde);
  assert.equal(pda.status, 200, JSON.stringify(pda.body));
  assert.ok(Array.isArray(pda.body.lijnen) && pda.body.lijnen.length >= 1);
  const lid = await lijnen(sessies.lid.waarde);
  assert.ok(lid.status === 401 || lid.status === 403, 'een lid krijgt ' + lid.status);
  assert.equal(ROLLEN.personeel.sleutel, 'rtg_pda_token');
});
