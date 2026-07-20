/* web, deel "verrijk": de req/res-objecten optuigen met de express-vorm die de
   app gebruikt -- req.body/params/query/path/ip/protocol, res.status/json/send/
   set/type/redirect/sendFile. Leunt op ./bestanden voor sendFile en de MIME-tabel. */
'use strict';
const fs = require('fs');
const { padNaar } = require('./routing');
const { stuurBestand, MIME } = require('./bestanden');

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

module.exports = { verrijk };
