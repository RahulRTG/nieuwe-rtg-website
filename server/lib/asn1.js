/* ASN.1 DER-encoder, in huis en zonder dependency. Precies genoeg om zelf een
   X.509-certificaat (self-signed voor local) en een PKCS#10-CSR (voor ACME/Let's
   Encrypt) te bouwen. Dit is SERIALISATIE, geen cryptografie: het echte tekenen
   doet Node's crypto (crypto.sign). DER is de "distinguished" (canonieke) vorm
   van BER: kortste lengte-codering, geen overbodige bytes -- zodat OpenSSL (en
   dus elke TLS-stack en elke CA) onze bytes accepteert.

   Elke bouwer geeft een Buffer terug; je nest ze in seq()/set(). Zo leest de
   opbouw als de ASN.1-structuur zelf. */
'use strict';

// Lengte-veld in DER: korte vorm (<128) is één byte; anders 0x80|aantal gevolgd
// door de lengte big-endian, zo kort mogelijk.
function lengte(n) {
  if (n < 0x80) return Buffer.from([n]);
  const b = [];
  while (n > 0) { b.unshift(n & 0xff); n = Math.floor(n / 256); }
  return Buffer.from([0x80 | b.length, ...b]);
}
// Tag-Length-Value: de bouwsteen van alles.
function tlv(tag, waarde) { return Buffer.concat([Buffer.from([tag]), lengte(waarde.length), waarde]); }

// INTEGER (0x02). Uit een niet-negatief getal of een big-endian Buffer. Een
// voorloop-0x00 wordt toegevoegd als de hoogste bit gezet is (anders leest DER
// het als negatief); overbodige voorloopnullen worden weggehaald.
function integer(waarde) {
  let buf;
  if (Buffer.isBuffer(waarde)) buf = Buffer.from(waarde);
  else {
    const b = [];
    let n = waarde;
    if (n === 0) b.push(0);
    while (n > 0) { b.unshift(n & 0xff); n = Math.floor(n / 256); }
    buf = Buffer.from(b);
  }
  let i = 0; while (i < buf.length - 1 && buf[i] === 0 && (buf[i + 1] & 0x80) === 0) i++;
  buf = buf.slice(i);
  if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]);
  return tlv(0x02, buf);
}

function bitString(buf, ongebruikt) { return tlv(0x03, Buffer.concat([Buffer.from([ongebruikt || 0]), buf])); }
function octetString(buf) { return tlv(0x04, buf); }
function nul() { return tlv(0x05, Buffer.alloc(0)); }
function booleaans(v) { return tlv(0x01, Buffer.from([v ? 0xff : 0x00])); }

// OBJECT IDENTIFIER (0x06). "1.2.840.113549.1.1.11" -> DER. De eerste twee bogen
// gaan samen in één byte (40*a+b), de rest in base-128 met de hoogste bit als
// "gaat door"-vlag op alle bytes behalve de laatste.
function oid(dotted) {
  const d = dotted.split('.').map(Number);
  const uit = [40 * d[0] + d[1]];
  for (let i = 2; i < d.length; i++) {
    let n = d[i]; const stapel = [n & 0x7f]; n = Math.floor(n / 128);
    while (n > 0) { stapel.unshift((n & 0x7f) | 0x80); n = Math.floor(n / 128); }
    uit.push(...stapel);
  }
  return tlv(0x06, Buffer.from(uit));
}

function utf8(s) { return tlv(0x0c, Buffer.from(s, 'utf8')); }
function printable(s) { return tlv(0x13, Buffer.from(s, 'latin1')); }
function ia5(s) { return tlv(0x16, Buffer.from(s, 'latin1')); }

// Tijd: UTCTime (YYMMDDHHMMSSZ) voor jaren < 2050, anders GeneralizedTime
// (YYYYMMDDHHMMSSZ) -- precies de X.509-regel (RFC 5280 4.1.2.5).
function tijd(dt) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const jaar = dt.getUTCFullYear();
  const mmss = p(dt.getUTCMonth() + 1) + p(dt.getUTCDate()) + p(dt.getUTCHours()) + p(dt.getUTCMinutes()) + p(dt.getUTCSeconds()) + 'Z';
  if (jaar < 2050) return tlv(0x17, Buffer.from(p(jaar % 100) + mmss, 'latin1'));
  return tlv(0x18, Buffer.from(p(jaar, 4) + mmss, 'latin1'));
}

function seq(...kinderen) { return tlv(0x30, Buffer.concat(kinderen)); }
function set(...kinderen) { return tlv(0x31, Buffer.concat(kinderen)); }
// context-specifieke tag, expliciet ([n] wrapt de inhoud) of impliciet (vervangt
// de tag). Constructed-vlag (0x20) tenzij het een primitieve impliciete is.
function context(n, inhoud, opties) {
  const constructed = !opties || opties.constructed !== false;
  const tag = 0xa0 | n | (constructed ? 0x20 : 0);
  // 0xa0 heeft de constructed-bit al; voor impliciet-primitief halen we die eraf
  const echteTag = constructed ? (0xa0 | n) : (0x80 | n);
  return tlv(echteTag, inhoud);
}
// een al-gecodeerd stuk DER (bijv. een SPKI dat Node ons gaf) ongewijzigd opnemen
function ruw(buf) { return Buffer.from(buf); }

module.exports = { lengte, tlv, integer, bitString, octetString, nul, booleaans, oid, utf8, printable, ia5, tijd, seq, set, context, ruw };
