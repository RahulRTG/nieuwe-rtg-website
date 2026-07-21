/* RTG Zegel controleren (offline): een leverancier scant het Zegel van een lid
   en verifieert het HIER, op het toestel, met alleen de publieke sleutel van RTG
   -- geen serveroproep. Zo wordt het een echte, cryptografisch bewezen ID-/
   leeftijdscontrole: RTG staat garant dat het paspoort is gezien, de partner
   leert enkel het bewezen feit (18+, lid, welke pas), nooit de naam.

   Puur WebCrypto (Ed25519), dezelfde code in de browser en in node. Geen extern
   pakket. Levert {geldig, claims, sub, exp, reden}. */
(function (root) {
  'use strict';
  var G = (typeof globalThis !== 'undefined') ? globalThis : root;
  var subtle = (G.crypto && G.crypto.subtle) || null;
  var _sleutel = null;

  function b64uNaarBytes(s) {
    s = String(s).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = G.atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function bytesNaarTekst(bytes) { return new G.TextDecoder().decode(bytes); }

  // Offline verificatie met de publieke sleutel (base64url SPKI-DER).
  async function verifieer(token, publiekeSleutelB64u, nu) {
    try {
      var t = String(token), punt = t.indexOf('.');
      if (punt < 0) return { geldig: false, reden: 'vorm' };
      if (!subtle) return { geldig: false, reden: 'geen-webcrypto' };
      var payload = b64uNaarBytes(t.slice(0, punt));
      var sig = b64uNaarBytes(t.slice(punt + 1));
      var der = b64uNaarBytes(publiekeSleutelB64u);
      var key = await subtle.importKey('spki', der, { name: 'Ed25519' }, false, ['verify']);
      if (!(await subtle.verify({ name: 'Ed25519' }, key, sig, payload))) return { geldig: false, reden: 'handtekening' };
      var data = JSON.parse(bytesNaarTekst(payload));
      var sec = nu || Math.floor(Date.now() / 1000);
      if (data.exp && sec > data.exp) return { geldig: false, reden: 'verlopen', sub: data.sub, exp: data.exp };
      return { geldig: true, sub: data.sub, claims: data.claims || {}, exp: data.exp, partner: data.aud || null };
    } catch (e) { return { geldig: false, reden: 'fout' }; }
  }

  // Browser: haal en cache de publieke sleutel van RTG (mag lang blijven staan).
  async function haalSleutel(force) {
    if (_sleutel && !force) return _sleutel;
    var r = await G.fetch('/api/zegel/sleutel');
    _sleutel = (await r.json()).sleutel;
    return _sleutel;
  }

  var api = { verifieer: verifieer, haalSleutel: haalSleutel };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGZegelcheck = api;
})(typeof self !== 'undefined' ? self : this);
