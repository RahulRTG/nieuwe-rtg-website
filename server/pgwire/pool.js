/* pgwire, deel "pool": de connection-pool (checkout/teruggeven, groeien tot max,
   dode verbindingen opruimen en opnieuw maken, wachtenden met time-out) en het
   ontleden van de connection string. Leunt op ./client voor de verbindingen. */
'use strict';
const { EventEmitter } = require('events');
const { Client } = require('./client');

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

module.exports = { Pool, ontleedConfig };
