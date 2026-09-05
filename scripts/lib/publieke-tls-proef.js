/* De publieke TLS-poort, als herbruikbare proef.

   Belangrijk onderscheid: `connectHost` mag voor een lokale deployproef het
   TCP-verkeer naar 127.0.0.1 sturen, maar de URL, Host-kop, SNI en
   certificaatcontrole blijven ALTIJD op de publieke APP_URL staan. Dat is het
   veilige equivalent van curl --resolve; de CLI kan de trust- of
   hostnamecontrole nergens uitzetten en accepteert geen eigen CA.

   De productie-aanroep gebruikt uitsluitend de normale publieke trustankers
   die Node meelevert plus de trustankers van het besturingssysteem. Extra
   proces-CA's worden bewust niet meegenomen. `trustAnchors` is alleen een
   injectienaald voor de volledig lokale unitproef en wordt niet door de CLI
   aangeboden. */
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const tls = require('node:tls');

const FORMAAT = 'rtg-publieke-tls-proef-v1';
const MIN_CERT_DAGEN = 14;
const MIN_HSTS_SECONDEN = 31536000;
const MAX_BODY_BYTES = 1024 * 1024;

class PubliekeTlsFout extends Error {
  constructor(boodschap, code) {
    super(boodschap);
    this.name = 'PubliekeTlsFout';
    this.code = code || 'RTG_PUBLIEKE_TLS_PROEF';
  }
}

function uniekeCertificaten(lijst) {
  return [...new Set((lijst || []).map(String).filter(Boolean))];
}

/* Leg de trustset expliciet vast. Daardoor kan NODE_EXTRA_CA_CERTS of een
   OpenSSL-configuratie op de operatorhost geen private/self-signed CA aan deze
   publieke vrijgaveproef toevoegen. */
function publiekeTrustankers() {
  const systeem = typeof tls.getCACertificates === 'function'
    ? tls.getCACertificates('system') : [];
  return uniekeCertificaten([...(tls.rootCertificates || []), ...systeem]);
}

function keurAppUrl(waarde) {
  let url;
  try { url = new URL(String(waarde || '').trim()); }
  catch (e) { throw new PubliekeTlsFout('APP_URL is geen geldige URL.', 'RTG_TLS_APP_URL'); }
  if (url.protocol !== 'https:')
    throw new PubliekeTlsFout('APP_URL moet https gebruiken.', 'RTG_TLS_APP_URL');
  if (url.username || url.password)
    throw new PubliekeTlsFout('APP_URL mag geen inloggegevens bevatten.', 'RTG_TLS_APP_URL');
  if (url.pathname !== '/' || url.search || url.hash)
    throw new PubliekeTlsFout('APP_URL moet exact de publieke domeinroot zijn.', 'RTG_TLS_APP_URL');
  if (url.port)
    throw new PubliekeTlsFout('APP_URL moet de standaard HTTPS-poort 443 gebruiken.', 'RTG_TLS_APP_URL');
  if (net.isIP(url.hostname) || url.hostname === 'localhost' || !url.hostname.includes('.'))
    throw new PubliekeTlsFout('APP_URL moet een publieke domeinnaam bevatten.', 'RTG_TLS_APP_URL');
  return url;
}

function keurHsts(waarde) {
  const bron = String(waarde || '').trim();
  if (!bron) throw new PubliekeTlsFout('Strict-Transport-Security ontbreekt.', 'RTG_TLS_HSTS');
  if (bron.includes(','))
    throw new PubliekeTlsFout('Strict-Transport-Security staat meermaals of is ongeldig.', 'RTG_TLS_HSTS');
  const delen = bron.split(';').map(s => s.trim()).filter(Boolean);
  const max = delen.filter(s => /^max-age\s*=/i.test(s));
  if (max.length !== 1 || !/^max-age\s*=\s*\d+$/i.test(max[0]))
    throw new PubliekeTlsFout('HSTS moet exact één numerieke max-age dragen.', 'RTG_TLS_HSTS');
  const seconden = Number(max[0].split('=')[1].trim());
  if (!Number.isSafeInteger(seconden) || seconden < MIN_HSTS_SECONDEN)
    throw new PubliekeTlsFout('HSTS max-age moet minimaal één jaar zijn.', 'RTG_TLS_HSTS');
  if (!delen.some(s => /^includeSubDomains$/i.test(s)))
    throw new PubliekeTlsFout('HSTS moet includeSubDomains bevatten.', 'RTG_TLS_HSTS');
  return { waarde: bron, maxAge: seconden, includeSubDomains: true,
    preload: delen.some(s => /^preload$/i.test(s)) };
}

