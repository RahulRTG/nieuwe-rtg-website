/* HTTP/1.1-motor, deel "antwoord": de uitgaande kant. Een ServerResponse-achtige
   res die de node:http-vorm nabootst voor precies wat de app gebruikt, plus de
   statusteksten. Serialiseert vaste lengte (Content-Length) of chunked bij
   streaming (SSE). Afgesplitst uit http1.js zodat elk deel klein blijft. */
'use strict';
const { EventEmitter } = require('events');

const CRLF = '\r\n';
const STATUS = { 200: 'OK', 201: 'Created', 204: 'No Content', 206: 'Partial Content', 301: 'Moved Permanently',
  302: 'Found', 303: 'See Other', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 405: 'Method Not Allowed',
  409: 'Conflict', 413: 'Payload Too Large', 415: 'Unsupported Media Type', 429: 'Too Many Requests',
  500: 'Internal Server Error', 502: 'Bad Gateway', 503: 'Service Unavailable' };

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

module.exports = { Res, STATUS };
