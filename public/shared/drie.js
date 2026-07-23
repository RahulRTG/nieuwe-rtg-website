/* Drie: de kleine, huiseigen 3D-laag van RTG. Zero-dependency WebGL, in de
   huisstijl (zwart met bordeaux en gedempt goud). Geen three.js, geen externe
   library, geen extern beeld: een compacte motor met precies genoeg om dingen
   te laten leven -- een grond met een fijn rasterlicht, geextrudeerde blokken,
   een oplichtend lint langs een route, en zwevende pinnen.

   Twee lagen:
   1. Een pure reken- en meshkern (mat4/vec3 + doos/vlak/lint/pin). Die draait
      ook in Node en is los te toetsen (test/drie.test.js) -- geen canvas nodig.
   2. Een browser-renderer op WebGL: 1 programma, weinig draws (grond, blokken,
      lint, pinnen), gerichte belichting + mist + een emissie-term voor de gloed.
      Valt stil terug (geeft null) als er geen WebGL is, zodat de app een 2D-
      kaart kan tonen in plaats van een zwart vlak.

   Alles blijft op het toestel; er gaat niets naar buiten. */
(function (root) {
  'use strict';

  /* ===================== 1. pure kern (ook in Node) ===================== */

  // vec3-helpers (gewone arrays van 3)
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function kruis(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function lengte(a) { return Math.hypot(a[0], a[1], a[2]); }
  function normaliseer(a) { var l = lengte(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  // mat4, kolom-hoofd (zoals OpenGL/gl-matrix)
  var M = {
    identiteit: function () { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
    vermenigvuldig: function (a, b) {
      var o = new Array(16);
      for (var c = 0; c < 4; c++) {
        for (var r = 0; r < 4; r++) {
          o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
        }
      }
      return o;
    },
    perspectief: function (fovy, aspect, near, far) {
      var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
      return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
    },
    kijkNaar: function (oog, doel, op) {
      var z = normaliseer(sub(oog, doel));
      var x = normaliseer(kruis(op, z));
      var y = kruis(z, x);
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
        -dot(x, oog), -dot(y, oog), -dot(z, oog), 1];
    },
    translatie: function (x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; },
    schaal: function (x, y, z) { return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]; },
    rotatieY: function (a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
    rotatieX: function (a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  };

  /* ---- meshbouwers: geven { posities, normalen, kleuren, indices } ----
     posities/normalen/kleuren zijn platte getallenrijen (x,y,z / r,g,b). */
  function leegMesh() { return { posities: [], normalen: [], kleuren: [], indices: [] }; }
  function voegVlakToe(mesh, hoeken, normaal, kleur) {
    var basis = mesh.posities.length / 3;
    for (var i = 0; i < 4; i++) {
      mesh.posities.push(hoeken[i][0], hoeken[i][1], hoeken[i][2]);
      mesh.normalen.push(normaal[0], normaal[1], normaal[2]);
      mesh.kleuren.push(kleur[0], kleur[1], kleur[2]);
    }
    mesh.indices.push(basis, basis + 1, basis + 2, basis, basis + 2, basis + 3);
  }

  // een blok (gebouw): breedte(x) hoogte(y) diepte(z), staand op y=0, midden op (cx,cz)
  function doos(mesh, cx, cz, w, h, d, kleur, dak) {
    var x0 = cx - w / 2, x1 = cx + w / 2, z0 = cz - d / 2, z1 = cz + d / 2, y0 = 0, y1 = h;
    dak = dak || kleur;
    voegVlakToe(mesh, [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]], [0, 1, 0], dak);       // dak
    voegVlakToe(mesh, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], kleur);     // voor
    voegVlakToe(mesh, [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]], [0, 0, -1], kleur);    // achter
    voegVlakToe(mesh, [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]], [1, 0, 0], kleur);     // rechts
    voegVlakToe(mesh, [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], kleur);    // links
    return mesh;
  }

  // een groot grondvlak (op y=0), gecentreerd; het raster tekent de fragment-shader
  function vlak(halveMaat, kleur) {
    var m = leegMesh();
    voegVlakToe(m, [[-halveMaat, 0, halveMaat], [halveMaat, 0, halveMaat], [halveMaat, 0, -halveMaat], [-halveMaat, 0, -halveMaat]], [0, 1, 0], kleur);
    return m;
  }

  // een lint langs een polyline op grondhoogte y (licht boven de grond tegen z-fighting)
  function lint(punten, breedte, kleur, y) {
    var m = leegMesh(); if (!punten || punten.length < 2) return m;
    y = y == null ? 0.6 : y; var hb = breedte / 2;
    for (var i = 0; i < punten.length - 1; i++) {
      var a = punten[i], b = punten[i + 1];
      var dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
      var nx = -dz / l * hb, nz = dx / l * hb;
      var p0 = [a[0] - nx, y, a[1] - nz], p1 = [a[0] + nx, y, a[1] + nz];
      var p2 = [b[0] + nx, y, b[1] + nz], p3 = [b[0] - nx, y, b[1] - nz];
      voegVlakToe(m, [p0, p1, p2, p3], [0, 1, 0], kleur);
    }
    return m;
  }

  // een pin: een smal prisma met een ruit erboven, op (cx,cz), hoogte h
  function pin(mesh, cx, cz, h, kleur) {
    doos(mesh, cx, cz, 0.5, h, 0.5, kleur);           // de steel
    var top = h, s = 1.4, basis = mesh.posities.length / 3, y = top + s / 2;
    // een octaeder-ruit als kop
    var p = [[cx, y + s, cz], [cx + s, y, cz], [cx, y, cz + s], [cx - s, y, cz], [cx, y, cz - s], [cx, y - s, cz]];
    function tri(a, b, c) {
      var n = normaliseer(kruis(sub(p[b], p[a]), sub(p[c], p[a])));
      var o = mesh.posities.length / 3;
      [a, b, c].forEach(function (k) { mesh.posities.push(p[k][0], p[k][1], p[k][2]); mesh.normalen.push(n[0], n[1], n[2]); mesh.kleuren.push(kleur[0], kleur[1], kleur[2]); });
      mesh.indices.push(o, o + 1, o + 2);
    }
    tri(0, 1, 2); tri(0, 2, 3); tri(0, 3, 4); tri(0, 4, 1);
    tri(5, 2, 1); tri(5, 3, 2); tri(5, 4, 3); tri(5, 1, 4);
    void basis;
    return mesh;
  }

  var Drie = {
    // reken
    sub: sub, kruis: kruis, dot: dot, lengte: lengte, normaliseer: normaliseer, mat4: M,
    // mesh
    leegMesh: leegMesh, doos: doos, vlak: vlak, lint: lint, pin: pin
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = Drie; return; }
  root.Drie = Drie;
  if (!root.document) return;

  /* ===================== 2. browser-renderer (WebGL) ===================== */

  var VERT =
    'attribute vec3 pos; attribute vec3 nor; attribute vec3 kol;' +
    'uniform mat4 uModel; uniform mat4 uVP;' +
    'varying vec3 vNor; varying vec3 vKol; varying vec3 vWereld;' +
    'void main(){ vec4 w = uModel * vec4(pos,1.0); vWereld = w.xyz;' +
    ' vNor = mat3(uModel) * nor; vKol = kol; gl_Position = uVP * w; }';
  var FRAG =
    'precision mediump float;' +
    'varying vec3 vNor; varying vec3 vKol; varying vec3 vWereld;' +
    'uniform vec3 uLicht; uniform float uEmissie; uniform float uRaster;' +
    'uniform vec3 uRasterKleur; uniform vec3 uMist; uniform vec3 uOog;' +
    'void main(){' +
    ' vec3 n = normalize(vNor);' +
    ' float diff = max(dot(n, normalize(uLicht)), 0.0);' +
    ' vec3 kleur = vKol * (0.34 + 0.66 * diff);' +
    ' if(uRaster > 0.5){' +      // fijn rasterlicht op de grond
    '   vec2 g = abs(fract(vWereld.xz / 8.0 - 0.5) - 0.5) / fwidth(vWereld.xz / 8.0);' +
    '   float lijn = 1.0 - min(min(g.x, g.y), 1.0);' +
    '   kleur = mix(kleur, uRasterKleur, lijn * 0.5);' +
    '   vec2 g2 = abs(fract(vWereld.xz / 48.0 - 0.5) - 0.5) / fwidth(vWereld.xz / 48.0);' +
    '   float lijn2 = 1.0 - min(min(g2.x, g2.y), 1.0);' +
    '   kleur = mix(kleur, uRasterKleur, lijn2 * 0.5);' +
    ' }' +
    ' kleur = mix(kleur, kleur * 1.8 + 0.15, uEmissie);' +
    ' float d = length(vWereld - uOog);' +
    ' float mist = clamp((d - 120.0) / 420.0, 0.0, 0.85);' +
    ' kleur = mix(kleur, uMist, mist);' +
    ' gl_FragColor = vec4(kleur, 1.0); }';

  function compileer(gl, type, bron) {
    var s = gl.createShader(type); gl.shaderSource(s, bron); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { return null; }
    return s;
  }

  function maakRenderer(canvas, opties) {
    opties = opties || {};
    var gl = null;
    try { gl = canvas.getContext('webgl', { antialias: true, alpha: false }) || canvas.getContext('experimental-webgl'); } catch (e) { gl = null; }
    if (!gl) return null;
    gl.getExtension('OES_standard_derivatives'); // voor fwidth (WebGL1)
    var vs = compileer(gl, gl.VERTEX_SHADER, VERT);
    var fs = compileer(gl, gl.FRAGMENT_SHADER, '#extension GL_OES_standard_derivatives : enable\n' + FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var loc = {
      pos: gl.getAttribLocation(prog, 'pos'), nor: gl.getAttribLocation(prog, 'nor'), kol: gl.getAttribLocation(prog, 'kol'),
      uModel: gl.getUniformLocation(prog, 'uModel'), uVP: gl.getUniformLocation(prog, 'uVP'),
      uLicht: gl.getUniformLocation(prog, 'uLicht'), uEmissie: gl.getUniformLocation(prog, 'uEmissie'),
      uRaster: gl.getUniformLocation(prog, 'uRaster'), uRasterKleur: gl.getUniformLocation(prog, 'uRasterKleur'),
      uMist: gl.getUniformLocation(prog, 'uMist'), uOog: gl.getUniformLocation(prog, 'uOog')
    };
    gl.enable(gl.DEPTH_TEST);
    var mist = opties.mist || [0.047, 0.047, 0.043];
    var raster = opties.raster || [0.79, 0.63, 0.29];
    var licht = normaliseer(opties.licht || [0.5, 1.0, 0.35]);

    function bufferVan(mesh) {
      var b = { pos: gl.createBuffer(), nor: gl.createBuffer(), kol: gl.createBuffer(), idx: gl.createBuffer(), n: mesh.indices.length };
      gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.posities), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.nor); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normalen), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.kol); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.kleuren), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
      return b;
    }
    var lagen = []; // { buffer, model, emissie, raster }
    function voegToe(mesh, cfg) {
      cfg = cfg || {};
      var laag = { buffer: bufferVan(mesh), model: cfg.model || M.identiteit(), emissie: cfg.emissie || 0, raster: cfg.raster ? 1 : 0, _mesh: null };
      lagen.push(laag); return laag;
    }
    function vervang(laag, mesh) { // hergebruik een laag met nieuwe geometrie
      var b = laag.buffer;
      gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.posities), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.nor); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.normalen), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.kol); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh.kleuren), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(mesh.indices), gl.STATIC_DRAW);
      b.n = mesh.indices.length;
    }
    function wis() { lagen.forEach(function (l) { var b = l.buffer; gl.deleteBuffer(b.pos); gl.deleteBuffer(b.nor); gl.deleteBuffer(b.kol); gl.deleteBuffer(b.idx); }); lagen = []; }

    function binden(b) {
      gl.bindBuffer(gl.ARRAY_BUFFER, b.pos); gl.enableVertexAttribArray(loc.pos); gl.vertexAttribPointer(loc.pos, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.nor); gl.enableVertexAttribArray(loc.nor); gl.vertexAttribPointer(loc.nor, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, b.kol); gl.enableVertexAttribArray(loc.kol); gl.vertexAttribPointer(loc.kol, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.idx);
    }

    function teken(oog, doel, extra) {
      extra = extra || {};
      var w = canvas.width, h = canvas.height;
      gl.viewport(0, 0, w, h);
      var lucht = extra.lucht || mist;
      gl.clearColor(lucht[0], lucht[1], lucht[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      var proj = M.perspectief((extra.fov || 52) * Math.PI / 180, w / h || 1, 1, 1400);
      var view = M.kijkNaar(oog, doel, [0, 1, 0]);
      var vp = M.vermenigvuldig(proj, view);
      gl.uniformMatrix4fv(loc.uVP, false, new Float32Array(vp));
      gl.uniform3fv(loc.uLicht, new Float32Array(extra.licht || licht));
      gl.uniform3fv(loc.uMist, new Float32Array(lucht));
      gl.uniform3fv(loc.uRasterKleur, new Float32Array(raster));
      gl.uniform3fv(loc.uOog, new Float32Array(oog));
      for (var i = 0; i < lagen.length; i++) {
        var l = lagen[i];
        gl.uniformMatrix4fv(loc.uModel, false, new Float32Array(l.model));
        gl.uniform1f(loc.uEmissie, l.emissie);
        gl.uniform1f(loc.uRaster, l.raster);
        binden(l.buffer);
        gl.drawElements(gl.TRIANGLES, l.buffer.n, gl.UNSIGNED_SHORT, 0);
      }
    }

    return { gl: gl, voegToe: voegToe, vervang: vervang, wis: wis, teken: teken };
  }

  Drie.maakRenderer = maakRenderer;
})(typeof self !== 'undefined' ? self : this);
