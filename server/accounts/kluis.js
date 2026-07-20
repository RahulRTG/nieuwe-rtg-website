/* Accounts, deel "kluis": de pseudonimisering en de cryptografie los van de data.
   De identiteitskluis (AES-256-GCM versleuteling van naam/e-mail/telefoon met de
   VAULT-sleutel), de zoek-hashes (HMAC op e-mail/telefoon), de wachtwoorden
   (scrypt + salt, tijd-veilig vergeleken), de token-ondertekening (HMAC met de
   SECRET-sleutel) en de codenaam-generator. Afgesplitst uit accounts.js; de
   sleutels komen live uit ./state (na init). */
const crypto = require('crypto');
const S = require('./state');

const CODENAMES = [
  'Zilveren Valk', 'Gouden Ibis', 'Noordelijke Ster', 'Witte Reiger', 'Blauwe Fenix',
  'Stille Havik', 'Rode Kraanvogel', 'Zwarte Zwaan', 'Zilveren Lynx', 'Gouden Panter',
  'Nachtorchidee', 'Zeearend', 'Poolvos', 'Marmeren Valk', 'Saffieren Ooievaar'
];

/* ---------- identiteitskluis (versleuteling van naam/e-mail) ---------- */
function enc(text) {
  if (text == null) return null;
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', S.VAULT, iv);
  const ct = Buffer.concat([c.update(String(text), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function dec(blob) {
  if (!blob) return null;
  try {
    const buf = Buffer.from(blob, 'base64');
    const d = crypto.createDecipheriv('aes-256-gcm', S.VAULT, buf.subarray(0, 12));
    d.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
  } catch (e) { return null; }
}
function emailHash(email) {
  return crypto.createHmac('sha256', S.VAULT).update(String(email || '').trim().toLowerCase()).digest('hex');
}
// Normaliseer een telefoonnummer tot louter cijfers (met landcode) voor de hash,
// zodat een telefoonnummer aan het juiste account gekoppeld kan worden.
function normalizePhone(phone) {
  let p = String(phone || '').replace(/[^\d+]/g, '');
  if (p.startsWith('00')) p = '+' + p.slice(2);
  if (p.startsWith('0')) p = '+31' + p.slice(1); // NL-standaard voor de demo
  if (!p.startsWith('+') && p.length >= 9) p = '+' + p;
  return p.replace(/\D/g, '');
}
function phoneHash(phone) {
  const n = normalizePhone(phone);
  return n ? crypto.createHmac('sha256', S.VAULT).update(n).digest('hex') : null;
}

/* ---------- wachtwoorden (scrypt + salt, tijd-veilige vergelijking) ----------
   scrypt is bewust zwaar (dat is de bescherming), maar de synchrone variant
   blokkeert de HELE server tijdens het rekenen: bij 100 gelijktijdige logins
   stond alles seconden stil. De asynchrone variant rekent in de threadpool
   naast de server, zodat andere verzoeken gewoon doorlopen. De Sync-varianten
   blijven bestaan voor het opstarten (seed) en tests: eenmalig blokkeren voor
   'listen' is prima en houdt de boot deterministisch. */
const scryptAsync = (pw, salt, len) => new Promise((resolve, reject) =>
  crypto.scrypt(pw, salt, len, (err, key) => err ? reject(err) : resolve(key)));

function hashPasswordSync(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(String(pw), salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}
async function verifyPassword(pw, stored) {
  const parts = String(stored || '').split(':');
  if (parts.length !== 2) return false;
  const salt = Buffer.from(parts[0], 'hex');
  const expected = Buffer.from(parts[1], 'hex');
  const actual = await scryptAsync(String(pw), salt, 64);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function makeCodename() {
  return CODENAMES[crypto.randomInt(CODENAMES.length)] + ' ' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

/* ondertekening van staatloze tokens (de token-vorm zelf staat in ./users). */
function sign(body) { return crypto.createHmac('sha256', S.SECRET).update(body).digest('hex').slice(0, 32); }

module.exports = {
  CODENAMES, enc, dec, emailHash, normalizePhone, phoneHash,
  scryptAsync, hashPasswordSync, hashPassword, verifyPassword, makeCodename, sign
};
