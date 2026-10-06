/* ============================================================================
   EEN STAND-BY BEVESTIGT NIETS -- regressie voor N6 uit de V1-audit.

   DE FOUT: een proces dat niet schrijft (RTG_ROL=standby, of afgezet door de
   poortwachter van het trio) liet een schrijfverzoek gewoon door. bewaar()
   keerde stil terug en het antwoord was 200: "gelukt" over iets dat nergens
   stond.

   DE FIX: server/opzet/standbypoort.js. Zolang db.writable false is, krijgt elk
   verzoek met een methode die iets kan veranderen een 503 met Retry-After;
   lezen en de clusterroutes blijven open.

   WAT HIER ONDERSCHEIDT (herkeuring van N6): een verse stand-by gaf al 503,
   omdat zijn opslag nog niet klaar is (opslagPoort in
   server/middleware/remmen.js). Die eerste bewering zakt dus niet zonder de fix.
   De toets leunt op de stand NA een afzetting, waar de opslag wel klaar is en
   alleen deze poort weigert. Daar wordt ook de TEKST gelezen, en een
   betaalwebhook geprobeerd: stond de poort pas na de lijfpoort, dan las de
   webhook zijn lijf en antwoordde hij zelf.

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
    const na = await registreer(3);
    assert.equal(na.status, 503, 'na de afzetting weigert hij weer');
    assert.match(na.body.error || '', /stand-by/, 'en het is deze poort die weigert, niet de opslagpoort: ' + na.body.error);
    assert.equal(na.retry, '2');

    /* De poort staat VOOR de betaalwebhooks: een webhook die een stand-by
       bereikt, hoort opnieuw te proberen en niet door zijn eigen handler te
       worden beantwoord. */
    const webhook = await post('/api/betaal/webhook', { type: 'payment_intent.succeeded' }, { 'stripe-signature': 't=1,v1=00' });
    assert.equal(webhook.status, 503, 'een betaalwebhook op een stand-by krijgt 503 (kreeg ' + webhook.status + ')');
    assert.match(webhook.body.error || '', /stand-by/, 'van deze poort, voor de handler: ' + webhook.body.error);
  } finally {
    await stop(srv);
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
  }
});
