/* Een minimale, echte TURN-client (RFC 5389 + RFC 5766) voor de relayproef.

   Waarom zelf: de vraag "werkt het relais" mag niet beantwoord worden met een
   TCP-connect of het bestaan van TURN_URL. Deze client doet wat een browser
   doet als hij TURN gebruikt -- een ALLOCATIE aanvragen met MESSAGE-INTEGRITY
   op de long-term key, een PERMISSIE zetten en daarna echte bytes via het
   relais sturen -- en kan dus alleen slagen als coturn daadwerkelijk pakketten
   doorgeeft. Er zit geen eigen cryptografie in: HMAC-SHA1 en MD5 komen uit
   node:crypto en zijn door de RFC voorgeschreven.

   Transport naar de TURN-server: udp, tcp of tls (turns:). Het RELAIS zelf is
   altijd UDP (REQUESTED-TRANSPORT 17), precies zoals WebRTC het gebruikt.
   TLS controleert de servernaam tegen het certificaat (rejectUnauthorized):
   een certificaatfout is een mislukte proef, nooit een waarschuwing. */
'use strict';

const crypto = require('node:crypto');
const dgram = require('node:dgram');
const net = require('node:net');
const tls = require('node:tls');

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

/* Een verbinding naar de TURN-server die STUN-berichten uitwisselt, ongeacht
   transport. TCP/TLS is een bytestroom: berichten worden op hun lengteveld
   uit de stroom geknipt. */
function verbind({ transport, host, poort, servername, ca, timeoutMs }) {
  return new Promise((resolve, reject) => {
    const luisteraars = new Set();
    const lever = b => { const m = ontleed(b); if (m) for (const f of luisteraars) f(m); };
    const klaar = (stuur, sluit) => resolve({ stuur, sluit,
      luister: f => { luisteraars.add(f); return () => luisteraars.delete(f); } });
    const tijd = setTimeout(() => reject(new Error('turnclient: verbinden duurde te lang')), timeoutMs);
    if (transport === 'udp') {
      const s = dgram.createSocket(net.isIP(host) === 6 ? 'udp6' : 'udp4');
      s.on('message', lever);
      s.on('error', e => reject(e));
      s.connect(poort, host, (e) => {
        clearTimeout(tijd);
        if (e) return reject(e);
        klaar(b => s.send(b), () => { try { s.close(); } catch (x) {} });
      });
      return;
    }
    let rest = Buffer.alloc(0);
    const opData = d => {
      rest = Buffer.concat([rest, d]);
      while (rest.length >= 20) {
        const l = 20 + rest.readUInt16BE(2);
        if (rest.length < l) break;
        lever(rest.subarray(0, l)); rest = rest.subarray(l);
      }
    };
    const s = transport === 'tls'
      ? tls.connect({ host, port: poort, servername: net.isIP(servername || host) ? undefined : (servername || host),
          rejectUnauthorized: true, ca, ALPNProtocols: undefined })
      : net.connect({ host, port: poort });
    s.on('data', opData);
    s.on('error', e => { clearTimeout(tijd); reject(e); });
    s.once(transport === 'tls' ? 'secureConnect' : 'connect', () => {
      clearTimeout(tijd);
      klaar(b => s.write(b), () => { try { s.destroy(); } catch (x) {} });
    });
  });
}

/* Stuur een verzoek en wacht op het antwoord met dezelfde transactie-id. UDP
   kent verlies, dus daar wordt een paar keer herhaald. */
function vraag(kanaal, bouwer, { timeoutMs, transport }) {
  return new Promise((resolve, reject) => {
    const { bytes, tx } = bouwer();
    let pogingen = 0, timer = null;
    const stop = kanaal.luister(m => {
      if (!m.tx.equals(tx)) return;
      clearTimeout(timer); stop(); resolve(m);
    });
    const verstuur = () => {
      pogingen += 1;
      kanaal.stuur(bytes);
      const wacht = transport === 'udp' ? Math.min(timeoutMs, 500 * pogingen) : timeoutMs;
      timer = setTimeout(() => {
        if (transport === 'udp' && pogingen < 4) return verstuur();
        stop(); reject(new Error('turnclient: geen antwoord van de TURN-server'));
      }, wacht);
    };
    verstuur();
  });
}