function keurRedirect({ status, location }, appUrl, pad) {
  if (status !== 301 && status !== 308)
    throw new PubliekeTlsFout('HTTP moet permanent doorsturen met status 301 of 308; ontvangen: ' + status + '.', 'RTG_TLS_REDIRECT');
  let doel;
  try { doel = new URL(String(location || ''), 'http://' + appUrl.host + pad); }
  catch (e) { throw new PubliekeTlsFout('De HTTP-redirect bevat geen geldige Location.', 'RTG_TLS_REDIRECT'); }
  const verwacht = new URL(pad, appUrl);
  if (doel.protocol !== 'https:' || doel.origin !== appUrl.origin ||
      doel.pathname !== verwacht.pathname || doel.search !== verwacht.search || doel.hash)
    throw new PubliekeTlsFout('HTTP stuurt niet exact naar dezelfde route op APP_URL.', 'RTG_TLS_REDIRECT');
  return { status, location: doel.href };
}

function keurCertificaat(tlsInfo, hostname, nu, minimumDagen) {
  if (!tlsInfo || !tlsInfo.authorized)
    throw new PubliekeTlsFout('Het certificaat is niet door de publieke trustset vertrouwd: ' +
      String(tlsInfo && tlsInfo.authorizationError || 'onbekende reden') + '.', 'RTG_TLS_TRUST');
  const cert = tlsInfo.cert || {};
  const hostFout = tls.checkServerIdentity(hostname, cert);
  if (hostFout)
    throw new PubliekeTlsFout('Het certificaat hoort niet bij APP_URL: ' + hostFout.message, 'RTG_TLS_HOSTNAME');
  const geldigVanaf = Date.parse(cert.valid_from || '');
  const geldigTot = Date.parse(cert.valid_to || '');
  const tijd = (nu instanceof Date ? nu : new Date(nu || Date.now())).getTime();
  if (!Number.isFinite(geldigVanaf) || !Number.isFinite(geldigTot) || geldigVanaf > tijd || geldigTot <= tijd)
    throw new PubliekeTlsFout('De certificaatlooptijd is ongeldig of niet actueel.', 'RTG_TLS_GELDIGHEID');
  const resterendMs = geldigTot - tijd;
  const grens = Number.isFinite(minimumDagen) ? minimumDagen : MIN_CERT_DAGEN;
  if (resterendMs < grens * 86400000)
    throw new PubliekeTlsFout('Het certificaat is minder dan ' + grens + ' dagen geldig.', 'RTG_TLS_GELDIGHEID');
  const protocol = String(tlsInfo.protocol || '');
  if (!/^TLSv1\.[23]$/.test(protocol))
    throw new PubliekeTlsFout('Alleen TLS 1.2 of TLS 1.3 is toegestaan; ontvangen: ' + (protocol || 'onbekend') + '.', 'RTG_TLS_PROTOCOL');
  return {
    authorized: true,
    protocol,
    validFrom: new Date(geldigVanaf).toISOString(),
    validTo: new Date(geldigTot).toISOString(),
    daysRemaining: Math.floor(resterendMs / 86400000),
    fingerprint256: String(cert.fingerprint256 || ''),
    subjectAltName: String(cert.subjectaltname || '')
  };
}

function poortGetal(waarde, standaard) {
  const n = Number(waarde == null ? standaard : waarde);
  if (!Number.isInteger(n) || n < 1 || n > 65535)
    throw new PubliekeTlsFout('Ongeldige verbindingspoort.', 'RTG_TLS_POORT');
  return n;
}

function leesAntwoord(res, resolve, reject, tlsInfo) {
  let bytes = 0;
  res.on('data', stuk => {
    bytes += stuk.length;
    if (bytes > MAX_BODY_BYTES) res.destroy(new PubliekeTlsFout('TLS-proefantwoord is onverwacht groot.', 'RTG_TLS_ANTWOORD'));
  });
  res.on('end', () => resolve({
    status: res.statusCode || 0,
    headers: res.headers,
    tls: tlsInfo || null
  }));
  res.on('error', reject);
}

function httpsVraag(appUrl, pad, opties) {
  const connectHost = opties.connectHost || appUrl.hostname;
  const port = poortGetal(opties.httpsPort, 443);
  const ca = opties.trustAnchors || publiekeTrustankers();
  return new Promise((resolve, reject) => {
    const req = https.request({
      host: connectHost,
      port,
      path: pad,
      method: 'GET',
      agent: false,
      servername: appUrl.hostname,
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
      ca,
      headers: { host: appUrl.host, 'user-agent': 'rtg-publieke-tls-proef/1', connection: 'close' }
    }, res => {
      const socket = res.socket;
      const info = {
        authorized: socket.authorized === true,
        authorizationError: socket.authorizationError || '',
        protocol: socket.getProtocol && socket.getProtocol(),
        cert: socket.getPeerCertificate ? socket.getPeerCertificate(true) : null
      };
      leesAntwoord(res, resolve, reject, info);
    });
    req.setTimeout(opties.timeoutMs, () => req.destroy(new PubliekeTlsFout('HTTPS-proef liep in een timeout.', 'RTG_TLS_TIMEOUT')));
    req.on('error', reject);
    req.end();
  });
}

