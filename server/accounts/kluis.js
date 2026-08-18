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
/* Een heel veld versleuteld opslaan, met een markering ervoor. De markering is
   het verschil met enc()/dec() hierboven: die gaan over velden die ALTIJD
   versleuteld zijn (enc_name, enc_email). Dit is voor velden die vroeger platte
   tekst waren en dat in bestaande databases nog zijn: leest de markering niet,
   dan is het oude platte tekst en geven we hem ongewijzigd terug. Zo migreert
   een draaiende installatie vanzelf mee, bij de eerstvolgende schrijfactie. */
const MERK = 'RTGV1:';
function encVeld(tekst) {
  if (tekst == null) return null;
  return MERK + enc(String(tekst));
}
function decVeld(waarde) {
  if (waarde == null) return null;
  const s = String(waarde);
  if (!s.startsWith(MERK)) return s;           // nog niet gemigreerd: platte tekst
  return dec(s.slice(MERK.length));            // null bij een verkeerde sleutel
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

/* ---------- wachtwoorden ----------
   Staan in ./wachtwoord.js: scrypt, het hashformaat met zijn kosten, en het
   migratiepad voor een hash uit de oude wereld. Ze reizen hieronder gewoon mee
   naar buiten, zodat aanroepers niets van de knip merken -- zelfde vorm als
   ./users.js met ./tokens.js. */
const wachtwoord = require('./wachtwoord');
const { scryptAsync, hashPasswordSync, hashPassword, verifyPassword, moetVernieuwen,
  SCRYPT_N, SCRYPT_R, SCRYPT_P } = wachtwoord;


function makeCodename() {
  return CODENAMES[crypto.randomInt(CODENAMES.length)] + ' ' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

/* ondertekening van staatloze tokens (de token-vorm zelf staat in ./users). */
function sign(body) { return crypto.createHmac('sha256', S.SECRET).update(body).digest('hex').slice(0, 32); }

module.exports = {
  CODENAMES, enc, dec, encVeld, decVeld, emailHash, normalizePhone, phoneHash,
  scryptAsync, hashPasswordSync, hashPassword, verifyPassword, moetVernieuwen, makeCodename, sign,
  SCRYPT_N, SCRYPT_R, SCRYPT_P
};
