/* Echte route/service/BW-keten; provider en accountopslag zijn de expliciete
   synthetische ketenfixture. Geen echte Stripe- of duurzaamheidsclaim. */
'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { keten } = require('./abonnementen-keten-fixture.cjs');
async function klaar() {
  const f = keten(), contractId = await f.getekend();
  await f.service.betaal(1, { contractId }); f.bevestig(); await f.service.herstel(1, { contractId });
  const maak = f.betaal.maakBetaling;
  f.betaal.maakBetaling = async o => { const p = await maak(o); p.id = 'pi_' + o.referentie; return p; };
  f.stand.klantacties = 0;
  f.betaal.haalKlantactie = async o => {
    f.stand.klantacties++;
    assert.equal(o.terugkerend.modus, 'innen'); assert.match(o.providerId, /^pi_/);
    return { soort: 'stripe-bevestigen', publicKey: 'pk_test_synthetisch',
      clientSecret: o.providerId + '_secret_synthetisch', paymentMethodId: 'pm_fixture', nieuweBetaalmethode: false };
  };
  f.stand.at = '2026-12-13T10:00:00.000Z';
  assert.deepEqual((await f.service.ronde()).fouten, []);
  return { ...f, contractId };
}
function route(f) {
  const handlers = new Map();
  require('../server/routes/aanmeldingen/automatisch')({ env: { RTG_ABONNEMENTEN_ZELFSERVICE: '1' },
    auth: (req, res, next) => req.accountId ? next() : res.status(401).json({ error: 'Geen sessie' }),
    aanvragerVan: req => req.accountId, aanmeldingen: { automatisch: f.service },
    app: { post(pad, ...rij) { handlers.set(pad, rij); } } });
  return async (accountId, body, pad = 'herstel') => {
    const req = { accountId, body }, r = { status: 200, headers: {} };
    const res = { set(k, v) { r.headers[k] = v; return this; },
      status(s) { r.status = s; return this; }, json(body) { r.body = body; return this; } };
    const rij = handlers.get('/api/mijn/abonnement/automatisch/' + pad);
    let i = 0; const next = async () => { if (rij[i]) await rij[i++](req, res, next); };
    await next(); return r;
  };
}
test('alleen expliciet eigen herstel geeft klantactie; achtergrond/stand bewaren geen secret', async () => {
  const f = await klaar();
  assert.equal(f.stand.klantacties, 0);
  assert.deepEqual((await f.service.ronde()).fouten, []);
  assert.equal(f.stand.klantacties, 0);
  const api = route(f), calls = f.stand.providerCalls;
  const r = await api(1, { contractId: f.contractId, accountId: 2, providerId: 'pi_vreemd', clientSecret: 'fake' });
  assert.equal(r.status, 200); assert.equal(r.body.klantactie.soort, 'stripe-bevestigen');
  assert.match(r.body.klantactie.clientSecret, /^pi_BW-.*_secret_synthetisch$/);
  assert.equal(r.body.klantactie.returnUrl, 'https://rtg.example/?abonnement=herstel');
  assert.equal(r.headers['Cache-Control'], 'no-store');
  assert.equal(f.stand.providerCalls, calls, 'geen nieuwe inning door herstelklik');
  const stand = await api(1, {}, 'stand');
  assert.equal(JSON.stringify(stand.body).includes('_secret_'), false);
  assert.equal(JSON.stringify(f.db.data).includes('_secret_'), false);
  assert.equal((await api(2, { contractId: f.contractId, accountId: 1 })).status, 404);
  assert.equal((await api(null, { contractId: f.contractId, accountId: 1 })).status, 401);
  assert.equal(f.stand.klantacties, 1);
});
test('klantactie-ophaalfout geeft foutantwoord; retry dezelfde PI en geen vals betaald', async () => {
  const f = await klaar(), api = route(f), origineel = f.betaal.haalKlantactie;
  const calls = f.stand.providerCalls;
  f.betaal.haalKlantactie = async () => { throw Error('Provider niet bereikbaar'); };
  assert.equal((await api(1, { contractId: f.contractId })).status, 503);
  const w = Object.values(f.db.data.betaalWaarheid).find(w => w.context.termijn === 2);
  assert.equal(w.status, 'WACHT_OP_KLANT'); assert.equal(!!w.afgehandeldAt, false);
  f.betaal.haalKlantactie = origineel;
  assert.equal((await api(1, { contractId: f.contractId })).body.klantactie.soort, 'stripe-bevestigen');
  assert.equal(f.stand.providerCalls, calls);
  f.bevestig();
  const betaald = await api(1, { contractId: f.contractId });
  assert.equal(betaald.status, 200); assert.equal(betaald.body.klantactie, undefined);
  assert.equal(f.stand.providerCalls, calls);
  assert.equal(f.db.data.lidmaatschapBetalingen[0].termijnen[1].status, 'voldaan');
});
