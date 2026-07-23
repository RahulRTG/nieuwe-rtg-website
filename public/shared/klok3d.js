/* De RTG-klok als 3D-skelethorloge: een progressieve verrijking boven de
   bestaande wijzerplaat (shared/klok.js). Waar WebGL kan, legt een doorzichtige
   laag er een echt geslepen gouden cassement omheen, een saffierglas met een
   bewegende reflectie, en -- het hart -- een opengewerkt (skeleton) uurwerk in
   3D: tandwielen met echte tanden die op de juiste tandverhoudingen in elkaar
   grijpen, aangedreven door de echte tijd (het secondewiel loopt exact 1 slag
   per minuut, gelijk met de secondewijzer), en een onrust die klopt.

   Als deze laag draait, verbergen we het 2D-binnenwerk van klok.js (de platte
   raderen), zodat het 3D-uurwerk het overneemt; de cijfers, de wijzers, de
   streepjes, de naam, de datum en de gangreserve blijven gewoon van de plaat.

   Veilig en omkeerbaar: geen WebGL of minder-beweging (prefers-reduced-motion)
   => geen laag, en het horloge staat er exact zoals voorheen. Het canvas neemt
   geen muis (pointer-events:none) en pauzeert zodra het uit beeld is.

   Zelf-installerend: zoekt .rtg-ring en verrijkt elke ring een keer. */
