/* Alleen een testproces: echte PG-collectie-, account- en responsecommits.
   De vaste accountkeuze is geen authproef; provider en fonds zijn de bestaande
   synthetische ketenfixture. Geen extra productie-endpoint of opslagdeur. */
'use strict';
const assert = require('node:assert/strict');
const opslag = require('../../server/db'), accounts = require('../../server/accounts');
const web = require('../../server/web');

async function main() {
  assert.equal(process.env.NODE_ENV, 'production');
  assert.equal(require('../../server/accounts/duurzaamheid').gesloten(), true);
  opslag.load(); accounts.init();
  await opslag.startPostgres(); await accounts.startPostgres();
  const email = 'pg-keten@fixture.test';
  if (!accounts.findByLogin(email)) await accounts.achtergrondWerk(() => {
    const u = accounts.createUserSync({ email, realName: 'PG ketenproef',
      password: 'alleen-synthetische-proef-123', tier: 'guest' });
    accounts.saveMemberState(u.id, { invoices: [] });
  });
  const accountId = accounts.findByLogin(email).id;
  let verlies = false;
  const bewerkCollectie = async (vorm, werk) => {
    const uit = await opslag.bewerkCollectie(vorm, werk);
    if (verlies) { verlies = false; throw Error('Collectieantwoord na echte COMMIT verloren'); }
    return uit;
  };
  const f = require('../abonnementen-keten-fixture.cjs').keten({ db: opslag.db,
    accounts, bewerkCollectie, save: opslag.save });
  const app = web(); app.use(opslag.postgresVerzoekMiddleware()); app.use(web.json());
  for (const actie of ['aanbod', 'teken', 'betaal', 'herstel']) app.post('/' + actie, async (req, res) => {
    try {
      verlies = actie === 'betaal' && req.headers['x-proef-antwoordverlies'] === '1';
      const uit = await f.service[actie](accountId, req.body);
      res.status(Number.isInteger(uit.status) ? uit.status : 200).json(uit);
    } catch (e) {
      const w = Object.values(opslag.db.data.betaalWaarheid || {})[0] || {};
      res.status(503).json({ error: e.message, oorzaak: e.cause?.message || null,
        stand: { id: w.id, status: w.status, soort: w.soort, actor: w.actor, bronRef: w.bronRef,
          centen: w.centen, valuta: w.valuta, provider: w.provider, providerId: w.providerId,
          terugbetaaldCenten: w.terugbetaaldCenten, context: w.context } });
    }
  });
  app.post('/provider/bevestig', (_req, res) => { f.bevestig(); res.json({ ok: true }); });
  app.get('/inspectie', (_req, res) => res.json({ providerCalls: f.stand.providerCalls,
    accountsTransactioneel: require('../../server/accounts/duurzaamheid').gesloten() }));
  const srv = app.listen(0, '127.0.0.1', () => process.send({ port: srv.address().port, accountId }));
}
main().catch(e => { console.error(e); process.exit(1); });
