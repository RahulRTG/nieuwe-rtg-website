/* ============================================================================
   EEN ONTWERP WEGHALEN UIT DE VIER ONTWERPBUREAUS VAN HET KANTOOR.

   RTG Atelier, de Ontwerpstudio, het Hardwarelab en het Architectenbureau
   (server/routes/kantoren/bureaus.js) hebben elk een /verwijder-deur die door
   geen enkele toets werd aangeroepen. Weghalen is het enige onomkeerbare deel
   van een bureau, en de bewering hier is drieledig:

     - het ontwerp dat je noemt is daarna weg uit het overzicht;
     - een ANDER ontwerp in hetzelfde bureau blijft staan (een filter die de
       verkeerde kant op staat, wist het hele bureau leeg);
     - zonder kantoorsessie, of met een gewone ledensessie, gebeurt er niets.

   MUTATIE GEZIEN ZAKKEN: in server/kern/architect/index.js de filter
   `o.id !== oid` vervangen door `false` (het hele bureau leeg); de toets zakte
   op "het andere ontwerp blijft staan". Teruggedraaid, daarna groen.

   Draai los: node --test test/ontwerpbureaus-verwijder.test.js
   ========================================================================== */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

let srv, base, office, lid;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-bureauwis-'));
const api = (pad, body, token) => fetch(base + pad, {
  method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
  body: JSON.stringify(body || {})
}).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));

test.before(async () => {
  srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP } });
  base = srv.base;
  office = (await api('/api/office/login', { code: 'RTG-OFFICE' })).body.token;
  assert.ok(office, 'het kantoor logt in');
  const reg = await api('/api/auth/register', { name: 'Bureau Gast', email: 'bureaugast-' + Date.now() + '@toets.example',
    password: 'geheim123', geboortedatum: '1985-05-05', tier: 'rtg' });
  lid = reg.body.token;
  assert.ok(lid, 'een gewoon lid registreert');
});
test.after(() => {
  stop(srv && srv.child);
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
});

const BUREAUS = [
  { pad: '/api/office/atelier', verwijder: '/api/office/atelier/verwijder', discipline: 'kleding' },
  { pad: '/api/office/studio', verwijder: '/api/office/studio/verwijder', discipline: 'jacht' },
  { pad: '/api/office/hardware', verwijder: '/api/office/hardware/verwijder', discipline: 'wearable' },
  { pad: '/api/office/architect', verwijder: '/api/office/architect/verwijder', discipline: 'villa' }
];

for (const b of BUREAUS) {
  test(b.verwijder + ': het genoemde ontwerp gaat weg, het andere blijft, en alleen het kantoor mag', async () => {
    const een = await api(b.pad + '/maak', { discipline: b.discipline, naam: 'Weg ermee ' + b.discipline, brief: 'mag weg' }, office);
    const twee = await api(b.pad + '/maak', { discipline: b.discipline, naam: 'Blijft staan ' + b.discipline, brief: 'blijft' }, office);
    assert.equal(een.status, 200, JSON.stringify(een.body).slice(0, 160));
    assert.equal(twee.status, 200, JSON.stringify(twee.body).slice(0, 160));
    const weg = een.body.ontwerp.id, blijft = twee.body.ontwerp.id;

    /* Eerst de weigeringen, en daarna kijken of het ontwerp er nog staat:
       een 401 die toch al gewist had, is erger dan geen deur. */
    assert.equal((await api(b.verwijder, { id: weg }, null)).status, 401, 'zonder sessie niets');
    const alsLid = await api(b.verwijder, { id: weg }, lid);
    assert.ok(alsLid.status === 401 || alsLid.status === 403, 'een ledensessie is geen kantoor, kreeg ' + alsLid.status);
    let ids = (await api(b.pad, {}, office)).body.ontwerpen.map(o => o.id);
    assert.ok(ids.includes(weg), 'na de weigeringen staat het ontwerp er nog');

    const r = await api(b.verwijder, { id: weg }, office);
    assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 160));
    assert.equal(r.body.ok, true);
    ids = (await api(b.pad, {}, office)).body.ontwerpen.map(o => o.id);
    assert.ok(ids.length > 0, 'het overzicht is niet leeg');
    assert.ok(!ids.includes(weg), 'het genoemde ontwerp is weg');
    assert.ok(ids.includes(blijft), 'het andere ontwerp blijft staan');
  });
}
