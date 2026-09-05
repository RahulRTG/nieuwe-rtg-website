/* Eigen, kleine Redis-client (RESP-protocol) op node:net/tls, i.p.v. het pakket
   `redis`. Geen eigen cryptografie: puur het RESP-wireprotocol op elkaar zetten.

   We bouwen exact de deelverzameling die de realtime-bus (server/bus.js) en de
   gedeelde-data-mirror (server/db/redis.js) gebruiken:
       const r = createClient({ url });
       r.on('error', cb); await r.connect();
       await r.set(k, v); await r.get(k);
       await r.eval(script, [key], [argument]);
       await r.publish(kanaal, tekst);
       await r.subscribe(kanaal, bericht => ...);   // callback krijgt de ruwe payload
   Redis ZELF (de server/broker) bouwen we nooit -- dit is alleen de client.

   Bewust robuust op het punt dat telt: bij een verbroken verbinding herstelt hij
   automatisch en her-abonneert hij (net als node-redis), zodat een Redis-blip de
   bus van een proces niet permanent doodt. */
'use strict';
const net = require('net');
const tls = require('tls');
/* SNI alleen bij een NAAM -- zie de kop van ./lib/sni.js. */
const { sniVan } = require('./lib/sni');
const { URL } = require('url');

const ONVOLLEDIG = Symbol('onvolledig');

/* ---- RESP coderen ---- */
function codeer(args) {
  const delen = [Buffer.from('*' + args.length + '\r\n')];
  for (const a of args) {
    const b = Buffer.isBuffer(a) ? a : Buffer.from(String(a));
    delen.push(Buffer.from('$' + b.length + '\r\n'), b, Buffer.from('\r\n'));
  }
  return Buffer.concat(delen);
}

/* ---- RESP ontleden: geeft [waarde, nieuwePositie] of ONVOLLEDIG ---- */
function ontleed(buf, pos) {
  if (pos >= buf.length) return ONVOLLEDIG;
  const type = buf[pos];
  const eol = buf.indexOf('\r\n', pos + 1);
  if (eol === -1) return ONVOLLEDIG;
  const regel = buf.toString('utf8', pos + 1, eol);
  const na = eol + 2;
  switch (type) {
    case 0x2b: return [regel, na];                         // + simpele string
    case 0x2d: return [new Error(regel), na];              // - fout
    case 0x3a: return [Number(regel), na];                 // : integer
    case 0x24: {                                           // $ bulk string
      const len = Number(regel);
      if (len === -1) return [null, na];
      if (buf.length < na + len + 2) return ONVOLLEDIG;
      return [buf.toString('utf8', na, na + len), na + len + 2];
    }
    case 0x2a: {                                           // * array
      const n = Number(regel);
      if (n === -1) return [null, na];
      const arr = []; let p = na;
      for (let i = 0; i < n; i++) { const r = ontleed(buf, p); if (r === ONVOLLEDIG) return ONVOLLEDIG; arr.push(r[0]); p = r[1]; }
      return [arr, p];
    }
    default: return ONVOLLEDIG;
  }
}

