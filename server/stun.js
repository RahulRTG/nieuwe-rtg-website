/* Eigen STUN-server (RFC 5389) zodat (video)bellen niet meer op de publieke
   STUN van Google (stun.l.google.com) hoeft te leunen. STUN doet één simpel
   ding: een client stuurt een Binding Request en krijgt terug welk IP-adres en
   welke poort de buitenwereld van hem ziet (na de NAT). Daarmee kan WebRTC een
   directe verbinding proberen. Er komt GEEN cryptografie aan te pas -- dit is
   puur het lezen van de afzender en het terugkaatsen ervan -- dus het botst niet
   met de regel "rol nooit je eigen encryptie".

   De harde gevallen (symmetrische NAT, streng 4G) blijven via TURN lopen; dat
   relais staat los en is met TURN_URL/TURN_SECRET te configureren (coturn).

   Aanzetten gebeurt automatisch met de server; STUN_UIT=1 schakelt hem uit,
   STUN_PORT kiest de UDP-poort (standaard 3478, de STUN-standaardpoort). */
const dgram = require('dgram');

const MAGIC = 0x2112A442;                       // STUN magic cookie (RFC 5389)
const MAGIC_BUF = Buffer.from([0x21, 0x12, 0xA4, 0x42]);
const BINDING_REQUEST = 0x0001;
const BINDING_SUCCESS = 0x0101;
const XOR_MAPPED_ADDRESS = 0x0020;

// Bouw het XOR-MAPPED-ADDRESS: de poort ge-XOR'd met de bovenste 16 bits van de
// magic cookie, en het adres met de cookie (IPv4) of cookie+transactie-id (IPv6).
function xorMappedAddress(address, port, txId) {
  const ipv6 = address.includes(':') && !address.startsWith('::ffff:');
  const adr = address.startsWith('::ffff:') ? address.slice(7) : address;
  if (ipv6) {
    const attr = Buffer.alloc(4 + 20);
    attr.writeUInt16BE(XOR_MAPPED_ADDRESS, 0); attr.writeUInt16BE(20, 2);
    attr.writeUInt8(0, 4); attr.writeUInt8(0x02, 5);
    attr.writeUInt16BE(port ^ (MAGIC >>> 16), 6);
    const sleutel = Buffer.concat([MAGIC_BUF, txId]);        // 16 bytes
    const bytes = ipv6NaarBytes(address);
    for (let i = 0; i < 16; i++) attr.writeUInt8(bytes[i] ^ sleutel[i], 8 + i);
    return attr;
  }
  const attr = Buffer.alloc(4 + 8);
  attr.writeUInt16BE(XOR_MAPPED_ADDRESS, 0); attr.writeUInt16BE(8, 2);
  attr.writeUInt8(0, 4); attr.writeUInt8(0x01, 5);          // gereserveerd, familie IPv4
  attr.writeUInt16BE(port ^ (MAGIC >>> 16), 6);
  const octets = adr.split('.').map(n => parseInt(n, 10) & 0xff);
  for (let i = 0; i < 4; i++) attr.writeUInt8((octets[i] || 0) ^ MAGIC_BUF[i], 8 + i);
  return attr;
}
// Minimale IPv6-tekst -> 16 bytes (genoeg voor de :: -verkorting).
function ipv6NaarBytes(adres) {
  let a = adres;
  if (a.startsWith('::ffff:')) a = a.slice(7);
  const stukken = a.split('::');
  const links = stukken[0] ? stukken[0].split(':') : [];
  const rechts = stukken.length > 1 && stukken[1] ? stukken[1].split(':') : [];
  const midden = 8 - links.length - rechts.length;
  const woorden = [...links, ...Array(Math.max(0, midden)).fill('0'), ...rechts].slice(0, 8);
  const buf = Buffer.alloc(16);
  for (let i = 0; i < 8; i++) buf.writeUInt16BE(parseInt(woorden[i] || '0', 16) || 0, i * 2);
  return buf;
}

// Verwerk één binnenkomend pakket; geeft het antwoord terug of null (negeer).
function verwerk(msg, rinfo) {
  if (!msg || msg.length < 20) return null;                 // te kort voor een STUN-kop
  const type = msg.readUInt16BE(0);
  if (type !== BINDING_REQUEST) return null;                // alleen Binding Requests
  if (msg.readUInt32BE(4) !== MAGIC) return null;           // geen geldige magic cookie
  const txId = msg.subarray(8, 20);
  const attr = xorMappedAddress(rinfo.address, rinfo.port, txId);
  const kop = Buffer.alloc(20);
  kop.writeUInt16BE(BINDING_SUCCESS, 0);
  kop.writeUInt16BE(attr.length, 2);
  MAGIC_BUF.copy(kop, 4);
  txId.copy(kop, 8);
  return Buffer.concat([kop, attr]);
}

/* Start de STUN-server. Geeft { socket, poort, stop } terug, of null als STUN
   uitstaat of de poort niet te binden is (dan valt bellen terug op TURN of op
   een LAN-directe verbinding; het mag de server nooit tegenhouden). */
function start({ port, log } = {}) {
  if (process.env.STUN_UIT === '1') return null;
  const poort = Number(port || process.env.STUN_PORT || 3478);
  const zeg = (n, m, x) => { try { if (typeof log === 'function') log(n, m, x); } catch (e) {} };
  // udp4 is overal betrouwbaar en dekt de meeste WebRTC-NAT-gevallen; udp6
  // (dual-stack, ook IPv6-clients) is opt-in met STUN_IPV6=1.
  const socket = dgram.createSocket(process.env.STUN_IPV6 === '1' ? { type: 'udp6', ipv6Only: false } : 'udp4');
  socket.on('message', (msg, rinfo) => {
    let antwoord = null;
    try { antwoord = verwerk(msg, rinfo); } catch (e) { return; }
    if (antwoord) socket.send(antwoord, rinfo.port, rinfo.address, () => {});
  });
  socket.on('error', e => { zeg('warn', '[stun] socketfout, STUN uit', { fout: e.message }); try { socket.close(); } catch (x) {} });
  try {
    socket.bind(poort, () => { zeg('info', '[stun] eigen STUN-server luistert', { poort }); });
    if (socket.unref) socket.unref();                       // mag het afsluiten nooit tegenhouden
  } catch (e) { zeg('warn', '[stun] binden mislukt, STUN uit', { poort, fout: e.message }); return null; }
  return { socket, poort, stop: () => { try { socket.close(); } catch (e) {} } };
}

module.exports = { start, verwerk };
