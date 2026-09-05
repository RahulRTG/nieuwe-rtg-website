/* De transportgrens van de PostgreSQL-driver.

   Een DATABASE_URL die naar een externe host wijst is pas een beveiligde
   verbinding als drie dingen tegelijk waar zijn: verify-full is gevraagd, de
   trust anchor is expliciet aangewezen en Node controleert de hostnaam. Alleen
   `sslmode=require` versleutelt zonder de server te authenticeren en is daarom
   in productie geen veilige stand.

   Plaintext blijft uitsluitend mogelijk op de twee vaste Compose-servicenamen
   uit deze repository en op de lokale machine. Dit is bewust geen env-
   allowlist: een omgevingsvariabele waarmee elke willekeurige host "intern"
   kan worden genoemd zou dezelfde poort weer openen. */
'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');
const crypto = require('crypto');

const INTERNE_HOSTS = new Set(['localhost', 'postgres', 'keurpostgres']);
const GELDIGE_MODI = new Set(['', 'disable', 'require', 'verify-ca', 'verify-full']);

function hostSchoon(host) {
  let h = String(host || '').trim().toLowerCase();
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  return h.replace(/\.$/, '');
}

function isLoopback(host) {
  const h = hostSchoon(host);
  if (h === '::1') return true;
  if (net.isIP(h) !== 4) return false;
  const eerste = Number(h.split('.')[0]);
  return eerste === 127;
}

function isInterneHost(host) {
  const h = hostSchoon(host);
  return INTERNE_HOSTS.has(h) || isLoopback(h);
}

function ontleedUrl(waarde) {
  const u = new URL(String(waarde || ''));
  if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:')
    throw new Error('DATABASE_URL moet het postgres- of postgresql-protocol gebruiken.');
  if (!u.hostname) throw new Error('DATABASE_URL mist een PostgreSQL-host.');
  const sslmode = String(u.searchParams.get('sslmode') || '').toLowerCase();
  /* Het pad staat in dezelfde connection string die iedere runtimeconsument
     krijgt. Een los PGSSLROOTCERT uit een ingelezen env-bestand zou door de
     config gezien kunnen worden terwijl een rechtstreekse Client alleen de URL
     ontvangt; dat zou opnieuw twee verschillende werkelijkheden maken. */
  const caPad = String(u.searchParams.get('sslrootcert') || '');
  return { url: u, host: hostSchoon(u.hostname), sslmode, caPad, intern: isInterneHost(u.hostname) };
}

function certBlokken(pem) {
  return String(pem || '').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g) || [];
}

function keurCaPem(pem) {
  const blokken = certBlokken(pem);
  if (!blokken.length) throw new Error('het PostgreSQL-CA-bestand bevat geen PEM-certificaat.');
  const nu = Date.now();
  let geldigeCa = false;
  for (const blok of blokken) {
    const cert = new crypto.X509Certificate(blok);
    if (cert.ca && Date.parse(cert.validFrom) <= nu && Date.parse(cert.validTo) > nu) geldigeCa = true;
  }
  if (!geldigeCa) throw new Error('het PostgreSQL-CA-bestand bevat geen momenteel geldige CA trust anchor.');
  return String(pem);
}

function leesCaBestand(caPad) {
  if (!caPad) throw new Error('sslmode=verify-full vereist sslrootcert in DATABASE_URL.');
  if (!path.isAbsolute(caPad)) throw new Error('het PostgreSQL-CA-pad moet absoluut zijn.');
  let pem;
  try { pem = fs.readFileSync(caPad, 'utf8'); }
  catch (e) { throw new Error('het PostgreSQL-CA-bestand is niet leesbaar.'); }
  return keurCaPem(pem);
}

/* Zuivere productie-uitspraak op de URL. Alleen de CA-bytes komen van schijf;
   er wordt nooit naar process.env teruggevallen, zodat config, Pool en een
   rechtstreekse Client exact dezelfde transportopgave beoordelen. */
function keurProductieUrl(waarde) {
  const fouten = [];
  let info;
  try { info = ontleedUrl(waarde); }
  catch (e) { return { fouten: [e.message], info: null, ca: null }; }

  if (!GELDIGE_MODI.has(info.sslmode)) {
    fouten.push('PostgreSQL sslmode="' + info.sslmode + '" is niet toegestaan in productie.');
    return { fouten, info, ca: null };
  }
  if (info.sslmode === 'require')
    fouten.push('PostgreSQL sslmode=require verifieert de server niet en is nooit productiegoed; gebruik verify-full met een vertrouwde CA.');
  else if (info.sslmode === 'verify-ca')
    fouten.push('PostgreSQL sslmode=verify-ca controleert de hostnaam niet en is niet productiegoed; gebruik verify-full.');
  else if (!info.intern && info.sslmode !== 'verify-full')
    fouten.push('Een externe PostgreSQL-host vereist sslmode=verify-full en een vertrouwde CA.');

  let ca = null;
  if (info.sslmode === 'verify-full') {
    try { ca = leesCaBestand(info.caPad); }
    catch (e) { fouten.push(e.message); }
  }
  return { fouten, info, ca };
}

/* Tweede slot in de driver zelf. De server draait de configuratiekeuring vóór
   de database wordt geopend, maar losse productiehulpprogramma's mogen niet via
   `new Pool()` alsnog rejectUnauthorized:false gebruiken. */
function eisProductieTransport(opts, cfg, env) {
  env = env || process.env;
  if (String(env.NODE_ENV || '') !== 'production') return;

  if (cfg.ssl && cfg.ssl.rejectUnauthorized === false)
    throw new Error('pg: rejectUnauthorized=false is nooit toegestaan in productie');

  if (opts.connectionString) {
    const oordeel = keurProductieUrl(opts.connectionString, env);
    if (oordeel.fouten.length) throw new Error('pg: onveilige productieverbinding: ' + oordeel.fouten.join(' '));
    if (oordeel.info && oordeel.info.sslmode === 'verify-full') {
      if (!cfg.ssl || cfg.ssl.rejectUnauthorized !== true || !cfg.ssl.ca)
        throw new Error('pg: sslmode=verify-full is door de runtimeconfiguratie verzwakt of mist zijn CA');
      if (hostSchoon(cfg.ssl.servername) !== oordeel.info.host)
        throw new Error('pg: sslmode=verify-full controleert niet de hostnaam uit DATABASE_URL');
      try { keurCaPem(cfg.ssl.ca); }
      catch (e) { throw new Error('pg: ongeldige PostgreSQL-CA: ' + e.message); }
    }
    return;
  }

  if (isInterneHost(cfg.host)) return;
  if (!cfg.ssl || cfg.ssl.rejectUnauthorized !== true || !cfg.ssl.ca)
    throw new Error('pg: een externe productiehost vereist geverifieerde TLS met een expliciete CA');
  if (cfg.ssl.servername && hostSchoon(cfg.ssl.servername) !== hostSchoon(cfg.host))
    throw new Error('pg: de TLS-servernaam wijkt af van de externe PostgreSQL-host');
  try { keurCaPem(cfg.ssl.ca); }
  catch (e) { throw new Error('pg: ongeldige PostgreSQL-CA: ' + e.message); }
}

module.exports = {
  INTERNE_HOSTS, hostSchoon, isInterneHost, ontleedUrl,
  keurCaPem, leesCaBestand, keurProductieUrl, eisProductieTransport
};
