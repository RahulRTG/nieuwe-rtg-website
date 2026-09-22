/* Veilige profielfoto's voor Connection OS.

   Opslag, publicatie en levering zijn afzonderlijke stappen. Een opgeslagen
   foto is dus nooit vanzelf zichtbaar. Permanente opslagreferenties verlaten
   deze module niet; de browser ontvangt alleen een kortlevend, versleuteld
   delivery-ticket. Ook bij levering worden blokkade, disclosure en matchstatus
   opnieuw gecontroleerd, zodat intrekken meteen effect heeft op nieuw verkeer. */
'use strict';

const Beeld = require('./connection-image');

const PURPOSE = 'PROFILE_PHOTO';
const VISIBILITY = Object.freeze(['DISCOVERY', 'AFTER_MATCH', 'PRIVATE']);
const MAX_PHOTOS = 6;
const TICKET_MS = 2 * 60 * 1000;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 10;

module.exports = function maakConnectionProfileMedia({ db, save, crypto, media, schoon, gate,
  isBlocked, isMatch, ticketSecret }) {
  const uploads = new Map();
  /* Productie levert RTG_ENC_KEY. Een losse lokale of testmatige kern zonder
     configuratie krijgt een willekeurige processleutel, nooit de voorspelbare
     hash van een lege string. Tickets vervallen dan terecht bij herstart. */
  const ticketBasis = ticketSecret ? String(ticketSecret) : crypto.randomBytes(32);
  const key = crypto.createHash('sha256').update(ticketBasis).update('\0connection-profile-media').digest();
  const nu = () => new Date().toISOString();
  const lees = () => Array.isArray(db.data.connectionProfileMedia) ? db.data.connectionProfileMedia : [];
  const bak = () => {
    if (!Array.isArray(db.data.connectionProfileMedia)) db.data.connectionProfileMedia = [];
    return db.data.connectionProfileMedia;
  };
  const vind = id => lees().find(x => x.id === String(id || '')) || null;
  const van = owner => lees().filter(x => x.owner === owner).sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
  const veiligTekst = (v, n) => schoon ? schoon(v, n) : String(v || '').slice(0, n);
  const zicht = v => VISIBILITY.includes(String(v || '').toUpperCase()) ? String(v).toUpperCase() : 'DISCOVERY';

  function encrypt(payload) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.from(JSON.stringify(payload));
    const enc = Buffer.concat([cipher.update(data), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
  }
  function decrypt(token) {
    try {
      const raw = Buffer.from(String(token || ''), 'base64url');
      if (raw.length < 29) return null;
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
      decipher.setAuthTag(raw.subarray(12, 28));
      return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8'));
    } catch (e) { return null; }
  }

  function magZien(item, viewer, context) {
    if (!item || item.processingState !== 'READY') return false;
    if (viewer === item.owner) return true;
    if (item.publicationState !== 'PUBLISHED' || item.visibility === 'PRIVATE') return false;
    if (isBlocked && isBlocked(viewer, item.owner)) return false;
    const profiel = db.data.vonk && db.data.vonk.profielen && db.data.vonk.profielen[item.owner];
    if (!profiel || profiel.actief === false) return false;
    if (context === 'discovery') return item.visibility === 'DISCOVERY';
    if (context === 'match' && isMatch && isMatch(viewer, item.owner))
      return item.visibility === 'DISCOVERY' || item.visibility === 'AFTER_MATCH';
    return false;
  }

  function ticket(item, viewer, context) {
    const exp = Date.now() + TICKET_MS;
    return { src: '/api/vonk/profile-photo/delivery/' + encrypt({ id: item.id, viewer, context, version: item.version, exp }),
      expiresAt: new Date(exp).toISOString() };
  }

  function projecteerEen(item, viewer, context) {
    if (!magZien(item, viewer, context)) return null;
    const toegang = ticket(item, viewer, context);
    return { id: item.id, purpose: PURPOSE, visibility: item.visibility,
      processingState: item.processingState, publicationState: item.publicationState,
      moderationState: item.moderationState, verificationState: item.verificationState,
      width: item.width, height: item.height, mime: item.mime, position: item.position,
      version: item.version, alt: item.alt, src: toegang.src, expiresAt: toegang.expiresAt };
  }

  function projecteer(viewer, owner, context) {
    return van(owner).map(x => projecteerEen(x, viewer, context)).filter(Boolean);
  }

  function poort(owner) {
    const g = typeof gate === 'function' ? gate(owner) : { ok: true };
    return g && g.ok ? null : { status: 403, error: (g && g.reden) || 'Profielmedia is niet beschikbaar.' };
  }

  function rate(owner) {
    const tijd = Date.now();
    const lijst = (uploads.get(owner) || []).filter(x => x > tijd - RATE_WINDOW_MS);
    if (lijst.length >= RATE_MAX) return false;
    lijst.push(tijd); uploads.set(owner, lijst); return true;
  }

  async function upload(owner, bytes, mime, opties) {
    const dicht = poort(owner); if (dicht) return dicht;
    if (!media || !media.bewaarBestandPrive) return { status: 503, error: 'De beveiligde mediaopslag is niet beschikbaar.' };
    const idem = String(opties && opties.idempotencyKey || '').trim().slice(0, 200);
    if (idem.length < 16) return { status: 400, error: 'De uploadsleutel ontbreekt. Kies de foto opnieuw.' };
    const bestaand = van(owner).find(x => x.idempotencyKey === idem);
    if (bestaand) return { status: 200, ok: true, herhaald: true, media: projecteerEen(bestaand, owner, 'owner') };
    if (van(owner).length >= MAX_PHOTOS) return { status: 409, error: 'Uw profiel heeft al zes foto’s. Verwijder er eerst één.' };
    if (!rate(owner)) return { status: 429, error: 'U heeft te veel foto’s kort na elkaar aangeboden. Probeer het later opnieuw.' };
    let beeld;
    try { beeld = Beeld.normaliseer(bytes, mime); }
    catch (e) { return { status: /8 MB|afmetingen|megapixel/.test(e.message) ? 413 : 400, error: e.message }; }
    const opgeslagen = await media.bewaarBestandPrive(beeld.bytes, beeld.mime, Beeld.MAX_BYTES);
    if (!opgeslagen || opgeslagen.type !== 'image') return { status: 400, error: 'De foto kon niet veilig worden bewaard.' };
    const at = nu();
    const item = { id: 'cpm' + crypto.randomBytes(9).toString('hex'), owner, purpose: PURPOSE,
      ref: opgeslagen.ref, mime: beeld.mime, bytes: opgeslagen.bytes, width: beeld.width, height: beeld.height,
      alt: veiligTekst(opties && opties.alt, 120) || 'Profielfoto', visibility: zicht(opties && opties.visibility),
      processingState: 'READY', publicationState: 'DRAFT', moderationState: 'NOT_REVIEWED',
      verificationState: 'UNVERIFIED', position: van(owner).length, version: 1, idempotencyKey: idem,
      createdAt: at, updatedAt: at,
      lifecycle: [{ state: 'UPLOADED', at }, { state: 'PROCESSING', at }, { state: 'READY', at }] };
    bak().push(item);
    try { save(); } catch (e) { media.verwijder(item.ref); throw e; }
    return { status: 200, ok: true, media: projecteerEen(item, owner, 'owner') };
  }

  function publiceer(owner, id, visibility, aan) {
    const dicht = poort(owner); if (dicht) return dicht;
    const item = vind(id);
    if (!item || item.owner !== owner) return { status: 404, error: 'Deze profielfoto bestaat niet.' };
    if (item.processingState !== 'READY') return { status: 409, error: 'De foto is nog niet klaar voor publicatie.' };
    const nieuweZichtbaarheid = zicht(visibility || item.visibility);
    const nieuwePublicatie = aan === false ? 'DRAFT' : 'PUBLISHED';
    if (item.visibility === nieuweZichtbaarheid && item.publicationState === nieuwePublicatie)
      return { status: 200, ok: true, herhaald: true, media: projecteerEen(item, owner, 'owner') };
    item.visibility = nieuweZichtbaarheid;
    item.publicationState = nieuwePublicatie;
    item.version += 1; item.updatedAt = nu();
    item.lifecycle.push({ state: item.publicationState, at: item.updatedAt });
    save();
    return { status: 200, ok: true, media: projecteerEen(item, owner, 'owner') };
  }

  function verwijder(owner, id) {
    const dicht = poort(owner); if (dicht) return dicht;
    const item = vind(id);
    if (!item || item.owner !== owner) return { status: 404, error: 'Deze profielfoto bestaat niet.' };
    db.data.connectionProfileMedia = lees().filter(x => x.id !== item.id);
    media.verwijder(item.ref); save();
    return { status: 200, ok: true };
  }

  async function lever(token) {
    const toegang = decrypt(token);
    if (!toegang || !Number.isFinite(toegang.exp) || toegang.exp < Date.now()) return null;
    const item = vind(toegang.id);
    if (!item || item.version !== toegang.version || !magZien(item, toegang.viewer, toegang.context)) return null;
    const bytes = await media.leesBuf(item.ref);
    return bytes ? { bytes, mime: item.mime } : null;
  }

  return { upload, publiceer, verwijder, lever, projecteer, magZien,
    PURPOSE, VISIBILITY, MAX_PHOTOS, TICKET_MS };
};

module.exports.PURPOSE = PURPOSE;
module.exports.VISIBILITY = VISIBILITY;
module.exports.MAX_PHOTOS = MAX_PHOTOS;
module.exports.TICKET_MS = TICKET_MS;
