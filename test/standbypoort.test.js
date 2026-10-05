/* ============================================================================
   EEN STAND-BY BEVESTIGT NIETS -- regressie voor N6 uit de V1-audit.

   DE FOUT: een proces dat niet schrijft (RTG_ROL=standby, of afgezet door de
   poortwachter van het trio) liet een schrijfverzoek gewoon door. bewaar()
   keerde stil terug en het antwoord was 200: "gelukt" over iets dat nergens
   stond.

   DE FIX: server/opzet/standbypoort.js. Zolang db.writable false is, krijgt elk
   verzoek met een methode die iets kan veranderen een 503 met Retry-After;
   lezen en de clusterroutes blijven open.

   Draai los: node --test test/standbypoort.test.js
   ========================================================================== */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { startServer, stop } = require('./helper');

const SLEUTEL = 'toets-clustersleutel';

test('een stand-by weigert schrijfverzoeken met 503, en schrijft weer zodra hij leider is', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-standby-'));
  const srv = await startServer({ env: { RTG_DATA_DIR: dir, RTG_ROL: 'standby', RTG_CLUSTER_KEY: SLEUTEL } });
  const post = async (pad, body, kop) => {
    const r = await fetch(srv.base + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(kop || {}) },
      body: JSON.stringify(body || {}) });
    return { status: r.status, retry: r.headers.get('retry-after'), body: await r.json().catch(() => ({})) };
  };
  const registreer = (n) => post('/api/auth/register',
    { name: 'Stand By', email: 'standby' + n + '@voorbeeld.test', password: 'geheim12', geboortedatum: '1990-01-01' });
  try {
    const health = await (await fetch(srv.base + '/api/health')).json();
    assert.equal(health.active, false, 'deze server begint als stand-by');

    const vooraf = await registreer(1);
    assert.equal(vooraf.status, 503, 'een stand-by bevestigt geen registratie die hij niet bewaart (kreeg ' + vooraf.status + ')');
    assert.equal(vooraf.retry, '2');
    assert.equal(vooraf.body.token, undefined);
    assert.equal((await fetch(srv.base + '/api/health')).status, 200, 'lezen blijft open');

    const promote = await post('/api/cluster/promote', {}, { 'x-rtg-cluster': SLEUTEL });
    assert.equal(promote.status, 200, 'de clusterroute blijft bereikbaar: ' + JSON.stringify(promote.body));
    const daarna = await registreer(2);
    assert.equal(daarna.status, 200, 'als leider schrijft hij gewoon: ' + JSON.stringify(daarna.body).slice(0, 160));
    assert.ok(daarna.body.token);

    const demote = await post('/api/cluster/demote', {}, { 'x-rtg-cluster': SLEUTEL });
    assert.equal(demote.status, 200);
    assert.equal((await registreer(3)).status, 503, 'na de afzetting weigert hij weer');
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});
