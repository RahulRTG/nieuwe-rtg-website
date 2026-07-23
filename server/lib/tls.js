/* Native TLS-terminatie IN de app, op Node's ingebouwde tls-stack -- net zoals
   onze eigen HTTP/1.1-motor op node:net bouwt en de HTTP/2-motor op node:http2.
   Geen externe reverse proxy meer nodig om HTTPS te spreken, en geen npm-
   dependency: de tls-module is kern-runtime (OpenSSL onder de motorkap doet het
   echte protocol -- wij rollen GEEN eigen crypto).

   Wat deze laag "beter" maakt dan een kale https.createServer:
   - HTTP/2 over TLS met ALPN, en HTTP/1.1 als terugval op DEZELFDE poort, zodat
     moderne browsers h2 spreken en oudere clients gewoon werken.
   - Harde defaults: TLS 1.2 als vloer (1.3 wordt vanzelf gekozen), alleen
     forward-secret AEAD-ciphers, honorCipherOrder aan.
   - Auto self-signed voor local/dev (uit onze eigen x509-laag), gecachet in de
     datamap, zodat `RTG_TLS=1 npm start` meteen HTTPS geeft zonder gedoe.
   - Hot cert-herlaad zonder herstart (setSecureContext): de ACME-vernieuwing
     wisselt het certificaat live om, midden in het verkeer.
   - Haakje voor OCSP-stapling (de ACME-laag vult de response).

   Certificaatkeuze, in volgorde: expliciet meegegeven PEM -> RTG_TLS_CERT/KEY
   (bestandspaden) -> zelfondertekend uit de datamap. */
'use strict';
const http2 = require('http2');
const https = require('https');
const fs = require('fs');
const path = require('path');
const x509 = require('./x509');

// Alleen forward-secret AEAD-suites voor TLS 1.2 (de TLS 1.3-suites liggen vast
// in Node/OpenSSL en zijn allemaal al veilig). Volgorde = onze voorkeur.
const CIPHERS = [
  'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-AES256-GCM-SHA384', 'ECDHE-RSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-CHACHA20-POLY1305', 'ECDHE-RSA-CHACHA20-POLY1305',
  'DHE-RSA-AES128-GCM-SHA256', 'DHE-RSA-AES256-GCM-SHA384'
].join(':');

function tlsMap(opties) {
  const basis = (opties && opties.dataDir) || process.env.RTG_DATA_DIR || path.join(__dirname, '..', 'data');
  return path.join(basis, 'tls');
}

/* Zelfondertekend certificaat voor local/dev: eenmalig maken en cachen in de
   datamap (0600, staat in .gitignore). Zolang het nog ruim geldig is hergebruiken
   we het, zodat een herstart niet elke keer een nieuw cert (en dus een nieuwe
   browserwaarschuwing) geeft. */
function zelfOndertekend(opties) {
  const dir = tlsMap(opties);
  try { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); } catch (e) {}
  const cPad = path.join(dir, 'self.crt'), kPad = path.join(dir, 'self.key');
  try {
    const cert = fs.readFileSync(cPad, 'utf8'), key = fs.readFileSync(kPad, 'utf8');
    if (x509.certInfo(cert).validTo > new Date(Date.now() + 86400000)) return { cert, key, bron: 'self-signed (cache)' };
  } catch (e) { /* nog niet aangemaakt of onleesbaar: opnieuw maken */ }
  const namen = (opties && opties.names) || ['localhost', '127.0.0.1'];
  const ss = x509.selfSigned({ names: namen });
  try { fs.writeFileSync(cPad, ss.certPem, { mode: 0o600 }); fs.writeFileSync(kPad, ss.keyPem, { mode: 0o600 }); } catch (e) {}
  return { cert: ss.certPem, key: ss.keyPem, bron: 'self-signed (nieuw)' };
}

function laadCertKey(opties) {
  opties = opties || {};
  if (opties.cert && opties.key) return { cert: opties.cert, key: opties.key, bron: 'opgegeven' };
  const cPad = opties.certPad || process.env.RTG_TLS_CERT;
  const kPad = opties.keyPad || process.env.RTG_TLS_KEY;
  if (cPad && kPad) {
    try { return { cert: fs.readFileSync(cPad), key: fs.readFileSync(kPad), bron: 'bestand' }; }
    catch (e) { /* pad klopt niet: val terug op self-signed zodat de app niet stilvalt */ }
  }
  return zelfOndertekend(opties);
}

// De opties voor de SecureContext (herbruikbaar bij setSecureContext).
function contextOpties(ck) {
  return { cert: ck.cert, key: ck.key, ciphers: CIPHERS, honorCipherOrder: true, minVersion: 'TLSv1.2' };
}

/* Maak de TLS-server. Standaard HTTP/2-secure met HTTP/1.1-terugval (ALPN);
   met RTG_TLS_HTTP2=0 puur HTTPS/1.1 (als een omgeving geen h2 wil). Geeft een
   server terug met dezelfde vorm die app.listen verwacht (server.listen(...)),
   plus .herlaadCert() en .zetOCSP() voor de ACME-laag. */
function maakServer(app, opties) {
  opties = opties || {};
  const ck = laadCertKey(opties);
  const ctx = contextOpties(ck);
  const alpn = ['h2', 'http/1.1'];
  const gebruikHttp2 = process.env.RTG_TLS_HTTP2 !== '0';
  // mTLS (wederzijdse TLS): met opties.ca (het CA-bundel van onze interne CA)
  // vraagt de server het clientcertificaat op en verifieert het tegen die CA --
  // zo authenticeren interne componenten (zaakdoos, noodserver, instances) elkaar.
  const mtls = {};
  if (opties.ca) { mtls.ca = opties.ca; mtls.requestCert = opties.requestCert !== false; mtls.rejectUnauthorized = opties.rejectUnauthorized !== false; }
  const server = gebruikHttp2
    ? http2.createSecureServer(Object.assign({ allowHTTP1: true, ALPNProtocols: alpn }, ctx, mtls), app)
    : https.createServer(Object.assign({ ALPNProtocols: alpn }, ctx, mtls), app);

  // Hot herlaad: wissel het certificaat live om (na een ACME-vernieuwing) zonder
  // de server te herstarten of ook maar één verbinding te verbreken.
  server.herlaadCert = (certPem, keyPem) => { try { server.setSecureContext(contextOpties({ cert: certPem, key: keyPem })); return true; } catch (e) { return false; } };

  // OCSP-stapling: staple een (door de ACME-laag opgehaalde) OCSP-response mee,
  // zodat de client de geldigheid ziet zonder zelf de CA te bevragen (sneller +
  // privacyvriendelijker). Zonder response: gewoon geen nietje, client valt terug.
  let ocsp = null;
  server.zetOCSP = (buf) => { ocsp = buf || null; };
  server.on('OCSPRequest', (cert, issuer, cb) => cb(null, ocsp));

  server.tlsBron = ck.bron;
  return server;
}

module.exports = { maakServer, laadCertKey, zelfOndertekend, CIPHERS };
