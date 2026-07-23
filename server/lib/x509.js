/* X.509 in huis: een sleutelpaar maken, er een self-signed certificaat van
   bakken (voor local/dev, zodat de app meteen HTTPS spreekt zonder externe CA),
   en een PKCS#10-CSR bouwen (die de ACME-client naar Let's Encrypt stuurt voor
   een ECHT certificaat). Alle bytes komen uit onze eigen DER-encoder (./asn1);
   het TEKENEN doet Node's crypto -- geen eigen cryptografie, geen dependency,
   geen openssl-proces.

   Standaard EC P-256 (prime256v1) met ES256: klein, snel, modern en door elke
   actuele browser en door Let's Encrypt geaccepteerd. RSA-2048 kan ook (voor
   heel oude clients). */
'use strict';
const crypto = require('crypto');
const a = require('./asn1');

// OID's die we nodig hebben
const OID = {
  cn: '2.5.4.3', org: '2.5.4.10',
  ecdsaSha256: '1.2.840.10045.4.3.2',
  rsaSha256: '1.2.840.113549.1.1.11',
  basicConstraints: '2.5.29.19', keyUsage: '2.5.29.15',
  extKeyUsage: '2.5.29.37', serverAuth: '1.3.6.1.5.5.7.3.1',
  subjectAltName: '2.5.29.17', extensionRequest: '1.2.840.113549.1.9.14'
};

function genKeyPair(opties) {
  const type = (opties && opties.type) || 'ec';
  const paar = type === 'rsa'
    ? crypto.generateKeyPairSync('rsa', { modulusLength: (opties && opties.bits) || 2048 })
    : crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  return {
    type,
    publicKey: paar.publicKey, privateKey: paar.privateKey,
    keyPem: paar.privateKey.export({ type: 'pkcs8', format: 'pem' }),
    spkiDer: paar.publicKey.export({ type: 'spki', format: 'der' })
  };
}

// AlgorithmIdentifier voor de handtekening, passend bij het sleuteltype.
function algId(type) {
  return type === 'rsa' ? a.seq(a.oid(OID.rsaSha256), a.nul()) : a.seq(a.oid(OID.ecdsaSha256));
}
// Name = SEQUENCE OF RDN; hier CN (verplicht) en optioneel O.
function naam(velden) {
  const rdns = [a.set(a.seq(a.oid(OID.cn), a.utf8(velden.cn)))];
  if (velden.org) rdns.push(a.set(a.seq(a.oid(OID.org), a.utf8(velden.org))));
  return a.seq(...rdns);
}
const isIPv4 = s => /^\d{1,3}(\.\d{1,3}){3}$/.test(s);
// SubjectAltName-extensie uit een lijst hostnamen/IP's. dNSName = [2] IMPLICIT
// IA5String, iPAddress = [7] IMPLICIT OCTET STRING (4 bytes voor IPv4).
function sanExtWaarde(namen) {
  const algemene = namen.map(n => isIPv4(n)
    ? a.context(7, Buffer.from(n.split('.').map(Number)), { constructed: false })
    : a.context(2, Buffer.from(n, 'latin1'), { constructed: false }));
  return a.seq(...algemene);
}
// Extension = SEQUENCE { extnID, critical DEFAULT false, extnValue OCTET STRING }
function extensie(oidStr, kritiek, derWaarde) {
  const delen = [a.oid(oidStr)];
  if (kritiek) delen.push(a.booleaans(true));
  delen.push(a.octetString(derWaarde));
  return a.seq(...delen);
}
function standaardExtensies(type, namen) {
  const ku = type === 'rsa' ? { byte: 0xa0, ongebruikt: 5 } : { byte: 0x80, ongebruikt: 7 };
  return [
    extensie(OID.basicConstraints, true, a.seq()),                              // cA = FALSE (default)
    extensie(OID.keyUsage, true, a.bitString(Buffer.from([ku.byte]), ku.ongebruikt)),
    extensie(OID.extKeyUsage, false, a.seq(a.oid(OID.serverAuth))),             // serverAuth
    extensie(OID.subjectAltName, false, sanExtWaarde(namen))
  ];
}
function serieel() {
  const b = crypto.randomBytes(16); b[0] &= 0x7f; if (b[0] === 0) b[0] = 1; return b; // positief, niet-nul
}

/* Een self-signed certificaat: issuer == subject, met SAN zodat browsers het voor
   die hostnamen aanvaarden (na het handmatig vertrouwen ervan). Voor local/dev. */
function selfSigned(opties) {
  opties = opties || {};
  const namen = (opties.names && opties.names.length) ? opties.names : ['localhost', '127.0.0.1'];
  const paar = opties.key || genKeyPair(opties);
  const nu = new Date();
  const nietVoor = new Date(nu.getTime() - 5 * 60000);                          // 5 min terug (klok-skew)
  const nietNa = new Date(nu.getTime() + (opties.days || 825) * 86400000);
  const subj = { cn: opties.cn || namen[0], org: opties.org || 'RTG local' };
  const tbs = a.seq(
    a.context(0, a.integer(2)),                                                 // versie v3
    a.integer(serieel()),
    algId(paar.type),
    naam(subj),                                                                 // issuer
    a.seq(a.tijd(nietVoor), a.tijd(nietNa)),
    naam(subj),                                                                 // subject
    a.ruw(paar.spkiDer),                                                        // SubjectPublicKeyInfo (van Node)
    a.context(3, a.seq(...standaardExtensies(paar.type, namen)))
  );
  const sig = crypto.sign('sha256', tbs, paar.privateKey);                      // Node tekent (EC->DER, RSA->PKCS1v15)
  const certDer = a.seq(tbs, algId(paar.type), a.bitString(sig));
  return { certPem: derNaarPem(certDer, 'CERTIFICATE'), keyPem: paar.keyPem, key: paar, certDer };
}

/* Een certificaat uitgeven voor een GEGEVEN publieke sleutel (SPKI-DER),
   ondertekend door een uitgever-sleutelpaar. Dit is wat een CA doet: subject !=
   issuer. selfSigned is hiervan het bijzondere geval subject == issuer. Handig
   voor een interne mini-CA (en voor een trouwe ACME-test die een cert uitgeeft
   voor de sleutel uit de CSR). */
function certVoor(opties) {
  const issuer = opties.issuerKey;                                              // { type, privateKey }
  const namen = (opties.names && opties.names.length) ? opties.names : [opties.cn];
  const nu = new Date();
  const nietVoor = new Date(nu.getTime() - 5 * 60000);
  const nietNa = new Date(nu.getTime() + (opties.days || 90) * 86400000);
  const subj = { cn: opties.cn || namen[0], org: opties.org };
  const iss = { cn: opties.issuerCn || subj.cn, org: opties.issuerOrg };
  const tbs = a.seq(
    a.context(0, a.integer(2)),
    a.integer(serieel()),
    algId(issuer.type),
    naam(iss),                                                                  // issuer (de CA)
    a.seq(a.tijd(nietVoor), a.tijd(nietNa)),
    naam(subj),
    a.ruw(opties.subjectSpkiDer),                                               // de publieke sleutel van de aanvrager
    a.context(3, a.seq(...standaardExtensies(opties.subjectType || 'ec', namen)))
  );
  const sig = crypto.sign('sha256', tbs, issuer.privateKey);
  const certDer = a.seq(tbs, algId(issuer.type), a.bitString(sig));
  return { certPem: derNaarPem(certDer, 'CERTIFICATE'), certDer };
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

module.exports = { genKeyPair, selfSigned, certVoor, maakCSR, derNaarPem, pemNaarDer, b64url, certInfo, OID };
