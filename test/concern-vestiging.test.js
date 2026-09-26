/* RTG Concern: VESTIGINGEN, tegen een echte server (routes/concern/vestiging.js).

   De vestigingsroutes gingen naar een eigen deelmodule toen de samenvoeging van
   twee takken routes/concern.js over de 10 kB duwde. Twee ervan -- een zaak
   loskoppelen en een vestiging sluiten -- hadden nog nooit een treffer in een
   toets. Deze toets geeft ze er een, en houdt vast wat ze beloven:

   1. een vestiging van een ander is een 404, ook voor loskoppelen en sluiten
      (dezelfde eigendomscontrole als de rest, mijnVestiging in ../routes/concern.js);
   2. een zaak loskoppelen die er niet aan hangt, is een 404 met de reden;
   3. sluiten legt een datum vast en is geen verwijderen: de vestiging staat
      daarna nog in de lijst, en een tweede keer sluiten is een 409.

   Draai los: node --test test/concern-vestiging.test.js */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { startServer, stop } = require('./helper');

test('vestiging: loskoppelen en sluiten achter de eigendomscontrole, en sluiten is niet verwijderen', async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-vestiging-'));
  const srv = await startServer({ env: { SMTP_URL: '', RTG_DATA_DIR: TMP, RTG_DEMO: '1' } });
  const post = async (pad, body, token) => {
    const r = await fetch(srv.base + pad, { method: 'POST', body: JSON.stringify(body || {}),
      headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  try {
    const lid = async (n) => (await post('/api/auth/register', { name: 'Vestiging ' + n, email: 'ves' + n + Date.now() + '@e.test',
      phone: '06' + String(Date.now() + n).slice(-8), password: 'geheim123', geboortedatum: '1990-01-01', tier: 'rtg' })).body.token;
    const A = await lid(1), B = await lid(2);
    const ent = (await post('/api/concern/entiteit/nieuw', { naam: 'Vestiging BV', land: 'NL' }, A)).body.entiteit;
    const ves = (await post('/api/concern/vestiging/nieuw', { entiteit: ent.id, naam: 'Hoofdkantoor' }, A)).body.vestiging;
    assert.ok(ves && ves.id, 'een vestiging om mee te werken');

    // 1. van een ander: 404, voor beide routes, en zonder sessie 401
    assert.equal((await post('/api/concern/vestiging/zaaklos', { vestiging: ves.id, code: 'BRISA' }, B)).status, 404);
    assert.equal((await post('/api/concern/vestiging/sluit', { vestiging: ves.id }, B)).status, 404);
    assert.equal((await post('/api/concern/vestiging/sluit', { vestiging: ves.id })).status, 401);

    // 2. een zaak die er niet aan hangt
    const los = await post('/api/concern/vestiging/zaaklos', { vestiging: ves.id, code: 'BRISA' }, A);
    assert.equal(los.status, 404);
    assert.match(String(los.body.error || ''), /hangt niet aan deze vestiging/);

    // 3. sluiten: een datum, geen verwijdering, en niet twee keer
    const dicht = await post('/api/concern/vestiging/sluit', { vestiging: ves.id }, A);
    assert.equal(dicht.status, 200, JSON.stringify(dicht.body));
    assert.ok(dicht.body.vestiging && dicht.body.vestiging.gesloten, 'een gesloten vestiging draagt haar sluitingsdatum');
    const lijst = (await post('/api/concern/vestigingen', { entiteit: ent.id }, A)).body.vestigingen || [];
    assert.ok(lijst.some(v => v.id === ves.id), 'sluiten is geen verwijderen: de vestiging staat er nog');
    assert.equal((await post('/api/concern/vestiging/sluit', { vestiging: ves.id }, A)).status, 409);
  } finally {
    await stop(srv.child);
  }
});
