/* Werkelijke HTTP-deurproef. De protocol- en end-to-endproeven gaan dieper in
   op betekenis; deze proef bewijst op een echte server dat alle Loop-ingangen
   ingangen gemount zijn en zonder server-derived actor/WorkOS-context dicht
   blijven. Daarmee komen ze ook uit waarneming in het routejournaal terecht. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helper');

let srv;

async function post(path, body) {
  const r = await fetch(srv.base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {})
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

test.before(async () => {
  srv = await h.startServer({ env: {
    SMTP_URL: '', RTG_BETALEN_UIT: '1', RTG_AI_UIT: '1',
    VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: ''
  } });
});

test.after(async () => { if (srv) await h.stop(srv.child); });

test('alle Loop Fabric HTTP-ingangen bestaan en blijven zonder identiteit dicht', async () => {
  for (const [path, status] of [
    ['/api/loop/observation/inbox', 401],
    ['/api/loop/recall/present', 401],
    ['/api/loop/recall/disposition', 401],
    ['/api/loop/proof', 401],
    /* werkPoort gebruikt voor alle bestaande WorkOS-routes 403 voor een
       onbekende werkruimte/lidcombinatie; deze slice verandert die betekenis
       niet om een generieke authcode af te dwingen. */
    ['/api/bedrijf/loop/procedure/change', 403],
    ['/api/bedrijf/loop/runbook/change', 403],
    ['/api/bedrijf/loop/incident/observe', 403]
  ]) {
    const r = await post(path, { workspaceCode: 'WLOOP' });
    assert.equal(r.status, status, path + ' hoort zonder identiteit dicht te blijven: ' + JSON.stringify(r.body));
  }
});
