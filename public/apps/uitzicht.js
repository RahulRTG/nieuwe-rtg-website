/* De skyline van RTG: een stille, langzaam ronddraaiende 3D-stad, gebouwd op de
   huiseigen 3D-motor (shared/drie.js). Elk blok staat voor een tak van het huis;
   samen vormen ze een nachtelijke skyline in bordeaux en gedempt goud, op een
   rasterverlicht grondvlak. Geen three.js, geen extern beeld.

   Zuinig en rustig: valt stil terug op een tekstmelding als er geen WebGL is,
   staat een enkel frame stil bij prefers-reduced-motion, en pauzeert zodra het
   tabblad niet zichtbaar is. Alles blijft op het toestel. */
(function () {
  'use strict';
  if (!window.Drie || !Drie.maakRenderer) return;
  var canvas = document.getElementById('skyline');
  var wrap = document.getElementById('stad');
  if (!canvas) return;

  var R = Drie.maakRenderer(canvas, {
    mist: [0.047, 0.047, 0.043],       // de huisnacht
    raster: [0.79, 0.63, 0.29],        // gedempt goud rasterlicht
    licht: [0.45, 1.0, 0.35]
  });
  if (!R) { if (wrap) wrap.classList.add('geen-webgl'); return; }

  /* ---- de huiskleuren (0..1) ---- */
  var DONKER = [0.10, 0.085, 0.09], DONKER2 = [0.14, 0.12, 0.13];
  var GRIJS = [0.26, 0.25, 0.235];
  var BORDEAUX = [0.50, 0.086, 0.20], BORDEAUX_HEL = [0.62, 0.11, 0.25];
  var GOUD = [0.52, 0.44, 0.10], GOUD_ZACHT = [0.79, 0.63, 0.29];

  /* ---- de stad: een bewust geplaatste skyline (geen ruis), met in het midden
     de hoogste toren en daaromheen lagere blokken. Elk blok een tak. ---- */
  var stad = Drie.leegMesh();
  // [cx, cz, breedte, hoogte, diepte, kleur, dak]
  var blokken = [
    [0, 0, 14, 46, 14, DONKER2, BORDEAUX],       // het hart (RTG)
    [-22, -6, 11, 30, 11, DONKER, GRIJS],
    [20, -10, 12, 34, 12, DONKER2, GOUD],
    [-14, 18, 10, 24, 10, DONKER, BORDEAUX_HEL],
    [16, 20, 11, 28, 11, DONKER2, GRIJS],
    [-34, 14, 9, 20, 9, DONKER, GRIJS],
    [34, 8, 9, 22, 9, DONKER2, BORDEAUX],
    [2, -30, 12, 26, 12, DONKER, GOUD],
    [-30, -26, 10, 18, 10, DONKER2, GRIJS],
    [30, -30, 10, 20, 10, DONKER, BORDEAUX_HEL],
    [-8, 38, 8, 14, 8, DONKER2, GRIJS],
    [12, 42, 8, 16, 8, DONKER, GRIJS],
    [-44, -4, 8, 15, 8, DONKER2, GRIJS],
    [44, 24, 8, 17, 8, DONKER, GRIJS]
  ];
  blokken.forEach(function (b) { Drie.doos(stad, b[0], b[1], b[2], b[3], b[4], b[5], b[6]); });

  var grond = Drie.vlak(240, [0.055, 0.05, 0.05]);

  // een paar gouden bakens die zacht gloeien -- de signatuur boven de stad
  var bakens = Drie.leegMesh();
  Drie.pin(bakens, 0, 0, 50, GOUD_ZACHT);
  Drie.pin(bakens, 20, -10, 38, GOUD_ZACHT);
  Drie.pin(bakens, -14, 18, 28, BORDEAUX_HEL);

  R.voegToe(grond, { raster: true });
  R.voegToe(stad, {});
  R.voegToe(bakens, { emissie: 0.55 });

  /* ---- camera: een trage baan om de stad heen ---- */
  var RUSTIG = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function grootte() {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = canvas.clientWidth || 800, h = canvas.clientHeight || 500;
    var bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
  }

  function frame(hoek) {
    grootte();
    var straal = 118, hoogte = 62;
    var oog = [Math.cos(hoek) * straal, hoogte, Math.sin(hoek) * straal];
    R.teken(oog, [0, 16, 0], { fov: 46 });
  }

  if (RUSTIG) { frame(-0.7); return; }   // één nette stilstaande blik

  var hoek = -0.7, vorige = null;
  function lus(ts) {
    if (!document.hidden) {
      if (vorige != null) hoek += (ts - vorige) / 1000 * 0.06;   // ~1 omwenteling per ~1,7 min: rustig
      frame(hoek);
    }
    vorige = ts;
    requestAnimationFrame(lus);
  }
  requestAnimationFrame(lus);
})();
