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

/* EEN SLEUTEL VOOR EEN ANDER DOEL, AFGELEID EN NIET DE SESSIESLEUTEL ZELF.

   Er zijn buiten deze kluis dingen die ondertekend moeten worden -- het
   bewijstoken van het controlevlak is de eerste (kern/commercie/bewijstoken/
   zegel.js). Die mogen niet met S.SECRET tekenen, en niet omdat dat "netter"
   is: wie op de een of andere manier een handtekening onder zo'n token kan
   krijgen, zou daarmee anders een SESSIETOKEN kunnen maken. Domeinscheiding
   kost hier een regel en is later niet meer in te bouwen.

   Vandaar HKDF met het doel als label. De ruwe sleutel verlaat deze module
   nooit; een aanroeper krijgt alleen een afgeleide, en van een afgeleide kom je
   niet terug bij de bron. Een leeg doel geeft NIETS terug -- anders is
   `sleutelVoor()` zonder argument stilzwijgend hetzelfde als een vaste sleutel
   voor alles, en dan is de scheiding weg zonder dat iemand het merkt. */
/* De afleiding staat LOS van de kluisstaat, en dat is geen stijlkeuze. Toen zij
   nog rechtstreeks op S.SECRET stond, gaf `sleutelVoor` in elk toetsproces null
   -- de kluis is daar niet geinitialiseerd -- en sloeg de toets zichzelf stil
   over. Drie mutaties liepen er dwars doorheen. Een zuivere functie is te
   toetsen; een die op modulestaat leunt, doet alsof. */
function afleidSleutel(basis, doel) {
  const d = String(doel || '').trim();
  if (!d || !basis) return null;
  const b = Buffer.isBuffer(basis) ? basis : Buffer.from(String(basis), 'utf8');
  if (!b.length) return null;
  return Buffer.from(crypto.hkdfSync('sha256', b, Buffer.alloc(0), Buffer.from('rtg-doel:' + d), 32));
}
function sleutelVoor(doel) { return afleidSleutel(S.SECRET, doel); }

module.exports = {
  CODENAMES, enc, dec, encVeld, decVeld, emailHash, normalizePhone, phoneHash,
  scryptAsync, hashPasswordSync, hashPassword, verifyPassword, makeCodename, sign, sleutelVoor, afleidSleutel
};
