/* ============================================================================
   Het beheer van de SSO-koppelingen. Alles achter techAuth + eigenaarAlleen.

   Niet uit voorzichtigheid, maar omdat wie hier mag schrijven, bepaalt wie er
   in het hele platform binnenkomt. Een koppeling aanmaken met een domein dat je
   niet bezit, is de kortste weg naar andermans account (zie sso/koppelingen.js).
   Dat besluit hoort bij een mens die er verantwoordelijk voor is, en dat is de
   eigenaar.

   Wat hier NOOIT teruggegeven wordt: het client-geheim. Het gaat er wel in en
   het wordt versleuteld bewaard, maar het komt er via deze weg niet meer uit.
   Een beheerscherm dat geheimen toont, is een beheerscherm dat geheimen lekt
   zodra iemand meekijkt of een schermafdruk maakt. Kwijt betekent: nieuwe
   aanvragen bij de provider, en dat is de bedoeling.

   Gemount vanuit routes/techniek.js. */
const sso = require('../../sso');
const koppelingen = require('../../sso/koppelingen');
const oidc = require('../../sso/oidc');
const jwks = require('../../sso/jwks');
const scim = require('../../scim');
const saml = require('../../sso/saml');
const { log } = require('../../log');

const { veiligeFout } = require('../../kern/util');
module.exports = (tctx) => {
  const { app, accounts, techAuth, eigenaarAlleen } = tctx;

  const wie = (req) => {
    try { return req.techUser ? accounts.realNameOf(req.techUser) : null; }
    catch (e) { return null; }
  };

  /* Het overzicht. Per koppeling ook hoeveel mensen er via binnen zijn gekomen
     -- een aantal, geen namen. */
  app.get('/api/techniek/sso', techAuth, eigenaarAlleen, (req, res) => {
    const lijst = koppelingen.lijst().map(k => ({
      ...k, geheimGezet: !!koppelingen.geheimVan(k.org),
      identiteiten: sso.identiteitenVan(k.org).length
    }));
    res.json({ koppelingen: lijst });
  });

  /* Aanmaken of wijzigen. Laat je clientSecret weg bij een wijziging, dan blijft
     het bestaande geheim staan (zie sso/koppelingen.js). */
  app.post('/api/techniek/sso', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    try {
      const k = koppelingen.zet({
        org: b.org, naam: b.naam, issuer: b.issuer, clientId: b.clientId,
        clientSecret: b.clientSecret, domeinen: b.domeinen, actief: b.actief
      });
      /* De ontdekking en de sleutelbos van deze provider opnieuw ophalen: anders
         blijft een gewijzigde issuer een uur lang op het oude adres kijken. */
      oidc.leegOntdek(k.issuer);
      jwks.leeg();
      log.info('sso.koppeling gezet', { org: k.org, door: wie(req), domeinen: k.domeinen.length });
      res.json({ ok: true, koppeling: k });
    } catch (e) {
      res.status(400).json({ error: veiligeFout(e) });
    }
  });

  /* Uitzetten zonder weggooien: de koppeling blijft staan (en daarmee de
     verwijzingen naar de accounts), maar er komt niemand meer mee binnen. Dit
     is wat je wilt bij een vermoeden -- weggooien maakt het onderzoek moeilijker. */
  app.post('/api/techniek/sso/schakel', techAuth, eigenaarAlleen, (req, res) => {
    const k = koppelingen.vind(req.body && req.body.org);
    if (!k) return res.status(404).json({ error: 'Onbekende koppeling.' });
    const uit = koppelingen.zet({ ...k, clientId: k.clientId, actief: !k.actief });
    log.warn('sso.koppeling geschakeld', { org: k.org, actief: uit.actief, door: wie(req) });
    res.json({ ok: true, koppeling: uit });
  });

  /* Echt weg. De gekoppelde accounts blijven bestaan -- dat zijn mensen met
     boekingen en facturen; die verdwijnen niet omdat een koppeling verdwijnt.
     Ze kunnen alleen niet meer via deze provider naar binnen. */
  app.delete('/api/techniek/sso/:org', techAuth, eigenaarAlleen, (req, res) => {
    const weg = koppelingen.weg(req.params.org);
    if (!weg) return res.status(404).json({ error: 'Onbekende koppeling.' });
    oidc.leegOntdek(weg.issuer);
    jwks.leeg();
    log.warn('sso.koppeling verwijderd', { org: weg.org, door: wie(req) });
    res.json({ ok: true, verwijderd: weg.org });
  });

  /* ---------- de SCIM-sleutel van een organisatie ----------

     Deze sleutel laat de IdP van een klant accounts aanmaken en uitzetten. Hij
     wordt EEN KEER getoond, hier, en daarna nooit meer -- ook niet aan de
     eigenaar. Kwijt = een nieuwe draaien, en dan is de oude meteen dood. */
  app.post('/api/techniek/sso/scimsleutel', techAuth, eigenaarAlleen, (req, res) => {
    const k = koppelingen.vind(req.body && req.body.org);
    if (!k) return res.status(404).json({ error: 'Maak eerst de SSO-koppeling aan; een SCIM-sleutel hoort bij een organisatie.' });
    const nieuw = scim.sleutels.draai(k.org);
    log.warn('scim.sleutel gedraaid', { org: k.org, door: wie(req) });
    res.json({
      ok: true, org: k.org, sleutel: nieuw.sleutel, hint: nieuw.hint,
      let_op: 'Dit is het enige moment waarop deze sleutel te zien is. Zet hem nu in de SCIM-instellingen van de klant.',
      endpoint: '/api/scim/v2'
    });
  });

  app.delete('/api/techniek/sso/scimsleutel/:org', techAuth, eigenaarAlleen, (req, res) => {
    if (!scim.sleutels.weg(req.params.org)) return res.status(404).json({ error: 'Deze organisatie heeft geen SCIM-sleutel.' });
    log.warn('scim.sleutel ingetrokken', { org: String(req.params.org).toLowerCase(), door: wie(req) });
    res.json({ ok: true });
  });

  /* ---------- de SAML-kant van dezelfde koppeling ----------

     Geen tweede koppeling maar drie velden erbij op de bestaande: of een
     organisatie via OIDC of via SAML binnenkomt, is een eigenschap van die
     koppeling. Twee koppelingen zouden twee domeinlijsten betekenen die uiteen
     kunnen lopen -- en de domeinlijst IS de beveiliging.

     Het certificaat wordt hier meteen gelezen. Een certificaat dat pas bij de
     eerste inlog onleesbaar blijkt, is een storing op het slechtste moment. */
  app.post('/api/techniek/sso/saml', techAuth, eigenaarAlleen, (req, res) => {
    const b = req.body || {};
    try {
      const uit = saml.zetSaml({ org: b.org, entityId: b.entityId, ssoUrl: b.ssoUrl, certificaat: b.certificaat });
      log.info('sso.saml gezet', { org: uit.org, door: wie(req) });
      res.json({ ok: true, saml: { org: uit.org, samlEntityId: uit.samlEntityId, samlSsoUrl: uit.samlSsoUrl },
        let_op: 'Vul bij uw provider ons antwoordadres /api/sso/saml/acs in. Onze metadata staat op /api/sso/saml/metadata.' });
    } catch (e) {
      res.status(400).json({ error: veiligeFout(e) });
    }
  });

  /* De proef op de som: bereikt de server de provider, en klopt zijn discovery?
     Dit is de knop die je wilt hebben VOOR je de eerste medewerker laat
     inloggen, niet erna. */
  app.post('/api/techniek/sso/proef', techAuth, eigenaarAlleen, async (req, res) => {
    const k = koppelingen.vind(req.body && req.body.org);
    if (!k) return res.status(404).json({ error: 'Onbekende koppeling.' });
    try {
      oidc.leegOntdek(k.issuer);
      const doc = await oidc.ontdek(k.issuer);
      const bos = await jwks.maakBos().bos(doc.jwks_uri);
      res.json({
        ok: true, issuer: doc.issuer,
        inlogAdres: doc.authorization_endpoint, tokenAdres: doc.token_endpoint,
        sleutels: bos.keys.length,
        algoritmen: (doc.id_token_signing_alg_values_supported || []).filter(a => a === 'RS256' || a === 'ES256')
      });
    } catch (e) {
      res.status(502).json({ ok: false, error: veiligeFout(e) });
    }
  });
};
