/* WGS84-meetkunde voor de RTG World Graph. Regiopakketten bewaren hun
   wegvormen als gewone little-endian LINESTRING-WKB; daardoor heeft de
   runtime geen GIS-pakket of externe kaartdienst nodig. */
'use strict';

function leesLijn(blob) {
  const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob || []);
  if (b.length < 9) return [];
  const klein = b[0] === 1;
  const u32 = p => klein ? b.readUInt32LE(p) : b.readUInt32BE(p);
  const f64 = p => klein ? b.readDoubleLE(p) : b.readDoubleBE(p);
  if (u32(1) % 1000 !== 2) return [];
  const aantal = u32(5), uit = [];
  for (let i = 0, p = 9; i < aantal && p + 15 < b.length; i++, p += 16) {
    uit.push({ lng: f64(p), lat: f64(p + 8) });
  }
  return uit;
}

function schrijfLijn(punten) {
  const rij = Array.isArray(punten) ? punten : [];
  const b = Buffer.allocUnsafe(9 + rij.length * 16);
  b[0] = 1; b.writeUInt32LE(2, 1); b.writeUInt32LE(rij.length, 5);
  for (let i = 0, p = 9; i < rij.length; i++, p += 16) {
    b.writeDoubleLE(Number(rij[i].lng), p); b.writeDoubleLE(Number(rij[i].lat), p + 8);
  }
  return b;
}

function grens(punten) {
  const g = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };
  for (const p of punten) {
    g.minLat = Math.min(g.minLat, p.lat); g.maxLat = Math.max(g.maxLat, p.lat);
    g.minLng = Math.min(g.minLng, p.lng); g.maxLng = Math.max(g.maxLng, p.lng);
  }
  return g;
}

module.exports = { leesLijn, schrijfLijn, grens };
