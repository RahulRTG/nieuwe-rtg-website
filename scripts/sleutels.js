/* Maakt in een keer alle geheimen die productie nodig heeft en drukt ze af als
   .env-blok. Draai: npm run sleutels
   Bewaar de uitvoer in je geheimenbeheer (niet in git); dezelfde sleutels
   moeten op ELKE instance staan (RTG_VAULT_KEY en RTG_SECRET_KEY vooral). */
const crypto = require('crypto');

const hex = (n) => crypto.randomBytes(n).toString('hex');
const code = (n) => Array.from({ length: n }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[crypto.randomInt(31)]).join('');

const regels = [
  ['NODE_ENV', 'production'],
  ['RTG_ENC_KEY', hex(32), 'versleuteling-at-rest van de database'],
  ['RTG_VAULT_KEY', hex(32), 'identiteitskluis (namen/e-mail); gedeeld over alle instances'],
  ['RTG_SECRET_KEY', hex(32), 'sessietokens; gedeeld over alle instances'],
  ['RTG_CLUSTER_KEY', hex(24), 'beschermt de failover-endpoints'],
  ['OFFICE_CODE', code(12), 'inlogcode van de RTG-Backoffice'],
  ['DEMO_PASS', hex(12), 'vervangt het demo-wachtwoord (demo staat in productie sowieso uit)'],
  ['RTG_OWNER_EMAIL', 'VUL-IN@JOUW-DOMEIN.NL', 'HANDMATIG: het echte e-mailadres van de eigenaar (technische pagina)'],
  ['APP_URL', 'https://VUL-IN.NL', 'HANDMATIG: het publieke adres (links in e-mails)'],
  ['DATABASE_URL', 'postgresql://VUL-IN', 'HANDMATIG: PostgreSQL (verplicht bij meerdere instances/vloot)'],
  ['REDIS_URL', 'redis://VUL-IN', 'HANDMATIG: realtime over meerdere instances'],
  ['SMTP_URL', 'smtps://VUL-IN', 'HANDMATIG: anders worden e-mails niet echt verstuurd']
];

console.log('# RTG-productiegeheimen, gegenereerd op ' + new Date().toISOString());
console.log('# Bewaar dit in je geheimenbeheer. Regels met HANDMATIG vul je zelf in.');
for (const [naam, waarde, uitleg] of regels) {
  if (uitleg) console.log('# ' + uitleg);
  console.log(naam + '=' + waarde);
}
console.log('\n# Controleer daarna alles in een keer met: npm run golive');
