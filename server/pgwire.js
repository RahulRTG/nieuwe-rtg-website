/* Eigen PostgreSQL-client (wireprotocol v3) op node:net/tls, i.p.v. het pakket `pg`.

   Let op regel 1 (docs/de-lijn.md): we schrijven GEEN eigen cryptografie. De
   SCRAM-SHA-256-authenticatie gebruikt uitsluitend node:crypto (pbkdf2, hmac,
   sha256); TLS komt uit node:tls. Alles hier is protocol-assemblage: de bekende
   frontend/backend-berichten op elkaar zetten, rijen decoderen, een pool beheren.
   De DATABASE zelf (PostgreSQL) blijft extern -- dit is enkel de client.

   Nagebouwd is exact de deelverzameling die server/pg/* en server/pgaccounts.js
   gebruiken: new Pool({ connectionString, max, ... }); pool.query(text, params?);
   pool.connect() -> client met query/release/on('notification')/on('error');
   pool.end(); pool.on('error'); pool.totalCount/idleCount/waitingCount/options;
   simpele én geparametriseerde queries, transacties, advisory locks, LISTEN/NOTIFY.
   Rijen komen als objecten terug; types worden gedecodeerd zoals `pg` (int8 als
   string, int4 als getal, bool als boolean, json geparsed, tekst als tekst). */
'use strict';
const net = require('net');
const tls = require('tls');
const crypto = require('crypto');
const { EventEmitter } = require('events');

/* ---------- wire-helpers ---------- */
function cstr(s) { return Buffer.concat([Buffer.from(String(s), 'utf8'), Buffer.from([0])]); }
function bericht(type, body) {                       // type=null -> startup (geen typebyte)
  const len = Buffer.alloc(4); len.writeInt32BE((body ? body.length : 0) + 4, 0);
  return type ? Buffer.concat([Buffer.from(type), len, body || Buffer.alloc(0)])
              : Buffer.concat([len, body || Buffer.alloc(0)]);
}

/* ---------- type-decodering (tekstformaat), zoals node-postgres ---------- */
function decodeer(oid, tekst) {
  if (tekst == null) return null;
  switch (oid) {
    case 16: return tekst === 't';                                   // bool
    case 21: case 23: case 26: return parseInt(tekst, 10);           // int2/int4/oid -> getal
    case 20: return tekst;                                           // int8 -> string (precisie)
    case 700: case 701: return parseFloat(tekst);                    // float4/float8
    case 1700: return tekst;                                         // numeric -> string
    case 114: case 3802: try { return JSON.parse(tekst); } catch (e) { return tekst; } // json/jsonb
    case 1114: case 1184: return new Date(tekst);                    // timestamp(tz)
    case 17: return Buffer.from(tekst.replace(/^\\x/, ''), 'hex');   // bytea (hex)
    default: return tekst;                                           // text/varchar/name/...
  }
}

