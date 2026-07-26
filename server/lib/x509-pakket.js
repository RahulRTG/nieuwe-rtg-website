/* X.509, deel "lijsten en verpakking": de CRL (ingetrokken certificaten), de
   CSR voor ACME, en het omzetten tussen DER en PEM. Losgetrokken uit x509.js
   omdat dat bestand boven de 10 KB kwam; het maken van certificaten staat daar,
   dit is wat je ermee verstuurt en opslaat.

   De gedeelde bouwstenen (asn1, de OID-tabel, extensie()) komen uit x509.js
   zelf. Die geeft ze mee bij het laden, zodat er geen kringverwijzing ontstaat:
   x509 -> x509-pakket, en niet terug. */
'use strict';
const crypto = require('crypto');
const a = require('./asn1');

module.exports = ({ OID, extensie, algId, naam, serieel, derVeld, akiExt, sanExtWaarde }) => {
  /* Een CRL (RFC 5280): de door de CA ondertekende lijst van ingetrokken serials.
     Interne clients halen die op om een ingetrokken cert te weigeren. */
  function maakCRL(o) {
    const nu = new Date();
    const thisUpd = o.thisUpdate || nu;
    const nextUpd = o.nextUpdate || new Date(nu.getTime() + (o.geldigDagen || 7) * 86400000);
    const rev = (o.ingetrokken || []).map(r => a.seq(
      a.integer(Buffer.isBuffer(r.serial) ? r.serial : Buffer.from(String(r.serial), 'hex')),
      a.tijd(r.datum ? new Date(r.datum) : nu)));
    const crlExts = [];
    if (o.issuerSkiDer) crlExts.push(akiExt(o.issuerSkiDer));
    if (o.nummer != null) crlExts.push(extensie(OID.crlNumber, false, a.integer(o.nummer)));
    const delen = [a.integer(1), algId(o.issuerKey.type), naam(o.issuerNaam), a.tijd(thisUpd), a.tijd(nextUpd)];
    if (rev.length) delen.push(a.seq(...rev));
    if (crlExts.length) delen.push(a.context(0, a.seq(...crlExts)));
    const tbs = a.seq(...delen);
    const sig = crypto.sign('sha256', tbs, o.issuerKey.privateKey);
    const crlDer = a.seq(tbs, algId(o.issuerKey.type), a.bitString(sig));
    return { crlDer, crlPem: derNaarPem(crlDer, 'X509 CRL') };
  }

  /* Een CSR (PKCS#10) voor ACME: subject + publieke sleutel + gevraagde SAN,
     ondertekend met de private sleutel. De CA (Let's Encrypt) geeft het echte cert. */
  function maakCSR(opties) {
    const paar = opties.key || genKeyPair(opties);
    const namen = (opties.names && opties.names.length) ? opties.names : [opties.cn];
    const subj = { cn: opties.cn || namen[0] };
    const attrs = a.context(0, a.seq(a.oid(OID.extensionRequest),                 // [0] IMPLICIT SET OF Attribute
      a.set(a.seq(extensie(OID.subjectAltName, false, sanExtWaarde(namen))))));
    const cri = a.seq(a.integer(0), naam(subj), a.ruw(paar.spkiDer), attrs);
    const sig = crypto.sign('sha256', cri, paar.privateKey);
    const csrDer = a.seq(cri, algId(paar.type), a.bitString(sig));
    return { csrDer, csrPem: derNaarPem(csrDer, 'CERTIFICATE REQUEST'), key: paar };
  }

  // DER -> PEM (base64 in regels van 64), en andersom.
  function derNaarPem(der, label) {
    const b64 = Buffer.from(der).toString('base64').replace(/(.{64})/g, '$1\n');
    return '-----BEGIN ' + label + '-----\n' + b64 + (b64.endsWith('\n') ? '' : '\n') + '-----END ' + label + '-----\n';
  }
  function pemNaarDer(pem) {
    const m = String(pem).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
    return Buffer.from(m, 'base64');
  }
  // base64url zonder padding (JOSE/ACME gebruikt dit overal)
  function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

  // Lees vervaldatum/SAN uit een cert (Node's parser) -- voor de vernieuwing.
  function certInfo(pem) {
    const c = new crypto.X509Certificate(pem);
    return { validTo: new Date(c.validTo), validFrom: new Date(c.validFrom), subject: c.subject, san: c.subjectAltName || '' };
  }

  // (de export van x509.js zelf staat daar)

  return { maakCRL, maakCSR, derNaarPem, pemNaarDer, b64url, certInfo };
};
