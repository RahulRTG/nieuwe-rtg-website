/* Regressie: de chaos-soak (scripts/mega65-storm.js) vond dat
   /api/office/ontmoeting/signaal een 500 gaf zodra het de EERSTE aanraking met de
   ontmoetingen was. Oorzaak: db.data.ontmoetDates wordt lui aangemaakt (lijsten())
   en is bij een verse boot (of een Postgres-boot waar de collectie nog nooit is
   opgeslagen) undefined; signaalNaarLid deed er direct .find op -> crash.

   Deze test bootst een verse server en roept het signaal-endpoint als allereerste
   ontmoeting-call aan. De eis: een nette 404 (afspraak niet gevonden), nooit 500.
   Draai: node --experimental-sqlite --test test/ontmoeting-leeg.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ontmoetleeg-'));
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
});
test.after(() => stop(srv && srv.child));

test('office-signaal op een lege ontmoetingen-collectie geeft 404, geen 500', async () => {
  const office = (await (await fetch(base + '/api/office/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: 'RTG-OFFICE' })
  })).json()).token;
  assert.ok(office, 'kantoor-login werkt');

  const r = await fetch(base + '/api/office/ontmoeting/signaal', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + office },
    body: JSON.stringify({ dateId: 'bestaat-niet', naarKey: 'user-999999', payload: { type: 'offer' } })
  });
  assert.equal(r.status, 404, 'onbekende afspraak -> 404, niet 500');
});
