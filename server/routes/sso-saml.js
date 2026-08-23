/* ============================================================================
   De SAML-deur: heenreis, antwoordadres, en de metadata die een klant nodig
   heeft om zijn provider in te richten.

   DEZE DEUR KOMT UIT OP HETZELFDE CLAIMCONTRACT ALS OIDC, en dat is de eis
   waaraan hij is gebouwd. Wat hier binnenkomt wordt tot
   `{ sub, email, email_verified, name, groups }` teruggebracht en gaat dan door
   sso/binnenkomst.js -- dezelfde vijf stappen, dezelfde identiteitsbrug,
   hetzelfde overdrachtsbewijs. Er staat in binnenkomst.js geen enkele
   `if (saml)`, en dat hoort zo te blijven.

   DE FAALVORM VAN DEZE LAAG IS EEN STILLE AUTHENTICATIE-BYPASS, en niet een
   foutmelding. Daarom staat de controle zelf niet hier maar in sso/saml/, met
   de aanvallen in test/samlxsw.test.js: XML Signature Wrapping, een
   handtekening over een ander element, een ongetekende assertie, een verlopen
   assertie en een verkeerd publiek. Deze route doet alleen het vervoer.

   WAAROM HET ANTWOORDADRES ZIJN EIGEN BODY LEEST. De provider POST een
   formulier (application/x-www-form-urlencoded), en de web-laag hier kent
   alleen JSON. In plaats van een tweede body-parser voor de hele server te
   zetten, leest deze ene route zijn eigen bytes met de hulp die er al is
   (web/body.js). Een parser die overal draait voor een deur die eens per inlog
   opengaat, is een grotere verandering dan het probleem.
   ========================================================================== */
const rem = require('../rem');
const koppelingen = require('../sso/koppelingen');
const saml = require('../sso/saml');
const antwoord = require('../sso/saml/antwoord');
const binnenkomst = require('../sso/binnenkomst');
const staat = require('../sso/staat');
const { leesBody } = require('../web/body');
const { log } = require('../log');

module.exports = (kern) => {
  const { app, appUrl, logInlog } = kern;

  /* Onze eigen entityID en antwoordadres. Ze komen uit de configuratie en NOOIT
     uit een kop van het verzoek: wie de Host-kop mag verzinnen, zou anders het
     publiek van een assertie kunnen verschuiven -- en dan controleert de
     Audience-toets zichzelf. */
  const acsAdres = (req) => appUrl(req) + '/api/sso/saml/acs';
  const onzeId = (req) => appUrl(req) + '/saml/metadata';

  /* ---------- 1. de heenreis ---------- */
  app.get('/api/sso/saml/start', rem({ windowMs: 60000, limit: 30 }), (req, res) => {
    const k = saml.samlVan(req.query.org);
    if (!k || !k.actief) return res.status(404).json({ error: 'Onbekende of uitgezette SAML-koppeling.' });
    try {
      const { url } = saml.verzoekUrl(k, {
        acs: acsAdres(req), entityId: onzeId(req), terug: staat.veiligTerug(req.query.terug)
      });
      res.redirect(302, url);
    } catch (e) {
      log.warn('saml.start mislukt', { org: k.org, fout: e.message });
      res.status(502).json({ error: 'De identiteitsprovider van uw organisatie is niet bereikbaar.' });
    }
  });

  /* ---------- 2. het antwoordadres ---------- */
  const formulier = (req, res, next) => {
    if (req._body) return next();
    leesBody(req, 1024 * 1024, (err, buf) => {
      if (err) return next(err);
      req._body = true;
      req.formulier = new URLSearchParams(buf.toString('utf8'));
      next();
    });
  };

  app.post('/api/sso/saml/acs', rem({ windowMs: 60000, limit: 30 }), formulier, async (req, res) => {
    const velden = req.formulier || new URLSearchParams('');
    const relay = String(velden.get('RelayState') || '');
    const rauw = String(velden.get('SAMLResponse') || '');
    if (!rauw) return res.status(400).json({ error: 'Er kwam geen SAML-antwoord mee.' });

    /* RelayState draagt ONS verzoek-ID en niets anders. De 80-byte grens van de
       specificatie laat geen versleutelde state toe zoals bij OIDC, dus het
       verzoek zelf staat in de database (sso/saml/index.js) en dit is de sleutel
       erheen. Hij wordt bij het ophalen meteen verwijderd. */
    const verzoek = relay ? saml.neemVerzoekBijId(relay) : null;
    if (!verzoek) return res.status(400).json({ error: 'Deze inlogpoging is verlopen of niet van ons. Probeer opnieuw.' });

    const k = koppelingen.vind(verzoek.org);
    const s = saml.samlVan(verzoek.org);
    if (!k || !k.actief || !s) return res.status(404).json({ error: 'Deze SAML-koppeling bestaat niet meer.' });

    try {
      const xml = Buffer.from(rauw.replace(/\s+/g, ''), 'base64').toString('utf8');
      const uit = antwoord.lees(xml, s, {
        entityId: onzeId(req), acs: acsAdres(req), verzoekId: verzoek.id
      });
      /* Eenmalig gebruik. Dit staat NA de controle en niet ervoor: een assertie
         die de controle niet haalt, hoort de teller van een geldige niet te
         kunnen verbranden. */
      if (!saml.markeerGebruikt(uit.id, s.org, uit.tot))
        throw new Error('deze assertie is al een keer ingewisseld');

      await binnenkomst.binnen(kern, k, uit.claims, req, res, verzoek.terug, 'saml');
    } catch (e) {
      /* De reden gaat het logboek in en niet het antwoord. "de assertie ligt
         buiten het ondertekende stuk" is precies de terugkoppeling waarmee
         iemand zijn volgende poging bijstelt. */
      log.warn('saml.acs geweigerd', { org: verzoek.org, fout: e.message });
      if (typeof logInlog === 'function') logInlog('sso', false, verzoek.org, req);
      res.status(401).json({ error: 'Inloggen via uw organisatie is niet gelukt.' });
    }
  });

  /* ---------- 3. onze metadata ----------
     Wat een klant bij zijn provider moet invullen. Bewust zonder
     ondertekencertificaat: wij ondertekenen het AuthnRequest niet, en een
     certificaat noemen dat nergens voor wordt gebruikt is een belofte zonder
     dekking. */
  app.get('/api/sso/saml/metadata', rem({ windowMs: 60000, limit: 30 }), (req, res) => {
    const xml = '<?xml version="1.0"?>' +
      '<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="' + esc(onzeId(req)) + '">' +
      '<SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"' +
      ' protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">' +
      '<NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat>' +
      '<AssertionConsumerService index="0" isDefault="true"' +
      ' Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="' + esc(acsAdres(req)) + '"/>' +
      '</SPSSODescriptor></EntityDescriptor>';
    res.set('Content-Type', 'application/samlmetadata+xml').send(xml);
  });

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }
};