function createClient(opts) {
  opts = opts || {};
  const u = new URL(opts.url || 'redis://127.0.0.1:6379');
  const secure = u.protocol === 'rediss:';
  const host = u.hostname || '127.0.0.1';
  const port = Number(u.port) || 6379;
  // redis://[user][:pass]@host:port[/db]
  const user = u.username ? decodeURIComponent(u.username) : '';
  const pass = u.password ? decodeURIComponent(u.password) : '';
  const dbNum = u.pathname && u.pathname.length > 1 ? u.pathname.slice(1) : '';

  let sock = null, buf = Buffer.alloc(0), wachtrij = [], dicht = false, verbondenOoit = false;
  let waakTimer = null, pingGrens = null;
  const PING_MS = Math.max(250, Number(process.env.RTG_BUS_PING_MS) || 2000);
  const abos = new Map();        // kanaal -> callback
  const cbs = { error: [], ready: [], close: [] };
  const emit = (naam, waarde) => {
    for (const cb of cbs[naam]) { try { cb(waarde); } catch (e) {} }
  };

  function verwerk() {
    let pos = 0;
    for (;;) { const r = ontleed(buf, pos); if (r === ONVOLLEDIG) break; routeer(r[0]); pos = r[1]; }
    if (pos) buf = buf.subarray(pos);
  }
  function routeer(val) {
    // pub/sub-duwberichten gaan naar de abonnee, niet naar de commando-wachtrij
    if (Array.isArray(val) && val[0] === 'message') { const fn = abos.get(val[1]); if (fn) { try { fn(val[2]); } catch (e) {} } return; }
    if (Array.isArray(val) && val[0] === 'pmessage') { const fn = abos.get(val[1]); if (fn) { try { fn(val[3]); } catch (e) {} } return; }
    const p = wachtrij.shift();
    if (p) { if (val instanceof Error) p.reject(val); else p.resolve(val); }
  }
  function stuur(args) {
    return new Promise((resolve, reject) => {
      if (!sock || sock.destroyed) return reject(new Error('redis: niet verbonden'));
      wachtrij.push({ resolve, reject });
      sock.write(codeer(args));
    });
  }

  function stopWaak() {
    if (waakTimer) clearTimeout(waakTimer);
    if (pingGrens) clearTimeout(pingGrens);
    waakTimer = null; pingGrens = null;
  }
  function planWaak() {
    stopWaak();
    waakTimer = setTimeout(() => {
      const verwacht = sock;
      pingGrens = setTimeout(() => {
        if (sock === verwacht && verwacht && !verwacht.destroyed) verwacht.destroy();
      }, PING_MS);
      stuur(['PING']).then(() => planWaak()).catch(() => {});
    }, PING_MS);
    if (waakTimer.unref) waakTimer.unref();
  }

  function open() {
    return new Promise((resolve, reject) => {
      const klaar = async () => {
        try {
          if (pass) await stuur(user ? ['AUTH', user, pass] : ['AUTH', pass]);
          if (dbNum) await stuur(['SELECT', dbNum]);
          for (const kanaal of abos.keys()) await stuur(['SUBSCRIBE', kanaal]); // her-abonneren na (her)verbinden
          await stuur(['PING']);             // TCP-open is nog geen Redis-readiness
          verbondenOoit = true; emit('ready'); planWaak(); resolve();
        } catch (e) { reject(e); }
      };
      sock = secure ? tls.connect(Object.assign({ host, port }, sniVan(host)), klaar) : net.connect({ host, port }, klaar);
      if (sock.setNoDelay) sock.setNoDelay(true);
      sock.on('data', c => { buf = buf.length ? Buffer.concat([buf, c]) : c; verwerk(); });
      sock.on('error', e => { emit('error', e); if (!verbondenOoit) reject(e); });
      sock.on('close', () => {
        stopWaak();
        emit('close');
        const q = wachtrij; wachtrij = [];
        for (const p of q) p.reject(new Error('redis: verbinding gesloten'));
        if (!dicht) {
          const t = setTimeout(() => open().catch(e => emit('error', e)), 500);
          if (t.unref) t.unref();
        } // auto-herstel + her-abonneren, ook als Redis bij de eerste poging nog niet op was
      });
    });
  }

  return {
    connect() { return open(); },
    on(ev, cb) { if (cbs[ev] && typeof cb === 'function') cbs[ev].push(cb); return this; },
    get(k) { return stuur(['GET', k]); },
    ping() { return stuur(['PING']); },
    scan(cursor, patroon, aantal) {
      return stuur(['SCAN', String(cursor || '0'), 'MATCH', String(patroon || '*'),
        'COUNT', String(Math.max(1, Number(aantal) || 100))]);
    },
    set(k, v) { return stuur(['SET', k, v]); },
    del(k) { return stuur(['DEL', k]); },
    eval(script, keys, args) {
      const ks = Array.isArray(keys) ? keys : [];
      const as = Array.isArray(args) ? args : [];
      return stuur(['EVAL', script, ks.length, ...ks, ...as]);
    },
    publish(kanaal, bericht) { return stuur(['PUBLISH', kanaal, bericht]); },
    subscribe(kanaal, fn) { abos.set(kanaal, fn); return stuur(['SUBSCRIBE', kanaal]); },
    unsubscribe(kanaal) { abos.delete(kanaal); return stuur(['UNSUBSCRIBE', kanaal]); },
    quit() {
      dicht = true; stopWaak();
      return new Promise(resolve => {
        if (!sock || sock.destroyed) return resolve();
        sock.once('close', () => resolve());
        try { sock.end(codeer(['QUIT'])); } catch (e) { resolve(); }
      });
    },
    disconnect() { dicht = true; stopWaak(); try { if (sock) sock.destroy(); } catch (e) {} }
  };
}

module.exports = { createClient, _codeer: codeer, _ontleed: ontleed, ONVOLLEDIG };
