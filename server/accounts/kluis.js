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
const scryptAsync = (pw, salt, len, opties) => new Promise((resolve, reject) =>
  crypto.scrypt(pw, salt, len, opties, (err, key) => err ? reject(err) : resolve(key)));

/* ---------- DE KOSTEN VAN SCRYPT, EN WAAROM ZE IN DE HASH ZELF STAAN ----------

   Hier stond `salt:hash`, en scrypt draaide op de Node-standaard (N=16384).
   Dat werkte, maar het had een gat dat je pas ziet als je het wilt gebruiken:
   ER WAS GEEN WEG OMHOOG. De opgeslagen hash zei nergens met welke kosten hij
   gemaakt was, dus wie de kosten wilde verhogen kon dat alleen doen door elk
   bestaand wachtwoord ongeldig te maken. Een instelling die je niet kunt
   veranderen is geen instelling maar een aanname, en deze aanname veroudert:
   scrypt-kosten horen mee te groeien met wat een aanvaller kan huren.

   Het nieuwe formaat draagt zijn eigen kosten:

       s2$<N>$<r>$<p>$<salt hex>$<hash hex>

   en het oude `salt:hash` blijft gewoon werken -- dat wordt gelezen als
   N=16384, r=8, p=1, want dat is wat het toen was. Een bestaande installatie
   merkt dus niets, en `moetVernieuwen()` hieronder zegt per hash of hij aan
   vervanging toe is. De inlogroute gebruikt dat om een hash bij een geslaagde
   inlog stilletjes op te waarderen: dat is het enige moment waarop het
   wachtwoord in leesbare vorm langskomt, dus het enige moment waarop het kan.

   DE KOSTEN ZIJN GEMETEN EN NIET OVERGESCHREVEN. Op deze machine (4 draden):

       N=16384   r=8 p=1     50 ms    16 MB per controle   ~80 inlogs/s
       N=32768   r=8 p=1     96 ms    32 MB                ~37 inlogs/s
       N=65536   r=8 p=1    198 ms    64 MB                ~18 inlogs/s
       N=131072  r=8 p=1    416 ms   128 MB                 ~9 inlogs/s

   De laatste is wat OWASP aanraadt, en die staat hier BEWUST NIET als
   standaard. 416 ms per inlog en 128 MB per gelijktijdige controle is een
   capaciteitsbesluit en geen vinkje: bij vier draden staat er dan een halve
   gigabyte alleen voor wachtwoorden, en de inlog wordt merkbaar traag. De
   standaard is N=32768: het dubbele werk voor een aanvaller ten opzichte van
   gisteren, en een inlog die onder de tiende seconde blijft. Wie meer wil zet
   RTG_SCRYPT_N hoger -- en dat KAN nu, want de hash onthoudt waarmee hij
   gemaakt is.

   MAXMEM MOET EXPLICIET MEE. Node's standaard maxmem is 32 MB en scrypt eist
   128*N*r bytes. Bij N=32768 is dat precies 32 MB en gooit hij er dus overheen.
   Zonder deze regel zou het verhogen van N een harde fout geven in plaats van
   een zwaardere hash. */
const SCRYPT_N = Math.max(1024, Number(process.env.RTG_SCRYPT_N) || 32768);
const SCRYPT_R = Math.max(1, Number(process.env.RTG_SCRYPT_R) || 8);
const SCRYPT_P = Math.max(1, Number(process.env.RTG_SCRYPT_P) || 1);
const scryptOpties = (N, r, p) => ({ N, r, p, maxmem: 256 * N * r + 1048576 });
const MERK_HASH = 's2';

const schrijfHash = (salt, hash, N, r, p) =>
  MERK_HASH + '$' + N + '$' + r + '$' + p + '$' + salt.toString('hex') + '$' + hash.toString('hex');

/* De opgeslagen hash uit elkaar halen. Let op de grenzen op N, r en p: die
   parameters komen uit de DATABASE, en scrypt rekent zo hard als je hem zegt.
   Zou iemand een rij kunnen zetten met N=2^30, dan is een enkele inlogpoging
   genoeg om de server minutenlang te laten malen en zijn geheugen op te eten --
   een denial of service via een veld dat er onschuldig uitziet. Een hash met
   waarden buiten deze grenzen is geen hash maar rommel, en rommel faalt dicht. */
function leesHash(stored) {
  const s = String(stored || '');
  if (s.startsWith(MERK_HASH + '$')) {
    const d = s.split('$');
    if (d.length !== 6) return null;
    const N = Number(d[1]), r = Number(d[2]), p = Number(d[3]);
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null;
    if (N < 1024 || N > 1048576 || r < 1 || r > 32 || p < 1 || p > 16) return null;
    if (!/^[0-9a-f]+$/i.test(d[4]) || !/^[0-9a-f]+$/i.test(d[5])) return null;
    return { N, r, p, salt: Buffer.from(d[4], 'hex'), hash: Buffer.from(d[5], 'hex'), oud: false };
  }
  const d = s.split(':');
  if (d.length !== 2) return null;
  if (!/^[0-9a-f]+$/i.test(d[0]) || !/^[0-9a-f]+$/i.test(d[1])) return null;
  // het oude formaat: precies de Node-standaard van toen
  return { N: 16384, r: 8, p: 1, salt: Buffer.from(d[0], 'hex'), hash: Buffer.from(d[1], 'hex'), oud: true };
}

function hashPasswordSync(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64, scryptOpties(SCRYPT_N, SCRYPT_R, SCRYPT_P));
  return schrijfHash(salt, hash, SCRYPT_N, SCRYPT_R, SCRYPT_P);
}
async function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const hash = await scryptAsync(String(pw), salt, 64, scryptOpties(SCRYPT_N, SCRYPT_R, SCRYPT_P));
  return schrijfHash(salt, hash, SCRYPT_N, SCRYPT_R, SCRYPT_P);
}
async function verifyPassword(pw, stored) {
  const h = leesHash(stored);
  if (!h || !h.hash.length) return false;
  let actual;
  try { actual = await scryptAsync(String(pw), h.salt, h.hash.length, scryptOpties(h.N, h.r, h.p)); }
  catch (e) { return false; }   // onmogelijke parameters: dicht, nooit open
  return h.hash.length === actual.length && crypto.timingSafeEqual(h.hash, actual);
}

/* Is deze hash aan vervanging toe? Waar: het oude formaat zonder parameters, of
   kosten die onder de huidige lat liggen. Alleen omhoog -- wie RTG_SCRYPT_N
   tijdelijk verlaagt hoort niet elke hash van het huis te verzwakken. */
function moetVernieuwen(stored) {
  const h = leesHash(stored);
  if (!h) return false;
  return h.oud || h.N < SCRYPT_N || h.r < SCRYPT_R || h.p < SCRYPT_P;
}

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
