/* De sleutel en het blokformaat van de GEHEUGEN-motor.

   Los van de motor omdat het een eigen ding is: hoe een stuk tekst een
   versleuteld blok wordt en weer terug. De motor eromheen gaat over brokken,
   generaties en het manifest en hoeft dit binnenwerk niet te kennen.

   Versleuteld-at-rest is hier ALTIJD aan, ook zonder RTG_ENC_KEY. De sleutel
   komt uit RTG_ENC_KEY als die er staat (ops houdt de regie), anders uit een
   zelf aangemaakte 32-byte sleutel in de datamap (geheugen.key, 0600, staat in
   .gitignore). AES-256-GCM, dus authenticated: een gekanteld bitje valt op bij
   het lezen in plaats van als stille datacorruptie door te sijpelen. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DATA_DIR, beslotenMap, besloten } = require('./opslag');
const { leesOfPubliceer } = require('../lib/sleutelbestand');

const MAGIC = Buffer.from('RTGMEM1');

function laadSleutel() {
  const ruw = process.env.RTG_ENC_KEY || '';
  if (ruw) return /^[0-9a-fA-F]{64}$/.test(ruw) ? Buffer.from(ruw, 'hex') : crypto.createHash('sha256').update(ruw).digest();
  const kf = path.join(DATA_DIR, 'geheugen.key');
  /* Lezen, of als EERSTE publiceren (server/lib/sleutelbestand.js). Hier stond
     een lezing die bij een korte sleutel stil een NIEUWE schreef, over de oude
     heen -- en een tweede proces dat midden in het schrijven las, zag precies
     zo'n korte sleutel. Een bestand dat er staat en geen sleutel is, wordt nu
     nooit vervangen; alleen als publiceren zelf niet lukt (een datamap die niet
     beschrijfbaar is) draait dit door met een sessiesleutel, zoals het al deed. */
  let hex;
  try {
    beslotenMap(DATA_DIR);
    hex = leesOfPubliceer(kf, () => crypto.randomBytes(32).toString('hex'), (p) => fs.readFileSync(p, 'utf8'));
    besloten(kf);
  } catch (e) {
    console.warn('[geheugen] kon de sleutel niet bewaren (' + e.message + '); draai door met een sessiesleutel.');
    return crypto.randomBytes(32);
  }
  const b = Buffer.from(String(hex).trim(), 'hex');
  if (b.length !== 32) throw new Error('geheugen.key is geen sleutel van 32 bytes; hij wordt met opzet NIET vervangen (server/lib/sleutelbestand.js).');
  return b;
}
let KEY = null;
function sleutel() { if (!KEY) KEY = laadSleutel(); return KEY; }

// tekst -> binair blok (magic|iv|tag|ciphertext) en terug (authenticated)
function versleutel(tekst) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', sleutel(), iv);
  const enc = Buffer.concat([c.update(Buffer.from(tekst, 'utf8')), c.final()]);
  return Buffer.concat([MAGIC, iv, c.getAuthTag(), enc]);
}
function ontsleutel(buf) {
  if (!buf || buf.length < MAGIC.length + 28 || !buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('geen geldig geheugen-blok');
  const p = MAGIC.length;
  const d = crypto.createDecipheriv('aes-256-gcm', sleutel(), buf.subarray(p, p + 12));
  d.setAuthTag(buf.subarray(p + 12, p + 28));
  return Buffer.concat([d.update(buf.subarray(p + 28)), d.final()]).toString('utf8');
}

module.exports = { versleutel, ontsleutel };
