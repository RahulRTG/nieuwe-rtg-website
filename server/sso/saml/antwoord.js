/* ============================================================================
   Van een SAML-antwoord naar hetzelfde claimcontract als OIDC.

   DE BELANGRIJKSTE REGEL VAN DIT BESTAND STAAT IN EEN REGEL CODE:

       if (!X.isNazaatVan(assertie, gecontroleerd)) weiger

   Alles wat hierna wordt gelezen -- het onderwerp, het adres, de groepen, de
   geldigheid -- komt UIT het stuk dat de handtekeningcontrole heeft
   teruggegeven. Niet uit "het document", niet uit "de eerste assertie". Dat is
   de enige structurele verdediging tegen XML Signature Wrapping: de controleur
   en de lezer kijken gegarandeerd naar dezelfde bytes.

   Daar bovenop staan twee gordels die elk op zichzelf de meeste XSW-varianten
   al tegenhouden: er mag maar EEN Assertion in het hele document staan, en er
   mag maar EEN Signature in staan (die tweede zit in handtekening.js).

   WAT ER VERDER WORDT GEEIST, en waarom elk ervan een aanval afsluit:

   - Issuer gelijk aan de entityID uit de koppeling. Anders ondertekent de
     provider van klant A een assertie namens klant B.
   - Audience gelijk aan ONZE entityID. Zonder die controle is een assertie die
     voor een andere dienst is uitgegeven, hier ook geldig -- dan is elke
     andere SP van dezelfde provider een sleutel tot dit huis.
   - NotBefore en NotOnOrAfter, met een krappe klokmarge. Een assertie zonder
     einde is een wachtwoord dat nooit verloopt.
   - InResponseTo hoort bij een verzoek dat WIJ hebben gestuurd en dat nog niet
     is gebruikt. Dat sluit de ongevraagde inlog af (IdP-initiated), en dat is
     een bewuste keuze: dat model bestaat, maar het maakt van een gestolen
     assertie een universele sleutel.
   - Recipient gelijk aan ons eigen antwoordadres.
   - Het assertie-ID is eenmalig. Herhaling is hergebruik.

   EN EEN VERSCHIL MET OIDC DAT NIET STIL MAG BLIJVEN. `sso/index.js` eist
   `email_verified: true`, want een OIDC-provider die zijn gebruikers zelf een
   adres laat intypen, mag hier niemand mee binnenhalen. SAML kent dat vlaggetje
   niet -- er is geen signaal om te honoreren. Wij zetten het hier dus op true,
   en dat is verdedigbaar om precies een reden: het adres staat in een assertie
   die met de sleutel van de koppeling is ondertekend, EN het moet binnen de
   domeinlijst van diezelfde koppeling vallen. De organisatie bevestigt dus haar
   eigen domein. Wie die domeinlijst leeg zou maken, haalt niet een gemakje weg
   maar deze hele redenering.
   ========================================================================== */
'use strict';
const X = require('./xml');
const { controleer } = require('./handtekening');

const PROTO = 'urn:oasis:names:tc:SAML:2.0:protocol';
const ASS = 'urn:oasis:names:tc:SAML:2.0:assertion';
const SUCCES = 'urn:oasis:names:tc:SAML:2.0:status:Success';
const BEARER = 'urn:oasis:names:tc:SAML:2.0:cm:bearer';
const MARGE_MS = 120000;                 // twee minuten klokverschil, niet meer

/* De namen waaronder providers een e-mailadres, een naam en groepen zetten.
   Een gesloten lijst: wie hier een naam bijzet, doet dat bewust. */
