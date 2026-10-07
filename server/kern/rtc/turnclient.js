/* Een minimale, echte TURN-client (RFC 5389 + RFC 5766) voor de relayproef.

   Een TCP-connect of een gezette TURN_URL bewijst niet dat het relais werkt.
   Deze client doet wat een browser doet -- een ALLOCATIE met MESSAGE-INTEGRITY
   op de long-term key, een PERMISSIE, en daarna echte bytes via het relais --
   en slaagt dus alleen als coturn werkelijk doorgeeft. Geen eigen crypto:
   HMAC-SHA1 en MD5 komen uit node:crypto, zoals de RFC voorschrijft.

   Transport naar de server: udp, tcp of tls (turns:, met servernaam- en
   certificaatcontrole; een certificaatfout is een mislukte proef). Het relais
   zelf is altijd UDP (REQUESTED-TRANSPORT 17), zoals WebRTC het gebruikt. */
'use strict';

const crypto = require('node:crypto');
const dgram = require('node:dgram');
const net = require('node:net');
const tls = require('node:tls');

const { bouw, ontleed, attr, xorAdres, leesXorAdres, foutcode, M, A, KLASSE } = require('./stunbericht');

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
