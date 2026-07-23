/* De RTG-signatuurmond: EEN mond voor het hele systeem, nu in 3D. Duizenden
   lichtpuntjes op een eigen canvas (geen extern beeld): bordeaux als basis, goud
   erdoorheen geweven, een enkel wit puntje als glinstering, en een gouden
   lichtgolf die om de paar seconden door de lippen trekt. De onderlip beweegt
   mee als Rahul "praat".

   Nieuw: waar WebGL kan, leeft de mond echt. Dezelfde puntenwolk krijgt diepte
   (de lippen bollen naar je toe), een zachte parallax die met de muis/kanteling
   meebeweegt, en additief oplichtende puntjes. Kan het toestel geen WebGL of
   wil de bezoeker minder beweging (prefers-reduced-motion), dan valt hij netjes
   terug op exact het bestaande 2D-beeld. Zelfde API, zelfde gezicht.

   Het puntenveld zelf (de lipvorm + diepte) is een pure functie die ook in Node
   draait en los getoetst is (test/mond.test.js).

   Gebruik: geef een <canvas width="440" height="200"> mee; het CSS bepaalt de
   getoonde maat. RTGMond.maak(canvas) tekent en geeft { praat(ms) } terug om de
   onderlip kort te laten bewegen. Het tekenen pauzeert zodra het canvas uit
   beeld is (offsetParent === null), dus het is goedkoop als het niet zichtbaar is. */
