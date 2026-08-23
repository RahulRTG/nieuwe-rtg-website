/* ============================================================================
   De publieke SSO-routes: de heenreis naar de provider van een klant en de
   terugreis met een code.

   Deze drie routes MOETEN zonder inlog werken -- inloggen is nu juist wat er
   gaat gebeuren. Ze staan daarom ook in de lijst van scripts/poortwacht.js, met
   dezelfde reden erbij.

   WAAROM ER GEEN SESSIETOKEN IN DE TERUGKEER-URL STAAT

   Het zou een regel schelen om de bezoeker terug te sturen naar
   /apps/app.html?token=<sessietoken>. Dat is precies wat je niet moet doen: een
   URL belandt in de browsergeschiedenis, in de Referer-kop naar elke volgende
   partij, en in de access log van elke proxy ertussen. Een sessietoken van
   dertig dagen op al die plekken is een lek dat je niet meer terugdraait.

   Daarom gaat er een OVERDRACHTSBEWIJS mee: een doelgebonden token van zestig
   seconden dat nergens anders voor deugt. De app ruilt dat via een POST om voor
   het echte sessietoken, en het bewijs wordt bij die ruil ingetrokken -- ook als
   het nog een halve minuut geldig was. Een tweede poging krijgt niets.
   ========================================================================== */
const rem = require('../rem');
const sso = require('../sso');
const koppelingen = require('../sso/koppelingen');
const oidc = require('../sso/oidc');
const staat = require('../sso/staat');
const { log } = require('../log');

const OVERDRACHT = 'sso-overdracht';
const OVERDRACHT_MS = 60000;