const ADRES = ['urn:oid:0.9.2342.19200300.100.1.3', 'urn:oid:1.2.840.113549.1.9.1',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress', 'email', 'mail', 'emailaddress'];
const NAAM = ['urn:oid:2.16.840.1.113730.3.1.241', 'urn:oid:2.5.4.3',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name', 'displayName', 'name', 'cn'];
const GROEP = ['http://schemas.xmlsoap.org/claims/Group', 'urn:oid:1.3.6.1.4.1.5923.1.5.1.1',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups', 'groups', 'memberOf', 'Group'];

function tijd(waarde) {
  if (!waarde) return null;
  const t = Date.parse(waarde);
  return Number.isFinite(t) ? t : NaN;
}

function attributen(assertie) {
  const uit = new Map();
  for (const houder of X.kinderen(assertie, ASS, 'AttributeStatement')) {
    for (const a of X.kinderen(houder, ASS, 'Attribute')) {
      const naam = X.attr(a, 'Name') || X.attr(a, 'FriendlyName');
      if (!naam) continue;
      const waarden = X.kinderen(a, ASS, 'AttributeValue').map(v => X.tekstVan(v).trim()).filter(Boolean);
      const bestaand = uit.get(naam) || [];
      uit.set(naam, bestaand.concat(waarden));
    }
  }
  return uit;
}
function eerste(attrs, namen) {
  for (const n of namen) { const v = attrs.get(n); if (v && v.length) return v[0]; }
  return null;
}
function alles(attrs, namen) {
  const uit = [];
  for (const n of namen) for (const v of attrs.get(n) || []) if (!uit.includes(v)) uit.push(v);
  return uit;
}

/* De hoofdingang. `verwacht` draagt wat WIJ weten en de afzender dus niet mag
   bepalen: onze entityID, ons antwoordadres, en het verzoek-ID dat wij hebben
   uitgegeven. */
function lees(xmlTekst, koppeling, verwacht, nu) {
  const nuMs = nu || Date.now();
  const wortel = X.lees(xmlTekst);
  if (wortel.ns !== PROTO || wortel.naam !== 'Response')
    throw new Error('dit is geen samlp:Response');

  /* Gordel een: precies EEN assertie in het hele document. Een tweede is per
     definitie een poging tot wrapping -- er bestaat geen eerlijke reden. */
  const asserties = X.alle(wortel).filter(el => el.ns === ASS && el.naam === 'Assertion');
  if (asserties.length !== 1)
    throw new Error('dit antwoord bevat ' + asserties.length + ' asserties. Er wordt er precies een verwacht; alles daarboven is een wrapping-aanval.');
  const assertie = asserties[0];

  const gecontroleerd = controleer(wortel, koppeling.samlCert);
  /* DE REGEL WAAR DIT BESTAND OM DRAAIT. */
  if (!X.isNazaatVan(assertie, gecontroleerd))
    throw new Error('de assertie ligt BUITEN het stuk dat is ondertekend. Precies dit is XML Signature Wrapping, en hier stopt het.');

  const status = X.kind(X.kind(wortel, PROTO, 'Status') || wortel, PROTO, 'StatusCode');
  if (!status || X.attr(status, 'Value') !== SUCCES)
    throw new Error('de provider meldt geen geslaagde inlog (' + (status ? X.attr(status, 'Value') : 'geen status') + ')');

  const issuer = X.kind(assertie, ASS, 'Issuer');
  const wie = issuer ? X.tekstVan(issuer).trim() : '';
  if (!wie || wie !== koppeling.samlEntityId)
    throw new Error('de assertie komt van "' + wie + '" en niet van de provider van deze koppeling');

  /* geldigheid en publiek */
  const cond = X.kind(assertie, ASS, 'Conditions');
  if (!cond) throw new Error('assertie zonder Conditions; dan is er geen geldigheidsduur en geen publiek');
  const vanaf = tijd(X.attr(cond, 'NotBefore'));
  const tot = tijd(X.attr(cond, 'NotOnOrAfter'));
  if (tot === null) throw new Error('deze assertie verloopt nooit (geen NotOnOrAfter). Geweigerd.');
  if (Number.isNaN(vanaf) || Number.isNaN(tot)) throw new Error('onleesbare geldigheidsdatum in de assertie');
  if (vanaf !== null && nuMs + MARGE_MS < vanaf) throw new Error('deze assertie geldt nog niet');
  if (nuMs - MARGE_MS >= tot) throw new Error('deze assertie is verlopen');

  const publiek = [];
  for (const r of X.kinderen(cond, ASS, 'AudienceRestriction'))
    for (const a of X.kinderen(r, ASS, 'Audience')) publiek.push(X.tekstVan(a).trim());
  if (!publiek.length) throw new Error('deze assertie noemt geen publiek; dan geldt hij overal en dus ook hier, en dat willen we niet');
  if (!publiek.includes(verwacht.entityId))
    throw new Error('deze assertie is voor ' + publiek.join(', ') + ' en niet voor ons');

  /* het onderwerp, en de bevestiging dat hij voor DEZE poging bedoeld is */
  const subject = X.kind(assertie, ASS, 'Subject');
  if (!subject) throw new Error('assertie zonder Subject');
  let bevestigd = false;
  for (const c of X.kinderen(subject, ASS, 'SubjectConfirmation')) {
    if (X.attr(c, 'Method') !== BEARER) continue;
    const d = X.kind(c, ASS, 'SubjectConfirmationData');
    if (!d) continue;
    const dtot = tijd(X.attr(d, 'NotOnOrAfter'));
    if (dtot === null || Number.isNaN(dtot) || nuMs - MARGE_MS >= dtot) continue;
    if (X.attr(d, 'Recipient') !== verwacht.acs) continue;
    if (X.attr(d, 'InResponseTo') !== verwacht.verzoekId) continue;
    bevestigd = true;
  }
  if (!bevestigd)
    throw new Error('geen bruikbare bevestiging: het antwoord hoort niet bij het verzoek dat wij hebben gestuurd, of het adres klopt niet');

  if (!X.kinderen(assertie, ASS, 'AuthnStatement').length)
    throw new Error('deze assertie zegt niet dat er iemand heeft ingelogd (geen AuthnStatement)');

  const nameId = X.kind(subject, ASS, 'NameID');
  const attrs = attributen(assertie);
  const email = String(eerste(attrs, ADRES) || (nameId && X.tekstVan(nameId)) || '').trim().toLowerCase();
  const sub = String((nameId && X.tekstVan(nameId).trim()) || email);
  if (!sub) throw new Error('de assertie noemt geen onderwerp');

  return {
    id: X.attr(assertie, 'ID') || null,
    tot,
    claims: {
      sub,
      email,
      /* zie de kop: geen vlaggetje om te honoreren, wel een ondertekende
         assertie binnen de domeinlijst van dezelfde koppeling */
      email_verified: true,
      name: eerste(attrs, NAAM) || null,
      groups: alles(attrs, GROEP)
    }
  };
}

module.exports = { lees, PROTO, ASS, MARGE_MS };
