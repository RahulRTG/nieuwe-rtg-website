/* Meetkunde voor het Nationaal Wegenbestand. NWB bewaart lijnen als
   GeoPackage-WKB in Rijksdriehoekscoordinaten (EPSG:28992). Deze module leest
   alleen dat binaire formaat en zet RD zelf om naar WGS84; geen GIS-pakket en
   geen kaartleverancier in de runtime. */
'use strict';

function rdNaarWgs(x, y) {
  const dx = (Number(x) - 155000) / 100000;
  const dy = (Number(y) - 463000) / 100000;
  const latSec = 3235.65389 * dy - 32.58297 * dx ** 2 - 0.2475 * dy ** 2
    - 0.84978 * dx ** 2 * dy - 0.0655 * dy ** 3 - 0.01709 * dx ** 2 * dy ** 2
    - 0.00738 * dx + 0.0053 * dx ** 4 - 0.00039 * dx ** 2 * dy ** 3
    + 0.00033 * dx ** 4 * dy - 0.00012 * dx * dy;
  const lngSec = 5260.52916 * dx + 105.94684 * dx * dy + 2.45656 * dx * dy ** 2
    - 0.81885 * dx ** 3 + 0.05594 * dx * dy ** 3 - 0.05607 * dx ** 3 * dy
    + 0.01199 * dy - 0.00256 * dx ** 3 * dy ** 2 + 0.00128 * dx * dy ** 4
    + 0.00022 * dy ** 2 - 0.00022 * dx ** 2 + 0.00026 * dx ** 5;
  return { lat: 52.1551744 + latSec / 3600, lng: 5.38720621 + lngSec / 3600 };
}

function wkbBegin(blob) {
  const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob || []);
  if (b.length < 9) throw new Error('NWB-geometrie is te kort.');
  if (b[0] !== 0x47 || b[1] !== 0x50) return { b, off: 0 };
  const omhulsel = (b[3] >> 1) & 7;
  const doubles = [0, 4, 6, 6, 8][omhulsel] || 0;
  return { b, off: 8 + doubles * 8 };
}

function leesLijn(b, off) {
  const klein = b[off] === 1;
  const u32 = p => klein ? b.readUInt32LE(p) : b.readUInt32BE(p);
  const f64 = p => klein ? b.readDoubleLE(p) : b.readDoubleBE(p);
  const type = u32(off + 1) % 1000;
  if (type !== 2) throw new Error('NWB verwacht LINESTRING-WKB, kreeg type ' + type + '.');
  const aantal = u32(off + 5);
  const punten = [];
  let p = off + 9;
  for (let i = 0; i < aantal; i++, p += 16) {
    const x = f64(p), y = f64(p + 8);
    punten.push({ x, y, ...rdNaarWgs(x, y) });
  }
  return punten;
}

function puntenUit(blob) {
  const { b, off } = wkbBegin(blob);
  if (off + 9 > b.length) return [];
  const klein = b[off] === 1;
  const type = (klein ? b.readUInt32LE(off + 1) : b.readUInt32BE(off + 1)) % 1000;
  if (type === 2) return leesLijn(b, off);
  if (type !== 5) throw new Error('Onbekend NWB-WKB-type ' + type + '.');
  const aantal = klein ? b.readUInt32LE(off + 5) : b.readUInt32BE(off + 5);
  const uit = [];
  let p = off + 9;
  for (let i = 0; i < aantal; i++) {
    const lijn = leesLijn(b, p);
    if (uit.length && lijn.length) lijn.shift();
    uit.push(...lijn);
    const lk = b[p] === 1;
    const n = lk ? b.readUInt32LE(p + 5) : b.readUInt32BE(p + 5);
    p += 9 + n * 16;
  }
  return uit;
}

function lengteRd(punten) {
  let m = 0;
  for (let i = 1; i < punten.length; i++) m += Math.hypot(punten[i].x - punten[i - 1].x, punten[i].y - punten[i - 1].y);
  return m;
}

function grens(punten) {
  const g = { minLat: Infinity, maxLat: -Infinity, minLng: Infinity, maxLng: -Infinity };
  for (const p of punten) {
    g.minLat = Math.min(g.minLat, p.lat); g.maxLat = Math.max(g.maxLat, p.lat);
    g.minLng = Math.min(g.minLng, p.lng); g.maxLng = Math.max(g.maxLng, p.lng);
  }
  return g;
}

module.exports = { rdNaarWgs, puntenUit, lengteRd, grens };
