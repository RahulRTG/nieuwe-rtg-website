/* Eigen HTTP/1.1-server op rauwe TCP-sockets (node:net), i.p.v. node:http.
   Puur onze eigen protocol-afhandeling: de verzoekregel en headers parsen,
   de body lezen (Content-Length of Transfer-Encoding: chunked), en het
   antwoord serialiseren (vaste lengte of chunked bij streaming, zoals SSE).
   Ondersteunt keep-alive (meerdere verzoeken per verbinding).

   Node's node:http is kern (geen dependency), goed getest en veilig; deze
   motor is daarom OPT-IN (web.listen kiest hem met RTG_EIGEN_HTTP=1), zodat
   de standaard veilig blijft. maakServer(handler) geeft een net.Server met
   dezelfde vorm die onze app verwacht: handler(req, res), met req/res die de
   node:http-vorm nabootsen voor precies wat de app gebruikt. */
'use strict';
const net = require('net');
const { EventEmitter } = require('events');

const MAX_KOP = 64 * 1024;        // headerblok mag nooit onbegrensd groeien
const CRLF = '\r\n';
const STATUS = { 200: 'OK', 201: 'Created', 204: 'No Content', 206: 'Partial Content', 301: 'Moved Permanently',
  302: 'Found', 303: 'See Other', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  409: 'Conflict', 413: 'Payload Too Large', 415: 'Unsupported Media Type', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' };

/* ---- pure parser: de verzoekregel + de headers uit een tekstblok ---- */
function parseKop(blok) {
  const regels = blok.split(CRLF);
  const eerste = regels.shift() || '';
  const m = eerste.match(/^([A-Z]+) (\S+) HTTP\/(\d\.\d)$/);
  if (!m) return null;
  const headers = {};
  const rauw = [];
  for (const r of regels) {
    if (!r) continue;
    const i = r.indexOf(':');
    if (i < 0) return null;
    const naam = r.slice(0, i).trim().toLowerCase();
    const waarde = r.slice(i + 1).trim();
    rauw.push(r.slice(0, i).trim(), waarde);
    // meerdere headers met dezelfde naam: samenvoegen zoals node (komma), set-cookie als lijst
    if (headers[naam] !== undefined) {
      if (naam === 'set-cookie') headers[naam] = [].concat(headers[naam], waarde);
      else headers[naam] += ', ' + waarde;
    } else headers[naam] = naam === 'set-cookie' ? [waarde] : waarde;
  }
  return { method: m[1], url: m[2], httpVersion: m[3], headers, rawHeaders: rauw };
}

/* ---- de inkomende kant: een IncomingMessage-achtige req ---- */
class Req extends EventEmitter {
  constructor(socket, kop) {
    super();
    this.socket = this.connection = socket;
    this.method = kop.method;
    this.url = kop.url;
    this.httpVersion = kop.httpVersion;
    this.headers = kop.headers;
    this.rawHeaders = kop.rawHeaders;
    this.aborted = false;
    this.complete = false;
  }
}

/* ---- de uitgaande kant: een ServerResponse-achtige res ---- */
class Res extends EventEmitter {
  constructor(socket, opties) {
    super();
    this.socket = this.connection = socket;
    this.statusCode = 200;
    this.statusMessage = null;
    this.headersSent = false;
    this.finished = false;
    this._headers = new Map();      // lowercase -> [origineleNaam, waarde]
    this._keepAlive = opties.keepAlive;
    this._chunked = false;
    this._klaarCb = opties.onKlaar;  // meld de verbinding dat dit antwoord klaar is
    this._hoofd = opties.method === 'HEAD';
  }
  setHeader(naam, waarde) { this._headers.set(String(naam).toLowerCase(), [String(naam), waarde]); return this; }
  getHeader(naam) { const p = this._headers.get(String(naam).toLowerCase()); return p ? p[1] : undefined; }
  getHeaderNames() { return [...this._headers.values()].map(p => p[0].toLowerCase()); }
  hasHeader(naam) { return this._headers.has(String(naam).toLowerCase()); }
  removeHeader(naam) { this._headers.delete(String(naam).toLowerCase()); }
  writeHead(status, arg2, arg3) {
    this.statusCode = status;
    let headers = arg3;
    if (typeof arg2 === 'string') this.statusMessage = arg2; else headers = arg2;
    if (headers) for (const k of Object.keys(headers)) this.setHeader(k, headers[k]);
    return this;
  }
  _zendKop(metLengte) {
    if (this.headersSent) return;
    this.headersSent = true;
    const reden = this.statusMessage || STATUS[this.statusCode] || 'Status';
    const regels = ['HTTP/1.1 ' + this.statusCode + ' ' + reden];
    let heeftLengte = this.hasHeader('content-length');
    let heeftTe = this.hasHeader('transfer-encoding');
    if (metLengte != null && !heeftLengte && !heeftTe) { this.setHeader('Content-Length', metLengte); heeftLengte = true; }
    if (!heeftLengte && !heeftTe && this.statusCode !== 204 && this.statusCode !== 304) {
      // streaming zonder bekende lengte -> chunked
      this.setHeader('Transfer-Encoding', 'chunked'); this._chunked = true;
    }
    if (!this.hasHeader('date')) this.setHeader('Date', new Date().toUTCString());
    if (!this.hasHeader('connection')) this.setHeader('Connection', this._keepAlive ? 'keep-alive' : 'close');
    for (const [, [naam, waarde]] of this._headers) {
      if (Array.isArray(waarde)) for (const w of waarde) regels.push(naam + ': ' + w);
      else regels.push(naam + ': ' + waarde);
    }
    this.socket.write(regels.join(CRLF) + CRLF + CRLF);
  }
  write(brok, enc, cb) {
    if (typeof enc === 'function') { cb = enc; enc = null; }
    const buf = Buffer.isBuffer(brok) ? brok : Buffer.from(brok || '', enc || 'utf8');
    if (!this.headersSent) this._zendKop(null); // streaming: nog geen lengte -> chunked
    if (this._hoofd) { if (cb) process.nextTick(cb); return true; }
    let ok = true;
    if (this._chunked) {
      this.socket.write(buf.length.toString(16) + CRLF);
      ok = this.socket.write(buf);
      this.socket.write(CRLF);
    } else ok = this.socket.write(buf);
    if (cb) process.nextTick(cb);
    return ok;
  }
  end(brok, enc, cb) {
    if (typeof brok === 'function') { cb = brok; brok = null; }
    else if (typeof enc === 'function') { cb = enc; enc = null; }
    if (this.finished) { if (cb) process.nextTick(cb); return this; }
    const buf = brok == null ? null : (Buffer.isBuffer(brok) ? brok : Buffer.from(brok, enc || 'utf8'));
    if (!this.headersSent) this._zendKop(buf ? buf.length : 0); // bekende lengte: vaste Content-Length
    if (buf && buf.length && !this._hoofd) {
      if (this._chunked) { this.socket.write(buf.length.toString(16) + CRLF); this.socket.write(buf); this.socket.write(CRLF); }
      else this.socket.write(buf);
    }
    if (this._chunked && !this._hoofd) this.socket.write('0' + CRLF + CRLF);
    this.finished = true;
    if (cb) process.nextTick(cb);
    this.emit('finish'); this.emit('close');
    this._klaarCb();
    return this;
  }
  flushHeaders() { if (!this.headersSent) this._zendKop(null); }
  destroy(e) { try { this.socket.destroy(e); } catch (er) {} }
  setTimeout(ms, cb) { this.socket.setTimeout(ms, cb); return this; }
}

/* ---- de server: een verbinding kan meerdere verzoeken dragen (keep-alive) ---- */
function maakServer(handler) {
  const server = net.createServer((socket) => {
    let buf = Buffer.alloc(0);
    let bezig = null;           // { req, restLengte, chunkStaat } tijdens het lezen van een body
    let dicht = false;

    socket.on('data', (stuk) => { buf = buf.length ? Buffer.concat([buf, stuk]) : stuk; verwerk(); });
    socket.on('error', () => { if (bezig && bezig.req) { bezig.req.aborted = true; bezig.req.emit('aborted'); bezig.req.emit('close'); } });
    socket.on('close', () => { dicht = true; if (bezig && bezig.req && !bezig.req.complete) { bezig.req.aborted = true; bezig.req.emit('aborted'); bezig.req.emit('close'); } });
    socket.setTimeout(120000, () => socket.destroy());

    function verwerk() {
      if (bezig) return leesBody();
      const eind = buf.indexOf('\r\n\r\n');
      if (eind < 0) { if (buf.length > MAX_KOP) socket.destroy(); return; }
      const kop = parseKop(buf.slice(0, eind).toString('latin1'));
      buf = buf.slice(eind + 4);
      if (!kop) { socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n'); socket.destroy(); return; }

      const verzoekKeepAlive = kop.httpVersion === '1.1'
        ? String(kop.headers.connection || '').toLowerCase() !== 'close'
        : String(kop.headers.connection || '').toLowerCase() === 'keep-alive';
      const req = new Req(socket, kop);

      // Ga pas door naar het volgende verzoek als ZOWEL de body helemaal
      // gelezen is ALS het antwoord klaar is; anders raakt keep-alive uit de pas.
      function ganaarVolgende() {
        if (!verzoekKeepAlive || dicht) { socket.end(); return; }
        bezig = null;
        if (buf.length) setImmediate(verwerk);
      }
      const res = new Res(socket, { keepAlive: verzoekKeepAlive, method: kop.method,
        onKlaar: () => { if (bezig) { bezig.resKlaar = true; if (bezig.bodyKlaar) ganaarVolgende(); } else ganaarVolgende(); } });

      // body-plan bepalen
      const te = String(kop.headers['transfer-encoding'] || '').toLowerCase();
      if (te.includes('chunked')) bezig = { req, res, chunk: { staat: 'grootte', over: 0 }, bodyKlaar: false, resKlaar: false, ganaarVolgende };
      else {
        const len = parseInt(kop.headers['content-length'], 10);
        bezig = { req, res, restLengte: Number.isFinite(len) ? len : 0, bodyKlaar: false, resKlaar: false, ganaarVolgende };
      }
      handler(req, res);          // de app krijgt req/res; de body volgt via events
      leesBody();
    }

    function rondBody() {
      const b = bezig; if (!b || b.bodyKlaar) return;
      b.bodyKlaar = true;
      b.req.complete = true;
      b.req.emit('end');
      if (b.resKlaar) b.ganaarVolgende();
    }

    function leesBody() {
      const b = bezig; if (!b) return;
      if (b.chunk) { // chunked
        for (;;) {
          if (b.chunk.staat === 'grootte') {
            const nl = buf.indexOf('\r\n'); if (nl < 0) return;
            const grootte = parseInt(buf.slice(0, nl).toString('latin1').split(';')[0], 16);
            buf = buf.slice(nl + 2);
            if (!Number.isFinite(grootte)) { socket.destroy(); return; }
            if (grootte === 0) { // laatste chunk (evt. trailers overslaan tot lege regel)
              const eind = buf.indexOf('\r\n'); if (eind < 0) return; buf = buf.slice(eind + 2);
              return rondBody();
            }
            b.chunk.staat = 'data'; b.chunk.over = grootte;
          }
          if (b.chunk.staat === 'data') {
            if (buf.length < b.chunk.over + 2) return; // wacht op data + CRLF
            b.req.emit('data', buf.slice(0, b.chunk.over));
            buf = buf.slice(b.chunk.over + 2); // sla de afsluitende CRLF over
            b.chunk.staat = 'grootte';
          }
        }
      }
      // Content-Length (of geen body)
      if (b.restLengte <= 0) return rondBody();
      if (buf.length === 0) return;
      const neem = Math.min(b.restLengte, buf.length);
      b.req.emit('data', buf.slice(0, neem));
      buf = buf.slice(neem);
      b.restLengte -= neem;
      if (b.restLengte <= 0) rondBody();
    }
  });
  return server;
}

module.exports = { maakServer, parseKop, Req, Res };
