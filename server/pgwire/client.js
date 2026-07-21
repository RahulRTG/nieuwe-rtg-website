/* pgwire, deel "client": één PostgreSQL-verbinding op node:net/tls. Startup,
   authenticatie (cleartext/md5/SCRAM-SHA-256 via node:crypto), de berichten-
   parser, simpele (Q) en extended (Parse/Bind/Describe/Execute/Sync) queries,
   LISTEN/NOTIFY. Regel 1: geen eigen crypto -- alleen node:crypto + node:tls. */
'use strict';
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const { cstr, bericht, int16, int32, leesCstrs, foutVelden, decodeer, paramTekst } = require('./protocol');
const scram = require('./scram');

class Client extends EventEmitter {
  constructor(cfg) {
    super();
    this.cfg = cfg;
    this.sock = null;
    this.buf = Buffer.alloc(0);
    this.klaarVerbinden = null;   // { resolve, reject } tijdens connect()
    this.wachtrij = [];           // wachtende query-taken
    this.actief = null;           // huidige query-taak
    this._scram = null;
    this._dood = false;
    this._paramStatus = {};
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.klaarVerbinden = { resolve, reject };
      const opts = { host: this.cfg.host, port: this.cfg.port };
      const na = () => this._verzendStartup();
      this.sock = this.cfg.ssl ? this._sslVerbinden(opts, reject) : net.connect(opts, na);
      if (!this.cfg.ssl) {
        this.sock.setNoDelay(true);
        this.sock.on('data', (d) => this._ontvang(d));
        this.sock.on('error', (e) => this._fout(e));
        this.sock.on('close', () => this._sluiten());
      }
    });
  }
  _sslVerbinden(opts, reject) {
    // SSLRequest: Int32(8), Int32(80877103); server antwoordt met 'S' (ja) of 'N' (nee)
    const rauw = net.connect(opts, () => { const m = Buffer.alloc(8); m.writeInt32BE(8, 0); m.writeInt32BE(80877103, 4); rauw.write(m); });
    rauw.once('data', (antw) => {
      if (antw[0] !== 0x53) { reject(new Error('pg: server weigert SSL')); rauw.destroy(); return; }
      const t = tls.connect({ socket: rauw, servername: opts.host, rejectUnauthorized: this.cfg.ssl && this.cfg.ssl.rejectUnauthorized !== false }, () => this._verzendStartup());
      this.sock = t;
      t.setNoDelay(true);
      t.on('data', (d) => this._ontvang(d));
      t.on('error', (e) => this._fout(e));
      t.on('close', () => this._sluiten());
    });
    rauw.on('error', (e) => this._fout(e));
    return rauw;
  }
  _verzendStartup() {
    const delen = [Buffer.from([0, 3, 0, 0])]; // protocol 3.0
    delen.push(cstr('user'), cstr(this.cfg.user));
    if (this.cfg.database) delen.push(cstr('database'), cstr(this.cfg.database));
    delen.push(cstr('application_name'), cstr('rtg'));
    delen.push(Buffer.from([0])); // einde
    this.sock.write(bericht(null, Buffer.concat(delen)));
  }

  _fout(e) { if (this.klaarVerbinden) { this.klaarVerbinden.reject(e); this.klaarVerbinden = null; } if (this.actief) { this.actief.reject(e); this.actief = null; } this.emit('error', e); }
  _sluiten() { this._dood = true; const e = new Error('pg: verbinding gesloten'); if (this.klaarVerbinden) { this.klaarVerbinden.reject(e); this.klaarVerbinden = null; } if (this.actief) { this.actief.reject(e); this.actief = null; } for (const t of this.wachtrij) t.reject(e); this.wachtrij = []; this.emit('close'); }

  /* berichten uit de stroom halen: 1 byte type + Int32 lengte(incl. zichzelf) + payload */
  _ontvang(data) {
    this.buf = this.buf.length ? Buffer.concat([this.buf, data]) : data;
    while (this.buf.length >= 5) {
      const len = this.buf.readInt32BE(1);
      if (this.buf.length < 1 + len) break;
      const type = String.fromCharCode(this.buf[0]);
      const payload = this.buf.subarray(5, 1 + len);
      this.buf = this.buf.subarray(1 + len);
      try { this._verwerk(type, payload); } catch (e) { this._fout(e); return; }
    }
    // subarray() deelt de onderliggende ArrayBuffer: na een grote respons zou de
    // (bijna) lege restbuffer die hele allocatie in leven houden, en elke
    // poolverbinding zou zo de grootste respons ooit blijven vasthouden. Een
    // lege rest laten we los; een kleine rest in een grote ouder kopieren we uit.
    if (this.buf.length === 0) {
      if (this.buf.buffer && this.buf.buffer.byteLength > 4096) this.buf = Buffer.alloc(0);
    } else if (this.buf.buffer && this.buf.buffer.byteLength > 65536 && this.buf.length < this.buf.buffer.byteLength / 4) {
      this.buf = Buffer.from(this.buf);
    }
  }

  _verwerk(type, p) {
    switch (type) {
      case 'R': return this._auth(p);
      case 'S': { const [naam, val] = leesCstrs(p, 2); this._paramStatus[naam] = val; return; }
      case 'K': return; // BackendKeyData (cancel) -- niet nodig
      case 'Z': return this._gereed();
      case 'T': return this._rowDesc(p);
      case 'D': return this._dataRow(p);
      case 'C': { const tag = leesCstrs(p, 1)[0]; if (this.actief) { this.actief.command = tag.split(' ')[0]; const n = tag.match(/(\d+)\s*$/); this.actief.rowCount = n ? parseInt(n[1], 10) : this.actief.rows.length; } return; }
      case 'I': return; // EmptyQueryResponse
      case 'E': { const f = foutVelden(p); const err = new Error('pg: ' + (f.M || 'fout') + (f.C ? ' (' + f.C + ')' : '')); err.code = f.C; err.severity = f.S; if (this.actief) this.actief.fout = err; else if (this.klaarVerbinden) { this.klaarVerbinden.reject(err); this.klaarVerbinden = null; } return; }
      case 'N': return; // NoticeResponse -- negeren
      case 'A': { let o = 4; const eind1 = p.indexOf(0, o); const kanaal = p.toString('utf8', o, eind1); const eind2 = p.indexOf(0, eind1 + 1); const lading = p.toString('utf8', eind1 + 1, eind2); this.emit('notification', { processId: p.readInt32BE(0), channel: kanaal, payload: lading }); return; }
      case '1': case '2': case '3': case 'n': case 's': return; // Parse/Bind/Close-Complete, NoData, PortalSuspended
      default: return; // onbekend/ongebruikt
    }
  }

  _auth(p) {
    const sub = p.readInt32BE(0);
    if (sub === 0) return;                                  // AuthenticationOk
    if (sub === 3) return this.sock.write(bericht('p', cstr(this.cfg.password || ''))); // cleartext
    if (sub === 5) {                                        // md5
      const salt = p.subarray(4, 8);
      const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
      const inner = md5(String(this.cfg.password || '') + this.cfg.user);
      const token = 'md5' + md5(Buffer.concat([Buffer.from(inner), salt]));
      return this.sock.write(bericht('p', cstr(token)));
    }
    if (sub === 10) return this._scramStart(p);             // SASL
    if (sub === 11) return this._scramContinue(p.subarray(4));
    if (sub === 12) return this._scramFinal(p.subarray(4));
    this._fout(new Error('pg: niet-ondersteunde auth-methode ' + sub));
  }
  _scramStart(p) {
    const mechs = leesCstrs(p.subarray(4), 20).filter(Boolean);
    // Channel binding (SCRAM-SHA-256-PLUS) als de verbinding TLS is en de server
    // het aanbiedt: bind aan het servercertificaat (tls-server-end-point). Anders
    // gewoon SCRAM-SHA-256 -- identiek gedrag als voorheen.
    let cb = null;
    if (this.sock.encrypted && mechs.includes('SCRAM-SHA-256-PLUS') && this.sock.getPeerCertificate) {
      try { const cert = this.sock.getPeerCertificate(false); if (cert && cert.raw) cb = scram.kanaalBinding(cert.raw); } catch (e) {}
    }
    if (!cb && !mechs.includes('SCRAM-SHA-256')) return this._fout(new Error('pg: geen SCRAM-SHA-256'));
    this._scram = scram.start(cb);
    this.sock.write(bericht('p', this._scram.body));
  }
  _scramContinue(data) {
    try {
      const { clientFinal, serverSignature } = scram.vervolg({
        password: this.cfg.password, nonce: this._scram.nonce,
        clientFirstBare: this._scram.clientFirstBare, serverFirst: data.toString('utf8'),
        gs2: this._scram.gs2, cbindData: this._scram.cbindData
      });
      this._scram.serverSignature = serverSignature;
      this.sock.write(bericht('p', clientFinal));
    } catch (e) { return this._fout(e); }
  }
  _scramFinal(data) {
    try { scram.eindeControle(data, this._scram.serverSignature); this._scram = null; }
    catch (e) { return this._fout(e); }
  }

  _gereed() {
    if (this.klaarVerbinden) { const r = this.klaarVerbinden; this.klaarVerbinden = null; r.resolve(this); this._volgende(); return; }
    if (this.actief) {
      const a = this.actief; this.actief = null;
      if (a.timer) clearTimeout(a.timer);
      if (a.fout) a.reject(a.fout);
      else a.resolve({ rows: a.rows, rowCount: a.rowCount != null ? a.rowCount : a.rows.length, command: a.command, fields: a.velden });
    }
    this._volgende();
  }
  _rowDesc(p) {
    if (!this.actief) return;
    const n = p.readUInt16BE(0); let o = 2; const velden = [];
    for (let i = 0; i < n; i++) {
      const eind = p.indexOf(0, o); const naam = p.toString('utf8', o, eind); o = eind + 1;
      const typeOid = p.readInt32BE(o + 6);
      o += 18; // tableOid(4)+colAttr(2)+typeOid(4)+typeLen(2)+typeMod(4)+format(2)
      velden.push({ name: naam, dataTypeID: typeOid });
    }
    this.actief.velden = velden; this.actief.rows = this.actief.rows || [];
  }
  _dataRow(p) {
    if (!this.actief) return;
    const n = p.readUInt16BE(0); let o = 2; const velden = this.actief.velden || []; const rij = {};
    for (let i = 0; i < n; i++) {
      const len = p.readInt32BE(o); o += 4;
      let waarde = null;
      if (len !== -1) { waarde = p.toString('utf8', o, o + len); o += len; }
      const v = velden[i] || { name: 'col' + i, dataTypeID: 25 };
      rij[v.name] = len === -1 ? null : decodeer(v.dataTypeID, waarde);
    }
    this.actief.rows.push(rij);
  }

  query(text, params) {
    return new Promise((resolve, reject) => {
      const taak = { text, params: params || null, resolve, reject, rows: [], velden: [], command: null, rowCount: null, fout: null };
      this.wachtrij.push(taak);
      if (!this.actief) this._volgende();
    });
  }
  _volgende() {
    if (this.actief || !this.wachtrij.length || this._dood) return;
    const taak = this.wachtrij.shift();
    this.actief = taak;
    if (this.cfg.query_timeout) taak.timer = setTimeout(() => { const e = new Error('pg: query-tijd verstreken'); taak.fout = null; taak.reject(e); this.actief = null; try { this.sock.destroy(); } catch (x) {} }, this.cfg.query_timeout);
    try {
      if (taak.params && taak.params.length) this._extended(taak);
      else this.sock.write(bericht('Q', cstr(taak.text)));
    } catch (e) { this.actief = null; if (taak.timer) clearTimeout(taak.timer); taak.reject(e); }
  }
  _extended(taak) {
    const parse = Buffer.concat([cstr(''), cstr(taak.text), int16(0)]);            // geen paramtypes -> server leidt af
    const waarden = taak.params.map(paramTekst);
    const bindDelen = [cstr(''), cstr(''), int16(0), int16(waarden.length)];
    for (const w of waarden) { if (w == null) bindDelen.push(int32(-1)); else { const b = Buffer.from(w, 'utf8'); bindDelen.push(int32(b.length), b); } }
    bindDelen.push(int16(0)); // resultformats: alles tekst
    const buf = Buffer.concat([
      bericht('P', parse),
      bericht('B', Buffer.concat(bindDelen)),
      bericht('D', Buffer.concat([Buffer.from('P'), cstr('')])),
      bericht('E', Buffer.concat([cstr(''), int32(0)])),
      bericht('S', Buffer.alloc(0))
    ]);
    this.sock.write(buf);
  }
  einde() { this._dood = true; try { this.sock.write(bericht('X', Buffer.alloc(0))); this.sock.end(); } catch (e) { try { this.sock.destroy(); } catch (x) {} } }
}

module.exports = { Client };
