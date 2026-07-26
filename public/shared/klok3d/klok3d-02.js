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
