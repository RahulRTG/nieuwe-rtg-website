/* Eigen, klein web-framework op node:http, i.p.v. het pakket express.

   Geen eigen cryptografie en geen runtime-magie: dit is puur HTTP-routering en
   middleware-afhandeling bovenop de standaardbibliotheek. We bouwen exact de
   express-deelverzameling na die deze server gebruikt, met dezelfde vorm, zodat
   server.js, de ~1100 routes, de foundation-router en nood.js niets merken:

       const web = require('./web');
       const app = web();
       app.use(web.json({ limit: '8mb' }));
       app.get('/pad/:id', (req, res) => res.status(200).json({ id: req.params.id }));
       app.use(web.static(publicDir));
       app.listen(3000);

   Ondersteund: app()/Router(); use/get/post/put/delete/patch/all; string-paden
   met :params, een RegExp-pad, en prefix-mount van een sub-router (met het
   strippen van het mount-pad, net als express); foutafhandelaars (4-arg
   middleware); web.json / web.raw (body-parsers met limiet en type-match);
   web.static (met Range voor video, voorwaardelijke GET/304, en bescherming
   tegen pad-traversal); en de req/res-hulpjes die de code aanroept.

   Bewust NIET nagebouwd: view-engines, res.render, req.cookies/res.cookie,
   content-negotiation, etag-onderhandeling voorbij het simpele geval -- die
   gebruikt deze codebase niet. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

/* ---------- helpers ---------- */
function limietBytes(v) {
  if (v == null) return Infinity;
  if (typeof v === 'number') return v;
  const m = String(v).trim().match(/^([\d.]+)\s*(b|kb|mb|gb)?$/i);
  if (!m) return Infinity;
  const eenheid = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 }[(m[2] || 'b').toLowerCase()];
  return parseFloat(m[1]) * eenheid;
}
function padNaar(url) { const i = url.indexOf('?'); return i === -1 ? url : url.slice(0, i); }

