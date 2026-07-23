/* Een rustige, decoratieve 3D-skyline áchter de hero van de RTG-app, op de
   huiseigen WebGL-motor (shared/drie.js). Zachter en kleiner dan het volledige
   'uitzicht'; puur sfeer. Valt stil weg (geen canvas-inhoud) als er geen WebGL
   is of bij prefers-reduced-motion, en pauzeert als het tabblad weg is. */
(function () {
  'use strict';
  if (!window.Drie || !Drie.maakRenderer) return;
  var canvas = document.getElementById('heroSky');
  if (!canvas) return;
  var RUSTIG = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  var R = Drie.maakRenderer(canvas, { mist: [0.047, 0.047, 0.043], raster: [0.62, 0.50, 0.24], licht: [0.4, 1.0, 0.35] });
  if (!R) return;

  var DONKER = [0.11, 0.09, 0.10], GRIJS = [0.24, 0.23, 0.215];
  var BORDEAUX = [0.50, 0.086, 0.20], GOUD = [0.52, 0.44, 0.10], GOUD_ZACHT = [0.79, 0.63, 0.29];

  var stad = Drie.leegMesh();
  var blokken = [
    [0, 0, 13, 40, 13, DONKER, BORDEAUX], [-20, -4, 10, 26, 10, DONKER, GRIJS],
    [18, -8, 11, 30, 11, DONKER, GOUD], [-12, 16, 9, 20, 9, DONKER, GRIJS],
    [15, 18, 10, 24, 10, DONKER, BORDEAUX], [-30, 10, 8, 16, 8, DONKER, GRIJS],
    [30, 6, 8, 18, 8, DONKER, GRIJS], [0, -26, 10, 22, 10, DONKER, GOUD]
  ];
  blokken.forEach(function (b) { Drie.doos(stad, b[0], b[1], b[2], b[3], b[4], b[5], b[6]); });
  var bakens = Drie.leegMesh();
  Drie.pin(bakens, 0, 0, 44, GOUD_ZACHT);
  Drie.pin(bakens, 18, -8, 34, GOUD_ZACHT);

  R.voegToe(Drie.vlak(220, [0.05, 0.045, 0.045]), { raster: true });
  R.voegToe(stad, {});
  R.voegToe(bakens, { emissie: 0.5 });

  function grootte() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = canvas.clientWidth || 800, h = canvas.clientHeight || 360;
    var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  }
  function frame(hoek) {
    grootte();
    R.teken([Math.cos(hoek) * 108, 54, Math.sin(hoek) * 108], [0, 14, 0], { fov: 44 });
  }
  if (RUSTIG) { frame(-0.6); return; }
  var hoek = -0.6, vorige = null;
  function lus(ts) {
    if (!document.hidden) { if (vorige != null) hoek += (ts - vorige) / 1000 * 0.05; frame(hoek); }
    vorige = ts; requestAnimationFrame(lus);
  }
  requestAnimationFrame(lus);
})();
