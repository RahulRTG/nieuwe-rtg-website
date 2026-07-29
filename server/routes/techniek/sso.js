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
const { log } = require('../../log');

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
      res.status(400).json({ error: e.message });
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
      res.status(502).json({ ok: false, error: e.message });
    }
  });
};
