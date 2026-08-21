/* Snelle self-host-keuring zonder Docker te hoeven starten. Controleert de
   geheimen, placeholders, bestandsrechten en dezelfde productiepoorten als de
   server. Netwerkafhankelijke controles volgen later via npm run golive. */
'use strict';

const fs = require('fs');
const { zonderGeheim } = require('../lib/geenlek');
const path = require('path');
const crypto = require('crypto');
const { leesEnv, leesGeheim } = require('./start');
const config = require('../../server/config');

const ROOT = path.join(__dirname, '..', '..');
const envPad = path.resolve(process.env.RTG_ENV_FILE || path.join(ROOT, '.env.productie'));
const pgPad = path.resolve(process.env.RTG_POSTGRES_PASSWORD_FILE || path.join(ROOT, '.rtg-secrets', 'postgres_password'));
const publiek = process.argv.includes('--publiek');
const livePad = path.resolve(process.env.RTG_LIVE_ENV_FILE || path.join(ROOT, 'deploy', 'live.env'));
const fouten = [], waarschuwingen = [];

function rechten(pad, geheim) {
  try {
    const mode = fs.statSync(pad).mode & 0o777;
    if (mode & 0o077) fouten.push(pad + ' is te breed leesbaar (' + mode.toString(8) + '); vereist 600.');
    if (!geheim) fouten.push(pad + ' is leeg.');
  } catch (e) { fouten.push(pad + ' ontbreekt.'); }
}

let env = {};
try {
  const tekst = fs.readFileSync(envPad, 'utf8');
  rechten(envPad, tekst.trim());
  if (/VUL-IN/.test(tekst)) fouten.push(envPad + ' bevat nog VUL-IN-plaatsen.');
  env = { ...leesEnv(tekst), NODE_ENV: 'production', REDIS_URL: 'redis://redis:6379' };
} catch (e) { if (!fouten.length) fouten.push(e.message); }

try {
  const pg = leesGeheim(pgPad);
  rechten(pgPad, pg);
  env.DATABASE_URL = 'postgresql://rtg:' + encodeURIComponent(pg) + '@postgres:5432/rtg';
} catch (e) { fouten.push(e.message); }

const uitslag = config.valideer(env);
fouten.push(...uitslag.fouten);
waarschuwingen.push(...uitslag.waarschuwingen);

