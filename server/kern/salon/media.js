/* De uploadkamer van De Salon. Bestandsbytes komen los van de kleine JSON-post
   binnen en krijgen tijdelijk een willekeurig id dat alleen dezelfde sessie
   mag gebruiken. Verlaten uploads worden na een uur uit de mediastore gehaald. */
'use strict';

const MAX_FOTO_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 60 * 1024 * 1024;
const UPLOAD_TTL = 60 * 60 * 1000;
const { schoonCues } = require('../ondertitels');

module.exports = ({ media, crypto, spraaktekst }) => {
  const uploads = new Map();

  function ruim() {
    const grens = Date.now() - UPLOAD_TTL;
    for (const [id, item] of uploads) {
      if (item.at >= grens) continue;
      uploads.delete(id);
      try { media.verwijder(item.src); } catch (e) {}
    }
  }

  async function upload(sess, bytes, opgegevenMime) {
    ruim();
    if (!Buffer.isBuffer(bytes) || !bytes.length) return { error: 'Kies eerst een foto of video.' };
    const soort = media && media.soortVanBuffer ? media.soortVanBuffer(bytes, opgegevenMime) : null;
    if (!soort) return { error: 'Gebruik een jpg-, png- of webp-foto, of een mp4-, mov- of webm-video.' };
    const limiet = soort.kind === 'video' ? MAX_VIDEO_BYTES : MAX_FOTO_BYTES;
    if (bytes.length > limiet) return { error: soort.kind === 'video'
      ? 'Deze video is groter dan 60 MB.' : 'Deze foto is groter dan 12 MB.' };
    const opgeslagen = await media.bewaarBestandPubliek(bytes, soort.mime,
      { image: MAX_FOTO_BYTES, video: MAX_VIDEO_BYTES });
    if (!opgeslagen || !opgeslagen.src) return { error: 'Dit bestand kon ik niet bewaren.' };
    const uploadId = crypto.randomBytes(18).toString('hex');
    uploads.set(uploadId, { key: sess.key, src: opgeslagen.src, type: opgeslagen.type,
      mime: opgeslagen.mime, bytes: opgeslagen.bytes, at: Date.now(), ondertitels: [],
      ondertitelStatus: opgeslagen.type === 'video' ? 'wacht' : null });
    return { ok: true, uploadId, type: opgeslagen.type, mime: opgeslagen.mime,
      bytes: opgeslagen.bytes };
  }

  function neem(sess, uploadId) {
    const item = uploads.get(String(uploadId || ''));
    return item && item.key === sess.key ? item : null;
  }
  async function ondertitel(sess, invoer) {
    ruim();
    const item = neem(sess, invoer && invoer.uploadId);
    if (!item) return { status: 404, error: 'Deze upload is verlopen. Kies de video opnieuw.' };
    if (item.type !== 'video') return { status: 400, error: 'Alleen een video heeft ondertiteling nodig.' };
    const duurS = Math.max(0, Math.min(6 * 3600, Number(invoer && invoer.duurS) || 0));
    if (invoer && invoer.stil === true) {
      item.ondertitels = []; item.ondertitelStatus = 'stil';
      return { ok: true, ondertitels: [], status: 'stil', stil: true };
    }
    if (Array.isArray(invoer && invoer.regels)) {
      const regels = schoonCues(invoer.regels, duurS);
      if (!regels || !regels.length) return { status: 400,
        error: 'Schrijf minstens één geldige regel, bijvoorbeeld 0:00 - 0:04 Welkom.' };
      item.ondertitels = regels; item.ondertitelStatus = 'handmatig';
      return { ok: true, ondertitels: regels, status: 'handmatig', stil: false };
    }
    if (!spraaktekst || typeof spraaktekst.transcribeerOpname !== 'function') return { status: 503,
      error: 'Automatische ondertiteling is hier niet ingericht. Schrijf de regels zelf onder de video.' };
    const bytes = await media.leesBuf(item.src);
    if (!bytes) return { status: 404, error: 'De video kon niet meer worden gelezen.' };
    const r = await spraaktekst.transcribeerOpname(bytes,
      { soort: item.mime, taal: String((invoer && invoer.taal) || '').slice(0, 8), duurS });
    if (!r.ok) return r;
    item.ondertitels = r.ondertitels || [];
    item.ondertitelStatus = r.stil ? 'stil' : 'automatisch';
    return { ok: true, ondertitels: item.ondertitels, status: item.ondertitelStatus,
      stil: !!r.stil, precies: !!r.precies, tekst: r.tekst || '' };
  }
  function verbruik(ids) { for (const id of ids || []) uploads.delete(id); }

  return { upload, ondertitel, neem, verbruik, MAX_FOTO_BYTES, MAX_VIDEO_BYTES };
};