function httpVraag(appUrl, pad, opties) {
  const connectHost = opties.connectHost || appUrl.hostname;
  const port = poortGetal(opties.httpPort, 80);
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: connectHost,
      port,
      path: pad,
      method: 'GET',
      agent: false,
      headers: { host: appUrl.hostname, 'user-agent': 'rtg-publieke-tls-proef/1', connection: 'close' }
    }, res => leesAntwoord(res, resolve, reject));
    req.setTimeout(opties.timeoutMs, () => req.destroy(new PubliekeTlsFout('HTTP-redirectproef liep in een timeout.', 'RTG_TLS_TIMEOUT')));
    req.on('error', reject);
    req.end();
  });
}

async function voerPubliekeTlsProef(invoer) {
  const opties = Object.assign({ timeoutMs: 8000, minimumCertDagen: MIN_CERT_DAGEN }, invoer || {});
  const appUrl = keurAppUrl(opties.appUrl);
  const releaseCommit = String(opties.releaseCommit || '').toLowerCase();
  if (opties.eisReleaseCommit && !/^[a-f0-9]{40,64}$/.test(releaseCommit))
    throw new PubliekeTlsFout('De publieke TLS-proef mist een geldige releasecommit.', 'RTG_TLS_RELEASE_COMMIT');
  if (opties.connectHost && !['127.0.0.1', '::1'].includes(String(opties.connectHost)))
    throw new PubliekeTlsFout('Een verbindingsomleiding mag uitsluitend naar loopback wijzen.', 'RTG_TLS_CONNECT_HOST');
  const vraagHttps = opties.vraagHttps || httpsVraag;
  const vraagHttp = opties.vraagHttp || httpVraag;

  const ready = await vraagHttps(appUrl, '/api/ready', opties);
  if (ready.status !== 200)
    throw new PubliekeTlsFout('/api/ready antwoordde niet met 200 maar met ' + ready.status + '.', 'RTG_TLS_READY');
  const tlsBewijs = keurCertificaat(ready.tls, appUrl.hostname, opties.nu, opties.minimumCertDagen);
  const readyHsts = keurHsts(ready.headers['strict-transport-security']);

  const bewijs = {
    formaat: FORMAAT,
    geslaagd: true,
    at: (opties.nu instanceof Date ? opties.nu : new Date(opties.nu || Date.now())).toISOString(),
    appUrl: appUrl.origin,
    connectMode: opties.connectHost ? 'loopback-met-publieke-SNI' : 'publieke-DNS',
    releaseCommit: /^[a-f0-9]{40,64}$/.test(releaseCommit) ? releaseCommit : null,
    tls: tlsBewijs,
    ready: { status: ready.status, hsts: readyHsts }
  };
  if (opties.readinessOnly) return bewijs;

  const hoofdpagina = await vraagHttps(appUrl, '/', opties);
  if (hoofdpagina.status !== 200)
    throw new PubliekeTlsFout('De hoofdpagina antwoordde niet met 200 maar met ' + hoofdpagina.status + '.', 'RTG_TLS_HOOFDPAGINA');
  keurCertificaat(hoofdpagina.tls, appUrl.hostname, opties.nu, opties.minimumCertDagen);
  bewijs.https = { status: hoofdpagina.status,
    hsts: keurHsts(hoofdpagina.headers['strict-transport-security']) };

  /* Niet alleen `/`: een rand die elk HTTP-pad naar de homepage gooit lijkt op
     root groen maar breekt uitnodigingen en terugkeerlinks. Pad én query moeten
     daarom behouden blijven. */
  const redirectPad = '/__rtg_tls_redirect_probe?bron=release';
  let onveilig;
  try { onveilig = await vraagHttp(appUrl, redirectPad, opties); }
  catch (e) {
    throw new PubliekeTlsFout('Poort 80 bewijst geen HTTP→HTTPS-redirect: ' + String(e && e.message || e) + '.', 'RTG_TLS_REDIRECT');
  }
  bewijs.redirect = keurRedirect({ status: onveilig.status, location: onveilig.headers.location }, appUrl, redirectPad);
  return bewijs;
}