if (publiek) {
  let live = {};
  try { live = { ...leesEnv(fs.readFileSync(livePad, 'utf8')), ...process.env }; }
  catch (e) { fouten.push(livePad + ' ontbreekt of is onleesbaar.'); }

  let appUrl = null;
  try { appUrl = new URL(String(env.APP_URL || '')); }
  catch (e) { fouten.push('APP_URL is geen geldige publieke URL.'); }
  if (appUrl) {
    if (appUrl.protocol !== 'https:') fouten.push('APP_URL moet voor livegang https gebruiken.');
    if (appUrl.pathname !== '/' || appUrl.search || appUrl.hash)
      fouten.push('APP_URL moet de domeinroot zijn, zonder subpad, query of fragment.');
    if (env.RTG_TLS_DOMAIN !== appUrl.hostname)
      fouten.push('RTG_TLS_DOMAIN moet exact gelijk zijn aan de host uit APP_URL (' + appUrl.hostname + ').');
  }
  if (env.RTG_TLS !== '1' || env.RTG_ACME !== '1')
    fouten.push('Native live-HTTPS vereist RTG_TLS=1 en RTG_ACME=1.');
  if (!env.RTG_TLS_EMAIL || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(env.RTG_TLS_EMAIL))
    fouten.push('RTG_TLS_EMAIL ontbreekt of is ongeldig; certificaatmeldingen kunnen dan niet aankomen.');
  if (env.RTG_PROXY_HOPS !== '0')
    fouten.push('Native TLS staat rechtstreeks aan internet; zet RTG_PROXY_HOPS=0 zodat bezoekers geen proxykoppen kunnen laten geloven.');
  if (env.RTG_BETALEN_UIT !== '1')
    fouten.push('Deze eerste livegang is zonder betalingen afgesproken; RTG_BETALEN_UIT=1 moet fail-closed aan staan.');
  if (env.RTG_AI_UIT !== '1' && env.RTG_EXTERNE_AI_UIT !== '1')
    fouten.push('De lokale-eerst livegang vereist RTG_AI_UIT=1 of RTG_EXTERNE_AI_UIT=1.');
  if (!env.OFFICE_TOTP_SECRET)
    fouten.push('OFFICE_TOTP_SECRET ontbreekt; publieke enterprise-livegang vereist 2FA op de backoffice.');

  if (live.RTG_PUBLISH_HOST !== '0.0.0.0' && live.RTG_PUBLISH_HOST !== '::')
    fouten.push('RTG_PUBLISH_HOST moet publiek binden (0.0.0.0 of ::); nu: ' + (live.RTG_PUBLISH_HOST || 'leeg') + '.');
  if (String(live.RTG_PUBLISH_PORT || '') !== '443' || String(live.RTG_CONTAINER_PORT || '') !== '443')
    fouten.push('De live-poorten moeten RTG_PUBLISH_PORT=443 en RTG_CONTAINER_PORT=443 zijn.');
  const backupDir = String(live.RTG_BACKUP_HOST_DIR || '');
  if (!path.isAbsolute(backupDir)) fouten.push('RTG_BACKUP_HOST_DIR moet een absolute map op een afzonderlijke schijf/mount zijn.');
  else {
    try {
      const st = fs.statSync(backupDir);
      if (!st.isDirectory()) fouten.push(backupDir + ' is geen map.');
      else fs.accessSync(backupDir, fs.constants.R_OK | fs.constants.W_OK);
    } catch (e) { fouten.push('Externe back-upmap is niet bestaand en lees/schrijfbaar: ' + backupDir + '.'); }
  }
  const offsiteDir = String(live.RTG_BACKUP_OFFSITE_HOST_DIR || '');
  if (!path.isAbsolute(offsiteDir)) fouten.push('RTG_BACKUP_OFFSITE_HOST_DIR moet een absolute off-site WORM/Object-Lock-map zijn.');
  else if (path.resolve(offsiteDir) === path.resolve(backupDir || '/')) fouten.push('Lokale en off-site back-upmappen mogen niet dezelfde map zijn.');
  else {
    try {
      const st = fs.statSync(offsiteDir);
      if (!st.isDirectory()) fouten.push(offsiteDir + ' is geen map.');
      else fs.accessSync(offsiteDir, fs.constants.R_OK | fs.constants.W_OK);
    } catch (e) { fouten.push('Off-site WORM-back-upmap is niet bestaand en lees/schrijfbaar: ' + offsiteDir + '.'); }
  }
  if (String(live.RTG_BACKUP_OFFSITE_IMMUTABLE || '') !== '1')
    fouten.push('Zet RTG_BACKUP_OFFSITE_IMMUTABLE=1 nadat WORM/Object Lock/retentie buiten RTG werkelijk is afgedwongen.');
  const certPad = path.resolve(String(live.RTG_BACKUP_PUBLIC_CERT_FILE || ''));
  try { new crypto.X509Certificate(fs.readFileSync(certPad)); }
  catch (e) { fouten.push('Publiek back-upcertificaat ontbreekt of is ongeldig: ' + certPad + '.'); }
  if (!env.ERR_WEBHOOK_URL)
    waarschuwingen.push('Geen ERR_WEBHOOK_URL: de externe GitHub-sonde merkt totale uitval, maar interne fouten melden dan alleen op het techniekbord.');
  if (!env.TURN_URL || !env.TURN_SECRET)
    waarschuwingen.push('TURN_URL/TURN_SECRET ontbreken: videobellen werkt via eigen STUN, maar niet gegarandeerd door strenge 4G/bedrijfsfirewalls.');
}

console.log('\n=== RTG ' + (publiek ? 'publieke live-keuring' : 'self-host-keuring') + ' ===\n');
/* DOOR DE ZEEF. Wat deze keuring afdrukt zijn paden, hostnamen en
   bestandsrechten uit de omgeving -- geen geheimen, en de melding is zonder die
   waarden onbruikbaar ("een map ontbreekt" -- welke?). Die blijven dus staan.
   Wat de zeef wel weghaalt is een verbindingsreeks met inloggegevens, een
   e-mailadres en een sleutel, voor het geval een volgende melding er ooit een
   meeneemt. Zie scripts/lib/geenlek.js. */
for (const f of fouten) console.log(' ✗ ' + zonderGeheim(f));
for (const w of waarschuwingen) console.log(' ⚠ ' + zonderGeheim(w));
if (fouten.length) {
  console.log('\nNiet startklaar: ' + fouten.length + ' blokkerende fout(en).');
  process.exit(1);
}
console.log('\n✓ Geheimen en productieconfiguratie zijn startklaar.' +
  (publiek ? ' Native HTTPS, betalingen-uit, versleutelde en off-site back-ups zijn afgedwongen.' :
    (env.RTG_PRIVATE_BETA === '1' ? ' De app blijft een private, lokale beta.' : ' Draai voor publieke livegang ook npm run golive.')));
