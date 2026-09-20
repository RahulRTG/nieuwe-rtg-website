/* Mediabestanden: herken het echte type aan de bytes en lever beeld, geluid
   en korte video met byte-ranges uit. Dit staat apart van de opslagbackend:
   disk en S3 bewaren dezelfde versleutelde bytes, terwijl dit bestand bepaalt
   wat er veilig als browsermedia naar buiten mag. */
'use strict';

const path = require('path');

const MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
  aac: 'audio/aac', flac: 'audio/flac'
};

function soortVanBuffer(buf, opgegeven) {
  if (!Buffer.isBuffer(buf) || !buf.length) return null;
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return { mime: 'image/jpeg', ext: 'jpg', kind: 'image' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mime: 'image/png', ext: 'png', kind: 'image' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP')
    return { mime: 'image/webp', ext: 'webp', kind: 'image' };
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WAVE')
    return { mime: 'audio/wav', ext: 'wav', kind: 'audio' };
  if (buf.length >= 4 && buf.subarray(0, 4).toString('latin1') === 'OggS')
    return { mime: 'audio/ogg', ext: 'ogg', kind: 'audio' };
  if (buf.length >= 4 && buf.subarray(0, 4).toString('latin1') === 'fLaC')
    return { mime: 'audio/flac', ext: 'flac', kind: 'audio' };
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] === 0xf1 || buf[1] === 0xf9))
    return { mime: 'audio/aac', ext: 'aac', kind: 'audio' };
  if ((buf.length >= 3 && buf.subarray(0, 3).toString('latin1') === 'ID3') ||
      (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0))
    return { mime: 'audio/mpeg', ext: 'mp3', kind: 'audio' };
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    const audio = String(opgegeven || '').toLowerCase().startsWith('audio/');
    return { mime: audio ? 'audio/webm' : 'video/webm', ext: 'webm', kind: audio ? 'audio' : 'video' };
  }
  if (buf.length >= 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const audio = String(opgegeven || '').toLowerCase().startsWith('audio/') ||
      ['M4A ', 'M4B '].includes(buf.subarray(8, 12).toString('latin1'));
    if (audio) return { mime: 'audio/mp4', ext: 'm4a', kind: 'audio' };
    const quicktime = String(opgegeven || '').toLowerCase() === 'video/quicktime';
    return { mime: quicktime ? 'video/quicktime' : 'video/mp4', ext: quicktime ? 'mov' : 'mp4', kind: 'video' };
  }
  return null;
}

function stuurBuffer(req, res, buf, mime, cacheControl) {
  res.set('Content-Type', mime || 'application/octet-stream');
  res.set('Cache-Control', cacheControl || 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Accept-Ranges', 'bytes');
  const bereik = req.headers && /^bytes=(\d+)-(\d*)$/.exec(String(req.headers.range || ''));
  if (bereik) {
    const begin = Number(bereik[1]);
    const einde = bereik[2] ? Math.min(Number(bereik[2]), buf.length - 1) : buf.length - 1;
    if (!Number.isSafeInteger(begin) || !Number.isSafeInteger(einde) || begin > einde || begin >= buf.length) {
      res.set('Content-Range', 'bytes */' + buf.length);
      return res.status(416).end();
    }
    res.status(206);
    res.set('Content-Range', 'bytes ' + begin + '-' + einde + '/' + buf.length);
    res.set('Content-Length', String(einde - begin + 1));
    return res.end(buf.subarray(begin, einde + 1));
  }
  res.set('Content-Length', String(buf.length));
  res.end(buf);
}

function maakServeer(leesBuf) {
  return async function serveer(req, res) {
    const naam = path.basename(String(req.params.naam || ''));
    if (!/^[0-9a-f]{32}\.(jpg|jpeg|png|webp|mp4|webm|mov)$/.test(naam)) return res.status(400).end();
    const buf = await leesBuf(naam);
    if (!buf) return res.status(404).end();
    const ext = path.extname(naam).slice(1).toLowerCase();
    return stuurBuffer(req, res, buf, MIME[ext], 'public, max-age=31536000, immutable');
  };
}

module.exports = { MIME, soortVanBuffer, stuurBuffer, maakServeer };
