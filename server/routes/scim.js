/* ============================================================================
   De SCIM-endpoints: de deur waar de IdP van een klant zelf doorheen loopt.

   Dit is de enige plek in het systeem waar een BUITENSTAANDS SYSTEEM accounts
   mag aanmaken en uitzetten, zonder mens ertussen. De sleutel ligt bij de klant.
   Daarom staat er hier meer bewaking dan bij een gewone route:

   - een eigen rem, want een IdP die op hol slaat kan duizenden verzoeken per
     minuut sturen en dat mag de rest van het platform niet raken;
   - elke bewerking gaat door de organisatiegrens in server/scim/index.js;
   - alles wat er gebeurt gaat het logboek in met de ORG en het account-id,
     nooit met het e-mailadres of de naam. Ook hier geldt het codenaam-ontwerp:
     een logregel die "piet@klant.nl uit dienst" zegt, is een personeelsdossier
     in een logbestand.

   SCIM wil zijn eigen foutvorm (application/scim+json met een Error-envelop);
   een gewone {error:...} laat een IdP vaak stilvallen zonder leesbare melding
   voor de beheerder die het moet oplossen.
   ========================================================================== */
const rem = require('../rem');
const scim = require('../scim');
const vorm = require('../scim/vorm');
const filter = require('../scim/filter');
const { log } = require('../log');

const BASIS = '/api/scim/v2';
const MAX_PAGINA = 200;

