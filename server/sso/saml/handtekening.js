/* ============================================================================
   XML-DSig controleren -- in een PROFIEL dat zo smal is dat de aanval er niet
   in past.

   XML Signature Wrapping (XSW) is geen fout in de wiskunde. De handtekening
   klopt; de aanvaller voegt gewoon een TWEEDE, ongetekende assertie toe en
   zorgt dat de controleur de echte pakt en de lezer daarna de valse. Elk
   verschil tussen "wat is er gecontroleerd" en "wat wordt er gelezen" is de
   aanval. Daarom werkt dit bestand niet met "is er ergens een geldige
   handtekening", maar met VIER harde koppelingen:

   1. HET ONDERTEKENDE ELEMENT IS DE OUDER VAN DE HANDTEKENING. Niet "een
      element met dat ID", niet "het eerste dat past" -- de directe ouder.
      Een handtekening die iets elders in het document dekt, is hier ongeldig,
      hoe geldig hij wiskundig ook is.
   2. HET ID VERWIJST NAAR PRECIES EEN ELEMENT. Twee elementen met hetzelfde ID
      is de klassieke wrapping-truc en levert hier een weigering, geen keuze.
   3. DE CONTROLE GEEFT HET ELEMENT TERUG, en de laag erboven leest UITSLUITEND
      daaruit (zie antwoord.js). De aanroeper krijgt dus niet "ja hoor" maar
      "dit stuk is gecontroleerd" -- dan kan hij niet per ongeluk iets anders
      lezen.
   4. ER MAG MAAR EEN HANDTEKENING IN HET DOCUMENT STAAN. Twee handtekeningen
      betekent dat iemand moet kiezen, en die keuze is precies wat een
      aanvaller wil sturen.

   WAT ER NIET MAG, met de reden:

   - GEEN SHA-1 en geen HMAC. SHA-1 is stuk; HMAC in XML-DSig betekent dat de
     ondertekensleutel een gedeeld geheim is, en wie dat kent maakt zelf een
     geldige assertie. Alleen RSA en ECDSA met SHA-256 of sterker.
   - GEEN sleutel uit KeyInfo. Het certificaat in het document is van de
     afzender, en de afzender is degene die we wantrouwen. De sleutel komt
     uitsluitend uit de koppeling die de eigenaar heeft ingericht.
   - GEEN XPath- of XSLT-transform. Alleen enveloped-signature en een
     canonicalisatie. Een transform die zelf kan kiezen welk stuk hij dekt, is
     een tweede lezing van het document -- en die hoort er nooit te zijn.
   ========================================================================== */
'use strict';
const crypto = require('crypto');
const X = require('./xml');
const { canoniek, EXCLUSIEF, INCLUSIEF, TOEGESTAAN } = require('./c14n');

const DS = 'http://www.w3.org/2000/09/xmldsig#';
const EC = 'http://www.w3.org/2001/10/xml-exc-c14n#';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/* Alleen deze. Een lijst die je uitbreidt met "voor de compatibiliteit" is de
   plek waar sha1 weer binnenkomt. */
const DIGEST = {
  'http://www.w3.org/2001/04/xmlenc#sha256': 'sha256',
  'http://www.w3.org/2001/04/xmldsig-more#sha384': 'sha384',
  'http://www.w3.org/2001/04/xmlenc#sha512': 'sha512'
};
const TEKEN = {
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256': { hash: 'sha256', soort: 'rsa' },
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha384': { hash: 'sha384', soort: 'rsa' },
  'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512': { hash: 'sha512', soort: 'rsa' },
  'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1': { hash: 'sha256', soort: 'pss' },
  'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256': { hash: 'sha256', soort: 'ec' },
  'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha384': { hash: 'sha384', soort: 'ec' }
};

const alg = (el) => (el ? X.attr(el, 'Algorithm') : null);

