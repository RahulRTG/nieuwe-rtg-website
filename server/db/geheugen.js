/* ============================================================================
   De GEHEUGEN-motor: een volledig in-memory runtime-engine voor de RTG-backend.

   De hele werkende staat leeft in het RAM (db.data), net als bij de andere
   motoren. Wat deze motor anders (en beter) doet is HOE hij die staat duurzaam
   en privé op schijf bewaart. De JSON-motor serialiseert bij elke save() de HELE
   datastore, versleutelt die (alleen als RTG_ENC_KEY staat) en schrijft alles
   opnieuw weg -- O(alle data) per mutatie, en boven ~512 MB knapt de ene grote
   string ("Invalid string length"). Deze motor lost dat op:

   - SNELLER / ZUINIGER : de staat wordt per top-level-collectie in een eigen
     brok bewaard. Een save herschrijft alleen de BROKKEN die echt veranderd zijn
     (vergelijk op sha-256); onveranderde brokken kosten geen encryptie, geen
     schijf en geen fsync. Er wordt nooit één reuzenstring van de hele database
     gebouwd, dus de 512 MB-grens van de JSON-motor bestaat hier niet.
   - VEILIGER : elke brok is los versleuteld met AES-256-GCM (authenticated: een
     bitje kantelen valt op). Schrijven gaat atomisch + fsync (via schrijfDuurzaam).
     Een manifest met per-brok een sha-256 en een generatienummer wordt ALS LAATSTE
     geschreven en is het commit-punt. Crasht een save halverwege, dan wijst het
     oude manifest nog naar de oude brokken: de vastgelegde staat raakt nooit half.
     Kan de nieuwste generatie toch niet volledig gelezen worden, dan rolt de motor
     terug naar de vorige, volledig consistente generatie (nooit een mengsel).
   - PRIVACY by design : versleuteld-at-rest is hier ALTIJD aan, ook zonder
     RTG_ENC_KEY. De sleutel komt uit RTG_ENC_KEY als die er is (ops houdt de
     regie), anders uit een zelf aangemaakte 32-byte sleutel in de datamap
     (geheugen.key, 0600, staat in .gitignore). Niets komt ooit als platte tekst
     op schijf.

   Aanzetten met RTG_STORE=geheugen. De rest van de app merkt er niets van: die
   praat alleen met db.data en save(), net als bij json/sqlite/postgres.
   ============================================================================ */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const state = require('./state');
const { DATA_DIR, beslotenMap, besloten, schrijfDuurzaam } = require('./opslag');

const db = state.db;
const GDIR = path.join(DATA_DIR, 'geheugen');
const MANIFEST = path.join(GDIR, 'manifest.rtgm');
const MAGIC = Buffer.from('RTGMEM1');

