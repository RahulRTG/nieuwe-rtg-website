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
  function meebewegen(org, ids, reden) {
    if (!kern.tenant) return;
    for (const id of new Set((ids || []).map(String))) {
      try {
        const u = accounts.getUserById(Number(id));
        if (!u) continue;
        const groepenNu = scim.groepen.groepenVan(org, id);
        kern.tenant.brug.uitClaims(org, groepenNu, 'user-' + u.id, null);
      } catch (e) { log.error('scim.groep meebewegen mislukt', { org, id, fout: e.message }); }
    }
    log.info('scim.groep', { org, geraakt: (ids || []).length, reden });
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
      const g = scim.groepen.maak(req.scimOrg, b.displayName, b.members, b.externalId);
      meebewegen(req.scimOrg, g.leden, 'groep gemaakt');
      stuurScim(res, 201, vorm.groep(g, BASIS));
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

  app.patch(BASIS + '/Groups/:id', remmen, scimAuth, (req, res) => {
    const g = scim.groepen.vind(req.scimOrg, req.params.id);
    if (!g) return stuurFout(res, 404, 'Onbekende groep binnen deze organisatie.');
    try {
      const { leden, naam, herkend } = scim.groepen.uitPatch(req.body, g.leden);
      if (!herkend) return stuurFout(res, 400, 'Alleen `displayName` en `members` kunnen via SCIM worden gewijzigd.', 'invalidValue');
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
      if (b.displayName) scim.groepen.hernoem(req.scimOrg, g.id, b.displayName);
      const na = scim.groepen.zetLeden(req.scimOrg, g.id, b.members || []);
      meebewegen(req.scimOrg, [...new Set([].concat(g.leden, na.leden))], 'groep vervangen');
      stuurScim(res, 200, vorm.groep(na, BASIS));
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

  app.delete(BASIS + '/Groups/:id', remmen, scimAuth, (req, res) => {
    try {
      const g = scim.groepen.haalWeg(req.scimOrg, req.params.id);
      /* De groep is weg; de ACCOUNTS blijven. Meebewegen trekt alleen de rollen
         in die aan deze groep hingen -- een groep opheffen is geen ontslag. */
      meebewegen(req.scimOrg, g.leden, 'groep verwijderd');
      res.status(204).end();
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

};
