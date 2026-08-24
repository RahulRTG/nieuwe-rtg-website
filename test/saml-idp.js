/* EEN NEP-IDENTITEITSPROVIDER, om er echte aanvallen mee te doen.

   Deze helper ondertekent SAML-asserties met een wegwerpsleutel, zodat de
   toetsen ernaast een GELDIG antwoord kunnen bouwen en het daarna kunnen
   verminken. Zonder dit is elke aanvalstoets een test op een kapot document,
   en dat bewijst niets: de vraag is nu juist of een document dat er perfect
   uitziet, en waarvan de handtekening WERKELIJK klopt, alsnog wordt geweigerd
   als hij het verkeerde stuk dekt.

   Er wordt hier bewust ondertekend met onze eigen canonicalisatie. Dat maakt
   deze helper geen onafhankelijke controle op c14n -- die staat apart in
   test/samlc14n.test.js, waar libxml2 (xmllint) de scheidsrechter is. */
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const X = require('../server/sso/saml/xml');
const { canoniek, EXCLUSIEF } = require('../server/sso/saml/c14n');

const PROTO = 'urn:oasis:names:tc:SAML:2.0:protocol';
const ASS = 'urn:oasis:names:tc:SAML:2.0:assertion';

/* Een wegwerpcertificaat. Nooit een sleutel in de repo: dat zou de secret-scan
   terecht rood maken. Ontbreekt openssl, dan is dit een HARDE fout en geen
   overgeslagen toets -- een stil overgeslagen aanvalstoets is precies het soort
   dekking-zonder-dekking waar LAT.md regel 9 over gaat. */
function sleutelpaar(cn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-idp-'));
  const k = path.join(dir, 'k.pem'), c = path.join(dir, 'c.pem');
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', k, '-out', c,
      '-days', '2', '-nodes', '-subj', '/CN=' + (cn || 'idp.test')], { stdio: 'ignore' });
  } catch (e) {
    throw new Error('openssl ontbreekt. Deze toets doet echte handtekeningaanvallen en wordt NIET overgeslagen: ' +
      'een aanvalstoets die zichzelf uitzet, geeft dekking zonder dekking.');
  }
  const uit = { key: fs.readFileSync(k, 'utf8'), cert: fs.readFileSync(c, 'utf8') };
  fs.rmSync(dir, { recursive: true, force: true });
  return uit;
}

const ALG = {
  'sha256': 'http://www.w3.org/2001/04/xmlenc#sha256',
  'sha1': 'http://www.w3.org/2000/09/xmldsig#sha1'
};
const TEKENALG = {
  'sha256': 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
  'sha1': 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  'hmac': 'http://www.w3.org/2000/09/xmldsig#hmac-sha256'
};

/* Onderteken een los element. `sjabloon` bevat {{SIG}} op de plek waar de
   handtekening hoort; de digest wordt berekend over het element ZONDER die
   plek -- dat is precies wat enveloped-signature betekent. */
function teken(sjabloon, id, opties) {
  const o = opties || {};
  const digestSoort = o.digest || 'sha256';
  const zonder = sjabloon.replace('{{SIG}}', '');
  const el = X.lees(zonder);
  const bytes = canoniek(el, EXCLUSIEF, [], null);
  const digest = crypto.createHash(digestSoort === 'sha1' ? 'sha1' : 'sha256').update(bytes).digest('base64');

  const si = '<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">' +
    '<ds:CanonicalizationMethod Algorithm="' + EXCLUSIEF + '"/>' +
    '<ds:SignatureMethod Algorithm="' + (TEKENALG[o.tekenAlg || 'sha256']) + '"/>' +
    '<ds:Reference URI="#' + (o.refUri || id) + '">' +
    '<ds:Transforms>' +
    '<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>' +
    '<ds:Transform Algorithm="' + EXCLUSIEF + '"/>' +
    '</ds:Transforms>' +
    '<ds:DigestMethod Algorithm="' + ALG[digestSoort] + '"/>' +
    '<ds:DigestValue>' + (o.digestWaarde || digest) + '</ds:DigestValue>' +
    '</ds:Reference></ds:SignedInfo>';

  const siBytes = canoniek(X.lees(si), EXCLUSIEF, [], null);
  const waarde = crypto.sign('sha256', siBytes, o.key).toString('base64');
  const sig = '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">' +
    si.replace(' xmlns:ds="http://www.w3.org/2000/09/xmldsig#"', '') +
    '<ds:SignatureValue>' + waarde + '</ds:SignatureValue></ds:Signature>';
  return sjabloon.replace('{{SIG}}', sig);
}

