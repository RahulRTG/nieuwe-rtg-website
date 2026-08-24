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
  /* De sessiesleutel voor de Trust Fabric: het token dat techAuth al heeft
     laten verifieren (zie routes/techniek.js). Niet zelf de kop lezen. */
  const sessieVan = (req) => String(req.techSessie || '');

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

  /* ---------- het contract ----------
     Bij de eigenaar, want dit IS de commerciele afspraak. Een klant die zijn
     eigen pakket kan zetten heeft geen pakket. Lezen zonder `pakket` in het
     lijf; zetten met. */
  app.post('/api/techniek/tenant/contract', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    const alleenLezen = b.pakket == null && b.tot === undefined && b.werkruimtes == null && b.apiPerUur == null;
    if (alleenLezen) {
      const c = T().contract.van(b.org);
      return c ? res.json({ ok: true, contract: c, pakketten: T().contract.PAKKETTEN })
        : res.status(404).json({ error: 'Die tenant kennen we niet.' });
    }
    const uit = T().contract.zet(b.org, { ...b, door: b.door || wie(req) });
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    log.info('tenant contract', { org: String(b.org || '').toUpperCase(), pakket: uit.contract.pakket, door: wie(req) });
    res.json(uit);
  });

  /* ---------- de levensloop ----------
     Opzeggen, bewaren en de bewaringsplicht. Bij de eigenaar en niet bij de
     klant: dit gaat over het contract, en een klant die zijn eigen tenant in
     de bewaring kan zetten, kan de toegang van zijn collega's sluiten. Zijn
     UITVOER kan hij altijd zelf ophalen -- dat staat in routes/tenant.js en
     hangt met opzet aan geen enkele stand. */
  app.post('/api/techniek/tenant/levensloop', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    if (!b.naar) {
      const s = T().levensloop.stand(b.org);
      return s ? res.json({ ok: true, levensloop: s }) : res.status(404).json({ error: 'Die tenant kennen we niet.' });
    }
    const uit = T().levensloop.zet(b.org, { ...b, door: b.door || wie(req) });
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    log.warn('tenant levensloop', { org: String(b.org || '').toUpperCase(), naar: b.naar, door: wie(req) });
    res.json(uit);
  });

  app.post('/api/techniek/tenant/bewaringsplicht', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    const uit = T().levensloop.houdVast(b.org, b.aan !== false, b.reden, b.door || wie(req));
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    log.warn('tenant bewaringsplicht', { org: String(b.org || '').toUpperCase(), aan: b.aan !== false, door: wie(req) });
    res.json(uit);
  });

  /* Vernietigen. Onomkeerbaar, dus met de drie deuren ervoor in de kern en
     niet hier: een controle in een route is een controle die de volgende
     aanroeper mist. */
  /* HET TWEEDE MOMENT (VERTROUWEN.md laag 3). Vernietigen is onherstelbaar en
     staat daarom in het register als `minstens: 'uitzonderlijk'`: die vragen
     elke keer een bevestiging die aan deze ene handeling vastzit. */
  app.post('/api/techniek/tenant/bevestig', techAuth, eigenaarAlleen, async (req, res) => {
    const b = req.body || {};
    if (!await accounts.verifyPassword(String(b.wachtwoord || ''), req.techUser.password_hash))
      return res.status(401).json({ error: 'Dat wachtwoord klopt niet. Er is niets bevestigd.' });
    const sessie = sessieVan(req);
    const uit = kern.vertrouwen.losBon(String(b.id || ''), sessie);
    if (!uit.ok) return res.status(400).json({ error: uit.reden });
    /* En de sessie is weer VERS: daarom vraagt een ZWARE handeling daarna een
       kwartier lang niets meer. Zie kern/vertrouwen/tweedemoment.js. */
    kern.vertrouwen.verifieer(sessie, { hoe: 'wachtwoord', account: 'user-' + req.techUser.id,
      apparaat: String(req.get('user-agent') || '') + '|' + String(req.get('accept-language') || '') });
    res.json({ ok: true });
  });

  app.post('/api/techniek/tenant/vernietig', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    const door = b.door || wie(req);
    /* EERST DE INHOUDELIJKE WEIGERING, DAN HET TWEEDE MOMENT: een bevestiging
       vragen voor iets dat toch niet doorgaat, verspeelt hem. */
    const mag = T().levensloop.magVernietigen(b.org, { door });
    if (mag.error) return res.status(mag.status || 400).json({ error: mag.error });
    const poort = kern.vertrouwen.poort({ actor: 'user-' + req.techUser.id, sessie: sessieVan(req),
      soort: 'tenant.vernietig', aantal: 1, doel: String(b.org || ''), bon: b.bevestiging });
    if (!poort.door) return res.status(poort.status).json(poort.antwoord);
    const uit = T().levensloop.vernietig(b.org, { door });
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    log.warn('tenant vernietigd', { org: String(b.org || '').toUpperCase(), door: wie(req),
      werkruimtes: uit.bewijs.werkruimtes.length });
    res.json(uit);
  });

  /* Een uitvoer weer inlezen. Bij de eigenaar omdat er een NIEUWE werkruimte
     uit komt en niemand anders die mag laten ontstaan; hij landt bewust nooit
     over een bestaande heen. */
  app.post('/api/techniek/tenant/invoer', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    const uit = T().uitgang.lees(b.uitvoer, { naam: b.naam });
    if (uit.error) return res.status(uit.status || 400).json({ error: uit.error });
    log.info('tenant invoer', { werkruimte: uit.werkruimte, door: wie(req) });
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
