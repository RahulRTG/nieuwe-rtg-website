/* Maakt alle productiegeheimen in één keer.

   Normaal:
     npm run sleutels
     npm run sleutels -- --schrijf

   Veilige self-hosted private beta (alleen localhost):
     npm run selfhost:init -- --eigenaar=jij@domein.nl

   Publiek, bewust zonder externe AI en zonder enige betaalrail:
     npm run live:init -- --eigenaar=jij@domein.nl \
       --url=https://jouw-domein.nl --smtp-url=smtps://...

   --docker maakt ook een apart PostgreSQL-wachtwoordbestand. Bestaande
   geheimen worden nooit stil overschreven; --force is bewust en expliciet.
   --stil drukt gegenereerde geheimen niet naar terminal/loggeschiedenis. */
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const argv = process.argv.slice(2);
const heeft = (naam) => argv.includes(naam);
const optie = (naam) => {
  const voor = naam + '=';
  const a = argv.find(x => x.startsWith(voor));
  return a ? a.slice(voor.length) : '';
};
const hex = (n) => crypto.randomBytes(n).toString('hex');
const CODEABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = (n) => Array.from({ length: n }, () => CODEABC[crypto.randomInt(CODEABC.length)]).join('');

function base32(buf) {
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, waarde = 0, uit = '';
  for (const b of buf) {
    waarde = (waarde << 8) | b; bits += 8;
    while (bits >= 5) { uit += ABC[(waarde >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) uit += ABC[(waarde << (5 - bits)) & 31];
  return uit;
}

const docker = heeft('--docker');
const priveBeta = heeft('--prive-beta');
const zonderAi = heeft('--zonder-ai');
const zonderBetalen = heeft('--zonder-betalen');
const zonderSms = heeft('--zonder-sms');
const nativeTls = heeft('--native-tls');
const stil = heeft('--stil');
const schrijven = heeft('--schrijf');
const forceren = heeft('--force');
const eigenaar = optie('--eigenaar') || 'VUL-IN@JOUW-DOMEIN.NL';
const poort = optie('--poort') || '3000';
const appUrl = optie('--url') || (priveBeta ? 'http://127.0.0.1:' + poort : 'https://VUL-IN.NL');
const smtpUrl = optie('--smtp-url') || 'smtps://VUL-IN';
const totp = base32(crypto.randomBytes(20));
let tlsDomein = 'VUL-IN.NL';
try { tlsDomein = new URL(appUrl).hostname || tlsDomein; } catch (e) {}

const regels = [
  ['NODE_ENV', 'production'],
  ['RTG_ENC_KEY', hex(32), 'versleuteling-at-rest van de database'],
  ['RTG_VAULT_KEY', hex(32), 'identiteitskluis (namen/e-mail); gedeeld over alle instances'],
  ['RTG_SECRET_KEY', hex(32), 'sessietokens; gedeeld over alle instances'],
  ['RTG_CLUSTER_KEY', hex(24), 'beschermt de failover-endpoints'],
  ['RTG_MOTOR_TOKEN', hex(32), 'beschermt de interne Rust-geldmotor'],
  ['OFFICE_CODE', code(12), 'inlogcode van de RTG-Backoffice'],
  ['OFFICE_TOTP_SECRET', totp, 'tweede factor (2FA) van de backoffice; scan de otpauth-regel hieronder'],
  ['DEMO_PASS', hex(12), 'vervangt het demo-wachtwoord (demo staat in productie sowieso uit)'],
  ['RTG_OWNER_EMAIL', eigenaar, 'HANDMATIG: het echte e-mailadres van de eigenaar (technische pagina)'],
  ['RTG_OWNER_BOOTSTRAP', hex(16), 'EENMALIG: hiermee claimt de eigenaar zijn account bij de eerste start; daarna weghalen'],
  ['APP_URL', appUrl, 'HANDMATIG: het publieke adres (links in e-mails)']
];

if (priveBeta) {
  regels.push(['RTG_PRIVATE_BETA', '1', 'ALLEEN LOKAAL: mail blijft in de outbox']);
} else {
  regels.push(
    ['DATABASE_URL', docker ? '' : 'postgresql://VUL-IN', docker ? 'Docker bouwt deze veilig uit het aparte PostgreSQL-geheim' : 'HANDMATIG: PostgreSQL (verplicht bij meerdere instances/vloot)'],
    ['REDIS_URL', docker ? 'redis://redis:6379' : 'redis://VUL-IN', 'HANDMATIG: realtime over meerdere instances'],
    ['SMTP_URL', smtpUrl, 'HANDMATIG: anders worden e-mails niet echt verstuurd']
  );
}
if (zonderAi) regels.push(['RTG_AI_UIT', '1', 'BEWUST: geen externe AI; handmatige werkmodus blijft beschikbaar']);
if (zonderBetalen || priveBeta) regels.push(['RTG_BETALEN_UIT', '1', 'BEWUST: zonder echte provider weigert elke betaalactie fail-closed']);
if (zonderSms) regels.push(['RTG_HERSTEL_SMS_UIT_BEWUST', '1', 'BEWUST: telefoonherstel weigert fail-closed zolang geen echte SMS-provider is gekoppeld']);
if (nativeTls) regels.push(
  ['RTG_TLS', '1', 'native TLS/HTTP2 in RTG zelf'],
  ['RTG_ACME', '1', 'automatisch publiek certificaat via Let\'s Encrypt'],
  ['RTG_TLS_DOMAIN', tlsDomein, 'domein voor het publieke certificaat'],
  ['RTG_TLS_EMAIL', optie('--tls-email') || eigenaar, 'contactadres voor certificaatmeldingen'],
  ['RTG_PROXY_HOPS', '0', 'geen proxy vóór native TLS; negeer aangeleverde proxykoppen']
);

const blok = [];
blok.push('# RTG-productiegeheimen, gegenereerd op ' + new Date().toISOString());
blok.push('# Bewaar dit in je geheimenbeheer. Regels met HANDMATIG vul je zelf in.');
for (const [naam, waarde, uitleg] of regels) {
  if (uitleg) blok.push('# ' + uitleg);
  if (waarde === '' && docker && naam === 'DATABASE_URL') blok.push('# DATABASE_URL wordt in Docker veilig samengesteld; niet hier opslaan.');
  else blok.push(naam + '=' + waarde);
}

if (!stil) {
  console.log(blok.join('\n'));
  console.log('\n# 2FA koppelen: voer dit adres (of het secret hierboven) in je authenticator-app in:');
  console.log('# otpauth://totp/RTG%20Backoffice?secret=' + totp + '&issuer=RTG');
}

function schrijfNieuw(doel, inhoud) {
  fs.mkdirSync(path.dirname(doel), { recursive: true, mode: 0o700 });
  if (fs.existsSync(doel) && !forceren)
    throw new Error(doel + ' bestaat al; bestaande sleutels blijven veilig staan. Gebruik alleen bewust --force.');
  const tijdelijk = doel + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, inhoud, { mode: 0o600, flag: 'wx' });
  fs.renameSync(tijdelijk, doel);
  try { fs.chmodSync(doel, 0o600); } catch (e) {}
}

if (schrijven) {
  try {
    const doel = path.resolve(optie('--doel') || path.join(__dirname, '..', '.env.productie'));
    const pgDoel = docker
      ? path.resolve(optie('--postgres-doel') || path.join(path.dirname(doel), '.rtg-secrets', 'postgres_password'))
      : '';
    // Eerst ALLE doelen controleren; zo laat een tweede run nooit een half
    // vernieuwde sleutelset achter.
    if (fs.existsSync(doel) && !forceren)
      throw new Error(doel + ' bestaat al; bestaande sleutels blijven veilig staan. Gebruik alleen bewust --force.');
    if (docker && fs.existsSync(pgDoel) && !forceren)
      throw new Error(pgDoel + ' bestaat al; het databasewachtwoord wordt nooit stil vervangen.');

    if (docker) {
      if (fs.existsSync(pgDoel)) {
        // Zelfs --force roteert een bestaand databasewachtwoord niet: PostgreSQL
        // bewaart zijn eigen hash in het datavolume en zou daarna onbereikbaar
        // worden. Rotatie is een aparte databasehandeling, geen bestandsschrijf.
        console.log('\n# Bestaand PostgreSQL-geheim blijft ongewijzigd: ' + pgDoel);
      } else {
        schrijfNieuw(pgDoel, hex(32) + '\n');
        console.log('\n# Apart PostgreSQL-geheim: ' + pgDoel + ' (rechten 600).');
      }
    }
    schrijfNieuw(doel, blok.join('\n') + '\n');
    console.log('# Geschreven naar ' + doel + ' (rechten 600, staat in .gitignore).');
    console.log('# Controleer met: npm run selfhost:check');
  } catch (e) {
    console.error('\n# NIET geschreven: ' + e.message);
    process.exitCode = 1;
  }
} else {
  if (!stil) console.log('\n# Tip: npm run sleutels -- --schrijf zet dit blok veilig in .env.productie');
}
console.log('\n# Publieke livegang controleer je met: npm run golive');
