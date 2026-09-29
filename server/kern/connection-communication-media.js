/* Purpose-bound private media for Connection conversations. Profile tickets
   never enter this store and message tickets are scoped to one open context. */
'use strict';

const Beeld = require('./connection-image');
const MEDIA_TYPES = Object.freeze({ image: 'MESSAGE_IMAGE', voice: 'VOICE_MESSAGE' });
const MAX_BYTES = 8 * 1024 * 1024;
const TICKET_MS = 2 * 60 * 1000;

module.exports = ({ product, root, media, crypto, ticketSecret, context, isBlocked, limit, save, id, now }) => {
  const key = crypto.createHash('sha256').update(ticketSecret ? String(ticketSecret) : crypto.randomBytes(32))
    .update('\0connection-communication').digest();
  function seal(payload) {
    const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString('base64url');
  }
  function open(token) {
    try {
      const text = String(token || '');
      if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
      const raw = Buffer.from(text, 'base64url');
      if (raw.toString('base64url') !== text) return null;
      if (raw.length < 29) return null;
      const d = crypto.createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
      d.setAuthTag(raw.subarray(12, 28));
      return JSON.parse(Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8'));
    } catch (e) { return null; }
  }
  function src(item, viewer, scope) {
    return '/api/connection/' + product + '/message-media/delivery/' + seal({
      id: item.id, viewer, scope, purpose: item.purpose, version: item.version, exp: Date.now() + TICKET_MS
    });
  }
  function mediaProject(mediaId, viewer, scope) {
    const item = root().media.find(x => x.id === mediaId && x.product === product);
    return item ? { purpose: item.purpose, mime: item.mime, src: src(item, viewer, scope),
      ...(item.transcript ? { transcript: item.transcript } : {}) } : undefined;
  }
  function normalizeAudio(bytes, mime) {
    if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BYTES) throw new Error('De spraakopname is te groot of leeg.');
    const type = String(mime || '').split(';')[0].toLowerCase();
    const webm = bytes.length > 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    const ogg = bytes.subarray(0, 4).toString('ascii') === 'OggS';
    if (!(type === 'audio/webm' && webm) && !(type === 'audio/ogg' && ogg)) throw new Error('Gebruik een WebM- of Ogg-spraakopname.');
    return { bytes, mime: type };
  }
  async function upload(actor, c, bytes, mime, kind, idem, projectMessage, transcript) {
    if (!media || !media.bewaarBestandPrive) return { status: 503, error: 'Beveiligde mediaopslag is niet beschikbaar.' };
    if (!limit(actor, 'media', 12, 3600000)) return { status: 429, error: 'Te veel media kort na elkaar.' };
    const token = String(idem || '').slice(0, 200); if (token.length < 16) return { status: 400, error: 'De uploadsleutel ontbreekt.' };
    const old = root().messages.find(x => x.product === product && x.from === actor && x.idempotencyKey === token);
    if (old) return { status: 200, ok: true, repeated: true, message: projectMessage(old, actor) };
    let normalized, purpose;
    try {
      if (kind === 'voice') {
        const text = String(transcript || '').replace(/\s+/g, ' ').trim().slice(0, 1200);
        if (!text) throw new Error('Voeg een transcript of korte inhoud toe aan het spraakbericht.');
        normalized = normalizeAudio(bytes, mime); normalized.transcript = text; purpose = MEDIA_TYPES.voice;
      }
      else { normalized = Beeld.normaliseer(bytes, mime); purpose = MEDIA_TYPES.image; }
    } catch (e) { return { status: 400, error: e.message }; }
    const stored = await media.bewaarBestandPrive(normalized.bytes, normalized.mime, MAX_BYTES);
    if (!stored) return { status: 503, error: 'De media kon niet veilig worden opgeslagen.' };
    const item = { id: id('ccx'), product, owner: actor, scope: c.scope, pair: c.pair, purpose,
      ref: stored.ref, mime: normalized.mime, transcript: normalized.transcript,
      version: 1, createdAt: now() };
    const message = { id: id('ccm'), product, scope: c.scope, pair: c.pair, from: actor,
      to: c.counterpart, kind: kind === 'voice' ? 'voice' : 'image', mediaId: item.id,
      idempotencyKey: token, at: now() };
    root().media.push(item); root().messages.push(message);
    try { save(); } catch (e) { media.verwijder(item.ref); throw e; }
    return { status: 200, ok: true, message: projectMessage(message, actor) };
  }
  async function deliver(token) {
    const t = open(token); if (!t || t.exp < Date.now()) return null;
    const item = root().media.find(x => x.id === t.id && x.product === product && x.version === t.version && x.purpose === t.purpose);
    if (!item || item.scope !== t.scope || isBlocked(t.viewer, item.owner)) return null;
    const c = context(t.viewer, { id: t.scope }); if (!c || c.scope !== item.scope || c.pair !== item.pair) return null;
    const bytes = await media.leesBuf(item.ref); return bytes ? { bytes, mime: item.mime } : null;
  }
  return { project: mediaProject, upload, deliver, MEDIA_TYPES };
};
