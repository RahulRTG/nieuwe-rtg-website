/* ============================================================================
   SCIM /Groups -- de verzamelingen waar mensen in zitten.

   Afgesplitst van ./scim.js: dat bestand ging over de 10 kB van keuringsregel
   13, en de naad is niet gekunsteld -- daar staan de MENSEN (aanmaken,
   uitzetten), hier de groepen. De opslag en de regels staan in
   server/scim/groepen.js; dit is de deur.

   WAT DEZE DEUR TOEVOEGT AAN DE IDENTITEITSBRUG. De brug las de claim `groups`
   uit het ID-token, en dat gebeurt alleen bij een INLOG. Haalt een beheerder
   iemand vanochtend uit een groep, dan houdt die persoon zijn rol tot hij
   toevallig opnieuw inlogt -- bij een sessie van dertig dagen dus een maand.
   Voor een groep die toegang tot personeelsdossiers geeft, is dat een maand te
   lang. Hier duwt de IdP de wijziging naar ons toe en werkt hij meteen.

   Elke wijziging aan de LEDEN loopt daarom door de brug (`meebewegen`), in
   hetzelfde verzoek. Anders is de deur wel dicht in onze tabel en nog open in
   de werkruimte -- en dat is de gevaarlijkste helft.
   ========================================================================== */
'use strict';

