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
  extKeyUsage: '2.5.29.37', serverAuth: '1.3.6.1.5.5.7.3.1', clientAuth: '1.3.6.1.5.5.7.3.2',
  subjectAltName: '2.5.29.17', extensionRequest: '1.2.840.113549.1.9.14',
  ski: '2.5.29.14', aki: '2.5.29.35', crlNumber: '2.5.29.20'
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
function serieel() {
  const b = crypto.randomBytes(16); b[0] &= 0x7f; if (b[0] === 0) b[0] = 1; return b; // positief, niet-nul
}

/* ---- extensie-bouwers ---- */
function basicConstraintsExt(isCA, pathLen) {
  const inner = [];
  if (isCA) { inner.push(a.booleaans(true)); if (pathLen != null) inner.push(a.integer(pathLen)); }
  return extensie(OID.basicConstraints, true, a.seq(...inner));                 // cA = FALSE als leeg (default)
}
// keyUsage-bits: digitalSignature=bit0(0x80), keyEncipherment=bit2(0x20),
// keyCertSign=bit5(0x04), cRLSign=bit6(0x02).
function keyUsageExt(isCA, type, isClient) {
  let byte, ongebruikt;
  if (isCA) { byte = 0x06; ongebruikt = 1; }                                    // keyCertSign + cRLSign
  else if (type === 'rsa' && !isClient) { byte = 0xa0; ongebruikt = 5; }        // digitalSignature + keyEncipherment
  else { byte = 0x80; ongebruikt = 7; }                                         // digitalSignature
  return extensie(OID.keyUsage, true, a.bitString(Buffer.from([byte]), ongebruikt));
}
function ekuExt(isClient) { return extensie(OID.extKeyUsage, false, a.seq(a.oid(isClient ? OID.clientAuth : OID.serverAuth))); }
function skiExt(keyId) { return extensie(OID.ski, false, a.octetString(keyId)); }
function akiExt(keyId) { return extensie(OID.aki, false, a.seq(a.context(0, keyId, { constructed: false }))); } // [0] keyIdentifier

// SubjectKeyIdentifier = SHA-1 van de publieke-sleutel-bits uit de SPKI-DER.
function derVeld(buf, start) {
  let i = start + 1, len = buf[i], hlen = 2;
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let j = 0; j < n; j++) len = len * 256 + buf[i + 1 + j]; hlen = 2 + n; }
  return { hlen, len, valStart: start + hlen, end: start + hlen + len };
}
function skiVan(spkiDer) {
  const outer = derVeld(spkiDer, 0);
  const alg = derVeld(spkiDer, outer.valStart);
  const bit = derVeld(spkiDer, alg.end);                                        // subjectPublicKey BIT STRING
  const inhoud = spkiDer.slice(bit.valStart + 1, bit.end);                      // sla de "ongebruikte bits"-byte over
  return crypto.createHash('sha1').update(inhoud).digest();
}

/* De algemene certificaat-bouwer: alles expliciet. selfSigned en certVoor zijn
   hier gevallen van; de interne CA (lib/ca.js) gebruikt hem voor CA-, server- en
   client-certificaten. Voegt SKI toe (en AKI als de uitgever-SKI bekend is),
   zodat ketenopbouw werkt zoals bij echte CA's. */
function bouwCert(o) {
  const nu = new Date();
  const nietVoor = o.notBefore || new Date(nu.getTime() - 5 * 60000);
  const nietNa = o.notAfter || new Date(nu.getTime() + (o.days || 825) * 86400000);
  const exts = [basicConstraintsExt(!!o.isCA, o.pathLen), keyUsageExt(!!o.isCA, o.subjectType || 'ec', !!o.isClient)];
  if (!o.isCA) exts.push(ekuExt(!!o.isClient));                                 // een CA-cert krijgt geen EKU
  if (o.namen && o.namen.length && !o.isCA) exts.push(extensie(OID.subjectAltName, false, sanExtWaarde(o.namen)));
  exts.push(skiExt(skiVan(o.subjectSpkiDer)));
  if (o.issuerSkiDer) exts.push(akiExt(o.issuerSkiDer));
  const tbs = a.seq(
    a.context(0, a.integer(2)),                                                 // versie v3
    a.integer(o.serial || serieel()),
    algId(o.issuerKey.type),
    naam(o.issuerNaam),
    a.seq(a.tijd(nietVoor), a.tijd(nietNa)),
    naam(o.subjectNaam),
    a.ruw(o.subjectSpkiDer),
    a.context(3, a.seq(...exts))
  );
  const sig = crypto.sign('sha256', tbs, o.issuerKey.privateKey);
  const certDer = a.seq(tbs, algId(o.issuerKey.type), a.bitString(sig));
  return { certDer, certPem: derNaarPem(certDer, 'CERTIFICATE'), ski: skiVan(o.subjectSpkiDer) };
}

/* Een self-signed certificaat: issuer == subject, met SAN zodat browsers het voor
   die hostnamen aanvaarden (na het handmatig vertrouwen ervan). Voor local/dev. */
function selfSigned(opties) {
  opties = opties || {};
  const namen = (opties.names && opties.names.length) ? opties.names : ['localhost', '127.0.0.1'];
  const paar = opties.key || genKeyPair(opties);
  const subj = { cn: opties.cn || namen[0], org: opties.org || 'RTG local' };
  const r = bouwCert({ subjectNaam: subj, subjectSpkiDer: paar.spkiDer, subjectType: paar.type,
    issuerNaam: subj, issuerKey: paar, issuerSkiDer: skiVan(paar.spkiDer), namen, days: opties.days || 825, isClient: opties.isClient });
  return { certPem: r.certPem, keyPem: paar.keyPem, key: paar, certDer: r.certDer };
}

/* Een certificaat uitgeven voor een GEGEVEN publieke sleutel (SPKI-DER),
   ondertekend door een uitgever-sleutelpaar. Dit is wat een CA doet: subject !=
   issuer. selfSigned is hiervan het bijzondere geval subject == issuer. */
function certVoor(opties) {
  const namen = (opties.names && opties.names.length) ? opties.names : [opties.cn];
  const r = bouwCert({
    subjectNaam: { cn: opties.cn || namen[0], org: opties.org }, subjectSpkiDer: opties.subjectSpkiDer, subjectType: opties.subjectType || 'ec',
    issuerNaam: { cn: opties.issuerCn || opties.cn || namen[0], org: opties.issuerOrg }, issuerKey: opties.issuerKey, issuerSkiDer: opties.issuerSkiDer,
    namen, days: opties.days || 90, isClient: opties.isClient
  });
  return { certPem: r.certPem, certDer: r.certDer };
}

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

module.exports = { genKeyPair, selfSigned, certVoor, bouwCert, maakCSR, maakCRL, skiVan, derNaarPem, pemNaarDer, b64url, certInfo, OID };