const nu = (ms) => new Date(ms).toISOString();

/* Een complete assertie, met {{SIG}} op de plek die de SAML-specificatie
   voorschrijft: direct na de Issuer. */
function assertie(a) {
  const t = a.tijd || Date.now();
  return '<saml:Assertion xmlns:saml="' + ASS + '" ID="' + a.id + '" Version="2.0" IssueInstant="' + nu(t) + '">' +
    '<saml:Issuer>' + a.issuer + '</saml:Issuer>' + (a.metSig === false ? '' : '{{SIG}}') +
    '<saml:Subject><saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:persistent">' + a.sub + '</saml:NameID>' +
    '<saml:SubjectConfirmation Method="urn:oasis:names:tc:SAML:2.0:cm:bearer">' +
    '<saml:SubjectConfirmationData NotOnOrAfter="' + nu(t + (a.bevestigingMs || 300000)) + '"' +
    ' Recipient="' + a.acs + '" InResponseTo="' + a.inResponseTo + '"/>' +
    '</saml:SubjectConfirmation></saml:Subject>' +
    '<saml:Conditions NotBefore="' + nu(t - 60000) + '" NotOnOrAfter="' + nu(t + (a.geldigMs === undefined ? 300000 : a.geldigMs)) + '">' +
    '<saml:AudienceRestriction><saml:Audience>' + a.publiek + '</saml:Audience></saml:AudienceRestriction>' +
    '</saml:Conditions>' +
    '<saml:AuthnStatement AuthnInstant="' + nu(t) + '"><saml:AuthnContext>' +
    '<saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:Password</saml:AuthnContextClassRef>' +
    '</saml:AuthnContext></saml:AuthnStatement>' +
    '<saml:AttributeStatement>' +
    '<saml:Attribute Name="email"><saml:AttributeValue>' + a.email + '</saml:AttributeValue></saml:Attribute>' +
    '<saml:Attribute Name="name"><saml:AttributeValue>' + (a.naam || 'Testpersoon') + '</saml:AttributeValue></saml:Attribute>' +
    (a.groepen || []).map(g => '<saml:Attribute Name="groups"><saml:AttributeValue>' + g + '</saml:AttributeValue></saml:Attribute>').join('') +
    '</saml:AttributeStatement></saml:Assertion>';
}

function response(inhoud, opties) {
  const o = opties || {};
  return '<samlp:Response xmlns:samlp="' + PROTO + '" ID="' + (o.id || '_resp1') + '" Version="2.0"' +
    ' IssueInstant="' + nu(o.tijd || Date.now()) + '" InResponseTo="' + (o.inResponseTo || '') + '">' +
    '<samlp:Status><samlp:StatusCode Value="' +
    (o.status || 'urn:oasis:names:tc:SAML:2.0:status:Success') + '"/></samlp:Status>' +
    inhoud + '</samlp:Response>';
}

/* Het normale, geldige antwoord. Alles wat de toetsen ernaast doen, is dit
   verminken. */
function geldig(p) {
  const sjabloon = assertie(p);
  const getekend = teken(sjabloon, p.id, { key: p.key });
  /* Het Response-ID is met opzet een ANDER dan dat van de assertie. Eerst
     stonden ze per ongeluk gelijk, en toen weigerde de controle het geldige
     antwoord al -- op de regel "twee elementen dragen hetzelfde ID". Dat is de
     regel die zijn werk doet, maar niet de aanval die we hier wilden bouwen. */
  return { xml: response(getekend, { id: '_resp' + p.id, tijd: p.tijd,
    inResponseTo: p.inResponseTo, status: p.status }), assertieXml: getekend, sjabloon };
}

module.exports = { sleutelpaar, teken, assertie, response, geldig, PROTO, ASS, nu };
