/* RTG QR tekenen: een tekst via onze eigen codec (public/shared/qr.js) naar een
   canvas of PNG-dataURL, om te tonen of te printen. Zwart-op-wit, scherp
   (geen anti-aliasing op de modules). Gebruikt in de leverancier-app (tafel-QR
   printen) en op de leden-pas (het Zegel). Geen extern pakket. */
(function (root) {
  'use strict';
  function codec() { return root.RTGQR || (typeof require !== 'undefined' ? require('./qr') : null); }

  function matrixNaarCanvas(matrix, opts) {
    opts = opts || {};
    var schaal = opts.schaal || 6, quiet = (opts.quiet == null ? 4 : opts.quiet);
    var n = matrix.length, W = (n + quiet * 2) * schaal, d = root.document;
    var cv = d.createElement('canvas'); cv.width = W; cv.height = W;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = opts.bg || '#FFFFFF'; ctx.fillRect(0, 0, W, W);
    ctx.fillStyle = opts.fg || '#0C0C0B';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (matrix[r][c]) ctx.fillRect((c + quiet) * schaal, (r + quiet) * schaal, schaal, schaal);
    return cv;
  }
  function teken(tekst, opts) {
    var q = codec(); if (!q) throw new Error('QR-codec ontbreekt');
    var qr = q.encode(String(tekst), { ecc: (opts && opts.ecc) || 'M' });
    return matrixNaarCanvas(qr.matrix, opts);
  }
  function dataURL(tekst, opts) { return teken(tekst, opts).toDataURL('image/png'); }

  var api = { teken: teken, dataURL: dataURL, matrixNaarCanvas: matrixNaarCanvas };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGQRteken = api;
})(typeof self !== 'undefined' ? self : this);
