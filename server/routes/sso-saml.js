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

  /* ONZE EIGEN entityID EN ANTWOORDADRES -- UIT DE CONFIGURATIE, EN NERGENS
     ANDERS VANDAAN.

     Hier stond `appUrl(req)`, met een commentaar erboven dat zei dat deze twee
     nooit uit een kop van het verzoek komen. Dat commentaar klopte niet met de
     code: buiten productie valt appUrl(req) terug op de Origin-kop en anders op
     de Host-kop. En dat is hier geen schoonheidsfoutje maar een gat in de
     controle zelf -- `onzeId` is precies de waarde waartegen de Audience van
     een assertie wordt gehouden, en `acsAdres` de waarde waartegen de
     Recipient. Wie de kop mag verzinnen, verschuift dus het publiek dat wij
     accepteren, en dan controleert de Audience-toets zichzelf.

     `appUrl(null)` geeft de geconfigureerde basis en anders een lege string:
     zonder verzoek kan er ook geen kop in sluipen. Dat is met opzet dezelfde
     functie en geen tweede kopie van de configuratielogica.

     Is er geen basis geconfigureerd, dan gaat deze deur NIET open met een
     gegokte identiteit maar dicht MET de reden -- dezelfde keuze als bij de
     modus `sovereign`. Een SP die zijn eigen naam van de beller leert, heeft
     geen naam. */
  const basis = () => appUrl(null);
  const acsAdres = () => basis() + '/api/sso/saml/acs';
  const onzeId = () => basis() + '/saml/metadata';

  /* 404 EN GEEN 503, sinds de ladder van 25 augustus 2026. Zonder vast webadres
     bestaat SAML hier niet -- maar 'Service Unavailable' aan een naamloze beller
     is twee fouten in een: de ladder telt elke 5xx op een tokenloos verzoek als
     serverfout (een dwaler hoort een nette weigering te krijgen, geen storing),
     en de fouttekst vertelde een vreemde welke omgevingsvariabelen dit huis mist.
     Voor wie het aangaat (de beheerder die SAML inricht) staat de volledige
     uitleg in het logboek; de buitenwereld ziet alleen dat er hier niets is. */
  const zonderBasis = (res) => {
    if (basis()) return false;
    log.warn('saml geweigerd: geen vast webadres (APP_URL of RTG_DOMAIN); de entityID en het antwoordadres van een SP zijn identiteit en mogen niet uit de Host-kop komen');
    res.status(404).json({ error: 'SAML is hier niet ingericht.' });
    return true;
  };

  /* ---------- 1. de heenreis ---------- */
  app.get('/api/sso/saml/start', rem({ windowMs: 60000, limit: 30 }), (req, res) => {
    /* Eerst wat de beller STUURT, dan pas wat het huis mist: een dwaler zonder
       geldige org krijgt 404 en leert niets over de configuratie. */
    const k = saml.samlVan(req.query.org);
    if (!k || !k.actief) return res.status(404).json({ error: 'Onbekende of uitgezette SAML-koppeling.' });
    if (zonderBasis(res)) return;
    try {
      const { url } = saml.verzoekUrl(k, {
        acs: acsAdres(), entityId: onzeId(), terug: staat.veiligTerug(req.query.terug)
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
    if (zonderBasis(res)) return;

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
        entityId: onzeId(), acs: acsAdres(), verzoekId: verzoek.id
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
      const fout = binnenkomst.foutAntwoord(e);
      if (fout.retryAfter) res.set('retry-after', fout.retryAfter);
      res.status(fout.status).json({ error: fout.bericht });
    }
  });

  /* ---------- 3. onze metadata ----------
     Wat een klant bij zijn provider moet invullen. Bewust zonder
     ondertekencertificaat: wij ondertekenen het AuthnRequest niet, en een
     certificaat noemen dat nergens voor wordt gebruikt is een belofte zonder
     dekking. */
  app.get('/api/sso/saml/metadata', rem({ windowMs: 60000, limit: 30 }), (req, res) => {
    if (zonderBasis(res)) return;
    const xml = '<?xml version="1.0"?>' +
      '<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="' + esc(onzeId()) + '">' +
      '<SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"' +
      ' protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">' +
      '<NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:persistent</NameIDFormat>' +
      '<AssertionConsumerService index="0" isDefault="true"' +
      ' Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="' + esc(acsAdres()) + '"/>' +
      '</SPSSODescriptor></EntityDescriptor>';
    res.set('Content-Type', 'application/samlmetadata+xml').send(xml);
  });

  /* `>` hoort er ook in. Hij is in XML alleen verplicht na `]]`, maar een
     escape die vier van de vijf tekens pakt is precies de vorm waar een
     scanner over valt -- en terecht: wie hem later hergebruikt voor iets
     anders dan een attribuut, heeft een gat. */
  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
};
