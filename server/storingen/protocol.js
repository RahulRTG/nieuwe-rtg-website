/* Het ondertekende storingenprotocol: raw bytes, korte geldigheid en een
   ontvangstbewijs dat aan precies dezelfde gebeurtenis en bytes is gebonden. */
'use strict';
const crypto = require('node:crypto');
const PAD = '/api/webhooks/storingen';
const MAX_BYTES = 16384;
const ID = /^[a-zA-Z0-9_-]{1,80}$/;
const sleutelGoed = s => typeof s === 'string' && /^[a-f0-9]{64}$/i.test(s);
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const mac = (s, tekst) => crypto.createHmac('sha256', Buffer.from(s, 'hex')).update(tekst).digest('hex');
function gelijk(a, b) {
  return typeof a === 'string' && /^[a-f0-9]{64}$/i.test(a) &&
    crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
function signatuur(s, tijd, id, raw) {
  return mac(s, Buffer.concat([Buffer.from('v1\nPOST\n' + PAD + '\n' + tijd + '\n' + id + '\n'), raw]));
}
function koppen(s, id, raw, nu = Date.now()) {
  const tijd = String(Math.floor(nu / 1000));
  return { 'x-rtg-event-id': id, 'x-rtg-timestamp': tijd,
    'x-rtg-signature': 'v1=' + signatuur(s, tijd, id, raw) };
}
function verifieer(s, h, raw, nu = Date.now()) {
  const id = h['x-rtg-event-id'], tijd = h['x-rtg-timestamp'], sig = h['x-rtg-signature'];
  if (!sleutelGoed(s) || !Buffer.isBuffer(raw) || raw.length > MAX_BYTES ||
      typeof id !== 'string' || !ID.test(id) || typeof tijd !== 'string' || !/^\d{10}$/.test(tijd) ||
      Math.abs(nu - Number(tijd) * 1000) > 300000 || typeof sig !== 'string' || !sig.startsWith('v1=')) return false;
  return gelijk(sig.slice(3), signatuur(s, tijd, id, raw));
}
function ontvangst(s, id, digest, herhaald) {
  return { ok: true, opgeslagen: true, id, digest, herhaald: !!herhaald,
    signatuur: mac(s, 'v1\nack\n' + id + '\n' + digest + '\n') };
}
function bewijsGoed(s, id, raw, r) {
  return !!r && r.ok === true && r.opgeslagen === true && r.id === id && r.digest === hash(raw) &&
    gelijk(r.signatuur, mac(s, 'v1\nack\n' + id + '\n' + r.digest + '\n'));
}
function eigenEndpoint(url) {
  try { const u = new URL(url); return u.pathname === PAD && !u.search && !u.hash; } catch (_) { return false; }
}
module.exports = { PAD, MAX_BYTES, ID, sleutelGoed, hash, koppen, verifieer, ontvangst, bewijsGoed, eigenEndpoint };
