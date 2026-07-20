/* pgwire, deel "protocol": de pure wire-helpers -- berichten inpakken, Int16/
   Int32 schrijven, C-strings lezen, foutvelden ontleden -- plus de type-
   decodering (tekstformaat, zoals node-postgres) en de parameter-tekstcodering.
   Geen crypto, geen sockets: enkel bytes <-> waarden. Los testbaar. */
'use strict';

function cstr(s) { return Buffer.concat([Buffer.from(String(s), 'utf8'), Buffer.from([0])]); }
function bericht(type, body) {                       // type=null -> startup (geen typebyte)
  const len = Buffer.alloc(4); len.writeInt32BE((body ? body.length : 0) + 4, 0);
  return type ? Buffer.concat([Buffer.from(type), len, body || Buffer.alloc(0)])
              : Buffer.concat([len, body || Buffer.alloc(0)]);
}

/* ---------- type-decodering (tekstformaat), zoals node-postgres ---------- */
function decodeer(oid, tekst) {
  if (tekst == null) return null;
  switch (oid) {
    case 16: return tekst === 't';                                   // bool
    case 21: case 23: case 26: return parseInt(tekst, 10);           // int2/int4/oid -> getal
    case 20: return tekst;                                           // int8 -> string (precisie)
    case 700: case 701: return parseFloat(tekst);                    // float4/float8
    case 1700: return tekst;                                         // numeric -> string
    case 114: case 3802: try { return JSON.parse(tekst); } catch (e) { return tekst; } // json/jsonb
    case 1114: case 1184: return new Date(tekst);                    // timestamp(tz)
    case 17: return Buffer.from(tekst.replace(/^\\x/, ''), 'hex');   // bytea (hex)
    default: return tekst;                                           // text/varchar/name/...
  }
}

// Int16 in het v3-protocol is een 16-bits teller: parameteraantal, aantal
// resultaatkolommen, aantal formaatcodes. Postgres staat tot 65535 parameters
// toe (een batch-insert van 5000 rijen x 9 kolommen = 45000 > 32767), dus dit
// MOET unsigned. De bytes zijn identiek aan writeInt16BE voor 0..32767; alleen
// de bereikcontrole verschilt. We sturen zelf nooit negatieve int16's.
function int16(n) { const b = Buffer.alloc(2); b.writeUInt16BE(n & 0xffff, 0); return b; }
function int32(n) { const b = Buffer.alloc(4); b.writeInt32BE(n, 0); return b; }
function leesCstrs(buf, max) { const uit = []; let o = 0; while (o < buf.length && uit.length < max) { const eind = buf.indexOf(0, o); if (eind === -1) break; uit.push(buf.toString('utf8', o, eind)); o = eind + 1; } return uit; }
function foutVelden(p) { const uit = {}; let o = 0; while (o < p.length && p[o] !== 0) { const code = String.fromCharCode(p[o]); const eind = p.indexOf(0, o + 1); uit[code] = p.toString('utf8', o + 1, eind); o = eind + 1; } return uit; }
function paramTekst(v) {
  if (v == null) return null;
  if (typeof v === 'boolean') return v ? 't' : 'f';
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return '\\x' + v.toString('hex');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

module.exports = { cstr, bericht, decodeer, int16, int32, leesCstrs, foutVelden, paramTekst };