/* ---------- één verbinding ---------- */
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
    if (!mechs.includes('SCRAM-SHA-256')) return this._fout(new Error('pg: geen SCRAM-SHA-256'));
    const nonce = crypto.randomBytes(18).toString('base64');
    this._scram = { nonce, clientFirstBare: 'n=,r=' + nonce };
    const ir = Buffer.from('n,,' + this._scram.clientFirstBare, 'utf8');
    const body = Buffer.concat([cstr('SCRAM-SHA-256'), int32(ir.length), ir]);
    this.sock.write(bericht('p', body));
  }
  _scramContinue(data) {
    const serverFirst = data.toString('utf8');
    const kv = {}; serverFirst.split(',').forEach(x => { const i = x.indexOf('='); kv[x.slice(0, i)] = x.slice(i + 1); });
    const r = kv.r, salt = Buffer.from(kv.s, 'base64'), iter = parseInt(kv.i, 10);
    if (!r || !r.startsWith(this._scram.nonce)) return this._fout(new Error('pg: SCRAM-nonce klopt niet'));
    const saltedPassword = crypto.pbkdf2Sync(String(this.cfg.password || ''), salt, iter, 32, 'sha256');
    const hmac = (key, str) => crypto.createHmac('sha256', key).update(str).digest();
    const clientKey = hmac(saltedPassword, 'Client Key');
    const storedKey = crypto.createHash('sha256').update(clientKey).digest();
    const clientFinalZonderProof = 'c=biws,r=' + r;
    const authMessage = this._scram.clientFirstBare + ',' + serverFirst + ',' + clientFinalZonderProof;
    const clientSignature = hmac(storedKey, authMessage);
    const proof = Buffer.alloc(clientKey.length);
    for (let i = 0; i < clientKey.length; i++) proof[i] = clientKey[i] ^ clientSignature[i];
    const serverKey = hmac(saltedPassword, 'Server Key');
    this._scram.serverSignature = hmac(serverKey, authMessage).toString('base64');
    const clientFinal = clientFinalZonderProof + ',p=' + proof.toString('base64');
    this.sock.write(bericht('p', Buffer.from(clientFinal, 'utf8')));
  }
  _scramFinal(data) {
    const kv = {}; data.toString('utf8').split(',').forEach(x => { const i = x.indexOf('='); kv[x.slice(0, i)] = x.slice(i + 1); });
    if (kv.v !== this._scram.serverSignature) return this._fout(new Error('pg: SCRAM-serverhandtekening klopt niet'));
    this._scram = null;
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

// Int16 in het v3-protocol is een 16-bits teller: parameteraantal, aantal
// resultaatkolommen, aantal formaatcodes. Postgres staat tot 65535 parameters
// toe (een batch-insert van 5000 rijen x 9 kolommen = 45000 > 32767), dus dit
// MOET unsigned. De bytes zijn identiek aan writeInt16BE voor 0..32767; alleen
// de bereikcontrole verschilt. We sturen zelf nooit negatieve int16's.
function int16(n) { const b = Buffer.alloc(2); b.writeUInt16BE(n & 0xffff, 0); return b; }
function int32(n) { const b = Buffer.alloc(4); b.writeInt32BE(n, 0); return b; }
function leesCstrs(buf, max) { const uit = []; let o = 0; while (o < buf.length && uit.length < max) { const eind = buf.indexOf(0, o); if (eind === -1) break; uit.push(buf.toString('utf8', o, eind)); o = eind + 1; } return uit; }
function foutVelden(p) { const uit = {}; let o = 0; while (o < p.length && p[o] !== 0) { const code = String.fromCharCode(p[o]); const eind = p.indexOf(0, o + 1); uit[code] = p.toString('utf8', o + 1, eind); o = eind + 1; } return uit; }
function paramTekst(v) {
  if (v == null) return null;
  if (typeof v === 'boolean') return v ? 't' : 'f';
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return '\\x' + v.toString('hex');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/* ---------- de pool ---------- */
class Pool extends EventEmitter {
  constructor(cfg) {
    super();
    this.options = Object.assign({ max: 10, connectionTimeoutMillis: 0, idleTimeoutMillis: 10000 }, cfg || {});
    this._cfg = ontleedConfig(this.options);
    this._idle = [];       // vrije clients
    this._alle = new Set(); // alle levende clients
    this._wachtend = [];   // { resolve, reject, timer }
  }
  get totalCount() { return this._alle.size; }
  get idleCount() { return this._idle.length; }
  get waitingCount() { return this._wachtend.length; }

  async _maak() {
    const c = new Client(this._cfg);
    this._alle.add(c);
    c.on('error', (e) => { if (!c._inGebruik) this.emit('error', e, c); this._verwijder(c); });
    c.on('close', () => this._verwijder(c));
    try {
      await c.connect();
      if (this._cfg.statement_timeout) await c.query('SET statement_timeout = ' + Number(this._cfg.statement_timeout));
    } catch (e) { this._verwijder(c); throw e; }
    return c;
  }
  _verwijder(c) { this._alle.delete(c); const i = this._idle.indexOf(c); if (i >= 0) this._idle.splice(i, 1); }

  async _checkout() {
    if (this._idle.length) { const c = this._idle.pop(); if (c._idleTimer) { clearTimeout(c._idleTimer); c._idleTimer = null; } c._inGebruik = true; return c; }
    if (this._alle.size < this.options.max) { const c = await this._maak(); c._inGebruik = true; return c; }
    return new Promise((resolve, reject) => {
      const w = { resolve, reject };
      if (this.options.connectionTimeoutMillis) w.timer = setTimeout(() => { const i = this._wachtend.indexOf(w); if (i >= 0) this._wachtend.splice(i, 1); reject(new Error('pg: geen vrije verbinding (time-out)')); }, this.options.connectionTimeoutMillis);
      this._wachtend.push(w);
    });
  }
  _terug(c) {
    c._inGebruik = false;
    if (c._dood || !this._alle.has(c)) { this._bedienWachtend(); return; }
    if (this._wachtend.length) { const w = this._wachtend.shift(); if (w.timer) clearTimeout(w.timer); c._inGebruik = true; w.resolve(c); return; }
    this._idle.push(c);
    if (this.options.idleTimeoutMillis) { c._idleTimer = setTimeout(() => { this._verwijder(c); c.einde(); }, this.options.idleTimeoutMillis); if (c._idleTimer.unref) c._idleTimer.unref(); }
  }
  async _bedienWachtend() {
    if (!this._wachtend.length) return;
    if (this._alle.size >= this.options.max) return;
    const w = this._wachtend.shift(); if (w.timer) clearTimeout(w.timer);
    try { const c = await this._maak(); c._inGebruik = true; w.resolve(c); } catch (e) { w.reject(e); }
  }

  async query(text, params) {
    const c = await this._checkout();
    try { return await c.query(text, params); }
    finally { this._terug(c); }
  }
  async connect() {
    const c = await this._checkout();
    const self = this;
    if (!c._releaseGezet) { c._releaseGezet = true; c.release = function () { self._terug(c); }; }
    return c;
  }
  async end() {
    for (const w of this._wachtend) { if (w.timer) clearTimeout(w.timer); w.reject(new Error('pg: pool afgesloten')); }
    this._wachtend = [];
    const clients = [...this._alle];
    this._alle.clear(); this._idle = [];
    for (const c of clients) { if (c._idleTimer) clearTimeout(c._idleTimer); try { c.einde(); } catch (e) {} }
  }
}

function ontleedConfig(opts) {
  let host = opts.host, port = opts.port, user = opts.user, password = opts.password, database = opts.database, ssl = opts.ssl;
  if (opts.connectionString) {
    const u = new URL(opts.connectionString);
    host = host || u.hostname || '127.0.0.1';
    port = port || (u.port ? Number(u.port) : 5432);
    user = user || (u.username ? decodeURIComponent(u.username) : (process.env.PGUSER || 'postgres'));
    password = password != null ? password : (u.password ? decodeURIComponent(u.password) : process.env.PGPASSWORD);
    database = database || (u.pathname && u.pathname.length > 1 ? decodeURIComponent(u.pathname.slice(1)) : user);
    const sslmode = u.searchParams.get('sslmode');
    if (ssl == null && sslmode && sslmode !== 'disable') ssl = { rejectUnauthorized: sslmode === 'verify-full' || sslmode === 'verify-ca' };
  }
  return { host: host || '127.0.0.1', port: port || 5432, user: user || 'postgres', password, database,
    ssl: ssl || false, statement_timeout: opts.statement_timeout, query_timeout: opts.query_timeout };
}

module.exports = { Pool, Client, _decodeer: decodeer, _paramTekst: paramTekst, _int16: int16 };
