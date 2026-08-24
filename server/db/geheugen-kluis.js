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
// De datamap als LEZING, niet als momentopname bij het laden -- zie ./opslag.js.
const { dataMap, beslotenMap, besloten } = require('./opslag');

const MAGIC = Buffer.from('RTGMEM1');

function laadSleutel() {
  const ruw = process.env.RTG_ENC_KEY || '';
  if (ruw) return /^[0-9a-fA-F]{64}$/.test(ruw) ? Buffer.from(ruw, 'hex') : crypto.createHash('sha256').update(ruw).digest();
  const kf = path.join(dataMap(), 'geheugen.key');
  try {
    if (fs.existsSync(kf)) { const b = Buffer.from(fs.readFileSync(kf, 'utf8').trim(), 'hex'); if (b.length === 32) return b; }
  } catch (e) {}
  const nieuw = crypto.randomBytes(32);
  try { beslotenMap(dataMap()); fs.writeFileSync(kf, nieuw.toString('hex'), { mode: 0o600 }); besloten(kf); }
  catch (e) { console.warn('[geheugen] kon de sleutel niet bewaren (' + e.message + '); draai door met een sessiesleutel.'); }
  return nieuw;
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
