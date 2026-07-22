/* pgwire, deel "auth": de authenticatie-methoden van de Client. Cleartext, md5
   en SASL/SCRAM-SHA-256 (met channel binding op TLS). Regel 1: geen eigen crypto
   -- alleen node:crypto en de scram-helper. Afgesplitst uit client.js zodat elk
   deel klein blijft; de methoden worden op Client.prototype gemengd en draaien
   dus met dezelfde `this` (this.sock, this.cfg, this._scram, this._fout). */
'use strict';
const crypto = require('crypto');
const { cstr, bericht, leesCstrs } = require('./protocol');
const scram = require('./scram');

module.exports = {
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
  },
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
  },
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
  },
  _scramFinal(data) {
    try { scram.eindeControle(data, this._scram.serverSignature); this._scram = null; }
    catch (e) { return this._fout(e); }
  }
};
