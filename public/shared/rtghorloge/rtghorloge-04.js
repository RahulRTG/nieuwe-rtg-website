    // het gaande werk: de middelpunten liggen op EXACT meshende afstand -- voor
    // elk grijpend paar geldt afstand = steekstraal_a + steekstraal_b (steekstraal
    // ~ 0,82 x de tip-straal r). Zo raken de tandkransen elkaar echt. Buren draaien
    // bovendien tegengesteld (omk), zodat het als een echt treintje ineengrijpt.
    // Keten: veer(barrel) -> midden -> derde -> vierde(seconde) -> anker -> balans.
    var trein = [
      { g: G.barrel, r: 0.25, x: -0.243, y: 0.243, kleur: HUISGOUD, bron: 'uur', omk: -1 },
      { g: G.midden, r: 0.17, x: 0.000, y: 0.000, kleur: STAAL, bron: 'midden', omk: 1 },
      { g: G.derde, r: 0.12, x: 0.205, y: -0.119, kleur: HUISGOUD, bron: 'derde', omk: 1 },
      { g: G.vierde, r: 0.135, x: 0.365, y: -0.253, kleur: STAAL, bron: 'vierde', omk: 1 },
      { g: G.escape, r: 0.075, x: 0.345, y: -0.425, kleur: HUISGOUD, bron: 'anker', omk: 1 }
    ];
    var balans = { r: 0.24, x: 0.0, y: -0.46 };
    // skelet-bruggen liggen langs de as tussen twee spillen (houden het werk vast)
    var bruggen = [
      { x: -0.12, y: 0.122, rot: -0.785, len: 0.42 },
      { x: 0.183, y: -0.126, rot: -0.606, len: 0.50 },
      { x: 0.190, y: -0.424, rot: -0.25, len: 0.34 }
    ];

    var uMVP = gl.getUniformLocation(pM, 'uMVP'), uModel = gl.getUniformLocation(pM, 'uModel'), uLicht = gl.getUniformLocation(pM, 'uLicht'), uKleur = gl.getUniformLocation(pM, 'uKleur');
    var aP = gl.getAttribLocation(pM, 'aPos'), aN = gl.getAttribLocation(pM, 'aNor');
    var uGlans = gl.getUniformLocation(pG, 'uGlans'), uR = gl.getUniformLocation(pG, 'uR'), aPG = gl.getAttribLocation(pG, 'aPos');

    function maat() { var dpr = Math.min(2, root.devicePixelRatio || 1), w = Math.max(1, Math.round(host.clientWidth * dpr)), h = Math.max(1, Math.round(host.clientHeight * dpr)); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; } }
    try { new ResizeObserver(maat).observe(host); } catch (e) {}
    maat();

    // camera: recht van voren met een heel lichte kanteling zodat het reliëf leeft
    var P = persp(3.05, 1, 0.1, 40), V = mul(T(0, 0.06, -3.2), Rx(-0.14));
    var VP = mul(P, V);

    function tekenMesh(buf, model, kleur, licht) {
      gl.uniformMatrix4fv(uMVP, false, new Float32Array(mul(VP, model)));
      gl.uniformMatrix4fv(uModel, false, new Float32Array(model));
      gl.uniform3fv(uLicht, new Float32Array(licht)); gl.uniform3fv(uKleur, new Float32Array(kleur));
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.p); gl.enableVertexAttribArray(aP); gl.vertexAttribPointer(aP, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.n); gl.enableVertexAttribArray(aN); gl.vertexAttribPointer(aN, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, buf.c);
    }

    function teken(d) {
      maat();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LESS); gl.disable(gl.BLEND);
      gl.useProgram(pM);
      var nu = d.getTime() / 1000, hoekL = nu * 0.5;
      var licht = [Math.cos(hoekL) * 0.8, 0.5 + Math.sin(hoekL) * 0.3, 1.0];
      var rad = W ? W.radHoeken(d) : { midden: 0, derde: 0, vierde: 0, anker: 0, uur: 0 };
      // de donkere wijzerplaat-holte achter het uurwerk (Porsche-diepte)
      tekenMesh(G.schijf, mul(T(0, -0.04, -0.30), S(1)), [0.115, 0.055, 0.07], licht);
      // skelet-bruggen (achter de raderen, in goud, laag)
      for (var bi = 0; bi < bruggen.length; bi++) { var br = bruggen[bi]; tekenMesh(G.brug, mul(mul(mul(T(br.x, br.y, -0.06), Rz(br.rot)), S(br.len)), S(1)), [0.55, 0.43, 0.18], licht); }
      // het gaande werk op de exacte hoeken
      for (var i = 0; i < trein.length; i++) {
        var g = trein[i], deg = (rad[g.bron] || 0) * (g.omk || 1);
        tekenMesh(g.g, mul(mul(T(g.x, g.y, 0.02 + i * 0.012), Rz(deg * Math.PI / 180)), S(g.r)), g.kleur, licht);
      }
      // de balans: exact 4 Hz (onrust), met de haarveer
      var slag = (W ? W.onrust(d, 150) : 0) * Math.PI / 180;
      tekenMesh(G.veer, mul(mul(T(balans.x, balans.y, 0.03), Rz(slag)), S(balans.r * 0.7)), HUISGOUD, licht);
      tekenMesh(G.onrust, mul(mul(T(balans.x, balans.y, 0.05), Rz(slag)), S(balans.r)), STAAL, licht);
      // saffierglas (additief, geen diepte)
      gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(pG);
      gl.uniform1f(uR, 0.80); gl.uniform2f(uGlans, Math.cos(hoekL) * 0.36, 0.30 + Math.sin(hoekL) * 0.30);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf); gl.enableVertexAttribArray(aPG); gl.vertexAttribPointer(aPG, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    return { canvas: canvas, teken: teken };
  }

  /* ================= samenstellen + laten lopen ================= */
  function maak(host) {
    if (!host || host.dataset.rtghKlaar === '1') return; host.dataset.rtghKlaar = '1';
    host.style.position = host.style.position || 'relative';
    var web = bouwWebGL(host);         // eerst (onderop), daarna de scherpe SVG erover
    var P = bouwPlaat(host, !!web);

    // de wijzers + datum + het 3D-werk op de exacte tijd zetten
    function stel(d) {
      var w = W ? W.wijzerHoeken(d) : { seconde: 0, minuut: 0, uur: 0 };
      P.gUur.setAttribute('transform', 'rotate(' + w.uur.toFixed(3) + ' 500 500)');
      P.gMin.setAttribute('transform', 'rotate(' + w.minuut.toFixed(3) + ' 500 500)');
      P.gSec.setAttribute('transform', 'rotate(' + w.seconde.toFixed(3) + ' 500 500)');
      P.dt.textContent = String(d.getDate());
      if (web) web.teken(d);
    }
    stel(new Date());

    if (RUSTIG) return;   // stilstaand maar volledig leesbaar
    (function lus() {
      if (host.offsetParent !== null || host.getClientRects().length) { stel(new Date()); requestAnimationFrame(lus); }
      else setTimeout(lus, 700);
    })();

    // zachte parallax-kanteling met de muis (3D-gevoel, ook zonder WebGL);
    // niets op grof aanwijzen (touch) of bij minder beweging
    if (!(root.matchMedia && matchMedia('(pointer: coarse)').matches)) {
      host.style.transformStyle = 'preserve-3d';
      host.addEventListener('pointermove', function (e) {
        var r = host.getBoundingClientRect(); if (!r.width) return;
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        host.style.transform = 'perspective(1400px) rotateX(' + (-py * 9).toFixed(2) + 'deg) rotateY(' + (px * 9).toFixed(2) + 'deg)';
      });
      host.addEventListener('pointerleave', function () { host.style.transform = 'perspective(1400px)'; });
    }
  }

  function alles() { try { doc.querySelectorAll('[data-rtg-horloge]').forEach(maak); } catch (e) {} }
  root.RTGHorloge = { maak: maak, alles: alles };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', alles);
  else alles();
})(typeof self !== 'undefined' ? self : this);
