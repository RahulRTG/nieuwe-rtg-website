'use strict';
/* MIJN LOOPBAAN: EEN 200 KOMT PAS NA DE DUURZAME COMMIT.

   De tegenlezer van ronde 2 (afbouw B2) vond in server/kern/carriereledger/ drie
   schrijvers die `vastleggen()` aanriepen ZONDER await, terwijl lib/duurzaam.js
   async is: het 200 ging de deur uit voordat de opslag iets had bevestigd. Een
   crash in dat gat liet een bevestigde regel verdwijnen (VOLTOOIPROEF.json,
   link:loopbaan, herstelbaar schakel 3), en een opslag die WEIGERDE gaf toch 200
   -- de valse bevestiging waar MENSNETWERK.md par. 0.6a voor waarschuwt.

   Deze toets meet het op een echte server en niet op een nagemaakte opslag: een
   lid zet een regel terwijl de duurzame schrijfactie faalt (RTG_VERRAAD
   `schrijf-faalt`, server/db/duurzaam.js). Op de oude code kwam daar 200 uit;
   nu hoort het een 503 te zijn met de reden, en mag de regel na een herstart
   zonder verraad niet bestaan. Hetzelfde voor intrekken, delen en stoppen met
   delen, want die hadden dezelfde vorm. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { startServer, stopNet } = require('./helper');

test('loopbaan: een schrijfactie die de opslag niet bevestigt, geeft geen 200', { timeout: 120000 }, async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-loopbaan-duurzaam-'));
  const env = { RTG_DATA_DIR: tmp, RTG_STORE: 'sqlite', DATABASE_URL: '', PG_URL: '', SMTP_URL: '',
    RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1', RTG_PUSH_UIT: '1' };
  let srv = null, lid = null;
  const api = async (pad, body = {}) => {
    const r = await fetch(srv.base + pad, { method: 'POST', signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', ...(lid ? { Authorization: 'Bearer ' + lid } : {}) },
      body: JSON.stringify(body) });
    return { http: r.status, ...(await r.json().catch(() => ({}))) };
  };
  const start = async (verraad = '') => { srv = await startServer({ env: { ...env, RTG_VERRAAD: verraad } }); };
  try {
    await start();
    lid = (await api('/api/auth/register', { name: 'Loopbaanproef', email: 'loopbaan-duurzaam@example.test',
      password: 'geheim12345', phone: '0612345679', geboortedatum: '1990-01-01', tier: 'rtg' })).token;
    assert.ok(lid, 'registratie gaf geen token');
    const vast = await api('/api/carriere/ledger/zet', { kapitaal: 'vermogen', wat: 'Diploma dat vaststaat', op: '2020-06-30' });
    assert.equal(vast.http, 200);
    const deel = await api('/api/carriere/ledger/deel', { id: vast.regel.id, dagen: 7, voor: 'een sponsor' });
    assert.equal(deel.http, 200);
    const did = (await api('/api/carriere/ledger/delen')).delen[0].id;
    await stopNet(srv.child);

    await start('schrijf-faalt');
    const zet = await api('/api/carriere/ledger/zet', { kapitaal: 'netwerk', wat: 'Regel die niet vaststaat', op: '2022-11-12' });
    assert.equal(zet.http, 503, 'zetten: de opslag bevestigde niets, dus geen 200 (kreeg ' + zet.http + ')');
    assert.match(String(zet.error), /niet vastgelegd/);
    const intrek = await api('/api/carriere/ledger/intrek', { id: vast.regel.id, reden: 'proef' });
    assert.equal(intrek.http, 503, 'intrekken: geen 200 over een intrekking die niet vaststaat (kreeg ' + intrek.http + ')');
    const nogEen = await api('/api/carriere/ledger/deel', { id: vast.regel.id, dagen: 3, voor: 'een ander' });
    assert.equal(nogEen.http, 503, 'delen: een deelcode die niet vaststaat hoort niet uitgegeven te worden (kreeg ' + nogEen.http + ')');
    const stop = await api('/api/carriere/ledger/stopdelen', { id: did });
    assert.equal(stop.http, 503, 'stoppen met delen: geen 200 over een stop die niet vaststaat (kreeg ' + stop.http + ')');
    await stopNet(srv.child);

    await start();
    const mijn = await api('/api/carriere/ledger/mijn');
    assert.equal(mijn.http, 200);
    const watten = (mijn.feiten || []).map((f) => f.wat);
    assert.deepEqual(watten, ['Diploma dat vaststaat'], 'na een herstart staat alleen wat de opslag bevestigde');
    assert.equal(mijn.feiten[0].ingetrokken, false, 'de intrekking die 503 kreeg, mag niet alsnog gelden');
    const delen = (await api('/api/carriere/ledger/delen')).delen;
    assert.equal(delen.length, 1, 'de deelcode die 503 kreeg, mag niet alsnog bestaan');
    assert.equal(delen[0].gestopt, false, 'de stop die 503 kreeg, mag niet alsnog gelden');
  } finally {
    if (srv) await stopNet(srv.child).catch(() => {});
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