(function (root) {
  'use strict';
  if (!root || !root.document) return;
  if (root.RTGKlok3D) return;
  var doc = root.document;
  var RUSTIG = root.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.RTGKlok3D = { verrijk: verrijk, alles: alles };

  /* verberg het platte 2D-binnenwerk zodra het 3D-uurwerk draait */
  (function () {
    var st = doc.createElement('style'); st.id = 'rtg-klok3d-stijl';
    st.textContent = '.rtg-ring.rtg3d-aan .rr-rad,.rtg-ring.rtg3d-aan .rr-spaak,.rtg-ring.rtg3d-aan .rr-as,.rtg-ring.rtg3d-aan .rr-onrust,.rtg-ring.rtg3d-aan .rr-spiraal{display:none!important;}';
    (doc.head || doc.documentElement).appendChild(st);
  })();

  /* ---- mini mat4 (kolom-hoofd), genoeg voor een recht-van-voren scene ---- */
  function ident() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function mul(a, b) { var o = new Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function T(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  function S(s) { return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]; }
  function Rz(a) { var c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }

  /* ---- meshbouwers: platte getallenrijen pos(x,y,z) + nor(x,y,z) ---- */
  function M() { return { pos: [], nor: [] }; }
  function hoek(m, p, n) { m.pos.push(p[0], p[1], p[2]); m.nor.push(n[0], n[1], n[2]); }
  function tri(m, a, na, b, nb, c, nc) { hoek(m, a, na); hoek(m, b, nb); hoek(m, c, nc); }
  function quad(m, a, b, c, d, n) { tri(m, a, n, b, n, c, n); tri(m, a, n, c, n, d, n); }

  // een tandwiel op eenheidsmaat (tip-straal 1): geslepen tandkrans + open
  // spaken + naaf met gat -> skelet. dik = halve dikte.
  function tandwiel(tanden, dik) {
    var m = M(), rIn = 0.58, rRoot = 0.82, rTip = 1.0, rHub = 0.24, rGat = 0.11, spaken = 5;
    var sB = Math.sin(0.9), cB = Math.cos(0.9);           // schuine tandflank voor de glans
    function pol(r, a, z) { return [r * Math.cos(a), r * Math.sin(a), z]; }
    // vlakke binnenband rIn..rRoot (bovenkant), normaal +z
    var seg = tanden * 4;
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2, nz = [0, 0, 1];
      quad(m, pol(rIn, a0, dik), pol(rRoot, a0, dik), pol(rRoot, a1, dik), pol(rIn, a1, dik), nz);
    }
    // de tanden: per tand een geslepen kop (rRoot..rTip) met flanken
    for (var t = 0; t < tanden; t++) {
      var b = t / tanden * Math.PI * 2, w = Math.PI * 2 / tanden;
      var aR0 = b + w * 0.10, aT0 = b + w * 0.30, aT1 = b + w * 0.70, aR1 = b + w * 0.90;
      var nOut0 = [Math.cos((aT0 + aR0) / 2) * sB, Math.sin((aT0 + aR0) / 2) * sB, cB];
      var nOut1 = [Math.cos((aT1 + aR1) / 2) * sB, Math.sin((aT1 + aR1) / 2) * sB, cB];
      var nTop = [Math.cos((aT0 + aT1) / 2) * sB * 0.5, Math.sin((aT0 + aT1) / 2) * sB * 0.5, Math.sqrt(1 - sB * sB * 0.25)];
      // geslepen bovenvlak van de tand (rRoot hoog -> rTip iets lager = afgeschuind)
      tri(m, pol(rRoot, aR0, dik), nOut0, pol(rTip, aT0, dik * 0.5), nTop, pol(rTip, aT1, dik * 0.5), nTop);
      tri(m, pol(rRoot, aR0, dik), nOut0, pol(rTip, aT1, dik * 0.5), nTop, pol(rRoot, aR1, dik), nOut1);
      // buitenwand van de tand
      quad(m, pol(rTip, aT0, dik * 0.5), pol(rTip, aT0, -dik), pol(rTip, aT1, -dik), pol(rTip, aT1, dik * 0.5),
        [Math.cos((aT0 + aT1) / 2), Math.sin((aT0 + aT1) / 2), 0]);
    }
    // spaken (open ertussen = skelet): platte balkjes rHub..rIn
    for (var s = 0; s < spaken; s++) {
      var sa = s / spaken * Math.PI * 2, hw = 0.10, nz2 = [0, 0, 1];
      var c = Math.cos(sa), si = Math.sin(sa), px = -si, py = c;   // dwars
      function pt(r, o) { return [r * c + px * o, r * si + py * o, dik]; }
      quad(m, pt(rHub, -hw), pt(rIn, -hw), pt(rIn, hw), pt(rHub, hw), nz2);
    }
    // naaf: band rGat..rHub (bovenkant) + binnenwand van het gat
    var hs = 40;
    for (var j = 0; j < hs; j++) {
      var b0 = j / hs * Math.PI * 2, b1 = (j + 1) / hs * Math.PI * 2;
      quad(m, pol(rGat, b0, dik), pol(rHub, b0, dik), pol(rHub, b1, dik), pol(rGat, b1, dik), [0, 0, 1]);
      quad(m, pol(rGat, b0, dik), pol(rGat, b0, -dik), pol(rGat, b1, -dik), pol(rGat, b1, dik), [-Math.cos(b0), -Math.sin(b0), 0]);
    }
    return afmaak(m);
  }

  // een gladde geslepen ring (voor de onrust en het cassement): rIn..rTip=1
  function ringMesh(rIn, dik, seg) {
    var m = M(); seg = seg || 120;
    var sB = Math.sin(0.85), cB = Math.cos(0.85), rMid = (rIn + 1) / 2;
    function pol(r, a, z) { return [r * Math.cos(a), r * Math.sin(a), z]; }
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
      var nO0 = [Math.cos(a0) * sB, Math.sin(a0) * sB, cB], nO1 = [Math.cos(a1) * sB, Math.sin(a1) * sB, cB];
      var nI0 = [-Math.cos(a0) * sB, -Math.sin(a0) * sB, cB], nI1 = [-Math.cos(a1) * sB, -Math.sin(a1) * sB, cB];
      // buitenflank (rMid piek -> rTip) en binnenflank (rMid -> rIn)
      tri(m, pol(1, a0, 0), nO0, pol(rMid, a0, dik), [0, 0, 1], pol(rMid, a1, dik), [0, 0, 1]);
      tri(m, pol(1, a0, 0), nO0, pol(rMid, a1, dik), [0, 0, 1], pol(1, a1, 0), nO1);
      tri(m, pol(rMid, a0, dik), [0, 0, 1], pol(rIn, a0, 0), nI0, pol(rIn, a1, 0), nI1);
      tri(m, pol(rMid, a0, dik), [0, 0, 1], pol(rIn, a1, 0), nI1, pol(rMid, a1, dik), [0, 0, 1]);
    }
    return afmaak(m);
  }

  // drie spaken voor de onrust
  function onrustMesh() {
    var ring = ringMesh(0.8, 0.05, 96), m = { pos: ring.posA ? [] : [], nor: [] };
    m.pos = Array.prototype.slice.call(ring.pos); m.nor = Array.prototype.slice.call(ring.nor);
    var mm = { pos: m.pos, nor: m.nor };
    for (var s = 0; s < 3; s++) {
      var sa = s / 3 * Math.PI * 2, c = Math.cos(sa), si = Math.sin(sa), px = -si, py = c, hw = 0.06;
      function pt(r, o) { return [r * c + px * o, r * si + py * o, 0.04]; }
      quad(mm, pt(0, -hw), pt(0.86, -hw), pt(0.86, hw), pt(0, hw), [0, 0, 1]);
    }
    return afmaak(mm);
  }

  // de haarveer: een platte Archimedische spiraal als dun bandje
  function spiraalMesh(winding) {
    var m = M(), seg = winding * 40, w = 0.012;
    function pt(k) { var a = k / 40 * Math.PI * 2, r = 0.05 + 0.02 * (k / 40); return [r * Math.cos(a), r * Math.sin(a)]; }
    for (var i = 0; i < seg; i++) {
      var p0 = pt(i), p1 = pt(i + 1), dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w, nz = [0, 0, 1];
      quad(m, [p0[0] - nx, p0[1] - ny, 0.02], [p0[0] + nx, p0[1] + ny, 0.02], [p1[0] + nx, p1[1] + ny, 0.02], [p1[0] - nx, p1[1] - ny, 0.02], nz);
    }
    return afmaak(m);
  }

  // het cassement: een vollere geslepen ring in de buitenmarge
  function caseMesh() { return ringMesh(0.90, 0.09, 160); }

  function afmaak(m) { return { pos: new Float32Array(m.pos), nor: new Float32Array(m.nor), n: m.pos.length / 3 }; }

  /* ---- WebGL ---- */
  var VERT =
    'attribute vec3 aPos; attribute vec3 aNor; uniform mat4 uMVP; uniform mat4 uModel;' +
    'varying vec3 vNor;' +
    'void main(){ vNor = mat3(uModel) * aNor; vec4 p = uMVP * vec4(aPos,1.0); gl_Position = vec4(p.x, p.y, -p.z, 1.0); }';
  var FRAG =
    'precision mediump float; varying vec3 vNor; uniform vec3 uLicht; uniform vec3 uKleur;' +
    'void main(){ vec3 n = normalize(vNor); vec3 l = normalize(uLicht);' +
    ' float diff = max(dot(n,l),0.0); vec3 r = reflect(-l,n); float spec = pow(max(r.z,0.0),22.0);' +
    ' vec3 k = uKleur*(0.20+0.80*diff) + vec3(1.0,0.95,0.82)*spec*0.9; gl_FragColor = vec4(k,1.0); }';
  var VGLAS = 'attribute vec2 aPos; varying vec2 vP; void main(){ vP=aPos; gl_Position=vec4(aPos,0.0,1.0); }';
  var FGLAS =
    'precision mediump float; varying vec2 vP; uniform vec2 uGlans;' +
    'void main(){ float rr = length(vP); if(rr>0.885) discard;' +
    ' float streep = smoothstep(0.70,0.0,distance(vP,uGlans))*0.26;' +          // heldere saffier-veeg
    ' float rand = smoothstep(0.885,0.74,rr)*0.12;' +                           // lichte glans langs de glasrand
    ' float koepel = smoothstep(0.885,0.2,rr)*0.06;' +                          // zachte bolling
    ' vec3 k = vec3(0.82,0.90,1.0)*streep + vec3(0.88,0.94,1.0)*(rand+koepel);' + // saffier-zweem
    ' float a = streep + rand + koepel; gl_FragColor = vec4(k, a); }';

  function shader(gl, t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
  function prog(gl, v, f) { var a = shader(gl, gl.VERTEX_SHADER, v), b = shader(gl, gl.FRAGMENT_SHADER, f); if (!a || !b) return null; var p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; }
  function buffer(gl, arr) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; }

  var GOUD = [0.83, 0.66, 0.30], STAAL = [0.66, 0.70, 0.74], DONKERGOUD = [0.60, 0.46, 0.18];

  function verrijk(ring) {
    if (!ring || ring.dataset.rtg3d || RUSTIG) return;
    var canvas = doc.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    var gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) return;
    var pMetaal = prog(gl, VERT, FRAG), pGlas = prog(gl, VGLAS, FGLAS);
    if (!pMetaal || !pGlas) return;
    ring.dataset.rtg3d = '1'; ring.classList.add('rtg3d-aan');
    // onder de cijfers, boven de plaat: zo blijven de cijfers leesbaar
    var kern = ring.querySelector('.rr-kern');
    if (kern) ring.insertBefore(canvas, kern); else ring.appendChild(canvas);

    // kleur die meeademt met de dagkleur, maar goud blijft
    var goud = GOUD.slice();
    try {
      var raw = getComputedStyle(ring).getPropertyValue('--klok-goud');
      if (raw) { var t = doc.createElement('span'); t.style.color = raw.trim(); t.style.display = 'none'; ring.appendChild(t); var rgb = getComputedStyle(t).color; ring.removeChild(t); var mm = rgb && rgb.match(/(\d+(?:\.\d+)?)/g); if (mm && mm.length >= 3) { var lv = [mm[0] / 255, mm[1] / 255, mm[2] / 255]; goud = [GOUD[0] * 0.78 + lv[0] * 0.22, GOUD[1] * 0.78 + lv[1] * 0.22, GOUD[2] * 0.78 + lv[2] * 0.22]; } }
    } catch (e) {}

    // meshes (eenmalig)
    var wielGroot = tandwiel(40, 0.06), wielMid = tandwiel(24, 0.055), wielKlein = tandwiel(16, 0.05);
    var onrust = onrustMesh(), veer = spiraalMesh(4), cass = caseMesh();
    function gpu(mesh) { return { p: buffer(gl, mesh.pos), n: buffer(gl, mesh.nor), c: mesh.n }; }
    var G = { groot: gpu(wielGroot), mid: gpu(wielMid), klein: gpu(wielKlein), onrust: gpu(onrust), veer: gpu(veer), cass: gpu(cass) };
    var quadBuf = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]));

    // het opengewerkte gaande werk (posities/stralen op eenheidsmaat, y omhoog):
    // secondewiel loopt exact 1 slag/min; de rest grijpt op tandverhouding in.
    var w4 = 2 * Math.PI / 60;                               // secondewiel (1/min)
    var w3 = -w4 * 40 / 24, w2 = -w3 * 24 / 16;              // meshende verhoudingen (tegengesteld)
    // een tangerend (meshend) gaande werk, laag in de plaat zodat de cijfers vrij staan
    var trein = [
      { g: G.groot, r: 0.20, x: -0.34, y: -0.40, w: w4, kleur: goud, z: 0.02 },
      { g: G.mid, r: 0.12, x: -0.031, y: -0.317, w: w3, kleur: STAAL, z: 0.06 },
      { g: G.klein, r: 0.085, x: 0.137, y: -0.435, w: w2, kleur: goud, z: 0.10 }
    ];
    var balans = { r: 0.26, x: 0.42, y: -0.38, z: 0.08 };

    var uMVP = gl.getUniformLocation(pMetaal, 'uMVP'), uModel = gl.getUniformLocation(pMetaal, 'uModel'), uLicht = gl.getUniformLocation(pMetaal, 'uLicht'), uKleur = gl.getUniformLocation(pMetaal, 'uKleur');
    var aP = gl.getAttribLocation(pMetaal, 'aPos'), aN = gl.getAttribLocation(pMetaal, 'aNor');
    var uGlans = gl.getUniformLocation(pGlas, 'uGlans'), aPG = gl.getAttribLocation(pGlas, 'aPos');
    var VP = ident();                                        // recht van voren (ortho): x,y blijven, cirkels blijven cirkels

    function maat() { var dpr = Math.min(2, root.devicePixelRatio || 1), w = Math.max(1, Math.round(ring.clientWidth * dpr)), h = Math.max(1, Math.round(ring.clientHeight * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } }
    try { new ResizeObserver(maat).observe(ring); } catch (e) {}
    maat();

    function tekenMesh(buf, model, kleur, licht) {
      var mvp = mul(VP, model);
      gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
      gl.uniformMatrix4fv(uModel, false, new Float32Array(model));
      gl.uniform3fv(uLicht, new Float32Array(licht)); gl.uniform3fv(uKleur, new Float32Array(kleur));
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.p); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.n); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, buf.c);
    }

    var t0 = Date.now();
    function teken() {
      maat();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
      gl.useProgram(pMetaal);
      var nu = (Date.now() - t0) / 1000, hoekL = nu * 0.7;
      var licht = [Math.cos(hoekL), Math.sin(hoekL), 0.85];
      // cassement
      tekenMesh(G.cass, mul(T(0, 0, -0.02), S(1.0)), goud, licht);
      // gaande werk
      for (var i = 0; i < trein.length; i++) {
        var g = trein[i];
        tekenMesh(g.g, mul(mul(T(g.x, g.y, g.z), Rz(nu * g.w)), S(g.r)), g.kleur, licht);
      }
      // onrust + haarveer (klopt op ~3 Hz, ingetogen amplitude)
      var slag = 0.9 * Math.sin(nu * 2 * Math.PI * 2.5);
      tekenMesh(G.veer, mul(mul(T(balans.x, balans.y, balans.z - 0.01), Rz(slag)), S(balans.r)), goud, licht);
      tekenMesh(G.onrust, mul(mul(T(balans.x, balans.y, balans.z), Rz(slag)), S(balans.r)), STAAL, licht);
      // saffierglas (additief, geen diepte)
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(pGlas);
      gl.uniform2f(uGlans, Math.cos(hoekL) * 0.40, Math.sin(hoekL) * 0.40);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(aPG); gl.vertexAttribPointer(aPG, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    (function lus() {
      if (canvas.offsetParent) { teken(); requestAnimationFrame(lus); }
      else setTimeout(lus, 600);
    })();
    void DONKERGOUD;
  }

  function alles() { try { doc.querySelectorAll('.rtg-ring').forEach(verrijk); } catch (e) {} }
  // de ring wordt door klok.js gebouwd (en op ~1200ms opgemeten); een paar
  // getimede rondes vangen dat efficient op, zonder blijvende observer
  function plan() { [60, 400, 1400].forEach(function (ms) { setTimeout(alles, ms); }); }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', plan);
  else plan();
})(typeof self !== 'undefined' ? self : this);
