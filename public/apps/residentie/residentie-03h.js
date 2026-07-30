
  /* ---------- deel 3h: de zaalscenes ----------
     Darts, biljart, zwemmen en dansen: het bord aan de muur, het laken van
     boven, de banen van het badhuis en de dansvloer in het spotlicht. */
  SCENES.darts = {
    worp: null,
    reset() { this.worp = null; },
    doel(W, H) { return { cx: W / 2, cy: H * 0.36, r: Math.min(W * 0.34, 150) }; },
    kruisPos(W, H) { // het kruis zwerft over het bord; uw tik is de worp
      const { cx, cy, r } = this.doel(W, H), t = performance.now();
      const rr = r * 0.88 * (0.5 + 0.5 * Math.sin(t / 690));
      return [cx + Math.cos(t / 470) * rr, cy + Math.sin(t / 470) * rr];
    },
    tik() {
      const { cx, cy, r } = this.doel(SW, SH);
      const p = this.kruisPos(SW, SH);
      this.worp = p;
      const afst = Math.hypot(p[0] - cx, p[1] - cy);
      return Math.max(0, Math.min(100, Math.round(100 - afst / (r * 0.92) * 100)));
    },
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
        const [kx, ky] = this.kruisPos(W, H);
        kruis(kx, ky, 'rgba(242,236,220,0.9)');
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText('tik als het kruis op de roos staat', W / 2, 140);
      }
      kopScene('Darts', 'de pijl landt waar uw kruis staat');
    },
    anim(c, W, H, a, t) {
      const cx = W / 2, cy = H * 0.36, r = Math.min(W * 0.34, 150);
      let lx, ly;
      if (a.eigen && this.worp) { lx = this.worp[0]; ly = this.worp[1]; }
      else {
        const rr = r * Math.max(0, 60 - (a.punt || 0)) / 60 * 0.9, ha = a.kracht / 100 * Math.PI * 2;
        lx = cx + Math.cos(ha) * rr; ly = cy + Math.sin(ha) * rr;
      }
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
    st: null, stoot: null,
    reset() { this.st = null; this.stoot = null; },
    draai() { return performance.now() / 900; },
    naarRood(W, H) {
      const { tx, ty, tw, th } = this.vak(W, H), b = this.ballen(tx, ty, tw, th);
      return Math.atan2(b.ry - b.wy, b.rx - b.wx);
    },
    tik(m) { // tik een: de keu stilzetten; tik twee: de kracht van de meter
      if (!this.st) { this.st = { hoek: this.draai() % (Math.PI * 2) }; return null; }
      let afw = Math.abs(((this.st.hoek - this.naarRood(SW, SH)) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const kr = Math.max(0, Math.min(100, Math.round(m - afw * 110)));
      this.stoot = this.st.hoek; this.st = null;
      return kr;
    },
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
        const hk = this.st ? this.st.hoek : this.draai();
        c.setLineDash([5, 7]); c.lineWidth = 1.8;
        c.strokeStyle = this.st ? 'rgba(216,184,88,0.95)' : 'rgba(242,236,220,0.6)';
        c.beginPath(); c.moveTo(b.wx, b.wy); c.lineTo(b.wx + Math.cos(hk) * tw * 0.36, b.wy + Math.sin(hk) * tw * 0.36); c.stroke();
        c.setLineDash([]);
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText(this.st ? 'de keu staat -- tik op het topje voor de kracht'
          : 'de keu draait -- tik als de lijn de rode raakt', W / 2, 140);
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
      let doelx = a.raak ? b.rx : b.rx + tw * 0.12, doely = a.raak ? b.ry : ty + th * 0.9;
      if (a.eigen && !a.raak && this.stoot != null) { // de misser volgt de eigen keu
        doelx = Math.max(tx + 10, Math.min(tx + tw - 10, b.wx + Math.cos(this.stoot) * tw * 0.42));
        doely = Math.max(ty + 10, Math.min(ty + th - 10, b.wy + Math.sin(this.stoot) * tw * 0.42));
      }
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

