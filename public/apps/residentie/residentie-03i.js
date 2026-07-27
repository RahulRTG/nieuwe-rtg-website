
  /* ---------- deel 3i: de vloerscenes ----------
     De dansvloer in het spotlicht en (verderop) de renbaan van het huis. */
  SCENES.dansen = {
    teken(c, W, H, m, beurt) {
      doek('#100C0A', '#070505');
      const cx = W / 2, fy = H * 0.6, rx = Math.min(W * 0.38, 210);
      c.fillStyle = 'rgba(240,200,110,0.09)'; // de lichtbundel van boven
      c.beginPath(); c.moveTo(cx - 30, 70); c.lineTo(cx - rx, fy); c.lineTo(cx + rx, fy); c.lineTo(cx + 30, 70); c.closePath(); c.fill();
      const g = c.createRadialGradient(cx, fy, 20, cx, fy, rx);
      g.addColorStop(0, '#3A3226'); g.addColorStop(1, '#16120D');
      c.fillStyle = g; c.beginPath(); c.ellipse(cx, fy, rx, rx * 0.42, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(216,184,88,0.55)'; c.lineWidth = 2;
      c.beginPath(); c.ellipse(cx, fy, rx, rx * 0.42, 0, 0, Math.PI * 2); c.stroke();
      const t2 = Date.now() / 800, dans = (x, k) => {
        const dy = Math.sin(t2 * 2 + x) * 6;
        c.fillStyle = k; c.beginPath(); c.ellipse(cx + x, fy - 34 + dy, 12, 26, x > 0 ? -0.08 : 0.08, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#D8B858'; c.beginPath(); c.ellipse(cx + x, fy - 56 + dy, 7, 4.6, 0, 0, Math.PI * 2); c.fill();
      };
      dans(-34, '#7F1634'); dans(34, '#1E1910');
      if (beurt) {
        const r = 30 + m / 100 * (rx - 40);
        c.strokeStyle = 'rgba(240,200,110,' + (0.25 + m / 100 * 0.6) + ')'; c.lineWidth = 2.4;
        c.beginPath(); c.ellipse(cx, fy, r, r * 0.42, 0, 0, Math.PI * 2); c.stroke();
      }
      kopScene('Het gemaskerde bal', 'dans samen op de maat, op het topje');
    },
    anim(c, W, H, a, t) {
      const cx = W / 2, fy = H * 0.6, rx = Math.min(W * 0.38, 210);
      c.strokeStyle = 'rgba(240,200,110,' + Math.max(0, 0.8 - t) + ')'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(cx, fy, 30 + t * rx, (30 + t * rx) * 0.42, 0, 0, Math.PI * 2); c.stroke();
      if (a.raak) {
        c.fillStyle = 'rgba(240,200,110,' + Math.max(0, 1 - t * 1.1) + ')';
        c.font = '400 ' + (16 + t * 10) + 'px serif'; c.textAlign = 'center';
        for (let i = 0; i < 5; i++) {
          const hk = t * 1.6 + i * Math.PI * 2 / 5, r = 40 + t * 90;
          c.fillText('✶', cx + Math.cos(hk) * r, fy - 40 + Math.sin(hk) * r * 0.45);
        }
      }
      puntZweef(cx, fy - 90, a, t);
    }
  };

  function kart(c, x, y, eigen, s) { // een kart van achteren, met gemaskerde coureur
    c.fillStyle = '#0A0908';
    c.fillRect(x - 11 * s, y - 3 * s, 5 * s, 8 * s); c.fillRect(x + 6 * s, y - 3 * s, 5 * s, 8 * s);
    c.fillStyle = eigen ? '#7F1634' : '#1E1910';
    c.fillRect(x - 8 * s, y - 8 * s, 16 * s, 11 * s);
    c.strokeStyle = 'rgba(216,184,88,0.8)'; c.lineWidth = 1.2;
    c.strokeRect(x - 8 * s, y - 8 * s, 16 * s, 11 * s);
    c.fillStyle = '#D8B858'; // de helm als masker
    c.beginPath(); c.ellipse(x, y - 12 * s, 5.5 * s, 4.5 * s, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = eigen ? '#D24A6E' : '#F2ECDC';
    c.fillRect(x - 6 * s, y - 20 * s, 12 * s, 2.2 * s); // het vleugeltje
  }

  SCENES.racen = {
    teken(c, W, H, m, beurt) {
      doek('#15120E', '#0A0806');
      const b = baan('#3A3630', '#242019', 'rgba(216,184,88,0.4)');
      for (let k = 0; k < 20; k++) { // kerbstones langs beide randen
        const v = k * 0.05;
        for (const zij of [-1.22, 1.22]) {
          const [x, y] = opBaan(b, v, zij);
          c.fillStyle = k % 2 ? '#7F1634' : '#EFE8D6';
          c.fillRect(x - 5, y - 3, 10, 5);
        }
      }
      const [fx, fy] = opBaan(b, 0.94, 0), fw = b.tw * 1.05; // de geblokte finish
      for (let i = 0; i < 10; i++) for (let j = 0; j < 2; j++) {
        c.fillStyle = (i + j) % 2 ? '#16130E' : '#EFE8D6';
        c.fillRect(fx - fw / 2 + i * fw / 10, fy - 6 + j * 5, fw / 10, 5);
      }
      c.setLineDash([8, 12]); c.strokeStyle = 'rgba(242,236,220,0.28)'; c.lineWidth = 2;
      const [m1x, m1y] = opBaan(b, 0, 0), [m2x, m2y] = opBaan(b, 0.92, 0);
      c.beginPath(); c.moveTo(m1x, m1y); c.lineTo(m2x, m2y); c.stroke(); c.setLineDash([]);
      const sp = (P && P.spelers) || [], tot = ((P && P.beurten) || 4) * 100;
      sp.forEach((s2, i) => {
        const zij = sp.length > 2 ? -0.75 + i * 0.5 : (i ? 0.45 : -0.45);
        const afs = s2.punten.reduce((a2, b2) => a2 + b2, 0);
        let v = 0.14 + Math.min(1, afs / tot) * 0.74;
        if (gas && beurt && s2.codenaam === S.ik) v += Math.min(0.03, gas.taps * 0.0012);
        const [kx, ky] = opBaan(b, v, zij);
        kart(c, kx, ky, s2.codenaam === S.ik, 1.15 - v * 0.55);
        c.fillStyle = '#EFE8D6'; c.font = '600 9px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(s2.codenaam, kx, ky + 16);
      });
      if (beurt) {
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        if (gas) {
          const rest = Math.max(0, (gas.tot - performance.now()) / 1000);
          c.fillText('tik, tik, tik -- nog ' + rest.toFixed(1) + ' s', W / 2, 226);
          c.font = '500 34px "Bodoni Moda", serif'; c.fillStyle = '#F2ECDC';
          c.fillText(String(gas.taps), W / 2, 268);
        } else c.fillText('druk op Geef gas en tik dan zo snel als u kunt', W / 2, 226);
      }
      kopScene('De Grand Prix van het huis', 'tik uzelf naar de finish');
    },
    anim(c, W, H, a, t) {
      const b = baanVak(), sp = (P && P.spelers) || [];
      const i = Math.max(0, sp.findIndex(s2 => s2.codenaam === a.wie));
      const zij = sp.length > 2 ? -0.75 + i * 0.5 : (i ? 0.45 : -0.45);
      const afs = sp[i] ? sp[i].punten.reduce((a2, b2) => a2 + b2, 0) : 0;
      const v = 0.14 + Math.min(1, afs / (((P && P.beurten) || 4) * 100)) * 0.74;
      const [x, y] = opBaan(b, v, zij);
      c.strokeStyle = 'rgba(216,184,88,' + Math.max(0, 0.7 - t) + ')'; c.lineWidth = 2;
      for (let k = 0; k < 3; k++) { // stofwolkjes achter de kart
        c.beginPath(); c.arc(x - 8 + k * 8, y + 10 + t * 26, 3 + t * 9, 0, Math.PI * 2); c.stroke();
      }
      if (a.raak) sceneVonken(x, y - 10, t, '#E3C878');
      puntZweef(x, y - 26, a, t);
    }
  };
