/* DE XML-HANDTEKENING, DE PROFIELGRENZEN (server/sso/saml/handtekening.js).

   controleer() beslist of een stuk XML werkelijk door de sleutel van de
   koppeling is ondertekend, en geeft het GEDEKTE element terug. De aanvallen
   (wrapping, zwakke algoritmen, ander ID) staan in test/samlxsw.test.js. Hier
   staan de profielgrenzen: een handtekening die structureel onvolledig is,
   meer dan één referentie heeft of buiten het document wijst -- en de twee
   sleutelsoorten naast RSA-PKCS1 (ECDSA en RSA-PSS) met ECHTE sleutels.

   Wat hier niet mag sneuvelen:
   1. zonder SignedInfo, SignatureMethod, DigestValue of SignatureValue geen
      geldige handtekening;
   2. precies één handtekening en precies één referentie, en die wijst binnen
      het document naar een bestaand ID;
   3. zonder enveloped-signature-transform weigeren (anders dekt hij zichzelf);
   4. een koppeling zonder certificaat controleert niets en laat dus niets door;
      een kaal base64-certificaat (zonder PEM-kop) werkt wel;
   3b. een transform buiten de lijst (XSLT, XPath) wordt nooit uitgevoerd;
   5. ECDSA-P256 en RSA-PSS worden echt geverifieerd; een kapotte waarde of een
      sleutel van de verkeerde soort (ook Ed25519, waar node:crypto op GOOIT)
      is een weigering, geen crash;
   6. de PrefixList van het exclusieve transform wordt gehonoreerd; zonder
      CanonicalizationMethod wordt SignedInfo inclusief gecanonicaliseerd.

   MUTATIES die zijn gedraaid en welke toets erop zakte (LAT.md regel 2):
   - `if (refs.length !== 1)` vervangen door `if (refs.length < 1)` -> "2."
     ZAKT (RAAK);
   - `if (teken.soort === 'ec') opties.dsaEncoding = ...` weggehaald -> "5."
     ZAKT (RAAK: de P1363-handtekening is dan geen geldige DER);
   - in transformsVan de PrefixList-regel weggehaald -> "6." ZAKT (RAAK: de
     digest komt niet meer overeen).

   Draai: node --test test/saml-handtekening-weerbaar.test.js */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto'), fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const X = require('../server/sso/saml/xml');
const { canoniek, EXCLUSIEF, INCLUSIEF } = require('../server/sso/saml/c14n');
const { controleer, DS } = require('../server/sso/saml/handtekening');
const idp = require('./saml-idp');

