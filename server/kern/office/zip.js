/* RTG Office: zip schrijven en lezen, voor XLSX en DOCX (OFFICE.md punt 23).

   Er staat geen zip-bibliotheek in dit huis en er komt er geen bij voor twee
   formaten: een Office-bestand is een gewone zip met XML erin, en Node heeft
   deflate en crc32 al aan boord (zlib). Wat hier staat is het containerformaat
   en verder niets.

   LEZEN IS INVOER VAN EEN VREEMDE. Een zip kan een bom zijn (een paar kB die
   uitpakken tot gigabytes), een pad als ../../ dragen of over zijn eigen
   lengtes liegen. Daarom: een plafond per bestand en in totaal dat zlib zelf
   afdwingt (maxOutputLength, niet achteraf meten), een maximum aantal
   bestanden, alleen de methodes 0 (opgeslagen) en 8 (deflate), en een naam is
   alleen een sleutel in een object -- er wordt nooit iets naar schijf
   geschreven. */
'use strict';

const zlib = require('node:zlib');

/* Een zip van { naam: Buffer|string }. Deflate, met de vaste datum van
   1 januari 2026 zodat hetzelfde document byte voor byte hetzelfde bestand
   geeft (een export die per seconde verschilt, kun je niet vergelijken). */
function pak(bestanden) {
  const lokaal = [], centraal = [];
  let positie = 0;
  const TIJD = 0, DATUM = ((2026 - 1980) << 9) | (1 << 5) | 1;
  for (const [naam, inhoud] of Object.entries(bestanden)) {
    const ruw = Buffer.isBuffer(inhoud) ? inhoud : Buffer.from(String(inhoud), 'utf8');
    const ingepakt = zlib.deflateRawSync(ruw);
    const naamBuf = Buffer.from(naam, 'utf8');
    const crc = zlib.crc32(ruw) >>> 0;
    const kop = Buffer.alloc(30);
    kop.writeUInt32LE(0x04034b50, 0); kop.writeUInt16LE(20, 4); kop.writeUInt16LE(0x0800, 6);
    kop.writeUInt16LE(8, 8); kop.writeUInt16LE(TIJD, 10); kop.writeUInt16LE(DATUM, 12);
    kop.writeUInt32LE(crc, 14); kop.writeUInt32LE(ingepakt.length, 18); kop.writeUInt32LE(ruw.length, 22);
    kop.writeUInt16LE(naamBuf.length, 26); kop.writeUInt16LE(0, 28);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6);
    cen.writeUInt16LE(0x0800, 8); cen.writeUInt16LE(8, 10); cen.writeUInt16LE(TIJD, 12); cen.writeUInt16LE(DATUM, 14);
    cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(ingepakt.length, 20); cen.writeUInt32LE(ruw.length, 24);
    cen.writeUInt16LE(naamBuf.length, 28); cen.writeUInt32LE(positie, 42);
    lokaal.push(kop, naamBuf, ingepakt);
    centraal.push(cen, naamBuf);
    positie += kop.length + naamBuf.length + ingepakt.length;
  }
  const cenBuf = Buffer.concat(centraal);
  const eind = Buffer.alloc(22);
  const n = Object.keys(bestanden).length;
  eind.writeUInt32LE(0x06054b50, 0); eind.writeUInt16LE(n, 8); eind.writeUInt16LE(n, 10);
  eind.writeUInt32LE(cenBuf.length, 12); eind.writeUInt32LE(positie, 16);
  return Buffer.concat([...lokaal, cenBuf, eind]);
}

const GRENS = { perBestand: 8 * 1024 * 1024, totaal: 24 * 1024 * 1024, aantal: 400 };

/* Een zip lezen tot { naam: Buffer }. Gooit een Error met `zipFout` bij alles
   wat niet klopt; de aanroeper maakt daar een nette weigering van. */
function lees(buf, grens) {
  const g = Object.assign({}, GRENS, grens || {});
  const fout = (w) => { const e = new Error(w); e.zipFout = true; return e; };
  if (!Buffer.isBuffer(buf) || buf.length < 22) throw fout('Dit is geen zip-bestand.');
  // het einde van de centrale map: van achteren zoeken, met ruimte voor commentaar
  let e = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  }
  if (e < 0) throw fout('Dit is geen zip-bestand.');
  const aantal = buf.readUInt16LE(e + 10);
  if (aantal > g.aantal) throw fout('Er zitten te veel onderdelen in dit bestand.');
  let p = buf.readUInt32LE(e + 16);
  // geen prototype: een onderdeel dat `__proto__` heet, blijft een gewone sleutel
  const uit = Object.create(null);
  let totaal = 0;
  for (let k = 0; k < aantal; k++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw fout('De inhoudsopgave van dit bestand is beschadigd.');
    const methode = buf.readUInt16LE(p + 10);
    const ingepakt = buf.readUInt32LE(p + 20);
    const lengte = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32);
    const lok = buf.readUInt32LE(p + 42);
    const naam = buf.slice(p + 46, p + 46 + nl).toString('utf8');
    p += 46 + nl + el + cl;
    if (naam.endsWith('/')) continue;
    if (lok + 30 > buf.length || buf.readUInt32LE(lok) !== 0x04034b50) throw fout('Een onderdeel van dit bestand is beschadigd.');
    const start = lok + 30 + buf.readUInt16LE(lok + 26) + buf.readUInt16LE(lok + 28);
    if (start + ingepakt > buf.length) throw fout('Een onderdeel van dit bestand is afgekapt.');
    if (lengte > g.perBestand) throw fout('Een onderdeel van dit bestand is te groot.');
    const bron = buf.slice(start, start + ingepakt);
    let ruw;
    if (methode === 0) ruw = bron;
    else if (methode === 8) {
      try { ruw = zlib.inflateRawSync(bron, { maxOutputLength: g.perBestand }); }
      catch (x) { throw fout('Een onderdeel van dit bestand kon niet worden uitgepakt.'); }
    } else throw fout('Dit bestand gebruikt een inpakmethode die RTG Office niet leest.');
    totaal += ruw.length;
    if (totaal > g.totaal) throw fout('Dit bestand is uitgepakt te groot.');
    uit[naam] = ruw;
  }
  return uit;
}

module.exports = { pak, lees, GRENS };