const langeSleutel = (gebruiker, realm, wachtwoord) =>
  crypto.createHash('md5').update(gebruiker + ':' + realm + ':' + wachtwoord).digest();

/* Eén allocatie: 401 -> realm/nonce -> geauthenticeerd Allocate. Geeft het
   relayadres terug, of gooit met een code die de proef kan duiden. */
async function alloceer(kanaal, { gebruiker, wachtwoord, timeoutMs, transport }) {
  const transportAttr = attr(A.REQUESTED_TRANSPORT, Buffer.from([17, 0, 0, 0]));
  const eerste = await vraag(kanaal, () => bouw(M.ALLOCATE, KLASSE.REQUEST, [transportAttr]), { timeoutMs, transport });
  if (eerste.klasse !== KLASSE.ERROR || foutcode(eerste) !== 401) {
    const e = new Error('turnclient: server vroeg geen authenticatie -- open relais geweigerd als proef');
    e.code = 'TURN_ZONDER_AUTH'; throw e;
  }
  const realm = String(eerste.attrs.get(A.REALM) || '');
  let nonce = eerste.attrs.get(A.NONCE);
  const sleutel = langeSleutel(gebruiker, realm, wachtwoord);
  const geauth = (methode, extra) => () => bouw(methode, KLASSE.REQUEST, [
    ...extra, attr(A.USERNAME, Buffer.from(gebruiker)), attr(A.REALM, Buffer.from(realm)),
    attr(A.NONCE, nonce)], sleutel);
  async function gevraagd(methode, extra) {
    for (let i = 0; i < 2; i++) {
      const m = await vraag(kanaal, geauth(methode, extra), { timeoutMs, transport });
      if (m.klasse === KLASSE.ERROR && foutcode(m) === 438 && m.attrs.get(A.NONCE)) { nonce = m.attrs.get(A.NONCE); continue; }
      return m;
    }
    throw new Error('turnclient: nonce bleef verouderd');
  }
  const antwoord = await gevraagd(M.ALLOCATE, [transportAttr]);
  if (antwoord.klasse !== KLASSE.SUCCESS) {
    const e = new Error('turnclient: allocatie geweigerd (' + foutcode(antwoord) + ')');
    e.code = foutcode(antwoord) === 401 ? 'TURN_AUTH_GEWEIGERD' : 'TURN_ALLOCATIE_GEWEIGERD';
    throw e;
  }
  const relay = leesXorAdres(antwoord.attrs.get(A.XOR_RELAYED_ADDRESS));
  if (!relay) throw new Error('turnclient: geen relayadres in het antwoord');
  return {
    relay,
    async permissie(ip) {
      const m = await gevraagd(M.CREATE_PERMISSION, [attr(A.XOR_PEER_ADDRESS, xorAdres(ip, 0))]);
      if (m.klasse !== KLASSE.SUCCESS) {
        const e = new Error('turnclient: permissie geweigerd (' + foutcode(m) + ')');
        e.code = foutcode(m) === 403 ? 'TURN_PEER_GEWEIGERD' : 'TURN_PERMISSIE_GEWEIGERD';
        throw e;
      }
    },
    stuurNaar(peer, data) {
      kanaal.stuur(bouw(M.SEND, KLASSE.INDICATION, [attr(A.XOR_PEER_ADDRESS, xorAdres(peer.ip, peer.poort)),
        attr(A.DATA, data)]).bytes);
    },
    opData(f) {
      return kanaal.luister(m => {
        if (m.methode !== M.DATA || m.klasse !== KLASSE.INDICATION) return;
        const van = leesXorAdres(m.attrs.get(A.XOR_PEER_ADDRESS));
        const data = m.attrs.get(A.DATA);
        if (van && data) f(van, Buffer.from(data));
      });
    },
    async vrijgeven() {
      try { await gevraagd(M.REFRESH, [attr(A.LIFETIME, Buffer.from([0, 0, 0, 0]))]); } catch (e) {}
    }
  };
}

module.exports = { verbind, alloceer, bouw, ontleed, langeSleutel, xorAdres, leesXorAdres, M, A, KLASSE };
