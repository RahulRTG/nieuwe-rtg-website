/* Mediastore: foto's die anders als base64 IN de database (db.data) zouden staan,
   worden hier als losse bestanden op schijf bewaard; in db.data blijft alleen een
   korte verwijzing. Zo groeit het werkgeheugen en elke db-snapshot niet mee met de
   Salon-foto's en snaps. Zelfde aanpak als de KYC-documenten (server/routes/auth.js):
   met RTG_ENC_KEY staan de bytes versleuteld op schijf (map 0700, bestand 0600).

   Twee soorten verwijzingen:
   - Salon-foto's (publiek): opgeslagen als de URL "/media/<naam>". De browser laadt
     die rechtstreeks in een <img src>; de /media-route streamt het bestand.
   - Snaps/verhalen (privé, kijk-een-keer): opgeslagen als de kále bestandsnaam. Die
     komt nooit als publieke URL naar buiten; bij het openen leest de server het
     bestand en geeft het eenmalig als data-URL terug, waarna het bestand weg mag. */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const kluis = require('./kluis');

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
const EXT_VAN_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const URL_PREFIX = '/media/';

function maakMedia({ dir }) {
  const MEDIA_DIR = path.join(dir, 'media');
  function ensure() { try { fs.mkdirSync(MEDIA_DIR, { recursive: true, mode: 0o700 }); fs.chmodSync(MEDIA_DIR, 0o700); } catch (e) { try { fs.mkdirSync(MEDIA_DIR, { recursive: true }); } catch (x) {} } }

  // Is een waarde al een verwijzing (dus geen inline base64 die we nog moeten opslaan)?
  function isRef(v) { return typeof v === 'string' && v.length > 0 && !v.startsWith('data:'); }
  // Bestandsnaam uit een verwijzing halen (accepteert zowel "/media/x" als "x").
  function naamVan(ref) { return path.basename(String(ref || '').replace(URL_PREFIX, '')); }
  function url(naam) { return URL_PREFIX + naam; }
  function pad(ref) { return path.join(MEDIA_DIR, naamVan(ref)); }

  // Een data-URL wegschrijven -> bestandsnaam (of null als het geen geldige foto is,
  // of te groot). maxBytes geldt over de ruwe (gedecodeerde) bytes.
  function bewaar(dataUrl, maxBytes) {
    const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
    if (!m) return null;
    let buf;
    try { buf = Buffer.from(m[2], 'base64'); } catch (e) { return null; }
    if (!buf.length) return null;
    if (maxBytes && buf.length > maxBytes) return null;
    ensure();
    const naam = crypto.randomBytes(16).toString('hex') + '.' + EXT_VAN_MIME[m[1]];
    try { fs.writeFileSync(path.join(MEDIA_DIR, naam), kluis.versleutelBuf(buf), { mode: 0o600 }); }
    catch (e) { return null; }
    return naam;
  }
  // Een data-URL opslaan en meteen de publieke Salon-URL teruggeven (of null).
  function bewaarPubliek(dataUrl, maxBytes) { const n = bewaar(dataUrl, maxBytes); return n ? url(n) : null; }

  function leesBuf(ref) {
    try { return kluis.ontsleutelBuf(fs.readFileSync(pad(ref))); } catch (e) { return null; }
  }
  // Het bestand terug als data-URL (voor snaps/verhalen: eenmalig aan de kijker).
  function leesDataUrl(ref) {
    if (typeof ref === 'string' && ref.startsWith('data:')) return ref; // oude, nog-inline foto: gewoon teruggeven
    const buf = leesBuf(ref);
    if (!buf) return null;
    const ext = (path.extname(naamVan(ref)).slice(1) || 'jpg').toLowerCase();
    return 'data:' + (MIME[ext] || 'application/octet-stream') + ';base64,' + buf.toString('base64');
  }
  function verwijder(ref) { if (!ref) return; try { fs.unlinkSync(pad(ref)); } catch (e) {} }
  function bestaat(ref) { try { return fs.existsSync(pad(ref)); } catch (e) { return false; } }

  // De publieke /media-route: streamt een Salon-foto (na ontsleutelen). De naam is
  // 32 hex-tekens en dus onraadbaar; geen directory-traversal (basename + whitelist).
  function serveer(req, res) {
    const naam = path.basename(String(req.params.naam || ''));
    if (!/^[0-9a-f]{32}\.(jpg|jpeg|png|webp)$/.test(naam)) return res.status(400).end();
    const buf = leesBuf(naam);
    if (!buf) return res.status(404).end();
    const ext = path.extname(naam).slice(1).toLowerCase();
    res.set('Content-Type', MIME[ext] || 'application/octet-stream');
    res.set('Cache-Control', 'private, max-age=31536000, immutable'); // inhoud verandert nooit voor een naam
    res.set('X-Content-Type-Options', 'nosniff');
    res.end(buf);
  }

  /* Eenmalige migratie: foto's die nu nog als base64 IN db.data staan, verplaatsen
     naar bestanden en vervangen door een verwijzing. Salon-foto's krijgen een
     /media-URL (publiek), snaps/verhalen een kále bestandsnaam (privé). Draait bij
     het opstarten; is idempotent (waarden die al een verwijzing zijn, blijven). */
  function migreerDb(db) {
    if (!db || !db.data) return 0;
    let n = 0;
    const naarPubliek = v => { if (typeof v === 'string' && v.startsWith('data:')) { const r = bewaarPubliek(v, 1.5 * 1024 * 1024); if (r) { n++; return r; } } return v; };
    const naarPrive = v => { if (typeof v === 'string' && v.startsWith('data:')) { const r = bewaar(v, 900 * 1024); if (r) { n++; return r; } } return v; };
    for (const s of (db.data.suppliers || [])) {
      if (Array.isArray(s.photos)) s.photos = s.photos.map(naarPubliek);
      if (s.salon && s.salon.foto) s.salon.foto = naarPubliek(s.salon.foto);
    }
    for (const p of (db.data.posts || [])) {
      if (p.photo) p.photo = naarPubliek(p.photo);
      if (p.folder && Array.isArray(p.folder.fotos)) p.folder.fotos = p.folder.fotos.map(naarPubliek);
    }
    for (const s of (db.data.snaps || [])) if (s.foto) s.foto = naarPrive(s.foto);
    for (const s of (db.data.stories || [])) if (s.foto) s.foto = naarPrive(s.foto);
    return n;
  }

  return { MEDIA_DIR, isRef, url, naamVan, pad, bewaar, bewaarPubliek, leesBuf, leesDataUrl, verwijder, bestaat, serveer, migreerDb };
}

module.exports = { maakMedia };
