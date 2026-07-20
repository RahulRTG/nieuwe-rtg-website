/* web, deel "body": de body-parsers (web.json / web.raw) met limiet en type-
   match, plus de byte-limiet-helper. Puur op de request-stream; geen requires. */
'use strict';

function limietBytes(v) {
  if (v == null) return Infinity;
  if (typeof v === 'number') return v;
  const m = String(v).trim().match(/^([\d.]+)\s*(b|kb|mb|gb)?$/i);
  if (!m) return Infinity;
  const eenheid = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }[(m[2] || 'b').toLowerCase()];
  return parseFloat(m[1]) * eenheid;
}

function heeftBody(req) {
  return (req.headers['transfer-encoding'] != null) ||
    (req.headers['content-length'] != null && req.headers['content-length'] !== '0');
}
function typeMatcht(req, type) {
  if (typeof type === 'function') return !!type(req);
  const ct = String(req.headers['content-type'] || '');
  if (type === '*/*' || type == null) return true;
  if (type === 'application/json' || type === 'json') return /[/+]json(\s*;|\s*$)/i.test(ct) || ct === '' && false;
  return ct.toLowerCase().startsWith(String(type).toLowerCase());
}
function leesBody(req, limiet, cb) {
  const brokken = []; let n = 0, klaar = false;
  req.on('data', (c) => {
    if (klaar) return;
    n += c.length;
    if (n > limiet) { klaar = true; const e = new Error('request entity too large'); e.status = 413; e.type = 'entity.too.large'; return cb(e); }
    brokken.push(c);
  });
  req.on('end', () => { if (klaar) return; klaar = true; cb(null, Buffer.concat(brokken)); });
  req.on('error', (e) => { if (klaar) return; klaar = true; cb(e); });
}
function json(opts) {
  opts = opts || {};
  const limiet = limietBytes(opts.limit != null ? opts.limit : '100kb');
  const type = opts.type || 'application/json';
  return function (req, res, next) {
    if (req._body || !heeftBody(req) || !typeMatcht(req, type)) return next();
    leesBody(req, limiet, (err, buf) => {
      if (err) return next(err);
      req._body = true;
      const s = buf.toString('utf8').trim();
      if (!s) { req.body = {}; return next(); }
      try { req.body = JSON.parse(s); } catch (e) { e.status = 400; e.type = 'entity.parse.failed'; return next(e); }
      next();
    });
  };
}
function raw(opts) {
  opts = opts || {};
  const limiet = limietBytes(opts.limit != null ? opts.limit : '100kb');
  const type = opts.type || 'application/octet-stream';
  return function (req, res, next) {
    if (req._body || !typeMatcht(req, type)) return next();
    leesBody(req, limiet, (err, buf) => { if (err) return next(err); req._body = true; req.body = buf; next(); });
  };
}


module.exports = { json, raw, limietBytes, leesBody, heeftBody, typeMatcht };
