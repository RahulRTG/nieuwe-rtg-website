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

/* HET SEEDVENSTER: EEN ZOUT PER WACHTWOORD, MAAR ALLEEN TIJDENS DE DEMOSTART.

   Gemeten op 23 augustus 2026: een testserver deed bij het opstarten 220
   scryptSync-aanroepen in 9,1 seconden -- twee derde van een boot van 13,6
   seconden. Voor VIER wachtwoorden: 112x '5678', 71x '1234', 35x 'werk' en 2x
   'Imran'. Alle vier staan letterlijk in deze repository, want het is de
   demoseed. De suite start 647 servers, dus dat was anderhalf uur rekenwerk per
   ronde om vier bekende woorden 220 keer opnieuw te hashen.

   Wat hier NIET gebeurt is het verlagen van de scrypt-kosten. De parameters
   blijven die van Node (N=16384), het opslagformaat blijft zout:hash, en
   verifyPassword rekent onveranderd de volle prijs. Het enige wat verandert is
   dat DEZELFDE seed-invoer binnen EEN demostart hetzelfde zout deelt.

   Drie grendels, want een snelheidstruc die in productie lekt is geen truc maar
   een gat:

   1. RTG_DEMO=1. Dat is in productie een BLOKKERENDE startfout
      (server/config/productie-lokaal.js), dus geen belofte maar een machine.
   2. NODE_ENV !== 'production', als tweede slot op dezelfde deur.
   3. Het venster gaat DICHT vlak voor app.listen (server/opzet/luister.js).
      Daarna deelt niets meer een zout -- ook niet in demostand, ook niet in de
      runtime-paden die toevallig een Sync-variant gebruiken (de eigenaars-PIN
      van een nieuw bedrijf in kern/aanmeldingen/bedrijf.js is er zo een).

   Dat derde slot is het belangrijkste: zonder dat zou het venster de hele
   levensduur van het proces openstaan en zou de memo ongebonden groeien met
   elke pincode die er in de demo bijkomt.

   Handhaver: test/seedvenster.test.js. Die eist alle drie de grendels, en het
   derde bij een ECHTE server (twee registraties met hetzelfde wachtwoord
   krijgen na de start een verschillend zout) en niet alleen in-proces. Haal een
   grendel weg en die toets zakt; dat is met alle drie nagelopen. */
let seedVensterOpen = process.env.RTG_DEMO === '1' && process.env.NODE_ENV !== 'production';
const seedZouten = new Map();
let seedHergebruik = 0;

function versZout(pw) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pw), salt, 64);
  return salt.toString('hex') + ':' + hash.toString('hex');
}

function hashPasswordSync(pw) {
  if (!seedVensterOpen) return versZout(pw);
  const sleutel = String(pw);
  const bestaand = seedZouten.get(sleutel);
  if (bestaand) { seedHergebruik++; return bestaand; }
  const verse = versZout(sleutel);
  seedZouten.set(sleutel, verse);
  return verse;
}

/* Het venster sluiten. Geeft terug of het openstond en wat het opleverde, zodat
   de aanroeper dat kan loggen en een toets het kan nakijken -- een sluiter die
   stil niets doet is geen sluiter (LAT-regel 5), en een besparing die niemand
   meet verdwijnt ongemerkt weer (LAT-regel 10). Idempotent: twee keer sluiten
   is geen fout. */
function sluitSeedvenster() {
  const stondOpen = seedVensterOpen;
  const hergebruikt = seedHergebruik;
  const woorden = seedZouten.size;
  seedVensterOpen = false;
  seedZouten.clear();
  /* En de teller terug op nul, want dit bestand belooft in STATE.json dat
     sluitSeedvenster() alle drie de seedwortels herstelt. Die regel stond hier
     niet: het venster en de memo gingen dicht, de teller liep door. Dat is geen
     gedragsfout -- de teller stuurt niets aan -- maar wel een register dat iets
     beweert wat de code niet doet, en op zulke beweringen wordt straks een
     server hergebruikt. Gevonden door scripts/staat.js zelf, die sinds vandaag
     nakijkt of een beloofde reset zijn wortel ook echt aanraakt. Het getal is
     hierboven al veiliggesteld en gaat gewoon mee terug. */
  seedHergebruik = 0;
  return { stondOpen, woorden, hergebruikt };
}
function seedvensterOpen() { return seedVensterOpen; }
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
  CODENAMES, enc, dec, encVeld, decVeld, emailHash, normalizePhone, phoneHash,
  scryptAsync, hashPasswordSync, hashPassword, verifyPassword, makeCodename, sign,
  sluitSeedvenster, seedvensterOpen
};