/* ---------- sleutel: RTG_ENC_KEY, anders een eigen sleutel in de datamap ---------- */
function laadSleutel() {
  const ruw = process.env.RTG_ENC_KEY || '';
  if (ruw) return /^[0-9a-fA-F]{64}$/.test(ruw) ? Buffer.from(ruw, 'hex') : crypto.createHash('sha256').update(ruw).digest();
  const kf = path.join(DATA_DIR, 'geheugen.key');
  try {
    if (fs.existsSync(kf)) { const b = Buffer.from(fs.readFileSync(kf, 'utf8').trim(), 'hex'); if (b.length === 32) return b; }
  } catch (e) {}
  const sleutel = crypto.randomBytes(32);
  try { beslotenMap(DATA_DIR); fs.writeFileSync(kf, sleutel.toString('hex'), { mode: 0o600 }); besloten(kf); }
  catch (e) { console.warn('[geheugen] kon de sleutel niet bewaren (' + e.message + '); draai door met een sessiesleutel.'); }
  return sleutel;
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

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const brokBestand = key => path.join(GDIR, 'k-' + crypto.createHash('sha1').update(String(key)).digest('hex').slice(0, 20) + '.rtgm');

// het sha-geheugen van de laatst weggeschreven brokken: zo weet save() wat er
// veranderd is zonder een tweede kopie van de data te bewaren (zuinig).
let laatsteSha = {};       // key -> sha van de laatst geschreven serialisatie
let generatie = 0;

/* ---------- laden ---------- */
function leesManifest(bestand) {
  try { return JSON.parse(ontsleutel(fs.readFileSync(bestand))); }
  catch (e) { return null; }
}
// Bouw de datastore die een manifest beschrijft; elke brok wordt geverifieerd
// tegen zijn sha (primair bestand, anders de .bak van de vorige generatie).
// Geeft het object terug, of null als één brok onherstelbaar is.
function assembleer(man) {
  if (!man || !man.keys) return null;
  const uit = {};
  for (const key of Object.keys(man.keys)) {
    const wil = man.keys[key].sha;
    let goed = null;
    for (const bestand of [brokBestand(key), brokBestand(key) + '.bak']) {
      try { const tekst = ontsleutel(fs.readFileSync(bestand)); if (sha(tekst) === wil) { goed = tekst; break; } }
      catch (e) {}
    }
    if (goed == null) return null;               // deze generatie is niet compleet
    try { uit[key] = JSON.parse(goed); } catch (e) { return null; }
  }
  return uit;
}
// Laad de nieuwste consistente generatie; val zo nodig terug op de vorige.
function laadGeheugen() {
  if (!fs.existsSync(MANIFEST)) return null;     // verse installatie
  const man = leesManifest(MANIFEST);
  if (man) { const d = assembleer(man); if (d) { generatie = man.generatie || 0; herbouwSha(man, d); return d; } }
  const bak = leesManifest(MANIFEST + '.bak');
  if (bak) { const d = assembleer(bak); if (d) { console.warn('[geheugen] nieuwste generatie onvolledig; teruggerold naar de vorige.'); generatie = bak.generatie || 0; herbouwSha(bak, d); return d; } }
  console.warn('[geheugen] geen leesbare generatie gevonden; de opslag start opnieuw op.');
  return null;
}
function herbouwSha(man, d) { laatsteSha = {}; for (const key of Object.keys(man.keys)) { try { laatsteSha[key] = sha(JSON.stringify(d[key])); } catch (e) {} } }

/* ---------- schrijven ---------- */
function schrijfBrokAtomisch(key, tekst) {
  const doel = brokBestand(key);
  try { if (fs.existsSync(doel)) fs.renameSync(doel, doel + '.bak'); } catch (e) {}  // vorige generatie bewaren
  schrijfDuurzaam(doel, versleutel(tekst), 0o600);
}
// De echte save: alleen veranderde brokken opnieuw versleutelen en wegschrijven,
// dan het manifest als commit-punt. Geeft het aantal geschreven brokken terug.
function schrijfGeheugenNu() {
  saveVuil = false;
  beslotenMap(GDIR);
  const nieuweKeys = Object.keys(db.data);
  const manKeys = {};
  let geschreven = 0;
  for (const key of nieuweKeys) {
    let tekst;
    try { tekst = JSON.stringify(db.data[key]); }
    catch (e) {
      // een enkele collectie te groot voor één string: bewaar de vorige brok,
      // waarschuw, en ga door (de rest van de database blijft wél duurzaam).
      console.error('[geheugen] collectie "' + key + '" te groot om te serialiseren (' + e.message + '); vorige versie behouden.');
      if (laatsteSha[key]) manKeys[key] = { sha: laatsteSha[key] };
      continue;
    }
    if (tekst === undefined) continue;            // niet-serialiseerbaar (bijv. functie): overslaan
    const h = sha(tekst);
    if (laatsteSha[key] !== h) { schrijfBrokAtomisch(key, tekst); laatsteSha[key] = h; geschreven++; }
    manKeys[key] = { sha: h, len: tekst.length };
  }
  // verwijderde collecties: hun brokken opruimen
  for (const key of Object.keys(laatsteSha)) {
    if (!Object.prototype.hasOwnProperty.call(db.data, key)) {
      try { fs.unlinkSync(brokBestand(key)); } catch (e) {}
      try { fs.unlinkSync(brokBestand(key) + '.bak'); } catch (e) {}
      delete laatsteSha[key];
    }
  }
  // het manifest als LAATSTE (commit-punt); de vorige blijft als .bak voor rollback
  try { if (fs.existsSync(MANIFEST)) fs.renameSync(MANIFEST, MANIFEST + '.bak'); } catch (e) {}
  generatie++;
  schrijfDuurzaam(MANIFEST, versleutel(JSON.stringify({ v: 1, generatie, at: Date.now(), keys: manKeys })), 0o600);
  saveDuur = Date.now() - (saveT0 || Date.now());
  saveKlaar = Date.now();
  return geschreven;
}

/* ---------- write-behind: een burst mutaties wordt gebundeld tot één flush ----------
   Zelfde ritme als de JSON-motor: de eerste save schrijft direct (dezelfde
   duurzaamheid voor een losse actie), een reeks binnen het venster wordt
   samengevoegd. Het venster past zich aan de flushduur aan (nooit meer dan ~25%
   van de tijd schrijven). Bij een crash gaat hooguit één venster verloren;
   afsluiten flusht altijd eerst (flushGeheugen). */
const SAVE_MS = Number(process.env.RTG_SAVE_MS || 250);
let saveTimer = null, saveVuil = false, saveDuur = 0, saveKlaar = 0, saveT0 = 0;
function saveGeheugen() {
  if (!db.writable) return;
  saveVuil = true;
  if (saveTimer) return;
  const venster = Math.max(SAVE_MS, saveDuur * 4);
  const sinds = Date.now() - saveKlaar;
  saveT0 = Date.now();
  if (sinds >= venster) { try { schrijfGeheugenNu(); } catch (e) { console.warn('[geheugen] save mislukt:', e.message); } return; }
  saveTimer = setTimeout(() => { saveTimer = null; if (saveVuil) { saveT0 = Date.now(); try { schrijfGeheugenNu(); } catch (e) { console.warn('[geheugen] save mislukt:', e.message); } } }, venster - sinds);
  if (saveTimer.unref) saveTimer.unref();
}
function flushGeheugen() { if (db.writable && saveVuil) { try { schrijfGeheugenNu(); } catch (e) {} } }

module.exports = { laadGeheugen, saveGeheugen, flushGeheugen, schrijfGeheugenNu, GDIR };
