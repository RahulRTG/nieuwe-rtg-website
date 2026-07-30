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

  /* De RTG-stijl: de code in bordeaux op zacht papier, met in het hart een klein
     merkteken -- de lippen of het horloge. Ons eigen scanner leest bordeaux net
     zo goed als zwart (drempel op helderheid); het merkteken houden we klein en
     kiezen we een ruimere versie zodat de foutcorrectie (niveau M) het hart
     probleemloos herstelt. opts.merk = 'lippen' (standaard) of 'horloge'. */
  function emblLippen(ctx, cx, cy, r, kleur) {
    ctx.fillStyle = kleur;
    ctx.beginPath();
    // bovenlip: twee bogen met een cupidoboog; onderlip: een volle boog
    ctx.moveTo(cx - r, cy);
    ctx.quadraticCurveTo(cx - r * 0.5, cy - r * 0.75, cx, cy - r * 0.15);
    ctx.quadraticCurveTo(cx + r * 0.5, cy - r * 0.75, cx + r, cy);
    ctx.quadraticCurveTo(cx + r * 0.5, cy + r * 0.9, cx, cy + r * 0.95);
    ctx.quadraticCurveTo(cx - r * 0.5, cy + r * 0.9, cx - r, cy);
    ctx.fill();
    // de mondlijn in de papierkleur, zodat de twee lippen leesbaar blijven
    ctx.strokeStyle = '#F4F1EC'; ctx.lineWidth = Math.max(1, r * 0.14); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - r * 0.92, cy); ctx.quadraticCurveTo(cx, cy + r * 0.28, cx + r * 0.92, cy); ctx.stroke();
  }
  function emblHorloge(ctx, cx, cy, r, kleur) {
    // een achthoekige wijzerplaat (de RTG-klok) met twee wijzers
    ctx.fillStyle = kleur; ctx.beginPath();
    for (var i = 0; i < 8; i++) { var a = Math.PI / 8 + i * Math.PI / 4, x = cx + r * Math.cos(a), y = cy + r * Math.sin(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#F4F1EC'; ctx.lineWidth = Math.max(1, r * 0.16); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - r * 0.55); ctx.stroke();       // grote wijzer
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * 0.42, cy + r * 0.12); ctx.stroke(); // kleine wijzer
  }
  function tekenRTG(tekst, opts) {
    opts = opts || {};
    var q = codec(); if (!q) throw new Error('QR-codec ontbreekt');
    // Versie 7 heeft precies in het hart een uitlijnpatroon (een 5x5-blok dat de
    // decoder zelf herstelt). Ons merkteken zetten we binnen dat blok, zodat het
    // GEEN databits raakt en de code dus altijd leesbaar blijft -- ook zonder
    // foutcorrectie in onze eigen codec.
    var qr = q.encode(String(tekst), { ecc: 'M', versie: 7 });
    var schaal = opts.schaal || 8, quiet = (opts.quiet == null ? 4 : opts.quiet);
    var bordeaux = opts.fg || '#7F1634', papier = opts.bg || '#F4F1EC';
    var cv = matrixNaarCanvas(qr.matrix, { schaal: schaal, quiet: quiet, fg: bordeaux, bg: papier });
    var ctx = cv.getContext('2d'), W = cv.width;
    var cx = W / 2, cy = W / 2;
    // het schijfje en het merkteken blijven binnen het centrale uitlijnpatroon
    // (straal ~2,5 modules), zodat er geen data verloren gaat
    var pad = schaal * 2.4, r = schaal * 1.9;
    ctx.fillStyle = papier; ctx.beginPath(); ctx.arc(cx, cy, pad, 0, Math.PI * 2); ctx.fill();
    (opts.merk === 'horloge' ? emblHorloge : emblLippen)(ctx, cx, cy, r, bordeaux);
    return cv;
  }
  function dataURLRTG(tekst, opts) { return tekenRTG(tekst, opts).toDataURL('image/png'); }

  var api = { teken: teken, dataURL: dataURL, tekenRTG: tekenRTG, dataURLRTG: dataURLRTG, matrixNaarCanvas: matrixNaarCanvas };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.RTGQRteken = api;
})(typeof self !== 'undefined' ? self : this);
