/* Accounts, deel "wachtwoord": scrypt, het hashformaat en het migratiepad.

   Afgesplitst uit ./kluis.js. Dat bestand droeg vijf onderwerpen naast elkaar
   -- de identiteitskluis, de zoek-hashes, de wachtwoorden, de codenaam-generator
   en de token-ondertekening -- en toen het wachtwoorddeel zijn kostenformaat en
   zijn migratiepad kreeg, werd het het zwaarste van de vijf. De keuring wees
   kluis.js daarop aan (bijna over de 10 kB), en dat is de juiste waarschuwing:
   een bestand dat je niet in een keer kunt lezen, kun je ook niet in een keer
   nakijken.

   Dit is de natuurlijke naad. Wachtwoorden zijn hier het enige onderwerp: hoe
   ze gehasht worden, hoe duur dat is, hoe dat op te schrijven valt en hoe een
   oude hash bijgetrokken wordt. De aanroepers merken er niets van: ./kluis.js
   exporteert deze functies gewoon door, precies zoals ./users.js dat met
   ./tokens.js doet.

   Draait op ./state voor niets -- dit deel heeft geen sleutel uit de kluis
   nodig, alleen crypto. Dat is meteen de reden dat de knip hier zo rustig is. */
const crypto = require('crypto');

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

module.exports = {
  scryptAsync, hashPasswordSync, hashPassword, verifyPassword, moetVernieuwen,
  SCRYPT_N, SCRYPT_R, SCRYPT_P
};
