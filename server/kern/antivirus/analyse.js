/* De Ontsmetter: de analyse zelf, als pure functies.

   Drie technieken, in oplopende twijfel:

   1. HANDTEKENINGEN. Bekende kwaadaardige byte- en tekstpatronen uit de
      definitielijst. Hard bewijs.
   2. HEURISTIEK. Magie tegen opgegeven type: een "png" die in werkelijkheid
      een .exe is. Dubbele extensie (foto.jpg.exe). Gevaarlijke extensie.
   3. ENTROPIE. Shannon-entropie om verpakte of versleutelde payloads te
      betrappen die zich als iets onschuldigs voordoen.

   Plus het afpellen van omhullende lagen (gzip, zlib, base64), want een
   payload die eenmaal is ingepakt lijkt op niets. Elk pad is begrensd tegen
   zip-bommen: hoogstens MAX_LAAG lagen diep en MAX_UITPAK per laag.

   Geen staat, geen database, geen meldingen: alles hier is te toetsen met een
   buffer erin en een oordeel eruit. */

const zlib = require('zlib');
const { BEELD_MAGIE } = require('./definities');

// Multi-laag / obfuscatie: hoeveel omhullende lagen we afpellen en hoe groot een
// gedecodeerde laag mag worden (harde grens tegen zip-bommen).
const MAX_LAAG = 3;
const MAX_UITPAK = 8 * 1024 * 1024; // 8 MB per laag
const MIN_LAAG = 24;                 // kleiner heeft geen zin om af te pellen

const HEX = /^[0-9a-f]+$/i;

function hexNaarBytes(h) {
  const b = [];
  for (let i = 0; i + 1 < h.length; i += 2) b.push(parseInt(h.substr(i, 2), 16));
  return Buffer.from(b);
}

// Shannon-entropie (bits per byte) over een sample.
function entropie(buf) {
  const n = Math.min(buf.length, 65536);
  if (n === 0) return 0;
  const tel = new Array(256).fill(0);
  for (let i = 0; i < n; i++) tel[buf[i]]++;
  let h = 0;
  for (let i = 0; i < 256; i++) {
    if (!tel[i]) continue;
    const p = tel[i] / n;
    h -= p * Math.log2(p);
  }
  return h;
}

function beginMet(buf, bytes) {
  if (buf.length < bytes.length) return false;
  for (let i = 0; i < bytes.length; i++) if (buf[i] !== bytes[i]) return false;
  return true;
}

// Klopt de magie met het opgegeven beeldtype? (alleen voor image/*)
function magieKlopt(buf, mime) {
  const m = /image\/(png|jpe?g|gif|webp)/.exec(String(mime || ''));
  if (!m) return true; // geen beeld: hier niets over zeggen
  const soort = m[1] === 'jpeg' ? 'jpg' : m[1];
  if (soort === 'webp') return buf.length >= 12 && buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP';
  const magie = BEELD_MAGIE[soort];
  return magie ? beginMet(buf, magie) : true;
}

// Alleen de handtekening-scan (geen type/entropie/extensie-heuristiek): gebruikt
// voor de BINNENSTE lagen die we uit gzip/deflate/base64 hebben gepeld. De
// mime-gate wordt daar leeg gelaten, zodat pdf-specifieke tokens (legitiem in
// een echte PDF) geen vals alarm geven op gedecodeerde binnenlagen.
function handtekeningScan(buf, mime, defs) {
  const redenen = [];
  let ernst = 'schoon';
  const hef = (e) => { if (e === 'besmet' || (e === 'verdacht' && ernst === 'schoon')) ernst = e; };
  for (const d of defs) {
    if (d.mimes && !d.mimes.includes(String(mime || ''))) continue;
    let raak = false;
    if (d.type === 'tekst') {
      raak = buf.indexOf(Buffer.from(d.patroon, 'latin1')) !== -1;
    } else if (d.type === 'bytes' && HEX.test(d.patroon)) {
      const naald = hexNaarBytes(d.patroon);
      raak = d.waar === 'start' ? beginMet(buf, naald) : buf.indexOf(naald) !== -1;
    }
    if (raak) { redenen.push('handtekening: ' + d.naam); hef(d.ernst); }
  }
  return { redenen, ernst };
}

/* Pel EEN omhullende laag af: gzip, zlib/deflate, of een tekstlaag die zelf
   (bijna) volledig base64 is. Geeft de gedecodeerde buffer terug, of null als er
   niets veiligs af te pellen valt. Alle paden zijn begrensd door MAX_UITPAK
   (zip-bom-bescherming) en accepteren een base64-laag alleen als hij echt naar
   iets korters decodeert (voorkomt lussen op toevallig base64-vormige tekst). */
function laagAf(buf) {
  if (!buf || buf.length < MIN_LAAG) return null;
  // gzip: 1f 8b
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    try { return zlib.gunzipSync(buf, { maxOutputLength: MAX_UITPAK }); } catch (e) { return null; }
  }
  // zlib/deflate: 78 01 / 78 9c / 78 da
  if (buf[0] === 0x78 && (buf[1] === 0x01 || buf[1] === 0x9c || buf[1] === 0xda)) {
    try { return zlib.inflateSync(buf, { maxOutputLength: MAX_UITPAK }); } catch (e) { return null; }
  }
  // platte base64-tekstlaag (los van de data-URL-schil die scanDataUrl al afpelt)
  const txt = buf.toString('latin1').trim();
  if (txt.length >= 40 && /^[A-Za-z0-9+/\r\n]+={0,2}$/.test(txt)) {
    const compact = txt.replace(/[\r\n]/g, '');
    if (compact.length % 4 === 0) {
      const uit = Buffer.from(compact, 'base64');
      if (uit.length >= MIN_LAAG && uit.length <= MAX_UITPAK && uit.length < buf.length) return uit;
    }
  }
  return null;
}

module.exports = { hexNaarBytes, entropie, beginMet, magieKlopt, handtekeningScan, laagAf,
  MAX_LAAG, MAX_UITPAK, MIN_LAAG, HEX };
