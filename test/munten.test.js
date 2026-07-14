/* Munten ontvangen en omzetten. RTG accepteert crypto voor zijn eigen diensten en
   zet ze meteen om naar euro's via een aanbieder-naad; zelf nooit crypto in bezit.
   We toetsen:
   1. de ontvanger-naad (muntbetaal): koers/omrekening, idempotentie, webhook;
   2. end-to-end: een lid vraagt een munt-adres voor een factuur, de aanbieder
      bevestigt via de webhook, de factuur wordt betaald en de 30%-RTFoundation-
      afdracht loopt gewoon mee. De backoffice ziet de euro-ontvangst.
   Draai: npm test */
process.env.MUNT_AAN = '1';
process.env.MUNT_WEBHOOK_SECRET = 'munt-test-secret-1234567890';
process.env.MUNT_MUNTEN = 'btc,eth,usdc';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const muntbetaal = require('../server/muntbetaal');
const { startServer, stop } = require('./helper');

function api(base, pad, body, token, method) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h.Authorization = 'Bearer ' + token;
  return fetch(base + pad, { method: method || 'POST', headers: h, body: method === 'GET' ? undefined : JSON.stringify(body || {}) })
    .then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
}

// ---- 1. de ontvanger-naad ----
test('muntbetaal: omrekening naar munt, gelockte koers, idempotent, webhook', async () => {
  // 1950 cent (EUR 19,50) in usdc bij demokoers 92 cent/usdc -> 21.20
  assert.equal(muntbetaal.naarMunt(1950, 'usdc'), '21.20');

  const a = await muntbetaal.maakOntvangst({ euroCenten: 1950, munt: 'usdc', referentie: 'R-1', idempotentieSleutel: 's1' });
  assert.equal(a.munt, 'usdc');
  assert.equal(a.euroCenten, 1950);
  assert.equal(a.bedragMunt, '21.20');
  assert.ok(a.adres, 'er is een ontvangstadres');
  assert.equal(a.status, 'wacht');

  const weer = await muntbetaal.maakOntvangst({ euroCenten: 1950, munt: 'usdc', referentie: 'R-1', idempotentieSleutel: 's1' });
  assert.equal(weer.id, a.id, 'zelfde sleutel: hetzelfde adres, nooit twee');
  assert.equal(weer.herhaald, true);

  await assert.rejects(() => muntbetaal.maakOntvangst({ euroCenten: 1000, munt: 'doge' }), /niet geaccepteerd/);
  await assert.rejects(() => muntbetaal.maakOntvangst({ euroCenten: 0, munt: 'btc' }), /positief bedrag/);

  const body = JSON.stringify({ id: a.id, status: 'ontvangen', euroCenten: 1950 });
  const evt = muntbetaal.verifieerWebhook(body, muntbetaal.tekenDemo(body));
  assert.equal(evt.id, a.id);
  assert.throws(() => muntbetaal.verifieerWebhook(body, 'foute-handtekening'), /handtekening/);
});

// ---- 2. end-to-end ----
let srv, base;
test.before(async () => {
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-munt-'));
  srv = await startServer({ env: {
    SMTP_URL: '', RTG_DATA_DIR: TMP, OFFICE_CODE: 'MUNT-KEURING-1',
    MUNT_AAN: '1', MUNT_WEBHOOK_SECRET: 'munt-test-secret-1234567890', MUNT_MUNTEN: 'btc,eth,usdc'
  } });
  base = srv.base;
});
test.after(() => stop(srv && srv.child));

test('e2e: munt-verzoek voor een factuur, webhook betaalt hem en de RTF-afdracht loopt mee', async () => {
  const opties = (await api(base, '/api/munt/opties', {})).body;
  assert.equal(opties.aan, true, 'acceptatie staat aan');
  assert.ok(opties.munten.some(m => m.munt === 'usdc'), 'usdc wordt aangeboden');

  const lid = (await api(base, '/api/login', { tier: 'business' })).body.token;
  const st = (await api(base, '/api/state', {}, lid)).body.state;
  const abo = (st.invoices || []).find(i => /maandbijdrage|lidmaatschap|jaarbijdrage/i.test(i.desc || '') && i.status === 'open');
  assert.ok(abo, 'er staat een open abonnementsfactuur klaar');

  const vz = await api(base, '/api/munt/verzoek', { invoiceId: abo.id, munt: 'usdc' }, lid);
  assert.equal(vz.status, 200);
  const verzoek = vz.body.verzoek;
  assert.ok(verzoek.adres && verzoek.bedragMunt, 'adres en muntbedrag terug');
  assert.ok(verzoek.euroCenten > 0);

  // de aanbieder bevestigt: munten binnen en omgezet naar euro
  const evtBody = JSON.stringify({ id: verzoek.id, status: 'ontvangen', euroCenten: verzoek.euroCenten });
  const wh = await fetch(base + '/api/munt/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-munt-signature': muntbetaal.tekenDemo(evtBody) }, body: evtBody
  });
  assert.equal(wh.status, 200);

  // de factuur is nu betaald
  const st2 = (await api(base, '/api/state', {}, lid)).body.state;
  const nu = (st2.invoices || []).find(i => i.id === abo.id);
  assert.equal(nu.status, 'paid', 'de factuur staat op betaald na de munt-ontvangst');

  // backoffice: euro-ontvangst zichtbaar en de RTFoundation-afdracht geboekt
  const office = (await api(base, '/api/office/login', { code: 'MUNT-KEURING-1' })).body.token;
  const os2 = (await api(base, '/api/office/state', {}, office)).body.state.stats;
  assert.equal(os2.muntOntvangst.aan, true);
  assert.equal(os2.muntOntvangst.aantal, 1);
  assert.equal(Math.round(os2.muntOntvangst.ontvangen * 100), verzoek.euroCenten, 'euro-ontvangst klopt');
  assert.ok(os2.fondsAfdracht.teStorten > 0, 'de 30%-afdracht is ook via de munt-betaling geboekt');

  // webhook nog eens: geen dubbele ontvangst
  await fetch(base + '/api/munt/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-munt-signature': muntbetaal.tekenDemo(evtBody) }, body: evtBody
  });
  const os3 = (await api(base, '/api/office/state', {}, office)).body.state.stats;
  assert.equal(os3.muntOntvangst.aantal, 1, 'idempotent: nog steeds een ontvangst');
});
