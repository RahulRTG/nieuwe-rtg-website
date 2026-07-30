/* RTG Scanner (deelmodule): een kleine, eigen PDF-bouwer die JPEG-pagina's
   in een geldige PDF zet (DCTDecode, een beeld per pagina, MediaBox op de
   pixelmaat). Geen externe pakketten en geen server: alles op het toestel.
   Puur en dus los te toetsen in Node (module.exports) en in de browser
   (window.RTGPdf). pages: [{ b64, w, h }] met b64 = de JPEG zonder
   data-url-kop; terug komt de base64 van de complete PDF. */
(function (root) {
  'use strict';
  function b64naarBytes(b64) {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  function bytesNaarB64(u) {
    if (typeof Buffer !== 'undefined') return Buffer.from(u).toString('base64');
    var s = '';
    for (var i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function maak(pages) {
    if (!Array.isArray(pages) || !pages.length) throw new Error('Geen pagina\'s om te bundelen.');
    var enc = new TextEncoder();
    var delen = [], offsets = [], totaal = 0;
    function push(u) { delen.push(u); totaal += u.length; }
    function pushStr(s) { push(enc.encode(s)); }
    function obj(n, s) { offsets[n] = totaal; pushStr(n + ' 0 obj\n' + s + '\nendobj\n'); }
    pushStr('%PDF-1.4\n');
    var n = pages.length;
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    var kids = pages.map(function (_, i) { return (3 + i * 3) + ' 0 R'; }).join(' ');
    obj(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + n + ' >>');
    pages.forEach(function (p, i) {
      var w = Math.max(1, Math.round(p.w)), h = Math.max(1, Math.round(p.h));
      var pn = 3 + i * 3, cn = pn + 1, xn = pn + 2;
      obj(pn, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] ' +
        '/Resources << /XObject << /Im' + i + ' ' + xn + ' 0 R >> >> /Contents ' + cn + ' 0 R >>');
      var inhoud = 'q ' + w + ' 0 0 ' + h + ' 0 0 cm /Im' + i + ' Do Q';
      obj(cn, '<< /Length ' + inhoud.length + ' >>\nstream\n' + inhoud + '\nendstream');
      var beeld = b64naarBytes(p.b64);
      offsets[xn] = totaal;
      pushStr(xn + ' 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + beeld.length + ' >>\nstream\n');
      push(beeld);
      pushStr('\nendstream\nendobj\n');
    });
    var maxObj = 2 + n * 3, xref = totaal;
    var x = 'xref\n0 ' + (maxObj + 1) + '\n0000000000 65535 f \n';
    for (var i2 = 1; i2 <= maxObj; i2++) x += String(offsets[i2]).padStart(10, '0') + ' 00000 n \n';
    x += 'trailer\n<< /Size ' + (maxObj + 1) + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF';
    pushStr(x);
    var uit = new Uint8Array(totaal), pos = 0;
    delen.forEach(function (d) { uit.set(d, pos); pos += d.length; });
    return bytesNaarB64(uit);
  }
  var api = { maak: maak };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RTGPdf = api;
})(typeof window !== 'undefined' ? window : globalThis);
