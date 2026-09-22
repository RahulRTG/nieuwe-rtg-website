/* Connection Profile Media -- beeldgrens.

   Een Content-Type is geen bewijs dat bytes een foto zijn. Deze module leest
   daarom de werkelijke PNG/JPEG-structuur, begrenst afmetingen en pixeloppervlak
   en schrijft een gecontroleerde variant terug. PNG-tekst/EXIF en JPEG APP/COM-
   segmenten verdwijnen; daarmee reizen GPS en camerametadata niet naar een
   volgende Connection-context. Er is bewust nog geen video-ondersteuning. */
'use strict';

const zlib = require('node:zlib');

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ZIJDE = 8192;
const MAX_PIXELS = 24 * 1024 * 1024;

let crcTabel = null;
function crc32(buf) {
  if (!crcTabel) {
    crcTabel = Array.from({ length: 256 }, (_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      return c >>> 0;
    });
  }
  let c = 0xffffffff;
  for (const b of buf) c = crcTabel[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const naam = Buffer.from(type, 'ascii');
  const lengte = Buffer.alloc(4); lengte.writeUInt32BE(data.length);
  const som = Buffer.alloc(4); som.writeUInt32BE(crc32(Buffer.concat([naam, data])));
  return Buffer.concat([lengte, naam, data, som]);
}

function grenzen(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1)
    throw new Error('De foto heeft geen geldige afmetingen.');
  if (width > MAX_ZIJDE || height > MAX_ZIJDE || width * height > MAX_PIXELS)
    throw new Error('De foto is te groot in afmetingen. Gebruik maximaal 24 megapixel.');
}

function png(buf) {
  const handtekening = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 33 || !buf.subarray(0, 8).equals(handtekening)) throw new Error('Dit is geen geldige PNG-foto.');
  let op = 8, ihdr = null, iend = false;
  const idat = [], veilig = [];
  while (op + 12 <= buf.length) {
    const lengte = buf.readUInt32BE(op);
    if (lengte > MAX_BYTES || op + 12 + lengte > buf.length) throw new Error('De PNG-structuur is beschadigd.');
    const type = buf.subarray(op + 4, op + 8).toString('ascii');
    const data = buf.subarray(op + 8, op + 8 + lengte);
    const verwacht = buf.readUInt32BE(op + 8 + lengte);
    if (crc32(Buffer.concat([Buffer.from(type), data])) !== verwacht) throw new Error('De PNG-controlesom klopt niet.');
    if (!ihdr && type !== 'IHDR') throw new Error('De PNG mist zijn beeldkop.');
    if (type === 'IHDR') {
      if (ihdr || lengte !== 13) throw new Error('De PNG-beeldkop is ongeldig.');
      ihdr = Buffer.from(data);
      if (ihdr[12] !== 0) throw new Error('Interlaced PNG is voor profielfoto’s niet toegestaan.');
    } else if (type === 'IDAT') idat.push(Buffer.from(data));
    else if (type === 'PLTE' || type === 'tRNS') veilig.push({ type, data: Buffer.from(data) });
    else if (type === 'IEND') { if (lengte !== 0) throw new Error('De PNG-afsluiting is ongeldig.'); iend = true; op += 12; break; }
    else if (type[0] === type[0].toUpperCase()) throw new Error('De PNG bevat een onbekend essentieel onderdeel.');
    op += 12 + lengte;
  }
  if (!ihdr || !idat.length || !iend || op !== buf.length) throw new Error('De PNG is niet volledig.');
  const width = ihdr.readUInt32BE(0), height = ihdr.readUInt32BE(4);
  grenzen(width, height);
  const diepte = ihdr[8], kleur = ihdr[9];
  const kanalen = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[kleur];
  if (!kanalen || ![1, 2, 4, 8, 16].includes(diepte) || (kleur !== 0 && kleur !== 3 && diepte < 8))
    throw new Error('Deze PNG-kleurindeling wordt niet ondersteund.');
  const rij = Math.ceil(width * kanalen * diepte / 8) + 1;
  const verwacht = rij * height;
  let pixels;
  try { pixels = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: verwacht + 1 }); }
  catch (e) { throw new Error('De PNG-beeldgegevens zijn beschadigd.'); }
  if (pixels.length !== verwacht) throw new Error('De PNG-beeldgegevens hebben een ongeldige lengte.');
  const onderdelen = [handtekening, pngChunk('IHDR', ihdr)];
  for (const x of veilig) onderdelen.push(pngChunk(x.type, x.data));
  onderdelen.push(pngChunk('IDAT', Buffer.concat(idat)), pngChunk('IEND', Buffer.alloc(0)));
  return { bytes: Buffer.concat(onderdelen), mime: 'image/png', width, height, metadataStripped: true };
}

