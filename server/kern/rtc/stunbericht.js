/* STUN/TURN-berichten bouwen en ontleden (RFC 5389 + RFC 5766): de codec
   onder kern/rtc/turnclient.js, afgesplitst op de 10 KB-grens. Zuiver: geen
   sockets, geen toestand. MESSAGE-INTEGRITY is HMAC-SHA1 uit node:crypto. */
'use strict';

const crypto = require('node:crypto');
const net = require('node:net');

const COOKIE = 0x2112A442;
const COOKIE_BUF = Buffer.from([0x21, 0x12, 0xA4, 0x42]);
const M = Object.freeze({ ALLOCATE: 0x0003, REFRESH: 0x0004, SEND: 0x0006, DATA: 0x0007,
  CREATE_PERMISSION: 0x0008 });
const A = Object.freeze({ USERNAME: 0x0006, MESSAGE_INTEGRITY: 0x0008, ERROR_CODE: 0x0009,
  LIFETIME: 0x000D, XOR_PEER_ADDRESS: 0x0012, DATA: 0x0013, REALM: 0x0014, NONCE: 0x0015,
  XOR_RELAYED_ADDRESS: 0x0016, REQUESTED_TRANSPORT: 0x0019, XOR_MAPPED_ADDRESS: 0x0020 });
const KLASSE = Object.freeze({ REQUEST: 0x0000, INDICATION: 0x0010, SUCCESS: 0x0100, ERROR: 0x0110 });

const pad4 = n => (4 - (n % 4)) % 4;

function attr(type, waarde) {
  const kop = Buffer.alloc(4);
  kop.writeUInt16BE(type, 0); kop.writeUInt16BE(waarde.length, 2);
  return Buffer.concat([kop, waarde, Buffer.alloc(pad4(waarde.length))]);
}

function xorAdres(ip, poort) {
  const v4 = net.isIP(ip) === 4;
  if (!v4) throw new Error('turnclient: alleen IPv4-peers in deze proef');
  const b = Buffer.alloc(8);
  b.writeUInt8(0, 0); b.writeUInt8(0x01, 1);
  b.writeUInt16BE(poort ^ (COOKIE >>> 16), 2);
  ip.split('.').forEach((o, i) => b.writeUInt8((Number(o) & 0xff) ^ COOKIE_BUF[i], 4 + i));
  return b;
}

function leesXorAdres(b) {
  if (!b || b.length < 8 || b.readUInt8(1) !== 0x01) return null;
  const poort = b.readUInt16BE(2) ^ (COOKIE >>> 16);
  const ip = [0, 1, 2, 3].map(i => b.readUInt8(4 + i) ^ COOKIE_BUF[i]).join('.');
  return { ip, poort };
}

/* Bouw een STUN-bericht; met `sleutel` komt MESSAGE-INTEGRITY erachter. */
function bouw(methode, klasse, attrs, sleutel, tx) {
  const id = tx || crypto.randomBytes(12);
  const type = (methode & 0x0f80) << 2 | (methode & 0x0070) << 1 | (methode & 0x000f) | klasse;
  let lijf = Buffer.concat(attrs);
  const kop = Buffer.alloc(20);
  kop.writeUInt16BE(type, 0); kop.writeUInt32BE(COOKIE, 4); id.copy(kop, 8);
  if (sleutel) {
    kop.writeUInt16BE(lijf.length + 24, 2);
    const mac = crypto.createHmac('sha1', sleutel).update(Buffer.concat([kop, lijf])).digest();
    lijf = Buffer.concat([lijf, attr(A.MESSAGE_INTEGRITY, mac)]);
  }
  kop.writeUInt16BE(lijf.length, 2);
  return { bytes: Buffer.concat([kop, lijf]), tx: id };
}

function ontleed(buf) {
  if (!buf || buf.length < 20 || buf.readUInt32BE(4) !== COOKIE) return null;
  const type = buf.readUInt16BE(0), lengte = buf.readUInt16BE(2);
  if (buf.length < 20 + lengte) return null;
  const methode = (type & 0x3e00) >> 2 | (type & 0x00e0) >> 1 | (type & 0x000f);
  const klasse = type & 0x0110;
  const attrs = new Map();
  let i = 20;
  while (i + 4 <= 20 + lengte) {
    const t = buf.readUInt16BE(i), l = buf.readUInt16BE(i + 2);
    if (!attrs.has(t)) attrs.set(t, buf.subarray(i + 4, i + 4 + l));
    i += 4 + l + pad4(l);
  }
  return { methode, klasse, tx: buf.subarray(8, 20), attrs, lengte: 20 + lengte };
}

function foutcode(bericht) {
  const b = bericht.attrs.get(A.ERROR_CODE);
  if (!b || b.length < 4) return null;
  return (b.readUInt8(2) & 0x07) * 100 + b.readUInt8(3);
}

module.exports = { bouw, ontleed, attr, xorAdres, leesXorAdres, foutcode, COOKIE, M, A, KLASSE };
