/* web, deel "bestanden": MIME-tabel, ETag en het streamen van statische
   bestanden met Range/416, voorwaardelijke GET/304 en pad-traversal-bescherming.
   web.static bouwt hierop. */
'use strict';
const fs = require('fs');
const path = require('path');
const { padNaar } = require('./routing');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.map': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.avif': 'image/avif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.csv': 'text/csv; charset=utf-8'
};
function mimeVan(fp) { return MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream'; }
function etagVan(st) { return '"' + st.size.toString(16) + '-' + Math.floor(st.mtimeMs).toString(16) + '"'; }
// Content-gehashte build-output (scripts/build.js -> dist/<naam>.<hash>.min.js):
// de bestandsnaam verandert zodra de inhoud verandert, dus mag de browser (en
// een edge/CDN ervoor) hem voor altijd bewaren. Zo scheelt elk herhaalbezoek een
// heen-en-weer over het net. De gewone (niet-gehashte) HTML blijft max-age=0.
function onveranderlijk(fp) { return /\.[0-9a-f]{8,}\.min\.(?:js|css)$/i.test(path.basename(fp)); }

function stuurBestand(req, res, fp, st, next) {
  const etag = etagVan(st);
  const laatst = new Date(st.mtime).toUTCString();
  if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', mimeVan(fp));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', laatst);
  if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', onveranderlijk(fp) ? 'public, max-age=31536000, immutable' : 'public, max-age=0');

  // voorwaardelijke GET -> 304
  const inm = req.headers['if-none-match'];
  const ims = req.headers['if-modified-since'];
  if ((inm && inm === etag) || (ims && !inm && new Date(ims).getTime() >= Math.floor(st.mtimeMs / 1000) * 1000)) {
    res.statusCode = 304; return res.end();
  }

  const bereik = req.headers.range;
  if (bereik) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(bereik).trim());
    if (m) {
      let start = m[1] === '' ? null : parseInt(m[1], 10);
      let eind = m[2] === '' ? null : parseInt(m[2], 10);
      if (start === null) { start = Math.max(0, st.size - (eind || 0)); eind = st.size - 1; }        // laatste N bytes
      else if (eind === null || eind >= st.size) eind = st.size - 1;
      if (start > eind || start >= st.size) { res.statusCode = 416; res.setHeader('Content-Range', 'bytes */' + st.size); return res.end(); }
      res.statusCode = 206;
      res.setHeader('Content-Range', 'bytes ' + start + '-' + eind + '/' + st.size);
      res.setHeader('Content-Length', eind - start + 1);
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(fp, { start, end: eind }).on('error', () => res.destroy()).pipe(res);
    }
  }
  res.setHeader('Content-Length', st.size);
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(fp).on('error', () => res.destroy()).pipe(res);
}

function statisch(root, opts) {
  root = path.resolve(root);
  const index = (opts && opts.index) || 'index.html';
  return function (req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    let pn; try { pn = decodeURIComponent(padNaar(req.url)); } catch (e) { return next(); }
    if (pn.indexOf('\0') !== -1) return next();
    let fp = path.join(root, pn);
    if (fp !== root && !fp.startsWith(root + path.sep)) return next();     // pad-traversal geweigerd
    fs.stat(fp, (err, st) => {
      if (err) return next();
      if (st.isDirectory()) {
        const kandidaat = path.join(fp, index);
        return fs.stat(kandidaat, (e2, st2) => { if (e2 || !st2.isFile()) return next(); stuurBestand(req, res, kandidaat, st2, next); });
      }
      if (!st.isFile()) return next();
      stuurBestand(req, res, fp, st, next);
    });
  };
}


module.exports = { MIME, mimeVan, etagVan, stuurBestand, statisch };