function jpeg(buf) {
  if (buf.length < 16 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('Dit is geen geldige JPEG-foto.');
  const delen = [buf.subarray(0, 2)];
  let op = 2, width = 0, height = 0, scan = false;
  while (op < buf.length) {
    if (buf[op] !== 0xff) throw new Error('De JPEG-structuur is beschadigd.');
    while (op < buf.length && buf[op] === 0xff) op++;
    const marker = buf[op++];
    if (marker === 0xd9) { delen.push(Buffer.from([0xff, 0xd9])); break; }
    if (marker === 0x00 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7))
      throw new Error('De JPEG bevat een marker op een ongeldige plaats.');
    if (op + 2 > buf.length) throw new Error('De JPEG is afgebroken.');
    const lengte = buf.readUInt16BE(op);
    if (lengte < 2 || op + lengte > buf.length) throw new Error('De JPEG-segmentlengte klopt niet.');
    const begin = op - 2, einde = op + lengte;
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (lengte < 8) throw new Error('De JPEG-beeldkop is ongeldig.');
      height = buf.readUInt16BE(op + 3); width = buf.readUInt16BE(op + 5); grenzen(width, height);
    }
    if (marker === 0xda) {
      delen.push(buf.subarray(begin, einde));
      const eoi = buf.lastIndexOf(Buffer.from([0xff, 0xd9]));
      if (eoi < einde) throw new Error('De JPEG mist zijn afsluiting.');
      delen.push(buf.subarray(einde, eoi + 2));
      scan = true; op = buf.length; break;
    }
    /* APP1..APP15 en COM bevatten EXIF, GPS, XMP en vrije tekst. APP0 (JFIF)
       mag blijven; alle noodzakelijke decodeertabellen blijven eveneens. */
    if (!(marker >= 0xe1 && marker <= 0xef) && marker !== 0xfe) delen.push(buf.subarray(begin, einde));
    op = einde;
  }
  if (!width || !height || !scan) throw new Error('De JPEG bevat geen compleet beeld.');
  const bytes = Buffer.concat(delen);
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new Error('De JPEG is niet volledig.');
  return { bytes, mime: 'image/jpeg', width, height, metadataStripped: true };
}

function normaliseer(bytes, opgegevenMime) {
  if (!Buffer.isBuffer(bytes) || !bytes.length) throw new Error('Kies eerst een foto.');
  if (bytes.length > MAX_BYTES) throw new Error('De foto is groter dan 8 MB.');
  let uit;
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) uit = png(bytes);
  else if (bytes[0] === 0xff && bytes[1] === 0xd8) uit = jpeg(bytes);
  else throw new Error('Gebruik een echte JPEG- of PNG-foto.');
  const gemeld = String(opgegevenMime || '').split(';')[0].trim().toLowerCase();
  if (gemeld && gemeld !== uit.mime) throw new Error('Het opgegeven bestandstype komt niet overeen met de foto.');
  return uit;
}

module.exports = { normaliseer, png, jpeg, MAX_BYTES, MAX_ZIJDE, MAX_PIXELS };