// String-pad -> { str } (snelle gelijkheid) of { rx, keys } (met :params).
function compilePad(pat) {
  if (pat instanceof RegExp) return { rx: pat, keys: [] };
  if (!/:/.test(pat)) return { str: pat };            // geen params: directe vergelijking (snel)
  const keys = [];
  const bron = pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:([A-Za-z0-9_]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
  return { rx: new RegExp('^' + bron + '\\/?$'), keys };
}
function padMatch(laag, pn) {
  if (laag.str != null) return (pn === laag.str || pn === laag.str + '/') ? {} : null;
  const m = laag.rx.exec(pn);
  if (!m) return null;
  const params = {};
  for (let i = 0; i < laag.keys.length; i++) { try { params[laag.keys[i]] = decodeURIComponent(m[i + 1]); } catch (e) { params[laag.keys[i]] = m[i + 1]; } }
  return params;
}
// Prefix-mount ('/api/foundation'): matcht op grens, geeft de rest-url terug om te strippen.
function mountMatch(prefix, pn) {
  if (prefix === '/' || prefix === '' || prefix == null) return { rest: pn, len: 0 };
  if (pn === prefix || pn.startsWith(prefix + '/')) return { rest: pn.slice(prefix.length) || '/', len: prefix.length };
  return null;
}

/* ---------- een router (ook de app is er een) ---------- */
function maakRouter() {
  const stack = [];

  function voegToe(method, pat, fns) {
    const c = compilePad(pat);
    for (const fn of fns) {
      if (typeof fn !== 'function') continue;
      stack.push({ method, pad: pat, str: c.str, rx: c.rx, keys: c.keys || [], fn, fout: fn.length === 4, mount: false });
    }
  }

  function handle(req, res, klaar) {
    let i = 0;
    const startUrl = req.url;
    const buitenParams = req.params || {};
    function next(err) {
      if (i >= stack.length) { req.url = startUrl; return klaar(err); }
      const laag = stack[i++];
      // fout-middleware draait alleen bij een fout; gewone middleware alleen zonder.
      if (err && !laag.fout) return next(err);
      if (!err && laag.fout) return next();
      const methodeOk = !laag.method || laag.method === req.method ||
        (laag.method === 'GET' && req.method === 'HEAD');
      if (laag.method && !methodeOk) return next(err);
      const pn = padNaar(req.url);

      if (laag.mount) {
        const mm = mountMatch(laag.prefix, pn);
        if (!mm) return next(err);
        req.params = { ...buitenParams };
        const oudUrl = req.url;
        req.url = mm.len ? req.url.slice(mm.len) || '/' : req.url;
        const verder = (e) => { req.url = oudUrl; req.params = buitenParams; next(e); };
        return laag.fout ? laag.fn(err, req, res, verder) : laag.fn(req, res, verder);
      }

      const params = padMatch(laag, pn);
      if (params === null) return next(err);
      req.params = { ...buitenParams, ...params };
      try {
        if (laag.fout) return laag.fn(err, req, res, next);
        return laag.fn(req, res, next);
      } catch (e) { return next(e); }
    }
    next();
  }

  // de router is zelf een middleware (voor mounten in een andere router)
  const router = function (req, res, next) { handle(req, res, next || (() => {})); };
  router._stack = stack;
  router._handle = handle;

  router.use = function (arg0, ...rest) {
    if (typeof arg0 === 'string') {
      for (const fn of rest) {
        if (typeof fn !== 'function') continue;
        stack.push({ method: null, mount: true, prefix: arg0, fn, fout: fn.length === 4 });
      }
    } else {
      for (const fn of [arg0, ...rest]) {
        if (typeof fn !== 'function') continue;
        stack.push({ method: null, mount: true, prefix: '/', fn, fout: fn.length === 4 });
      }
    }
    return router;
  };
  for (const m of ['get', 'post', 'put', 'delete', 'patch', 'all', 'head', 'options']) {
    router[m] = function (pat, ...fns) { voegToe(m === 'all' ? null : m.toUpperCase(), pat, fns); return router; };
  }
  return router;
}

/* ---------- req/res verrijken (zoals express) ---------- */
function verrijk(req, res, instellingen) {
  const trustProxy = !!(instellingen && instellingen['trust proxy']);
  req.originalUrl = req.originalUrl || req.url;
  const vraag = padNaar(req.url);
  req.path = vraag;
  req.params = req.params || {};
  const qi = req.url.indexOf('?');
  req.query = {};
  if (qi !== -1) { const sp = new URLSearchParams(req.url.slice(qi + 1)); for (const [k, v] of sp) { if (k in req.query) { if (!Array.isArray(req.query[k])) req.query[k] = [req.query[k]]; req.query[k].push(v); } else req.query[k] = v; } }
  req.get = (naam) => {
    const n = String(naam).toLowerCase();
    if (n === 'referer' || n === 'referrer') return req.headers.referer || req.headers.referrer;
    return req.headers[n];
  };
  req.header = req.get;
  const xfProto = trustProxy ? String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() : '';
  req.protocol = xfProto || ((req.socket && req.socket.encrypted) ? 'https' : 'http');
  req.secure = req.protocol === 'https';
  const xfHost = trustProxy ? String(req.headers['x-forwarded-host'] || '').split(',')[0].trim() : '';
  req.hostname = String(xfHost || req.headers.host || '').replace(/:\d+$/, '') || undefined;
  if (trustProxy) {
    const xff = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    req.ip = xff || (req.socket && req.socket.remoteAddress);
  } else req.ip = req.socket && req.socket.remoteAddress;

  res.status = (code) => { res.statusCode = code; return res; };
  res.set = res.header = function (veld, waarde) {
    if (veld && typeof veld === 'object') { for (const k of Object.keys(veld)) res.setHeader(k, veld[k]); }
    else res.setHeader(veld, waarde);
    return res;
  };
  res.get = (veld) => res.getHeader(veld);
  res.type = (t) => { res.setHeader('Content-Type', t.indexOf('/') === -1 ? (MIME['.' + t.replace(/^\./, '')] || t) : t); return res; };
  res.json = function (obj) {
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  res.send = function (body) {
    if (body == null) { res.end(); return res; }
    if (Buffer.isBuffer(body)) { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/octet-stream'); res.end(body); return res; }
    if (typeof body === 'object') return res.json(body);
    if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(String(body));
    return res;
  };
  res.redirect = function (a, b) {
    const code = typeof a === 'number' ? a : 302;
    const url = typeof a === 'number' ? b : a;
    res.statusCode = code; res.setHeader('Location', url); res.end();
    return res;
  };
  res.sendFile = function (fp, cb) {
    fs.stat(fp, (err, st) => {
      if (err || !st.isFile()) { if (cb) return cb(err || new Error('geen bestand')); res.statusCode = res.statusCode >= 400 ? res.statusCode : 404; return res.end(); }
      stuurBestand(req, res, fp, st, () => { res.end(); });
    });
    return res;
  };
}

/* ---------- MIME + statische bestanden (met Range) ---------- */
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

function stuurBestand(req, res, fp, st, next) {
  const etag = etagVan(st);
  const laatst = new Date(st.mtime).toUTCString();
  if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', mimeVan(fp));
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', laatst);
  if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'public, max-age=0');

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

/* ---------- body-parsers ---------- */
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

/* ---------- de applicatie ---------- */
function maakApp() {
  const router = maakRouter();
  const instellingen = {};

  const app = function (req, res) { app.handle(req, res); };
  // de router-methoden doorspiegelen op de app
  app.use = (...a) => { router.use(...a); return app; };
  for (const m of ['post', 'put', 'delete', 'patch', 'all', 'head', 'options']) {
    app[m] = (...a) => { router[m](...a); return app; };
  }
  // app.get is in express ook een instellingen-getter (1 string-argument)
  app.get = function (pat, ...fns) {
    if (typeof pat === 'string' && fns.length === 0) return instellingen[pat];
    router.get(pat, ...fns); return app;
  };
  app.set = (k, v) => { instellingen[k] = v; return app; };
  app.enable = (k) => { instellingen[k] = true; return app; };
  app.disable = (k) => { instellingen[k] = false; return app; };
  app.enabled = (k) => !!instellingen[k];
  app.disabled = (k) => !instellingen[k];

  /* Express-compatibele introspectie: sommige code (kern/stuur.js) leest de
     geregistreerde routes uit app._router.stack -> laag.route.{path,methods}.
     We bieden diezelfde vorm als een afgeleide weergave van de eigen stack. */
  app._router = {
    get stack() {
      return router._stack.map(l => {
        if (l.mount) return { handle: l.fn, route: undefined, name: 'router' };
        const methods = l.method ? { [l.method.toLowerCase()]: true } : { _all: true };
        return { handle: l.fn, route: { path: l.pad, methods, stack: [{ method: l.method, handle: l.fn }] } };
      });
    }
  };

  app.handle = function (req, res) {
    verrijk(req, res, instellingen);
    router._handle(req, res, (err) => {
      if (err) {
        if (res.headersSent) return res.destroy();
        res.statusCode = (err && err.status) || 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(JSON.stringify({ error: 'Interne fout.' }));
      }
      if (res.headersSent) return;
      res.statusCode = 404; res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.end('Not Found');
    });
  };

  app.listen = function (...args) {
    const server = http.createServer(app);
    return server.listen(...args);
  };
  return app;
}

/* ---------- publieke API (zelfde vorm als express) ---------- */
function web() { return maakApp(); }
web.Router = maakRouter;
web.json = json;
web.raw = raw;
web.static = statisch;
web.urlencoded = () => (req, res, next) => next(); // niet gebruikt; veilige no-op voor drop-in
module.exports = web;