module.exports = (kern) => {
  const { app, accounts, appUrl, stateFor, logInlog } = kern;

  /* Het adres waar de provider naartoe terugstuurt. Dit moet BIT VOOR BIT
     gelijk zijn aan wat er bij de provider is geregistreerd, en het moet uit
     onze eigen configuratie komen -- niet uit een kop van het verzoek. Wie de
     Host-kop mag verzinnen, zou anders de terugkeer naar zijn eigen server
     kunnen laten wijzen, en dan levert de provider de code daar af. */
  const terugAdres = (req) => appUrl(req) + '/api/sso/terug';

  /* ---------- 1. waar hoort dit adres thuis? ----------
     Het inlogscherm vraagt dit zodra iemand zijn werkmail typt. Het antwoord
     zegt hoogstens "dit domein logt in via zijn eigen provider" -- geen namen,
     geen aantallen, geen bevestiging dat een account bestaat. */
  app.post('/api/sso/waarheen', rem({ windowMs: 60000, limit: 20 }), (req, res) => {
    const k = koppelingen.vindVoorEmail(req.body && req.body.email);
    if (!k) return res.json({ sso: false });
    res.json({ sso: true, org: k.org, naam: k.naam, start: '/api/sso/start?org=' + encodeURIComponent(k.org) });
  });

  /* ---------- 2. de heenreis ---------- */
  app.get('/api/sso/start', rem({ windowMs: 60000, limit: 30 }), async (req, res) => {
    const k = koppelingen.vind(req.query.org);
    if (!k || !k.actief) return res.status(404).json({ error: 'Onbekende of uitgezette SSO-koppeling.' });
    try {
      const doc = await oidc.ontdek(k.issuer);
      const verifier = staat.maakVerifier();
      const nonce = staat.maakNonce();
      const state = staat.inpakken({ org: k.org, nonce, verifier, terug: req.query.terug });
      const adres = oidc.startAdres(doc, {
        clientId: k.clientId, redirectUri: terugAdres(req), state, nonce,
        challenge: staat.challengeVan(verifier),
        // alleen als hint; we geloven straks uitsluitend het ondertekende token
        hint: typeof req.query.hint === 'string' ? req.query.hint.slice(0, 120) : null
      });
      res.redirect(302, adres);
    } catch (e) {
      log.warn('sso.start mislukt', { org: k.org, fout: e.message });
      res.status(502).json({ error: 'De identiteitsprovider is nu niet bereikbaar.' });
    }
  });

  /* ---------- 3. de terugreis ----------
     Alles wat hier binnenkomt is door de browser van de bezoeker gegaan en is
     dus onbetrouwbaar, inclusief de code. De state pakken we eerst uit: klopt
     die niet, dan is er niets om verder te doen. */
  app.get('/api/sso/terug', rem({ windowMs: 60000, limit: 30 }), async (req, res) => {
    const fout = (bericht, code) => res.status(code || 400).json({ error: bericht });

    if (req.query.error) {
      // de provider zelf wees het af (gebruiker klikte "nee", of geen toegang)
      log.info('sso.terug afgewezen door provider', { fout: String(req.query.error).slice(0, 80) });
      return fout('De identiteitsprovider heeft de inlog afgewezen.', 401);
    }
    const s = staat.uitpakken(req.query.state);
    if (!s) return fout('Deze inlogpoging is verlopen of niet geldig. Probeer opnieuw.', 400);
    if (!req.query.code) return fout('De provider stuurde geen code mee.', 400);

    const k = koppelingen.vind(s.org);
    if (!k || !k.actief) return fout('Deze SSO-koppeling bestaat niet meer.', 404);

    try {
      const doc = await oidc.ontdek(k.issuer);
      const { claims } = await oidc.wisselCode(doc, {
        clientId: k.clientId, clientSecret: koppelingen.geheimVan(k.org),
        redirectUri: terugAdres(req), code: req.query.code, verifier: s.verifier
      }, { nonce: s.nonce });

      const { user, nieuw, gekoppeld } = await sso.aanmelden(accounts, k, claims);
      /* Wat er WEL in het logboek komt: dat er is ingelogd, via welke koppeling,
         en of het een nieuw account was. Niet het e-mailadres, niet de naam --
         het codenaam-ontwerp geldt ook voor onze eigen logregels. */
      log.info('sso.inlog', { org: k.org, codenaam: user.codename, nieuw, gekoppeld });
      if (typeof logInlog === 'function') logInlog('sso', true, k.org, req);

      /* DE IDENTITEITSBRUG. Tot hier ging dit over een RTG-account; een
         werkruimte van het Werk OS werkt met een eigen lid. De brug legt die
         twee aan elkaar aan de hand van de groepen die de provider meestuurt --
         en doet NIETS zolang de beheerder van die werkruimte geen groep aan een
         rol heeft gekoppeld (kern/tenant/brug.js).

         De claim heet `groups`: één bron, geen tweede naam ernaast. Wat de
         provider niet meestuurt, bestaat voor deze ronde niet.

         Een fout hier laat de INLOG staan en wordt luid gelogd. Dit gaat over
         de werkplek en niet over het account; iemand buitensluiten uit zijn
         eigen RTG-omgeving omdat een journaalregel in een werkruimte niet
         wegkwam, is het verkeerde antwoord op het verkeerde probleem. Dat het
         misging mag alleen nooit stil zijn -- dan lopen rollen ongemerkt uit de
         pas met de provider. */
      try {
        if (kern.tenant) {
          const uit = kern.tenant.brug.uitClaims(k.org, claims.groups, 'user-' + user.id, claims.name);
          if (uit.ok && uit.werkruimtes.length) log.info('tenant.brug', { org: k.org, werkruimtes: uit.werkruimtes.length });
        }
      } catch (e) {
        log.error('tenant.brug mislukt', { org: k.org, fout: e.message });
      }

      const bewijs = accounts.issueActionToken(user.id, OVERDRACHT, OVERDRACHT_MS);
      const pas = user.tier === 'lifestyle' || user.tier === 'business' ? user.tier : 'rtg';
      res.redirect(302, '/apps/app.html?pas=' + pas + '&sso=' + encodeURIComponent(bewijs) +
        '&terug=' + encodeURIComponent(s.terug));
    } catch (e) {
      /* De reden gaat het logboek in, niet het antwoord: "dit adres valt buiten
         de domeinen van deze koppeling" vertelt een buitenstaander meer over
         onze inrichting dan hij hoort te weten. */
      log.warn('sso.terug mislukt', { org: k.org, fout: e.message });
      if (typeof logInlog === 'function') logInlog('sso', false, k.org, req);
      return fout('Inloggen via uw organisatie is niet gelukt.', 401);
    }
  });

  /* ---------- 4. het bewijs omruilen voor een echt sessietoken ----------
     Een POST, zodat hij niet in de geschiedenis of een Referer belandt. */
  app.post('/api/sso/wissel', rem({ windowMs: 60000, limit: 30 }), (req, res) => {
    const bewijs = req.body && req.body.sso;
    const user = bewijs ? accounts.verifyActionToken(bewijs, OVERDRACHT) : null;
    if (!user) return res.status(401).json({ error: 'Dit overdrachtsbewijs is verlopen of al gebruikt.' });
    // meteen intrekken: een bewijs is voor een keer, niet voor zestig seconden
    accounts.trekInActie(bewijs, OVERDRACHT);
    const token = accounts.issueToken(user.id);
    const sess = { tier: user.tier, key: 'user-' + user.id, account: user };
    res.json({ token, state: stateFor(sess, req.body.lang) });
  });
};