function gelijk(a, b) {
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* Van een certificaat (PEM of kale base64) naar een publieke sleutel. */
function sleutelUit(certificaat) {
  const ruw = String(certificaat || '').trim();
  if (!ruw) throw new Error('deze koppeling heeft geen ondertekencertificaat; dan valt er niets te controleren');
  const pem = ruw.includes('-----BEGIN')
    ? ruw
    : '-----BEGIN CERTIFICATE-----\n' + ruw.replace(/\s+/g, '').replace(/(.{64})/g, '$1\n').trim() + '\n-----END CERTIFICATE-----';
  return new crypto.X509Certificate(pem).publicKey;
}

/* Het element met dit ID -- en alleen als er precies EEN is. */
function bijId(wortel, id) {
  const raak = X.alle(wortel).filter(el => X.attr(el, 'ID') === id);
  if (raak.length > 1) throw new Error('twee elementen dragen ID "' + id + '". Dat is geen document maar een val.');
  return raak[0] || null;
}

function transformsVan(ref) {
  const houder = X.kind(ref, DS, 'Transforms');
  const lijst = houder ? X.kinderen(houder, DS, 'Transform') : [];
  let enveloped = false, c14nAlg = INCLUSIEF, prefixLijst = [];
  for (const t of lijst) {
    const a = alg(t);
    if (a === ENVELOPED) { enveloped = true; continue; }
    if (TOEGESTAAN.includes(a)) {
      c14nAlg = a;
      const inc = X.kind(t, EC, 'InclusiveNamespaces');
      if (inc) prefixLijst = String(X.attr(inc, 'PrefixList') || '').split(/\s+/).filter(Boolean);
      continue;
    }
    throw new Error('transform "' + a + '" wordt hier niet uitgevoerd. Alleen enveloped-signature en een canonicalisatie.');
  }
  if (!enveloped)
    throw new Error('de referentie mist het enveloped-signature-transform; dan dekt de handtekening zichzelf en klopt er niets van');
  return { c14nAlg, prefixLijst };
}

/* De controle. Geeft het GECONTROLEERDE element terug, niet true. */
function controleer(wortel, certificaat) {
  const handtekeningen = X.alle(wortel).filter(el => el.ns === DS && el.naam === 'Signature');
  if (!handtekeningen.length) throw new Error('dit antwoord draagt geen handtekening');
  if (handtekeningen.length > 1)
    throw new Error('er staan ' + handtekeningen.length + ' handtekeningen in dit document. Wie moet er dan kiezen? Geweigerd.');
  const sig = handtekeningen[0];

  const si = X.kind(sig, DS, 'SignedInfo');
  if (!si) throw new Error('handtekening zonder SignedInfo');
  const teken = TEKEN[alg(X.kind(si, DS, 'SignatureMethod'))];
  if (!teken) throw new Error('ondertekenmethode "' + alg(X.kind(si, DS, 'SignatureMethod')) +
    '" is hier niet toegestaan. Geen SHA-1, geen HMAC -- alleen RSA of ECDSA met SHA-256 of sterker.');

  const refs = X.kinderen(si, DS, 'Reference');
  if (refs.length !== 1)
    throw new Error('deze handtekening heeft ' + refs.length + ' referenties; het profiel staat er precies een toe');
  const ref = refs[0];

  const uri = X.attr(ref, 'URI');
  if (!uri || uri[0] !== '#')
    throw new Error('de referentie wijst naar "' + uri + '". Alleen een verwijzing binnen dit document (#ID) wordt gevolgd.');
  const gedekt = bijId(wortel, uri.slice(1));
  if (!gedekt) throw new Error('de handtekening verwijst naar ID "' + uri.slice(1) + '", en dat element bestaat niet');

  /* KOPPELING 1 -- en dit is de regel die XSW doodt. */
  if (sig.ouder !== gedekt)
    throw new Error('de handtekening zit niet IN het element dat hij dekt. Dat is de vorm van een wrapping-aanval, dus hier stopt het.');

  const hash = DIGEST[alg(X.kind(ref, DS, 'DigestMethod'))];
  if (!hash) throw new Error('digestmethode "' + alg(X.kind(ref, DS, 'DigestMethod')) + '" is hier niet toegestaan (geen SHA-1).');
  const dv = X.kind(ref, DS, 'DigestValue');
  if (!dv) throw new Error('referentie zonder DigestValue');

  const { c14nAlg, prefixLijst } = transformsVan(ref);
  const bytes = canoniek(gedekt, c14nAlg, prefixLijst, sig);
  const gerekend = crypto.createHash(hash).update(bytes).digest();
  const gemeld = Buffer.from(String(X.tekstVan(dv)).replace(/\s+/g, ''), 'base64');
  if (!gelijk(gerekend, gemeld))
    throw new Error('de inhoud komt niet overeen met de digest in de handtekening: dit stuk is na het ondertekenen veranderd');

  const siBytes = canoniek(si, alg(X.kind(si, DS, 'CanonicalizationMethod')) || INCLUSIEF, prefixLijst, null);
  const sv = X.kind(sig, DS, 'SignatureValue');
  if (!sv) throw new Error('handtekening zonder SignatureValue');
  const waarde = Buffer.from(String(X.tekstVan(sv)).replace(/\s+/g, ''), 'base64');

  const sleutel = sleutelUit(certificaat);
  const opties = { key: sleutel };
  if (teken.soort === 'ec') opties.dsaEncoding = 'ieee-p1363';
  if (teken.soort === 'pss') opties.padding = crypto.constants.RSA_PKCS1_PSS_PADDING;
  let ok = false;
  try { ok = crypto.verify(teken.hash, siBytes, opties, waarde); } catch (e) { ok = false; }
  if (!ok) throw new Error('de handtekening is niet van de sleutel van deze koppeling');

  return gedekt;
}

module.exports = { controleer, sleutelUit, bijId, DS, EXCLUSIEF };
