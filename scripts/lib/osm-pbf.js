/* Kleine, zelfstandige OSM-PBF-lezer voor de RTG World Graph-importer.
   Ondersteunt de standaard raw/zlib blobs, DenseNodes, Nodes en Ways. */
'use strict';

const fs = require('node:fs');
const zlib = require('node:zlib');

function varint(b, staat) {
  let n = 0n, shift = 0n;
  while (staat.i < b.length) { const x = b[staat.i++]; n |= BigInt(x & 127) << shift;
    if (!(x & 128)) return n; shift += 7n; if (shift > 70n) throw new Error('Ongeldige protobuf-varint.'); }
  throw new Error('Afgebroken protobuf-varint.');
}
const zigzag = n => (n >> 1n) ^ (-(n & 1n));
function velden(b) {
  const uit = [], s = { i: 0 };
  while (s.i < b.length) {
    const tag = Number(varint(b, s)), nr = tag >> 3, wire = tag & 7;
    if (wire === 0) uit.push({ nr, wire, n: varint(b, s) });
    else if (wire === 2) { const len = Number(varint(b, s)), begin = s.i; s.i += len;
      if (s.i > b.length) throw new Error('Afgebroken protobuf-veld.'); uit.push({ nr, wire, b: b.subarray(begin, s.i) }); }
    else if (wire === 1) { s.i += 8; }
    else if (wire === 5) { s.i += 4; }
    else throw new Error('Niet-ondersteund protobuf-wiretype ' + wire + '.');
  }
  return uit;
}
function gepakt(b, signed) {
  const uit = [], s = { i: 0 }; while (s.i < b.length) { const n = varint(b, s); uit.push(Number(signed ? zigzag(n) : n)); } return uit;
}
function tags(keys, vals, strings) {
  const uit = {}; for (let i = 0; i < Math.min(keys.length, vals.length); i++) {
    const k = strings[keys[i]], v = strings[vals[i]]; if (k != null && v != null) uit[k] = v;
  } return uit;
}
function eerste(rij, nr) { return rij.find(x => x.nr === nr); }
function pakRij(rij, nr, signed) { const x = eerste(rij, nr); return x && x.b ? gepakt(x.b, signed) : []; }

function primitiveBlock(data, bezoeker) {
  const blok = velden(data), stVeld = eerste(blok, 1), strings = stVeld
    ? velden(stVeld.b).filter(x => x.nr === 1).map(x => x.b.toString('utf8')) : [];
  const gran = Number((eerste(blok, 17) || {}).n || 100n);
  const latOff = Number((eerste(blok, 19) || {}).n || 0n), lngOff = Number((eerste(blok, 20) || {}).n || 0n);
  const coord = (offset, n) => 1e-9 * (offset + gran * n);
  for (const groepVeld of blok.filter(x => x.nr === 2)) {
    const groep = velden(groepVeld.b);
    for (const nv of groep.filter(x => x.nr === 1)) {
      const n = velden(nv.b), id = Number(zigzag((eerste(n, 1) || {}).n || 0n));
      const lat = Number(zigzag((eerste(n, 8) || {}).n || 0n)), lng = Number(zigzag((eerste(n, 9) || {}).n || 0n));
      bezoeker.node({ id, lat: coord(latOff, lat), lng: coord(lngOff, lng), tags: tags(pakRij(n, 2), pakRij(n, 3), strings) });
    }
    for (const dv of groep.filter(x => x.nr === 2)) {
      const d = velden(dv.b), ids = pakRij(d, 1, true), lats = pakRij(d, 8, true), lngs = pakRij(d, 9, true);
      const kv = pakRij(d, 10), sleutelRijen = []; let huidig = [];
      for (const x of kv) { if (x === 0) { sleutelRijen.push(huidig); huidig = []; } else huidig.push(x); }
      let id = 0, lat = 0, lng = 0;
      for (let i = 0; i < ids.length; i++) { id += ids[i]; lat += lats[i] || 0; lng += lngs[i] || 0;
        const rij = sleutelRijen[i] || [], ks = [], vs = []; for (let k = 0; k + 1 < rij.length; k += 2) { ks.push(rij[k]); vs.push(rij[k + 1]); }
        bezoeker.node({ id, lat: coord(latOff, lat), lng: coord(lngOff, lng), tags: tags(ks, vs, strings) }); }
    }
    for (const wv of groep.filter(x => x.nr === 3)) {
      const w = velden(wv.b), refsDelta = pakRij(w, 8, true), refs = []; let id = 0;
      for (const d of refsDelta) { id += d; refs.push(id); }
      bezoeker.way({ id: Number((eerste(w, 1) || {}).n || 0n), refs,
        tags: tags(pakRij(w, 2), pakRij(w, 3), strings) });
    }
  }
}

function blobData(blob) {
  const v = velden(blob), raw = eerste(v, 1), z = eerste(v, 3);
  if (raw && raw.b) return raw.b;
  if (z && z.b) return zlib.inflateSync(z.b);
  throw new Error('OSM-PBF blob gebruikt een niet-ondersteunde compressie.');
}
function leesExact(fd, lengte) {
  const b = Buffer.allocUnsafe(lengte); let off = 0;
  while (off < lengte) { const n = fs.readSync(fd, b, off, lengte - off, null); if (!n) return off ? b.subarray(0, off) : null; off += n; }
  return b;
}
function leesPbf(bestand, bezoeker) {
  const fd = fs.openSync(bestand, 'r'); let blokken = 0;
  try {
    while (true) {
      const lb = leesExact(fd, 4); if (!lb) break; if (lb.length !== 4) throw new Error('Afgebroken OSM-PBF-header.');
      const header = leesExact(fd, lb.readUInt32BE(0)); if (!header) throw new Error('OSM-PBF-header ontbreekt.');
      const hv = velden(header), type = (eerste(hv, 1) || {}).b, grootte = Number((eerste(hv, 3) || {}).n || 0n);
      const blob = leesExact(fd, grootte); if (!blob) throw new Error('OSM-PBF-blob ontbreekt.');
      if (type && type.toString() === 'OSMData') primitiveBlock(blobData(blob), bezoeker);
      blokken++; if (bezoeker.voortgang) bezoeker.voortgang(blokken);
    }
  } finally { fs.closeSync(fd); }
  return blokken;
}

module.exports = { leesPbf, primitiveBlock, velden, gepakt, zigzag };
