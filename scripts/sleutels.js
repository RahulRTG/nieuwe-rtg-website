/* Maakt in een keer alle geheimen die productie nodig heeft en drukt ze af als
   .env-blok. Draai: npm run sleutels
   Met --schrijf komt hetzelfde blok ook als bestand .env.productie in de
   projectmap te staan (rechten 600, staat in .gitignore); de go-live-keuring
   (npm run golive) leest dat bestand dan vanzelf mee.
   Bewaar de uitvoer in je geheimenbeheer (niet in git); dezelfde sleutels
   moeten op ELKE instance staan (RTG_VAULT_KEY en RTG_SECRET_KEY vooral). */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const hex = (n) => crypto.randomBytes(n).toString('hex');
const code = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[crypto.randomInt(31)]).join('');
// base32 (RFC 4648, zonder padding): het formaat dat authenticator-apps eten
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

const totp = base32(crypto.randomBytes(20));
const regels = [
  ['NODE_ENV', 'production'],
  ['RTG_ENC_KEY', hex(32), 'versleuteling-at-rest van de database'],
  ['RTG_VAULT_KEY', hex(32), 'identiteitskluis (namen/e-mail); gedeeld over alle instances'],
  ['RTG_SECRET_KEY', hex(32), 'sessietokens; gedeeld over alle instances'],
  ['RTG_CLUSTER_KEY', hex(24), 'beschermt de failover-endpoints'],
  ['OFFICE_CODE', code(12), 'inlogcode van de RTG-Backoffice'],
  ['OFFICE_TOTP_SECRET', totp, 'tweede factor (2FA) van de backoffice; scan de otpauth-regel hieronder'],
  ['DEMO_PASS', hex(12), 'vervangt het demo-wachtwoord (demo staat in productie sowieso uit)'],
  ['RTG_OWNER_EMAIL', 'VUL-IN@JOUW-DOMEIN.NL', 'HANDMATIG: het echte e-mailadres van de eigenaar (technische pagina)'],
  ['APP_URL', 'https://VUL-IN.NL', 'HANDMATIG: het publieke adres (links in e-mails)'],
  ['DATABASE_URL', 'postgresql://VUL-IN', 'HANDMATIG: PostgreSQL (verplicht bij meerdere instances/vloot)'],
  ['REDIS_URL', 'redis://VUL-IN', 'HANDMATIG: realtime over meerdere instances'],
  ['SMTP_URL', 'smtps://VUL-IN', 'HANDMATIG: anders worden e-mails niet echt verstuurd']
];

const blok = [];
blok.push('# RTG-productiegeheimen, gegenereerd op ' + new Date().toISOString());
blok.push('# Bewaar dit in je geheimenbeheer. Regels met HANDMATIG vul je zelf in.');
for (const [naam, waarde, uitleg] of regels) {
  if (uitleg) blok.push('# ' + uitleg);
  blok.push(naam + '=' + waarde);
}
console.log(blok.join('\n'));
// de 2FA-koppelregel: scannen met een authenticator-app (of handmatig invoeren)
console.log('\n# 2FA koppelen: voer dit adres (of het secret hierboven) in je authenticator-app in:');
console.log('# otpauth://totp/RTG%20Backoffice?secret=' + totp + '&issuer=RTG');

if (process.argv.includes('--schrijf')) {
  const doel = path.join(__dirname, '..', '.env.productie');
  fs.writeFileSync(doel, blok.join('\n') + '\n', { mode: 0o600 });
  console.log('\n# Geschreven naar ' + doel + ' (rechten 600, staat in .gitignore).');
  console.log('# Vul de HANDMATIG-regels in en draai daarna: npm run golive');
} else {
  console.log('\n# Tip: npm run sleutels -- --schrijf zet dit blok meteen in .env.productie');
}
console.log('\n# Controleer daarna alles in een keer met: npm run golive');