/* Strikte lezer voor de latere P3-samenvoeging. Dit maakt het bestand nog
   niet onafhankelijk of onwijzigbaar; daarvoor moet de release-authority de
   hash in het externe dossier ondertekenen. Het voorkomt wel dat een oud,
   loopback- of andersoortig JSON-bestand als publieke TLS-proef wordt gelezen. */
function valideerPubliekeTlsBewijs(bewijs, verwacht) {
  verwacht = Object.assign({ maxLeeftijdMs: 30 * 60 * 1000, eisPubliekeDns: true }, verwacht || {});
  if (!bewijs || bewijs.formaat !== FORMAAT || bewijs.geslaagd !== true)
    throw new PubliekeTlsFout('Publiek TLS-bewijs ontbreekt, is rood of heeft een onbekend formaat.', 'RTG_TLS_BEWIJS');
  const appUrl = keurAppUrl(verwacht.appUrl);
  if (bewijs.appUrl !== appUrl.origin)
    throw new PubliekeTlsFout('TLS-bewijs hoort niet bij de verwachte APP_URL.', 'RTG_TLS_BEWIJS_APP_URL');
  if (verwacht.eisPubliekeDns && bewijs.connectMode !== 'publieke-DNS')
    throw new PubliekeTlsFout('Een loopbackproef is geen extern DNS/TLS-bewijs.', 'RTG_TLS_BEWIJS_DNS');
  const commit = String(verwacht.releaseCommit || '').toLowerCase();
  if (!/^[a-f0-9]{40,64}$/.test(commit) || bewijs.releaseCommit !== commit)
    throw new PubliekeTlsFout('TLS-bewijs is niet aan de verwachte releasecommit gebonden.', 'RTG_TLS_BEWIJS_COMMIT');
  const nu = (verwacht.nu instanceof Date ? verwacht.nu : new Date(verwacht.nu || Date.now())).getTime();
  const gemaakt = Date.parse(bewijs.at || '');
  if (!Number.isFinite(gemaakt) || gemaakt > nu + 5 * 60 * 1000 || nu - gemaakt > verwacht.maxLeeftijdMs)
    throw new PubliekeTlsFout('TLS-bewijs is verlopen of komt uit de toekomst.', 'RTG_TLS_BEWIJS_VERSHEID');
  if (!bewijs.tls || bewijs.tls.authorized !== true || !/^TLSv1\.[23]$/.test(String(bewijs.tls.protocol || '')) ||
      !bewijs.tls.fingerprint256)
    throw new PubliekeTlsFout('TLS-bewijs mist een vertrouwde actuele TLS-peer.', 'RTG_TLS_BEWIJS_PEER');
  const hostFout = tls.checkServerIdentity(appUrl.hostname,
    { subjectaltname: String(bewijs.tls.subjectAltName || ''), subject: {} });
  if (hostFout)
    throw new PubliekeTlsFout('TLS-bewijs mist een SAN voor APP_URL.', 'RTG_TLS_BEWIJS_SAN');
  const geldigTot = Date.parse(bewijs.tls.validTo || '');
  if (!Number.isFinite(geldigTot) || geldigTot - gemaakt < MIN_CERT_DAGEN * 86400000)
    throw new PubliekeTlsFout('TLS-bewijs mist de vereiste certificaatmarge.', 'RTG_TLS_BEWIJS_GELDIGHEID');
  if (!bewijs.ready || bewijs.ready.status !== 200 || !bewijs.https || bewijs.https.status !== 200)
    throw new PubliekeTlsFout('TLS-bewijs mist een groene readiness of hoofdpagina.', 'RTG_TLS_BEWIJS_HTTP');
  keurHsts(bewijs.ready.hsts && bewijs.ready.hsts.waarde);
  keurHsts(bewijs.https.hsts && bewijs.https.hsts.waarde);
  keurRedirect(bewijs.redirect || {}, appUrl, '/__rtg_tls_redirect_probe?bron=release');
  return { ok: true, formaat: FORMAAT, appUrl: bewijs.appUrl,
    releaseCommit: bewijs.releaseCommit, bewijsAt: bewijs.at };
}

function schrijfBewijs(pad, bewijs) {
  const doel = String(pad || '');
  if (!doel) return;
  const tijdelijk = doel + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, JSON.stringify(bewijs, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tijdelijk, doel);
}

module.exports = {
  FORMAAT,
  MIN_CERT_DAGEN,
  MIN_HSTS_SECONDEN,
  PubliekeTlsFout,
  publiekeTrustankers,
  keurAppUrl,
  keurHsts,
  keurRedirect,
  keurCertificaat,
  voerPubliekeTlsProef,
  valideerPubliekeTlsBewijs,
  schrijfBewijs
};