const ENV = DS + 'enveloped-signature';
const RSA = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const PSS = 'http://www.w3.org/2007/05/xmldsig-more#sha256-rsa-MGF1';
const ECDSA = 'http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256';
const rsa = idp.sleutelpaar('rsa.test');
function certPaar(soort) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-ec-'));
  try {
    execFileSync('openssl', ['req', '-x509', '-newkey', ...soort, '-keyout', path.join(dir, 'k'),
      '-out', path.join(dir, 'c'), '-days', '2', '-nodes', '-subj', '/CN=ec.test'], { stdio: 'ignore' });
    return { key: fs.readFileSync(path.join(dir, 'k'), 'utf8'), cert: fs.readFileSync(path.join(dir, 'c'), 'utf8') };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const ec = certPaar(['ec', '-pkeyopt', 'ec_paramgen_curve:prime256v1']);
const ed = certPaar(['ed25519']);

const DOC = '<a:Doc xmlns:a="urn:a" ID="_d"><a:Wie>pia</a:Wie>{{SIG}}<a:Lijst xmlns:xs="urn:xs"><a:W soort="xs:string">1</a:W></a:Lijst></a:Doc>';

/* Bouw een handtekening met precies de afwijking die de toets wil. */
function teken(o) {
  o = o || {};
  const prefix = o.prefix || [];
  const digest = crypto.createHash('sha256').update(canoniek(X.lees(DOC.replace('{{SIG}}', '')), EXCLUSIEF, prefix, null)).digest('base64');
  const inc = o.prefix ? '<ec:InclusiveNamespaces xmlns:ec="' + EXCLUSIEF + '"' + (o.prefix.length ? ' PrefixList="' + o.prefix.join(' ') + '"' : '') + '/>' : '';
  const tr = o.transforms !== undefined ? o.transforms
    : '<ds:Transforms><ds:Transform Algorithm="' + ENV + '"/><ds:Transform Algorithm="' + EXCLUSIEF + '">' + inc + '</ds:Transform></ds:Transforms>';
  const ref = '<ds:Reference URI="' + (o.uri || '#_d') + '">' + tr + '<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>' +
    (o.zonderDigest ? '' : '<ds:DigestValue>' + digest + '</ds:DigestValue>') + '</ds:Reference>';
  const si = '<ds:SignedInfo>' + (o.inclusief ? '' : '<ds:CanonicalizationMethod Algorithm="' + EXCLUSIEF + '"/>') +
    (o.zonderMethode ? '' : '<ds:SignatureMethod Algorithm="' + (o.methode || RSA) + '"/>') + ref.repeat(o.refs === undefined ? 1 : o.refs) + '</ds:SignedInfo>';
  const sig = '<ds:Signature xmlns:ds="' + DS + '">' + (o.zonderSi ? '' : si) + (o.zonderWaarde ? '' : '<ds:SignatureValue>WAARDE</ds:SignatureValue>') + '</ds:Signature>';
  let xml = DOC.replace('{{SIG}}', sig + (o.tweede ? sig : ''));
  if (!o.zonderSi && !o.zonderWaarde) {
    const w = X.lees(xml);
    const siEl = X.alle(w).find(e => e.ns === DS && e.naam === 'SignedInfo');
    const bytes = canoniek(siEl, o.inclusief ? INCLUSIEF : EXCLUSIEF, prefix, null);
    const m = o.methode || RSA, k = o.sleutel || rsa.key;
    const opt = m === ECDSA ? { key: k, dsaEncoding: 'ieee-p1363' } : m === PSS ? { key: k, padding: crypto.constants.RSA_PKCS1_PSS_PADDING } : k;
    xml = xml.replace('WAARDE', o.waarde || crypto.sign('sha256', bytes, opt).toString('base64'));
  }
  return X.lees(xml);
}
const ok = (o, cert) => assert.equal(controleer(teken(o), cert === undefined ? rsa.cert : cert).naam, 'Doc');
const nee = (o, patroon, cert) => assert.throws(() => controleer(teken(o), cert === undefined ? rsa.cert : cert), patroon);

test('1. structureel onvolledig: geen SignedInfo, methode, DigestValue of SignatureValue', () => {
  ok({});
  nee({ zonderSi: true }, /zonder SignedInfo/);
  nee({ zonderMethode: true }, /ondertekenmethode "null"/);
  nee({ zonderDigest: true }, /zonder DigestValue/);
  nee({ zonderWaarde: true }, /zonder SignatureValue/);
});

test('2. één handtekening, één referentie, binnen het document, naar een bestaand ID', () => {
  nee({ tweede: true }, /er staan 2 handtekeningen/);
  nee({ refs: 2 }, /heeft 2 referenties/);
  nee({ refs: 0 }, /heeft 0 referenties/);
  nee({ uri: 'https://kwaad.test/doc.xml#_d' }, /Alleen een verwijzing binnen dit document/);
  nee({ uri: '#_weg' }, /ID "_weg", en dat element bestaat niet/);
});

test('3. zonder enveloped-signature-transform weigeren', () => {
  nee({ transforms: '' }, /mist het enveloped-signature-transform/);
  nee({ transforms: '<ds:Transforms><ds:Transform Algorithm="' + EXCLUSIEF + '"/></ds:Transforms>' }, /mist het enveloped/);
  const xslt = '<ds:Transforms><ds:Transform Algorithm="' + ENV + '"/><ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xslt-19991116"/></ds:Transforms>';
  nee({ transforms: xslt }, /REC-xslt-19991116" wordt hier niet uitgevoerd/);
});

test('4. zonder certificaat niets; een kaal base64-certificaat wel', () => {
  nee({}, /geen ondertekencertificaat/, '   ');
  nee({}, /geen ondertekencertificaat/, null);
  const kaal = rsa.cert.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  ok({}, kaal);
});

test('5. ECDSA-P256 en RSA-PSS echt geverifieerd; kapot of verkeerde sleutelsoort is een weigering', () => {
  ok({ methode: ECDSA, sleutel: ec.key }, ec.cert);
  ok({ methode: PSS });
  nee({ methode: ECDSA, sleutel: ec.key, waarde: Buffer.alloc(64, 1).toString('base64') }, /niet van de sleutel van deze koppeling/, ec.cert);
  nee({ methode: ECDSA, sleutel: ec.key }, /niet van de sleutel/, rsa.cert);
  nee({ methode: PSS }, /niet van de sleutel/, ec.cert);
  nee({}, /niet van de sleutel/, ec.cert);
  nee({}, /niet van de sleutel/, ed.cert);
  nee({ methode: ECDSA, sleutel: ec.key }, /niet van de sleutel/, ed.cert);
});

test('6. PrefixList gehonoreerd; zonder CanonicalizationMethod inclusief', () => {
  ok({ prefix: ['xs'] });
  ok({ prefix: [] }, undefined);
  const metLijst = teken({ prefix: ['xs'] });
  const ref = X.alle(metLijst).find(e => e.naam === 'InclusiveNamespaces');
  ref.attrs = [];
  assert.throws(() => controleer(metLijst, rsa.cert), /na het ondertekenen veranderd/, 'zonder de PrefixList klopt de digest niet meer');
  ok({ inclusief: true });
});