module.exports = (kern) => {
  const { app, accounts } = kern;

  const stuurScim = (res, status, lichaam) =>
    res.status(status).set('content-type', 'application/scim+json; charset=utf-8').json(lichaam);
  const stuurFout = (res, status, detail, type) => stuurScim(res, status, vorm.fout(status, detail, type));

  /* De sleutel controleren en de organisatie eraan hangen. Faalt dit, dan komt
     er geen enkel signaal terug over of de sleutel bestond of alleen fout was. */
  function scimAuth(req, res, next) {
    const kop = req.get('authorization') || '';
    const sleutel = kop.startsWith('Bearer ') ? kop.slice(7).trim() : null;
    const org = sleutel ? scim.sleutels.vanSleutel(sleutel) : null;
    if (!org) {
      res.set('www-authenticate', 'Bearer realm="RTG SCIM"');
      return stuurFout(res, 401, 'Geen geldige SCIM-sleutel.');
    }
    req.scimOrg = org;
    next();
  }

  /* DE CASCADE BIJ UIT DIENST.

     Een SCIM-deactivatie zette tot nu toe het RTG-ACCOUNT uit. Wie via zijn
     werkgever ook in een werkruimte van het Werk OS zat, hield daar zijn
     lid-token -- en dat token werkt zonder RTG-account gewoon door, want een
     werkruimtelid is met opzet een eigen identiteit. "Uit dienst" bij de klant
     liet de werkplek dus openstaan.

     Hij draait SYNCHROON, binnen dit verzoek. Dat is de hele belofte: krijgt de
     IdP zijn 204, dan is de toegang in elke werkruimte van deze tenant al weg.
     Een wachtrij zou van uitdiensttreding een tijdvenster maken, en bij een
     ontslag op staande voet is dat venster precies het probleem. */
  function cascade(org, user) {
    if (!kern.tenant) return;
    try {
      const uit = kern.tenant.brug.deprovisioneer(org, 'user-' + user.id);
      if (uit.geraakt.length) log.warn('scim.werkruimte-ingetrokken', { org, id: user.id, werkruimtes: uit.geraakt.length });
    } catch (e) {
      log.error('scim.cascade mislukt', { org, id: user.id, fout: e.message });
    }
  }

  const remmen = rem({ windowMs: 60000, limit: 600 });

  /* ---------- ontdekking: wat kunnen wij ---------- */
  app.get(BASIS + '/ServiceProviderConfig', remmen, scimAuth, (req, res) =>
    stuurScim(res, 200, vorm.providerConfig(BASIS)));
  app.get(BASIS + '/ResourceTypes', remmen, scimAuth, (req, res) =>
    stuurScim(res, 200, vorm.resourceTypes(BASIS)));
  app.get(BASIS + '/Schemas', remmen, scimAuth, (req, res) =>
    stuurScim(res, 200, vorm.schemas(BASIS)));

  /* ---------- lijst en zoeken ---------- */
  app.get(BASIS + '/Users', remmen, scimAuth, (req, res) => {
    const f = filter.ontleed(req.query.filter);
    if (f.soort === 'onbekend') return stuurFout(res, 400, f.reden, 'invalidFilter');

    const naarScim = (u) => vorm.gebruiker(u, accounts.emailOf(u), BASIS);

    if (f.soort === 'gelijk') {
      /* De vraag "ken je deze al?". Een leeg antwoord is hier een geldig en
         belangrijk antwoord: de IdP maakt daarna het account aan. */
      const u = scim.zoekOpEmail(accounts, req.scimOrg, f.waarde);
      return stuurScim(res, 200, vorm.lijst(u ? [naarScim(u)] : [], { start: 1, aantal: u ? 1 : 0, totaal: u ? 1 : 0 }));
    }

    const alles = scim.accountsVan(accounts, req.scimOrg);
    const start = Math.max(1, Number(req.query.startIndex) || 1);
    const aantal = Math.max(1, Math.min(Number(req.query.count) || 100, MAX_PAGINA));
    const venster = alles.slice(start - 1, start - 1 + aantal);
    stuurScim(res, 200, vorm.lijst(venster.map(naarScim), { start, aantal, totaal: alles.length }));
  });

  app.get(BASIS + '/Users/:id', remmen, scimAuth, (req, res) => {
    try {
      const u = scim.lees(accounts, req.scimOrg, req.params.id);
      stuurScim(res, 200, vorm.gebruiker(u, accounts.emailOf(u), BASIS));
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

  /* ---------- aanmaken (in dienst) ---------- */
  app.post(BASIS + '/Users', remmen, scimAuth, async (req, res) => {
    try {
      const { user, bestond } = await scim.maak(accounts, req.scimOrg, req.body || {});
      log.info('scim.gebruiker', { org: req.scimOrg, id: user.id, bestond });
      stuurScim(res, bestond ? 200 : 201, vorm.gebruiker(user, accounts.emailOf(user), BASIS));
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

  /* ---------- bijwerken: alleen aan/uit ---------- */
  app.patch(BASIS + '/Users/:id', remmen, scimAuth, (req, res) => {
    const { actief, herkend } = scim.uitPatch(req.body);
    if (!herkend) return stuurFout(res, 400, 'Alleen het veld `active` kan via SCIM worden gewijzigd.', 'invalidValue');
    try {
      const u = scim.zetActief(accounts, req.scimOrg, req.params.id, actief);
      if (!actief) cascade(req.scimOrg, u);
      log.warn('scim.actief', { org: req.scimOrg, id: u.id, actief: u.actief === 1 });
      stuurScim(res, 200, vorm.gebruiker(u, accounts.emailOf(u), BASIS));
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

  /* PUT vervangt de hele bron. Wij lezen er alleen `active` uit -- de rest van
     de velden negeren we bewust (zie server/scim/index.js: de IdP mag de
     identiteitskluis niet overschrijven). */
  app.put(BASIS + '/Users/:id', remmen, scimAuth, (req, res) => {
    const aan = !(req.body && req.body.active === false);
    try {
      const u = scim.zetActief(accounts, req.scimOrg, req.params.id, aan);
      if (!aan) cascade(req.scimOrg, u);
      log.warn('scim.actief', { org: req.scimOrg, id: u.id, actief: u.actief === 1, via: 'put' });
      stuurScim(res, 200, vorm.gebruiker(u, accounts.emailOf(u), BASIS));
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });

  /* De groepen staan in ./scim-groepen.js: dit bestand ging er met 11.874 bytes
     van over de 10 kB van keuringsregel 13, en de naad is echt -- hier staan de
     MENSEN, daar staan de verzamelingen waar ze in zitten. */
  require('./scim-groepen')({ app, kern, accounts, scim, vorm, filter, log,
    BASIS, remmen, scimAuth, stuurScim, stuurFout });

  /* ---------- uit dienst ----------
     DELETE zet op non-actief en wist niets. Zie de kop van server/scim/index.js
     voor waarom dat geen halve maatregel is maar de juiste. */
  app.delete(BASIS + '/Users/:id', remmen, scimAuth, (req, res) => {
    try {
      const u = scim.zetActief(accounts, req.scimOrg, req.params.id, false);
      cascade(req.scimOrg, u);
      log.warn('scim.uitdienst', { org: req.scimOrg, id: u.id });
      res.status(204).end();
    } catch (e) { stuurFout(res, e.status || 400, e.message, e.scimType); }
  });
};