(function (root) {
  'use strict';

  /* ---- de pure kern: het puntenveld met diepte (ook in Node) ----
     De lipvormen als functies: de middellijn met cupidoboog, de boog van de
     bovenlip en de boog van de onderlip (mondhoeken op x=50 en x=170). Elk punt
     krijgt een z: de lippen bollen naar de kijker toe, de middellijn ligt terug. */
  function puntenVeld(rand) {
    var rnd = rand || Math.random;
    var PUNTEN = [];
    var midden = function (x) { return 52 - 6 * Math.exp(-Math.pow(x - 110, 2) / 98); };
    var boven = function (x) { var t = (x - 110) / 60; return 52 - 24 * Math.pow(Math.max(0, 1 - t * t), 0.8) + 7 * Math.exp(-Math.pow(x - 110, 2) / 72); };
    var onder = function (x) { var t = (x - 110) / 60; return 52 + 27 * Math.pow(Math.max(0, 1 - t * t), 0.9); };
    var bult = function (x) { return Math.exp(-Math.pow(x - 110, 2) / 2600); };   // lipvolume naar het midden toe
    for (var i = 0; i < 2400; i++) {
      var lip = rnd() < 0.45 ? 'b' : 'o';
      var x = 50 + rnd() * 120;
      var y1 = lip === 'b' ? boven(x) : midden(x), y2 = lip === 'b' ? midden(x) : onder(x);
      if (y2 - y1 < 0.8) continue;
      var r = rnd();
      var diep = (y2 - y1) > 0 ? (((y1 + (y2 - y1) / 2) - y1) / (y2 - y1)) : 0;
      // z: de bovenlip iets naar voren, de onderlip iets voller; puntjes aan de
      // rand van de lip liggen wat verder terug dan het midden van de lip
      var lipMidden = 1 - Math.abs((0.5 - ((((y1 + (y2 - y1) / 2)) - y1) / Math.max(0.001, y2 - y1))) * 2);
      var z = (lip === 'b' ? 0.20 : 0.26) * bult(x) * (0.55 + 0.45 * lipMidden);
      PUNTEN.push({ x: x, y: y1 + rnd() * (y2 - y1), lip: lip,
        fase: rnd() * Math.PI * 2, maat: 0.5 + rnd() * 0.9,
        kleur: r < 0.62 ? '#9E1C40' : (r < 0.9 ? '#C9A24B' : '#FFFFFF'),
        diep: diep, z: z });
    }
    // de gouden middellijn loopt door tot voorbij de mondhoeken en vervaagt; ligt terug
    for (var j = 0; j < 420; j++) {
      var mx = 14 + rnd() * 192;
      PUNTEN.push({ x: mx, y: midden(Math.min(170, Math.max(50, mx))) + (rnd() - 0.5) * 1.6,
        lip: 'm', fase: rnd() * Math.PI * 2, maat: 0.4 + rnd() * 0.7,
        kleur: '#C9A24B', rand: Math.min(1, Math.min(mx - 14, 206 - mx) / 55), diep: 0, z: -0.05 });
    }
    return PUNTEN;
  }

  var api = { puntenVeld: puntenVeld };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---- vanaf hier: alleen in de browser ---- */
  if (root.RTGMond) return;
  var RUSTIG = root.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hex(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255]; }

  /* ---- 3D: de puntenwolk als levend beeld met diepte + parallax ---- */
  var VERT =
    'attribute vec3 aPos; attribute vec3 aKleur; attribute vec4 aExtra; attribute float aRand;' +
    'uniform float uTijd, uGolf, uSpreek, uYaw, uPitch, uDpr;' +
    'varying vec3 vKleur; varying float vAlpha;' +
    'void main(){' +
    ' float maat=aExtra.x, fase=aExtra.y, lip=aExtra.z, diep=aExtra.w;' +
    ' vec3 p=aPos;' +
    ' if(lip>0.5){ p.y -= uSpreek*diep*0.32; p.z += uSpreek*0.12; }' +   // de onderlip zakt en puilt bij het praten
    ' float cy=cos(uYaw), sy=sin(uYaw), cx=cos(uPitch), sx=sin(uPitch);' +
    ' vec3 a=vec3(cy*p.x+sy*p.z, p.y, -sy*p.x+cy*p.z);' +
    ' vec3 b=vec3(a.x, cx*a.y-sx*a.z, sx*a.y+cx*a.z);' +
    ' float persp=1.7/(1.7-b.z*0.6);' +
    ' gl_Position=vec4(b.x*persp, b.y*persp, 0.0, 1.0);' +
    ' gl_PointSize=maat*persp*4.2*uDpr;' +
    ' float mx=aPos.x*110.0+110.0;' +                                    // terug naar mond-x voor de golf
    ' float dg=mx-uGolf; float golf=exp(-(dg*dg)/420.0);' +              // geen pow() met mogelijk negatieve basis (undefined in GLSL)
    ' float twinkel=0.45+0.4*sin(fase+uTijd/700.0);' +
    ' vAlpha=min(1.0, twinkel*aRand + golf*0.9);' +
    ' vKleur=mix(aKleur, vec3(0.96,0.90,0.72), clamp(golf*1.3,0.0,0.85));' +
    '}';
  var FRAG =
    'precision mediump float; varying vec3 vKleur; varying float vAlpha;' +
    'void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard;' +
    // zacht rond puntje; premultiplied kleur (rgb*a) voor additieve gloed op een doorzichtig canvas
    ' float a=vAlpha*(1.0-r*1.9); if(a<=0.0) discard; gl_FragColor=vec4(vKleur*a, a); }';

  function schaduw(gl, type, bron) { var s = gl.createShader(type); gl.shaderSource(s, bron); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }

  function maak3D(canvas, PUNTEN) {
    var gl = null;
    // premultiplied (standaard) voor nette gloed; preserveDrawingBuffer houdt het
    // laatste beeld staan als de rAF-lus even pauzeert (geen flikkering)
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) return null;
    var vs = schaduw(gl, gl.VERTEX_SHADER, VERT), fs = schaduw(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    // buffers vullen (normaliseer x,y naar [-1,1]-achtig; z is al klein)
    var n = PUNTEN.length;
    var pos = new Float32Array(n * 3), kol = new Float32Array(n * 3), ext = new Float32Array(n * 4), rnd = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var p = PUNTEN[i];
      pos[i * 3] = (p.x - 110) / 110; pos[i * 3 + 1] = -(p.y - 52) / 60; pos[i * 3 + 2] = p.z;
      var c = hex(p.kleur); kol[i * 3] = c[0]; kol[i * 3 + 1] = c[1]; kol[i * 3 + 2] = c[2];
      ext[i * 4] = p.maat; ext[i * 4 + 1] = p.fase; ext[i * 4 + 2] = p.lip === 'o' ? 1 : 0; ext[i * 4 + 3] = p.diep || 0;
      rnd[i] = p.rand == null ? 1 : p.rand;
    }
    function buf(data, comp, naam) {
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, naam); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, comp, gl.FLOAT, false, 0, 0);
    }
    buf(pos, 3, 'aPos'); buf(kol, 3, 'aKleur'); buf(ext, 4, 'aExtra'); buf(rnd, 1, 'aRand');
    var U = {}; ['uTijd', 'uGolf', 'uSpreek', 'uYaw', 'uPitch', 'uDpr'].forEach(function (u) { U[u] = gl.getUniformLocation(prog, u); });
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);   // additief (premultiplied): de puntjes gloeien op, ook doorzichtig
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    // muis/kanteling voor de parallax
    var muisX = 0, muisY = 0;
    canvas.addEventListener('pointermove', function (e) { var r = canvas.getBoundingClientRect(); muisX = (e.clientX - r.left) / r.width - 0.5; muisY = (e.clientY - r.top) / r.height - 0.5; });
    if (root.DeviceOrientationEvent) root.addEventListener('deviceorientation', function (e) { if (e.gamma != null) { muisX = Math.max(-0.5, Math.min(0.5, e.gamma / 45)); muisY = Math.max(-0.5, Math.min(0.5, (e.beta - 40) / 45)); } }, true);
    return {
      teken: function (t, praatTot) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        var golf = ((t / 4200) % 1) * 260 - 20;
        var spreek = t < praatTot ? Math.abs(Math.sin(t / 1000 * Math.PI * 4.4)) : 0;
        var yaw = Math.sin(t / 2600) * 0.18 + muisX * 0.5;
        var pitch = Math.sin(t / 3400) * 0.06 + muisY * 0.3;
        gl.uniform1f(U.uTijd, t); gl.uniform1f(U.uGolf, golf); gl.uniform1f(U.uSpreek, spreek);
        gl.uniform1f(U.uYaw, yaw); gl.uniform1f(U.uPitch, pitch); gl.uniform1f(U.uDpr, dpr);
        gl.drawArrays(gl.POINTS, 0, n);
      }
    };
  }

  function maak(canvas) {
    if (!canvas || canvas.dataset.rtgMondActief) return { praat: function () {} };
    canvas.dataset.rtgMondActief = '1';
    var PUNTEN = puntenVeld();
    var praatTot = 0;
    var praat = function (ms) { praatTot = performance.now() + ms; };

    // de levende 3D-mond waar het kan; anders het vertrouwde 2D-beeld
    var d3 = RUSTIG ? null : maak3D(canvas, PUNTEN);
    if (d3) {
      (function lus() {
        if (canvas.offsetParent) { d3.teken(performance.now(), praatTot); requestAnimationFrame(lus); }
        else setTimeout(lus, 600);
      })();
      return { praat: praat };
    }

    // ---- 2D-terugval: exact het bestaande beeld ----
    var mctx = canvas.getContext('2d');
    if (!mctx) return { praat: praat };
    function verf(t) {
      mctx.clearRect(0, 0, 440, 200);
      mctx.save();
      mctx.scale(2, 2);
      var golf = ((t / 4200) % 1) * 260 - 20;
      var spreek = t < praatTot ? Math.sin(t / 1000 * Math.PI * 4.4) : 0;
      for (var i = 0; i < PUNTEN.length; i++) {
        var p = PUNTEN[i];
        var gloed = Math.exp(-Math.pow(p.x - golf, 2) / 420);
        var twinkel = 0.45 + 0.4 * Math.sin(p.fase + t / 700);
        mctx.globalAlpha = Math.min(1, twinkel * (p.rand == null ? 1 : p.rand) + gloed * 0.9);
        mctx.fillStyle = gloed > 0.45 ? '#F5E6B8' : p.kleur;
        mctx.fillRect(p.x, p.lip === 'o' ? p.y + spreek * 4 * p.diep : p.y, p.maat, p.maat);
      }
      mctx.restore();
    }
    if (RUSTIG) verf(0);
    else (function lus() {
      if (canvas.offsetParent) { verf(performance.now()); requestAnimationFrame(lus); }
      else setTimeout(lus, 600);
    })();
    return { praat: praat };
  }

  /* De mond als knop-icoon: HET vaste gezicht van Rahul, overal hetzelfde. Geef
     een knop mee; er komt een klein mond-canvas in (met een toegankelijk label
     op de knop zelf). Geeft { praat } terug zodat de knop kan "meepraten". */
  function fab(knop, hoogte) {
    if (!knop || knop.dataset.rtgMondFab) return { praat: function () {} };
    knop.dataset.rtgMondFab = '1';
    var c = document.createElement('canvas');
    c.width = 440; c.height = 200;
    c.style.cssText = 'display:block;width:' + (hoogte ? hoogte * 2.2 : 3.4) + 'rem;height:auto;pointer-events:none;';
    c.setAttribute('aria-hidden', 'true');
    knop.textContent = '';
    knop.appendChild(c);
    return maak(c);
  }

  root.RTGMond = { maak: maak, fab: fab, puntenVeld: puntenVeld };
})(typeof self !== 'undefined' ? self : this);
