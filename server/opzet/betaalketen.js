/* De providerwaarheid wordt vóór de herstelregie samengesteld. Alleen de
   twee bestaande herstelacties worden aan die regie doorgegeven. */
module.exports = (ctx) => {
  const { db, save, crypto, betaal, nu, log, env } = ctx;
/* Eén blijvende waarheid voor inkomende betalingen, vóór routes en webhooks
   worden bedraad. Ze hangt niet aan Stripe of Mollie: providers leveren alleen
   gebeurtenissen aan. Daardoor kan een zaak van rail wisselen zonder dat de
   betekenis van "betaald" mee verhuist. */
const betaalWaarheid = require('../kern/betaalwaarheid')({
  d: () => db.data, save, crypto, betaal, nu, log
});
const betaalRegie = require('../kern/betaalregie')({
  d: () => db.data, save, betaal, env, nu,
  afhandeling: { terugAfhandelen: b => betaalWaarheid.terugAfhandelen(b), controleAfronden: b => betaalWaarheid.controleAfronden(b) }
});

  return { betaalWaarheid, betaalRegie };
};