module.exports = ({ app, kern, accounts, scim, vorm, filter, log,
  BASIS, remmen, scimAuth, stuurScim, stuurFout }) => {
  function syncFout(org, oorzaak) {
    const detail = oorzaak && oorzaak.message ? oorzaak.message
      : (oorzaak && oorzaak.reden ? oorzaak.reden : String(oorzaak || 'onbekende fout'));
    log.error('scim.groep meebewegen mislukt', { org, fout: detail });
    const e = new Error('De groepswijziging kon niet in Werk OS worden bevestigd. Probeer het SCIM-verzoek opnieuw.');
    e.status = 503;
    e.code = 'SCIM_WERK_GROEP';
    return e;
  }

  function markeer(org, ids, reden) {
    try { scim.groepen.markeerSync(org, ids, reden); }
    catch (e) { throw syncFout(org, e); }
  }

  function createKlaar(org, id) {
    try { scim.groepen.createSyncKlaar(org, id); }
    catch (e) { throw syncFout(org, e); }
  }

  function meebewegen(org, ids, reden) {
    let alle;
    try {
      alle = new Set([].concat(ids || [], scim.groepen.wachtendeSync(org)).map(String));
    } catch (e) { throw syncFout(org, e); }
    if (!alle.size) return { ok: true, geraakt: 0 };

    let tenant;
    try { tenant = kern.tenant; }
    catch (e) { throw syncFout(org, e); }
    if (!tenant || !tenant.register || typeof tenant.register.haal !== 'function') {
      throw syncFout(org, new Error('tenantregister niet beschikbaar'));
    }
    let gebonden;
    try { gebonden = tenant.register.haal(org); }
    catch (e) { throw syncFout(org, e); }

    /* Zonder tenant zijn er voor deze org geen Werk OS-rollen. De blijvende
       markering kan dan veilig weg; bij twijfel over het register kwamen we
       hierboven juist met 503 uit. */
    if (!gebonden) {
      try { for (const id of alle) scim.groepen.syncKlaar(org, id); }
      catch (e) { throw syncFout(org, e); }
      return { ok: true, geraakt: 0, nietVanToepassing: 'geen-tenant' };
    }
    if (!tenant.brug || typeof tenant.brug.uitClaims !== 'function') {
      throw syncFout(org, new Error('tenantbrug niet beschikbaar'));
    }

    const mislukt = [];
    let geraakt = 0;
    for (const id of alle) {
      try {
        const u = accounts.getUserById(Number(id));
        if (!u) { scim.groepen.syncKlaar(org, id); continue; }
        const groepenNu = scim.groepen.groepenVan(org, id);
        const uit = tenant.brug.uitClaims(org, groepenNu, 'user-' + u.id, null);
        if (!uit || uit.ok !== true || !Array.isArray(uit.werkruimtes)) {
          throw new Error(uit && uit.reden || 'tenantbrug gaf geen bevestiging');
        }
        scim.groepen.syncKlaar(org, id);
        geraakt++;
      } catch (e) {
        log.error('scim.groep lid niet gesynchroniseerd', { org, id, fout: e.message });
        mislukt.push(id);
      }
    }
    if (mislukt.length) throw syncFout(org, new Error(mislukt.length + ' account(s) wachten nog op Werk OS'));
    log.info('scim.groep', { org, geraakt, reden });
    return { ok: true, geraakt };
  }

  app.get(BASIS + '/Groups', remmen, scimAuth, (req, res) => {
    const f = filter.ontleed(req.query.filter);
    const alle = scim.groepen.lijst(req.scimOrg);
    const rijen = f.soort === 'gelijk' ? alle.filter(g => g.naam === f.waarde) : alle;
    stuurScim(res, 200, vorm.lijst(rijen.map(g => vorm.groep(g, BASIS)),
      { start: 1, aantal: rijen.length, totaal: rijen.length }));
  });

  app.get(BASIS + '/Groups/:id', remmen, scimAuth, (req, res) => {
    const g = scim.groepen.vind(req.scimOrg, req.params.id);
    if (!g) return stuurFout(res, 404, 'Onbekende groep binnen deze organisatie.');
    stuurScim(res, 200, vorm.groep(g, BASIS));
  });

  app.post(BASIS + '/Groups', remmen, scimAuth, (req, res) => {
    const b = req.body || {};
    try {
      /* Eerst volledig valideren, zonder enige bijwerking. Een gewone duplicate
         blijft daarna een zuivere 409. Alleen de exact herkenbare retryrij die
         atomair met een eerdere create is vastgelegd, mag Werk OS hervatten. */
      const leden = scim.groepen.schoonLeden(b.members);
      const naam = String(b.displayName || '').trim();
      const bestaand = scim.groepen.opNaam(req.scimOrg, naam);
      if (bestaand && scim.groepen.isCreateRetry(req.scimOrg, bestaand, naam, leden, b.externalId)) {
        meebewegen(req.scimOrg, bestaand.leden, 'groep-create opnieuw aangeboden');
        createKlaar(req.scimOrg, bestaand.id);
        return stuurScim(res, 200, vorm.groep(bestaand, BASIS));
      }
      const g = scim.groepen.maakMetSync(req.scimOrg, naam, leden, b.externalId);
      meebewegen(req.scimOrg, g.leden, 'groep gemaakt');
      createKlaar(req.scimOrg, g.id);
      stuurScim(res, 201, vorm.groep(g, BASIS));
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

  app.patch(BASIS + '/Groups/:id', remmen, scimAuth, (req, res) => {
    const g = scim.groepen.vind(req.scimOrg, req.params.id);
    if (!g) return stuurFout(res, 404, 'Onbekende groep binnen deze organisatie.');
    try {
      const { leden, naam, herkend } = scim.groepen.uitPatch(req.body, g.leden);
      if (!herkend) return stuurFout(res, 400, 'Alleen `displayName` en `members` kunnen via SCIM worden gewijzigd.', 'invalidValue');
      markeer(req.scimOrg, [...new Set([].concat(g.leden, leden))], 'groep gewijzigd');
      if (naam) scim.groepen.hernoem(req.scimOrg, g.id, naam);
      const na = scim.groepen.zetLeden(req.scimOrg, g.id, leden);
      /* Ook wie ERUIT ging moet meebewegen -- juist die, want dat is de kant
         waar toegang verdwijnt. */
      meebewegen(req.scimOrg, [...new Set([].concat(g.leden, na.leden))], 'groep gewijzigd');
      stuurScim(res, 200, vorm.groep(na, BASIS));
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

  app.put(BASIS + '/Groups/:id', remmen, scimAuth, (req, res) => {
    const g = scim.groepen.vind(req.scimOrg, req.params.id);
    if (!g) return stuurFout(res, 404, 'Onbekende groep binnen deze organisatie.');
    const b = req.body || {};
    try {
      const leden = scim.groepen.schoonLeden(b.members || []);
      markeer(req.scimOrg, [...new Set([].concat(g.leden, leden))], 'groep vervangen');
      if (b.displayName) scim.groepen.hernoem(req.scimOrg, g.id, b.displayName);
      const na = scim.groepen.zetLeden(req.scimOrg, g.id, leden);
      meebewegen(req.scimOrg, [...new Set([].concat(g.leden, na.leden))], 'groep vervangen');
      stuurScim(res, 200, vorm.groep(na, BASIS));
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

  app.delete(BASIS + '/Groups/:id', remmen, scimAuth, (req, res) => {
    try {
      const bestaand = scim.groepen.vind(req.scimOrg, req.params.id);
      if (!bestaand) {
        /* Na een 503 kan de groep al weg zijn. De blijvende ledenlijst maakt
           DELETE idempotent zonder de ingetrokken mensen kwijt te raken. */
        const wachtend = scim.groepen.wachtendeSync(req.scimOrg);
        if (!wachtend.length) return stuurFout(res, 404, 'Onbekende groep binnen deze organisatie.');
        meebewegen(req.scimOrg, [], 'verwijderde groep opnieuw aangeboden');
        return res.status(204).end();
      }
      markeer(req.scimOrg, bestaand.leden, 'groep verwijderd');
      const g = scim.groepen.haalWeg(req.scimOrg, req.params.id);
      /* De groep is weg; de ACCOUNTS blijven. Meebewegen trekt alleen de rollen
         in die aan deze groep hingen -- een groep opheffen is geen ontslag. */
      meebewegen(req.scimOrg, g.leden, 'groep verwijderd');
      res.status(204).end();
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

};
