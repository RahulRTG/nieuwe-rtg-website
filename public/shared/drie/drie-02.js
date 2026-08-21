/* de buffers van een mesh naar de GPU */
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
