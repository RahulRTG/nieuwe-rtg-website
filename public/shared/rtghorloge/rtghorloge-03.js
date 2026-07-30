    // ---- een heel lichte saffier-sheen bovenop alles ----
    svg.appendChild(E('circle', { cx: C, cy: C, r: 372, fill: 'url(#rtghGlas)', 'pointer-events': 'none' }));

    host.appendChild(svg);
    return { svg: svg, gUur: gUur, gMin: gMin, gSec: gSec, dt: dt };
  }

  /* ================= WebGL: het levende 3D-uurwerk + saffierglas ================= */
  function ident() { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function mul(a, b) { var o = new Array(16); for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]; return o; }
  function T(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  function S(s) { return [s, 0, 0, 0, 0, s, 0, 0, 0, 0, s, 0, 0, 0, 0, 1]; }
  function Rz(a) { var c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function Rx(a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function persp(f, asp, n, ver) { var nf = 1 / (n - ver); return [f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (ver + n) * nf, -1, 0, 0, 2 * ver * n * nf, 0]; }

  function M() { return { pos: [], nor: [] }; }
  function hoek(m, p, nn) { m.pos.push(p[0], p[1], p[2]); m.nor.push(nn[0], nn[1], nn[2]); }
  function tri(m, a, na, b, nb, c, nc) { hoek(m, a, na); hoek(m, b, nb); hoek(m, c, nc); }
  function quad(m, a, b, c, d, nn) { tri(m, a, nn, b, nn, c, nn); tri(m, a, nn, c, nn, d, nn); }
  function klaar(m) { return { pos: new Float32Array(m.pos), nor: new Float32Array(m.nor), n: m.pos.length / 3 }; }

  // een opengewerkt tandwiel op eenheidsmaat (tip-straal 1): geslepen tanden,
  // open spaken en een naaf met gat -> skelet
  function tandwiel(tanden, dik, spaken) {
    var m = M(), rTip = 1.0, rRoot = 0.80, rIn = 0.70, rHub = 0.26, rGat = 0.12;
    spaken = spaken || 5;
    var sB = Math.sin(0.85), cB = Math.cos(0.85);
    function pol(r, a, z) { return [r * Math.cos(a), r * Math.sin(a), z]; }
    // band rIn..rRoot boven
    var seg = tanden * 3;
    for (var i = 0; i < seg; i++) { var a0 = i / seg * 6.2831853, a1 = (i + 1) / seg * 6.2831853; quad(m, pol(rIn, a0, dik), pol(rRoot, a0, dik), pol(rRoot, a1, dik), pol(rIn, a1, dik), [0, 0, 1]); }
    // tanden
    for (var t = 0; t < tanden; t++) {
      var b = t / tanden * 6.2831853, w = 6.2831853 / tanden;
      var aR0 = b + w * 0.12, aT0 = b + w * 0.30, aT1 = b + w * 0.70, aR1 = b + w * 0.88;
      var nO0 = [Math.cos((aT0 + aR0) / 2) * sB, Math.sin((aT0 + aR0) / 2) * sB, cB];
      var nO1 = [Math.cos((aT1 + aR1) / 2) * sB, Math.sin((aT1 + aR1) / 2) * sB, cB];
      var nT = [Math.cos((aT0 + aT1) / 2) * sB * 0.5, Math.sin((aT0 + aT1) / 2) * sB * 0.5, Math.sqrt(1 - sB * sB * 0.25)];
      tri(m, pol(rRoot, aR0, dik), nO0, pol(rTip, aT0, dik * 0.55), nT, pol(rTip, aT1, dik * 0.55), nT);
      tri(m, pol(rRoot, aR0, dik), nO0, pol(rTip, aT1, dik * 0.55), nT, pol(rRoot, aR1, dik), nO1);
      quad(m, pol(rTip, aT0, dik * 0.55), pol(rTip, aT0, -dik), pol(rTip, aT1, -dik), pol(rTip, aT1, dik * 0.55), [Math.cos((aT0 + aT1) / 2), Math.sin((aT0 + aT1) / 2), 0]);
    }
    // spaken
    for (var sp = 0; sp < spaken; sp++) {
      var sa = sp / spaken * 6.2831853, c = Math.cos(sa), si = Math.sin(sa), px = -si, py = c, hw = 0.11;
      (function () { function pt(r, o) { return [r * c + px * o, r * si + py * o, dik]; } quad(m, pt(rHub, -hw), pt(rIn, -hw), pt(rIn, hw), pt(rHub, hw), [0, 0, 1]); })();
    }
    // naaf
    for (var j = 0; j < 36; j++) {
      var b0 = j / 36 * 6.2831853, b1 = (j + 1) / 36 * 6.2831853;
      quad(m, pol(rGat, b0, dik), pol(rHub, b0, dik), pol(rHub, b1, dik), pol(rGat, b1, dik), [0, 0, 1]);
      quad(m, pol(rGat, b0, dik), pol(rGat, b0, -dik), pol(rGat, b1, -dik), pol(rGat, b1, dik), [-Math.cos(b0), -Math.sin(b0), 0]);
    }
    return klaar(m);
  }
  // gladde geslepen ring (onrust/cassement-detail)
  function ringMesh(rIn, dik, seg) {
    var m = M(); seg = seg || 120; var sB = Math.sin(0.85), cB = Math.cos(0.85), rMid = (rIn + 1) / 2;
    function pol(r, a, z) { return [r * Math.cos(a), r * Math.sin(a), z]; }
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * 6.2831853, a1 = (i + 1) / seg * 6.2831853;
      var nO0 = [Math.cos(a0) * sB, Math.sin(a0) * sB, cB], nO1 = [Math.cos(a1) * sB, Math.sin(a1) * sB, cB];
      var nI0 = [-Math.cos(a0) * sB, -Math.sin(a0) * sB, cB], nI1 = [-Math.cos(a1) * sB, -Math.sin(a1) * sB, cB];
      tri(m, pol(1, a0, 0), nO0, pol(rMid, a0, dik), [0, 0, 1], pol(rMid, a1, dik), [0, 0, 1]);
      tri(m, pol(1, a0, 0), nO0, pol(rMid, a1, dik), [0, 0, 1], pol(1, a1, 0), nO1);
      tri(m, pol(rMid, a0, dik), [0, 0, 1], pol(rIn, a0, 0), nI0, pol(rIn, a1, 0), nI1);
      tri(m, pol(rMid, a0, dik), [0, 0, 1], pol(rIn, a1, 0), nI1, pol(rMid, a1, dik), [0, 0, 1]);
    }
    return klaar(m);
  }
  function onrustMesh() {
    var ring = ringMesh(0.82, 0.05, 96), mm = { pos: Array.prototype.slice.call(ring.pos), nor: Array.prototype.slice.call(ring.nor) };
    for (var s = 0; s < 3; s++) { var sa = s / 3 * 6.2831853, c = Math.cos(sa), si = Math.sin(sa), px = -si, py = c, hw = 0.06; (function () { function pt(r, o) { return [r * c + px * o, r * si + py * o, 0.03]; } quad(mm, pt(0, -hw), pt(0.88, -hw), pt(0.88, hw), pt(0, hw), [0, 0, 1]); })(); }
    return klaar(mm);
  }
  function spiraalMesh(winding) {
    var m = M(), seg = winding * 44, w = 0.014;
    function pt(k) { var a = k / 44 * 6.2831853, r = 0.06 + 0.022 * (k / 44); return [r * Math.cos(a), r * Math.sin(a)]; }
    for (var i = 0; i < seg; i++) { var p0 = pt(i), p1 = pt(i + 1), dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w, ny = dx / l * w; quad(m, [p0[0] - nx, p0[1] - ny, 0.02], [p0[0] + nx, p0[1] + ny, 0.02], [p1[0] + nx, p1[1] + ny, 0.02], [p1[0] - nx, p1[1] - ny, 0.02], [0, 0, 1]); }
    return klaar(m);
  }
  // een vlakke, licht bolle schijf: de donkere wijzerplaat-holte achter het werk
  function schijfMesh(r, seg) {
    var m = M(); seg = seg || 120;
    for (var i = 0; i < seg; i++) {
      var a0 = i / seg * 6.2831853, a1 = (i + 1) / seg * 6.2831853;
      tri(m, [0, 0, 0.06], [0, 0, 1], [r * Math.cos(a0), r * Math.sin(a0), 0], [Math.cos(a0) * 0.3, Math.sin(a0) * 0.3, 0.95], [r * Math.cos(a1), r * Math.sin(a1), 0], [Math.cos(a1) * 0.3, Math.sin(a1) * 0.3, 0.95]);
    }
    return klaar(m);
  }
  // een geslepen skelet-brug (balk met afgeschuinde bovenkant)
  function brugMesh(len, br, dik) {
    var m = M(), hx = len / 2, hy = br / 2, top = [0, 0, 1];
    quad(m, [-hx, -hy * 0.6, dik], [hx, -hy * 0.6, dik], [hx, hy * 0.6, dik], [-hx, hy * 0.6, dik], top);
    quad(m, [-hx, -hy, 0], [hx, -hy, 0], [hx, -hy * 0.6, dik], [-hx, -hy * 0.6, dik], [0, -0.7, 0.7]);
    quad(m, [-hx, hy * 0.6, dik], [hx, hy * 0.6, dik], [hx, hy, 0], [-hx, hy, 0], [0, 0.7, 0.7]);
    return klaar(m);
  }

  var VERT = 'attribute vec3 aPos;attribute vec3 aNor;uniform mat4 uMVP;uniform mat4 uModel;varying vec3 vN;varying vec3 vP;' +
    'void main(){vN=mat3(uModel)*aNor;vec4 wp=uModel*vec4(aPos,1.0);vP=wp.xyz;gl_Position=uMVP*vec4(aPos,1.0);}';
  var FRAG = 'precision mediump float;varying vec3 vN;varying vec3 vP;uniform vec3 uLicht;uniform vec3 uKleur;' +
    'void main(){vec3 n=normalize(vN);vec3 l=normalize(uLicht);float d=max(dot(n,l),0.0);' +
    'vec3 v=normalize(vec3(0.0,0.0,3.2)-vP);vec3 h=normalize(l+v);float sp=pow(max(dot(n,h),0.0),36.0);' +
    'vec3 k=uKleur*(0.22+0.72*d)+vec3(1.0,0.95,0.84)*sp*0.5;gl_FragColor=vec4(k,1.0);}';
  var VGLAS = 'attribute vec2 aPos;varying vec2 vP;void main(){vP=aPos;gl_Position=vec4(aPos,0.0,1.0);}';
  var FGLAS = 'precision mediump float;varying vec2 vP;uniform vec2 uGlans;uniform float uR;' +
    'void main(){float rr=length(vP);if(rr>uR)discard;' +
    'float streep=smoothstep(0.62,0.0,distance(vP,uGlans))*0.10;' +
    'float rand=smoothstep(uR,uR-0.12,rr)*0.08;float koepel=smoothstep(uR,0.15,rr)*0.035;' +
    'vec3 k=vec3(0.80,0.89,1.0)*streep+vec3(0.90,0.95,1.0)*(rand+koepel);' +
    'gl_FragColor=vec4(k,streep+rand+koepel);}';
  function shader(gl, t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return gl.getShaderParameter(o, gl.COMPILE_STATUS) ? o : null; }
  function prog(gl, v, f) { var a = shader(gl, gl.VERTEX_SHADER, v), b = shader(gl, gl.FRAGMENT_SHADER, f); if (!a || !b) return null; var p = gl.createProgram(); gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p); return gl.getProgramParameter(p, gl.LINK_STATUS) ? p : null; }
  function buffer(gl, arr) { var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); return b; }

  function bouwWebGL(host) {
    if (RUSTIG) return null;
    var canvas = doc.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    var gl = null;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) return null;
    var pM = prog(gl, VERT, FRAG), pG = prog(gl, VGLAS, FGLAS);
    if (!pM || !pG) return null;
    // het canvas onder de wijzerplaat-SVG (die tekent er het glas/holte overheen)
    host.insertBefore(canvas, host.firstChild);

    var G = {
      schijf: gpu(schijfMesh(0.94)),
      barrel: gpu(tandwiel(60, 0.05, 6)), midden: gpu(tandwiel(40, 0.05, 5)),
      derde: gpu(tandwiel(24, 0.045, 4)), vierde: gpu(tandwiel(21, 0.045, 4)),
      escape: gpu(tandwiel(15, 0.04, 3)), onrust: gpu(onrustMesh()), veer: gpu(spiraalMesh(5)),
      brug: gpu(brugMesh(1.0, 0.14, 0.05))
    };
    function gpu(mesh) { return { p: buffer(gl, mesh.pos), n: buffer(gl, mesh.nor), c: mesh.n }; }
    var quadBuf = buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]));

