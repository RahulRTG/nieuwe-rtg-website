/* ============================================================================
   Het beheer van de tenants. Alles achter techAuth + eigenaarAlleen.

   Om dezelfde reden als de SSO-koppelingen (zie ./sso.js): wie hier mag
   schrijven, bepaalt onder welk contract, welk merk en straks welke export een
   werkruimte valt. Een werkruimte die zichzelf aan een tenant kan hangen, kan
   zichzelf aan andermans tenant hangen -- en dan leest de een het merk en de
   ledenlijst van de ander. Dezelfde keuze die kern/webmerk.js al maakte toen
   een zaak zich niet tot moederbedrijf van een andere zaak mocht uitroepen.

   Wat de KLANT zelf beheert staat er niet bij: de groepsafbeelding hoort bij de
   beheerder van zijn eigen werkruimte (routes/tenant.js). Dat is een
   personeelsbesluit; welke organisatie dit is, is dat niet.

   Gemount vanuit routes/techniek.js. */
'use strict';

const { veiligeFout } = require('../../kern/util');
const { log } = require('../../log');

module.exports = (tctx) => {
  const { app, accounts, techAuth, eigenaarAlleen, kern } = tctx;

  const wie = (req) => {
    try { return req.techUser ? accounts.realNameOf(req.techUser) : null; }
    catch (e) { return null; }
  };
  const T = () => kern.tenant;

  app.get('/api/techniek/tenant', techAuth, eigenaarAlleen, (req, res) => {
    res.json({ tenants: T().register.lijst(), modi: T().register.MODI,
      sovereign: T().register.SOVEREIGN_WAAROM });
  });

  /* Aanmaken of wijzigen. De org is de sleutel en is niet te hernoemen: hij
     staat ook in sso_koppelingen en in de SCIM-sleutels, en een hernoeming die
     maar één van die drie raakt, levert een tenant op die zijn eigen mensen
     niet meer herkent. Wie een andere org wil, maakt een nieuwe. */
  app.post('/api/techniek/tenant', techAuth, eigenaarAlleen, (req, res) => {
    try {
      const uit = T().register.zet(req.body || {});
      if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
      log.info('tenant gezet', { org: uit.tenant.org, modus: uit.tenant.modus, door: wie(req) });
      res.json(uit);
    } catch (e) { res.status(400).json({ error: veiligeFout(e) }); }
  });

  /* Een werkruimte of een zaak aan een tenant hangen. `soort` is 'werkruimte'
     of 'zaak'; die twee staan naast elkaar en niet in elkaar, want een
     leverancierscode is een zakelijke relatie en geen productinstantie. */
  app.post('/api/techniek/tenant/bind', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    const soort = b.soort === 'zaak' ? 'zaak' : 'werkruimte';
    const uit = T().register.bind(b.org, soort, b.code, b.aan !== false);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    log.info('tenant binding', { org: String(b.org || '').toUpperCase(), soort, aan: b.aan !== false, door: wie(req) });
    res.json(uit);
  });

  /* Het merk van de tenant. Komt er als ONDERTEKEND manifest uit; het geheim
     erachter blijft binnen, net als bij de SSO-koppelingen. */
  app.post('/api/techniek/tenant/merk', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    const uit = T().merkZet(b.org, b.merk || b);
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    log.info('tenant merk gezet', { org: String(b.org || '').toUpperCase(), door: wie(req) });
    res.json(uit);
  });
};
