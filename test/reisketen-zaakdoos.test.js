/* Echte lokale HTTP/SQLite, met opzettelijk wegvallende lijn. Een kopie van
   een persoonlijk reisbesluit mag geen doosbevoegdheid of replay worden. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { DatabaseSync } = require('node:sqlite');
const { startServer, stop } = require('./helper');
const { maakReisketenFixture, goed } = require('./lib/reisketen-fixture');
const { SLEUTELS } = require('../server/lib/idemsleutels-reisketen');
const { journaalPadOk, metZegel } = require('../server/kern/zaakdoos/journaal');

test('persoonlijke reisketen hoort niet in het doosjournaal, ook een oud geldig zegel niet', () => {
  const { journaalZegel, journaalGeldig } = metZegel(Buffer.alloc(32, 7));
  for (const sleutel of Object.keys(SLEUTELS).filter(s => s.startsWith('POST /api/supplier/'))) {
    const pad = sleutel.slice(5);
    for (const spelling of [pad, pad + '/', pad.toUpperCase() + '/']) {
      assert.equal(journaalPadOk(spelling), false, spelling);
      const oud = { seq: 1, pad: spelling, body: { voorwaarden: 'Privé reisvoorwaarden' }, res: null, at: 1 };
      oud.zegel = journaalZegel(oud);
      assert.equal(journaalGeldig(oud), false, 'geen replay van een vroeger geldig reisbesluit');
    }
  }
  assert.equal(journaalPadOk('/api/supplier/overschot'), true, 'keukencontinuïteit blijft bestaan');
});

test('koude doosstart weigert de actuele reisketen zonder dossier, mutatie of journaal; normale server herstelt', async () => {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-doos-'));
  const env = { RTG_DATA_DIR: map, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' };
  let srv, dodeCloud;
  function opgeslagen(naam) {
    const db = new DatabaseSync(path.join(map, 'store.db'), { readOnly: true });
    try { return db.prepare('SELECT val FROM kv WHERE key = ?').get(naam)?.val || null; }
    finally { db.close(); }
  }
  try {
    srv = await startServer({ env });
    const x = await maakReisketenFixture(() => srv.base);
    const reis = goed(await x.api('/api/reisbureau/keten/start', { titel: 'Vertrouwelijke offlinegrens',
      bestemming: 'Ibiza', supplierCode: x.bureau.code, idem: 'doos-reis-start' }, x.reiziger.token), 'reis').reis;
    await stop(srv); srv = null;
    const voor = opgeslagen('reisAanvragen'); assert.ok(voor && voor.includes(reis.ref));
    dodeCloud = net.createServer(s => s.destroy());
    await new Promise(r => dodeCloud.listen(0, '127.0.0.1', r));
    srv = await startServer({ env: { ...env, RTG_DOOS_CLOUD: 'http://127.0.0.1:' + dodeCloud.address().port,
      RTG_DOOS_SLEUTEL: 'uitsluitend-lokale-reisdoos-proef' } });
    // Het eerste verzoek ondervindt echte transportuitval; ook dié terugval
    // mag niet op een oude lokale reisstand als actueel antwoord terugvallen.
    for (const sleutel of Object.keys(SLEUTELS)) {
      const pad = sleutel.slice(5);
      const token = pad.startsWith('/api/supplier/') ? x.bureau.token : pad.startsWith('/api/office/') ? x.office : x.reiziger.token;
      const r = await x.api(pad, { ref: reis.ref, versie: reis.versie, idem: 'offline-geen-replay' }, token);
      assert.equal(r.status, 503, pad + ': ' + JSON.stringify(r.body));
      assert.equal(r.body.code, 'reisketen-online-vereist');
      assert.equal(JSON.stringify(r.body).includes(reis.titel), false);
    }
    const variant = await x.api('/API/SUPPLIER/REISBUREAU/KETEN/', {}, x.bureau.token);
    assert.equal(variant.status, 503, 'dezelfde Express-spelling blijft gesloten');
    assert.equal((await (await fetch(srv.base + '/api/doos/status')).json()).modus, 'lokaal');
    assert.equal(opgeslagen('reisAanvragen'), voor, 'geen offline handeling of ontvangst vastgelegd');
    assert.equal(opgeslagen('doosJournaal'), null, 'geen reislijf op schijf voor latere automatische replay');
    await stop(srv); srv = null;
    srv = await startServer({ env });
    const hersteld = goed(await x.api('/api/reisbureau/keten', { ref: reis.ref }, x.reiziger.token), 'online herlezing');
    assert.equal(hersteld.reizen[0].ref, reis.ref);
    assert.equal(hersteld.reizen[0].versie, reis.versie);
  } finally {
    if (srv) await stop(srv);
    if (dodeCloud) await new Promise(r => dodeCloud.close(r));
    fs.rmSync(map, { recursive: true, force: true });
  }
});

test('online doos geeft de echte cloud door; lijnuitval in het volgende verzoek opent geen lokale terugval', async () => {
  const cloudMap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-cloud-'));
  const doosMap = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-reis-proxy-'));
  let cloud, doos;
  try {
    cloud = await startServer({ env: { RTG_DATA_DIR: cloudMap, SMTP_URL: '', OFFICE_CODE: 'RTG-OFFICE' } });
    const x = await maakReisketenFixture(cloud.base);
    const reis = goed(await x.api('/api/reisbureau/keten/start', { titel: 'Uitsluitend in de cloud', bestemming: 'Ibiza',
      idem: 'doos-cloud-start' }, x.reiziger.token), 'cloudreis').reis;
    doos = await startServer({ env: { RTG_DATA_DIR: doosMap, SMTP_URL: '', RTG_DOOS_CLOUD: cloud.base,
      RTG_DOOS_SLEUTEL: 'test-geeft-geen-recht-op-een-kloon' } });
    const verzoek = () => fetch(doos.base + '/api/reisbureau/keten', { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer ' + x.reiziger.token,
      'Idempotency-Key': 'geen-oude-reisprojectie' }, body: JSON.stringify({ ref: reis.ref }) });
    const online = await verzoek(); assert.equal(online.status, 200);
    assert.equal((await online.json()).reizen[0].ref, reis.ref, 'persoonlijke cloudautoriteit blijft leidend');
    assert.equal((await (await fetch(doos.base + '/api/doos/status')).json()).modus, 'cloud');
    await stop(cloud); cloud = null;
    const offline = await verzoek();
    assert.equal(offline.status, 503);
    assert.equal(offline.headers.get('cache-control'), 'no-store');
    const antwoord = await offline.json();
    assert.equal(antwoord.code, 'reisketen-online-vereist');
    assert.equal(JSON.stringify(antwoord).includes(reis.ref), false, 'geen oude transportcache of fictief lokaal dossier');
    assert.equal((await (await fetch(doos.base + '/api/doos/status')).json()).modus, 'lokaal');
  } finally {
    if (doos) await stop(doos);
    if (cloud) await stop(cloud);
    fs.rmSync(cloudMap, { recursive: true, force: true });
    fs.rmSync(doosMap, { recursive: true, force: true });
  }
});
