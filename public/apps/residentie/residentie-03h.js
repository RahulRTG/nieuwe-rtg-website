
  /* ---------- deel 3h: de zaalscenes ----------
     Darts, biljart, zwemmen en dansen: het bord aan de muur, het laken van
     boven, de banen van het badhuis en de dansvloer in het spotlicht. */
  SCENES.darts = {
    teken(c, W, H, m, beurt) {
      doek('#171310', '#0B0908');
      const cx = W / 2, cy = H * 0.36, r = Math.min(W * 0.34, 150);
      c.fillStyle = '#241E15';
      c.beginPath(); c.arc(cx, cy, r + 12, 0, Math.PI * 2); c.fill();
      for (let i = 0; i < 20; i++) {
        c.fillStyle = i % 2 ? '#EFE8D6' : '#1E1910';
        c.beginPath(); c.moveTo(cx, cy);
        c.arc(cx, cy, r, i * Math.PI / 10, (i + 1) * Math.PI / 10); c.closePath(); c.fill();
      }
      c.strokeStyle = '#7F1634'; c.lineWidth = 5; // dubbel- en tripelring
      c.beginPath(); c.arc(cx, cy, r * 0.95, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(cx, cy, r * 0.58, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#D8B858'; c.beginPath(); c.arc(cx, cy, r * 0.11, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#7F1634'; c.beginPath(); c.arc(cx, cy, r * 0.05, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(216,184,88,0.8)'; c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, r + 12, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(216,184,88,0.5)'; // de werplijn (oche)
      c.beginPath(); c.moveTo(W * 0.3, H - 180); c.lineTo(W * 0.7, H - 180); c.stroke();
      if (beurt) {
        const rr = r * (100 - m) / 100 * 0.92, hk = performance.now() / 560;
        kruis(cx + Math.cos(hk) * rr, cy + Math.sin(hk) * rr, 'rgba(242,236,220,0.85)');
      }
      kopScene('Darts', 'gooi op het topje voor de roos');
    },
    anim(c, W, H, a, t) {
      const cx = W / 2, cy = H * 0.36, r = Math.min(W * 0.34, 150);
      const rr = r * Math.max(0, 60 - (a.punt || 0)) / 60 * 0.9, ha = a.kracht / 100 * Math.PI * 2;
      const lx = cx + Math.cos(ha) * rr, ly = cy + Math.sin(ha) * rr;
      const tt = Math.min(1, t * 2.4);
      const x = lx + (1 - tt) * (a.eigen ? 90 : -90), y = ly + (1 - tt) * 300;
      c.strokeStyle = '#D8B858'; c.lineWidth = 2.4;
      c.beginPath(); c.moveTo(x, y + 20 * (1 - tt * 0.5)); c.lineTo(x, y); c.stroke();
      c.fillStyle = '#D24A6E';
      c.beginPath(); c.moveTo(x, y + 22 * (1 - tt * 0.5)); c.lineTo(x - 3.4, y + 29 * (1 - tt * 0.5) + 3); c.lineTo(x + 3.4, y + 29 * (1 - tt * 0.5) + 3); c.closePath(); c.fill();
      if (tt >= 1) { if (a.raak) sceneVonken(lx, ly, (t - 0.42) * 2, '#E3C878'); puntZweef(lx, ly - 16, a, Math.max(0, t - 0.38)); }
    }
  };

  SCENES.biljart = {
    vak(W, H) { const tw = Math.min(W * 0.84, 560), th = tw * 0.52;
      return { tx: (W - tw) / 2, ty: H * 0.24, tw, th }; },
    teken(c, W, H, m, beurt) {
      doek('#161310', '#0B0908');
      const { tx, ty, tw, th } = this.vak(W, H);
      c.fillStyle = '#4A2F16'; c.fillRect(tx - 16, ty - 16, tw + 32, th + 32);
      c.fillStyle = '#2E5A3E'; c.fillRect(tx, ty, tw, th);
      c.strokeStyle = 'rgba(12,10,7,0.5)'; c.lineWidth = 2; c.strokeRect(tx, ty, tw, th);
      c.fillStyle = '#D8B858'; // de diamanten op de band
      for (let i = 1; i < 4; i++) { c.beginPath(); c.arc(tx + tw * i / 4, ty - 8, 2.2, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(tx + tw * i / 4, ty + th + 8, 2.2, 0, Math.PI * 2); c.fill(); }
      const b = this.ballen(tx, ty, tw, th);
      if (beurt) {
        // de lijn wijst pas op het topje van de meter precies naar de rode
        const naarRood = Math.atan2(b.ry - b.wy, b.rx - b.wx);
        const hk = naarRood + (100 - m) / 100 * Math.PI;
        c.setLineDash([5, 7]); c.strokeStyle = 'rgba(242,236,220,0.75)'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(b.wx, b.wy); c.lineTo(b.wx + Math.cos(hk) * tw * 0.32, b.wy + Math.sin(hk) * tw * 0.32); c.stroke();
        c.setLineDash([]);
      }
      const bal = (x, y, k) => { c.fillStyle = k; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x - 2.5, y - 2.5, 2.2, 0, Math.PI * 2); c.fill(); };
      bal(b.wx, b.wy, '#F2ECDC'); bal(b.gx, b.gy, '#C9A94B'); bal(b.rx, b.ry, '#9E1C40');
      kopScene('Biljart', 'stoot als de lijn de rode raakt');
    },
    ballen(tx, ty, tw, th) {
      return { wx: tx + tw * 0.28, wy: ty + th * 0.62, gx: tx + tw * 0.24, gy: ty + th * 0.3,
        rx: tx + tw * 0.72, ry: ty + th * 0.46 };
    },
    anim(c, W, H, a, t) {
      const { tx, ty, tw, th } = this.vak(W, H), b = this.ballen(tx, ty, tw, th);
      const tt = 1 - (1 - t) * (1 - t);
      const doelx = a.raak ? b.rx : b.rx + tw * 0.12, doely = a.raak ? b.ry : ty + th * 0.9;
      const f = Math.min(1, tt * 1.6);
      const x = b.wx + (doelx - b.wx) * f, y = b.wy + (doely - b.wy) * f;
      c.fillStyle = '#F2ECDC'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
      if (a.raak && f >= 1) { // de rode kaatst weg over het laken
        const g = (tt - 0.62) / 0.38;
        if (g > 0) { c.fillStyle = '#9E1C40';
          c.beginPath(); c.arc(b.rx + g * tw * 0.16, b.ry - g * th * 0.3, 8, 0, Math.PI * 2); c.fill();
          sceneVonken(b.rx, b.ry, g, '#E3C878'); }
      }
      puntZweef(x, y - 20, a, t);
    }
  };

  SCENES.zwemmen = {
    vak(W, H) { const pw = Math.min(W * 0.78, 480);
      return { px: (W - pw) / 2, py: 170, pw, ph: H - 470 }; },
    teken(c, W, H, m, beurt) {
      doek('#0E1A1E', '#080F13');
      const { px, py, pw, ph } = this.vak(W, H);
      const g = c.createLinearGradient(0, py, 0, py + ph);
      g.addColorStop(0, 'rgba(48,104,130,0.95)'); g.addColorStop(1, 'rgba(24,58,76,0.95)');
      c.fillStyle = g; c.fillRect(px, py, pw, ph);
      c.strokeStyle = 'rgba(216,184,88,0.7)'; c.lineWidth = 3; c.strokeRect(px, py, pw, ph);
      const sp = (P && P.spelers) || [], n = Math.max(2, sp.length);
      c.setLineDash([4, 10]); c.strokeStyle = 'rgba(242,236,220,0.4)'; c.lineWidth = 1.4;
      for (let i = 1; i < n; i++) { c.beginPath(); c.moveTo(px + pw * i / n, py); c.lineTo(px + pw * i / n, py + ph); c.stroke(); }
      c.setLineDash([]);
      const t2 = Date.now() / 600;
      // wie sneller zwemt (minder seconden) ligt zichtbaar iets voor
      const sommen = sp.map(s2 => s2.punten.reduce((a2, b2) => a2 + b2, 0));
      const gem = sommen.reduce((a2, b2) => a2 + b2, 0) / (sommen.length || 1);
      sp.forEach((s2, i) => {
        const lx = px + pw * (i + 0.5) / n;
        const voor = Math.max(-0.05, Math.min(0.05, (gem - sommen[i]) * 0.01));
        const v = Math.max(0, Math.min(1, s2.punten.length / ((P && P.beurten) || 4) + voor));
        const y = py + ph - 26 - v * (ph - 56);
        c.strokeStyle = 'rgba(242,236,220,0.5)'; c.lineWidth = 1.2;
        c.beginPath(); c.ellipse(lx, y, 13 + Math.sin(t2 + i) * 2, 6, 0, 0, Math.PI * 2); c.stroke();
        c.fillStyle = s2.codenaam === S.ik ? '#7F1634' : '#1E1910';
        c.beginPath(); c.arc(lx, y, 7.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#D8B858'; c.lineWidth = 1.4; c.beginPath(); c.arc(lx, y, 7.5, 0, Math.PI * 2); c.stroke();
        c.fillStyle = '#EFE8D6'; c.font = '600 10px Inter, sans-serif'; c.textAlign = 'center';
        c.fillText(s2.codenaam, lx, py + ph + 18 + (i % 2) * 12);
      });
      if (beurt) {
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        if (gas) {
          const rest = Math.max(0, (gas.tot - performance.now()) / 1000);
          c.fillText('tik, tik, tik -- nog ' + rest.toFixed(1) + ' s', W / 2, py - 12);
          c.font = '500 34px "Bodoni Moda", serif'; c.fillStyle = '#F2ECDC';
          c.fillText(String(gas.taps), W / 2, py + 42);
        } else c.fillText('druk op Zwem en tik dan zo snel als u kunt', W / 2, py - 12);
      }
      kopScene('Baantjes trekken', 'tik uzelf door het water, de snelste tijd wint');
    },
    anim(c, W, H, a, t) {
      const { px, py, pw, ph } = this.vak(W, H);
      const sp = (P && P.spelers) || [], n = Math.max(2, sp.length);
      const i = Math.max(0, sp.findIndex(s2 => s2.codenaam === a.wie));
      const lx = px + pw * (i + 0.5) / n, y = py + ph - 26 - t * (ph - 56);
      c.strokeStyle = 'rgba(242,236,220,' + (0.7 - t * 0.4) + ')'; c.lineWidth = 1.6;
      for (let k = 0; k < 3; k++) {
        const f = (t * 2 + k / 3) % 1;
        c.beginPath(); c.ellipse(lx, y + f * 34, 6 + f * 16, 3 + f * 7, 0, 0, Math.PI * 2); c.stroke();
      }
      puntZweef(lx, y - 14, a, t);
    }
  };

