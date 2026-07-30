
  /* ---------- deel 3g: de baanscenes ----------
     Golf, kegelen en boogschieten als schermvullende speelvelden. De baan
     ligt in perspectief, het richten volgt de meter onderin, en elke beurt
     speelt zich in de scene af: de bal rolt, de pijl vliegt, kegels vallen. */
  SCENES.golf = {
    // drie holes die elk anders liggen; de baan wisselt per beurt
    HOLES: [{ v: 0.86, zij: 0 }, { v: 0.8, zij: -0.34 }, { v: 0.9, zij: 0.36 }],
    st: null,
    reset() { this.st = null; },
    beurtVan(naam) {
      const w = ((P && P.spelers) || []).find(s2 => s2.codenaam === naam);
      return (w && w.punten.length) || 0;
    },
    mik() { return Math.sin(performance.now() / 300) * 0.8; },
    tik(m) { // tik een: de richting vangen; tik twee: de kracht van de meter
      if (!this.st) { this.st = { aim: this.mik() }; return null; }
      const h = this.HOLES[this.beurtVan(S.ik) % 3];
      const kr = Math.max(0, Math.min(100, Math.round(m - Math.abs(this.st.aim - h.zij) * 140)));
      this.st = null;
      return kr;
    },
    teken(c, W, H, m, beurt) {
      doek('#141C0F', '#090D06');
      const b = baan('#4C6B36', '#2C471F', 'rgba(216,184,88,0.5)');
      const h = this.HOLES[this.beurtVan((P && P.aanZet) || S.ik) % 3];
      const [hx, hy] = opBaan(b, h.v, h.zij);
      c.fillStyle = 'rgba(62,102,44,0.9)'; // de glooiing rond de hole
      c.beginPath(); c.ellipse(hx, hy, 34, 15, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#0A0A09';
      c.beginPath(); c.ellipse(hx, hy, 13, 6, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#D8B858'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx, hy - 54); c.stroke();
      c.fillStyle = '#D24A6E';
      c.beginPath(); c.moveTo(hx, hy - 54); c.lineTo(hx + 26, hy - 46); c.lineTo(hx, hy - 38); c.closePath(); c.fill();
      const [bx, by] = opBaan(b, 0.04, 0);
      if (beurt) {
        richtlijn(b, this.st ? this.st.aim : this.mik(), this.st ? 'rgba(216,184,88,0.95)' : 'rgba(242,236,220,0.6)');
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText(this.st ? 'de richting staat -- tik op het topje voor de kracht'
          : 'hole ' + (this.beurtVan(S.ik) % 3 + 1) + ' -- tik als de lijn op de hole ligt', W / 2, 140);
      }
      c.fillStyle = '#F2ECDC';
      c.beginPath(); c.arc(bx, by - 5, 6, 0, Math.PI * 2); c.fill();
      kopScene('Midgetgolf', 'drie holes, en elke hole ligt anders');
    },
    anim(c, W, H, a, t) {
      const b = baanVak(), tt = 1 - (1 - t) * (1 - t);
      const h = this.HOLES[Math.max(0, this.beurtVan(a.wie) - 1) % 3];
      const eindV = a.raak ? h.v : 0.3 + a.kracht / 100 * (h.v - 0.3);
      const eindZ = a.raak ? h.zij : h.zij + (a.kracht >= 50 ? 0.3 : -0.3);
      const [x, y] = opBaan(b, 0.04 + (eindV - 0.04) * tt, eindZ * tt);
      c.fillStyle = '#F2ECDC';
      c.beginPath(); c.arc(x, y - 4, 6 - tt * 2.5, 0, Math.PI * 2); c.fill();
      if (a.raak && t > 0.72) { const [hx, hy] = opBaan(b, h.v, h.zij); sceneVonken(hx, hy - 4, (t - 0.72) * 3.6, '#E3C878'); }
      puntZweef(x, y - 28, a, t);
    }
  };

  SCENES.kegelen = {
    st: null, rol: 0,
    reset() { this.st = null; this.rol = 0; },
    glij() { return Math.sin(performance.now() / 280) * 0.55; },
    tik(m) { // tik een: de bal stilzetten; tik twee: de kracht van de meter
      if (!this.st) { this.st = { zij: this.glij() }; return null; }
      const kr = Math.max(0, Math.min(100, Math.round(m - Math.abs(this.st.zij) * 160)));
      this.rol = this.st.zij; this.st = null;
      return kr;
    },
    teken(c, W, H, m, beurt) {
      doek('#1B130A', '#0C0805');
      const b = baan('#7A552C', '#452C13', 'rgba(216,184,88,0.45)');
      // de naden van de baanplanken lopen mee het perspectief in
      c.strokeStyle = 'rgba(12,10,7,0.35)'; c.lineWidth = 1;
      for (const z of [-0.5, 0, 0.5]) {
        const [x1, y1] = opBaan(b, 0, z), [x2, y2] = opBaan(b, 1, z);
        c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      }
      const kegel = (x, y, r) => {
        c.fillStyle = '#EFE8D6';
        c.beginPath(); c.ellipse(x, y - r * 1.6, r, r * 2, 0, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#B08D2F'; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(x - r * 0.7, y - r * 2.4); c.lineTo(x + r * 0.7, y - r * 2.4); c.stroke();
      };
      const rijen = [[0], [-0.13, 0.13], [-0.26, 0, 0.26], [-0.39, -0.13, 0.13, 0.39]];
      rijen.forEach((rij, i) => rij.forEach(z => { const [x, y] = opBaan(b, 0.8 + i * 0.05, z); kegel(x, y, 4.6 - i * 0.5); }));
      const zijNu = beurt ? (this.st ? this.st.zij : this.glij()) : 0;
      const [bx, by] = opBaan(b, 0.05, zijNu);
      if (beurt) {
        richtlijn(b, zijNu, this.st ? 'rgba(216,184,88,0.95)' : 'rgba(242,236,220,0.55)');
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText(this.st ? 'de lijn staat -- tik op het topje voor de kracht'
          : 'de bal glijdt -- tik als hij voor het midden staat', W / 2, 140);
      }
      c.fillStyle = '#7F1634'; c.beginPath(); c.arc(bx, by - 7, 9, 0, Math.PI * 2); c.fill();
      c.fillStyle = 'rgba(242,236,220,0.5)'; c.beginPath(); c.arc(bx - 3, by - 10, 2.2, 0, Math.PI * 2); c.fill();
      kopScene('Kegelen', 'zet de bal recht en rol vol door');
    },
    anim(c, W, H, a, t) {
      const b = baanVak(), tt = 1 - (1 - t) * (1 - t);
      const zijA = a.eigen ? this.rol * (1 - tt * 0.8) : 0;
      const [x, y] = opBaan(b, 0.05 + 0.72 * tt, zijA);
      c.fillStyle = '#7F1634';
      c.beginPath(); c.arc(x, y - 6, 9 - tt * 4, 0, Math.PI * 2); c.fill();
      if (t > 0.55) { // de kegels stuiven uiteen, naar rato van de worp
        const n = Math.max(1, Math.round(a.punt || 0)), f = (t - 0.55) / 0.45;
        const [px, py] = opBaan(b, 0.85, 0);
        c.strokeStyle = 'rgba(239,232,214,' + Math.max(0, 1 - f * 1.1) + ')'; c.lineWidth = 2.4;
        for (let i = 0; i < n; i++) {
          const hk = (i / n - 0.5) * 2.6, r = 10 + f * 52;
          const kx = px + Math.cos(hk - Math.PI / 2) * r, ky = py + Math.sin(hk - Math.PI / 2) * r * 0.6;
          c.beginPath(); c.moveTo(kx, ky); c.lineTo(kx + Math.cos(hk) * 8, ky + Math.sin(hk) * 8 - 4); c.stroke();
        }
        if (a.raak) sceneVonken(px, py - 6, f, '#E3C878');
        puntZweef(px, py - 30, a, f);
      }
    }
  };

  SCENES.boogschieten = {
    st: null, schot: null,
    reset() { this.schot = null; },
    doel(W, H) { return { cx: W / 2, cy: H * 0.34, r: Math.min(W * 0.33, 150) }; },
    kruisPos(W, H) { // het kruis ademt rond en scheert af en toe langs de roos
      const { cx, cy, r } = this.doel(W, H), t = performance.now();
      const rr = r * 0.85 * (0.5 + 0.5 * Math.sin(t / 810));
      return [cx + Math.cos(t / 540) * rr, cy + Math.sin(t / 540) * rr * 0.92];
    },
    tik() { // een tik: de pijl vertrekt naar waar het kruis nu staat
      const { cx, cy, r } = this.doel(SW, SH);
      const p = this.kruisPos(SW, SH);
      this.schot = p;
      const afst = Math.hypot(p[0] - cx, (p[1] - cy) / 0.92);
      return Math.max(0, Math.min(100, Math.round(100 - afst / (r * 0.92) * 100)));
    },
    teken(c, W, H, m, beurt) {
      doek('#151110', '#0A0807');
      const cx = W / 2, cy = H * 0.34, r = Math.min(W * 0.33, 150);
      c.strokeStyle = '#4A3A22'; c.lineWidth = 5; // de poten van de schietstand
      c.beginPath(); c.moveTo(cx - r * 0.7, cy + r * 1.5); c.lineTo(cx, cy);
      c.moveTo(cx + r * 0.7, cy + r * 1.5); c.lineTo(cx, cy); c.stroke();
      schijf(cx, cy, r, ['#EFE8D6', '#1E1910', '#C23A5E', '#7F1634', '#D8B858']);
      // de boog met de pijl op de pees, onderin
      const by = H - 190;
      c.strokeStyle = '#8A6238'; c.lineWidth = 4;
      c.beginPath(); c.arc(cx, by + 60, 85, Math.PI * 1.22, Math.PI * 1.78); c.stroke();
      c.strokeStyle = 'rgba(242,236,220,0.6)'; c.lineWidth = 1.4;
      c.beginPath(); c.moveTo(cx - 71, by + 13); c.lineTo(cx, by + 4); c.lineTo(cx + 71, by + 13); c.stroke();
      c.strokeStyle = '#D8B858'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx, by + 4); c.lineTo(cx, by - 44); c.stroke();
      if (beurt) {
        const [kx, ky] = this.kruisPos(W, H);
        kruis(kx, ky, 'rgba(242,236,220,0.9)');
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText('adem mee en tik als het kruis de roos vindt', W / 2, 140);
      }
      kopScene('Boogschieten', 'de pijl gaat naar waar uw kruis staat');
    },
    anim(c, W, H, a, t) {
      const cx = W / 2, cy = H * 0.34, r = Math.min(W * 0.33, 150);
      let lx, ly;
      if (a.eigen && this.schot) { lx = this.schot[0]; ly = this.schot[1]; }
      else {
        const rr = r * Math.max(0, 10 - (a.punt || 0)) / 10 * 0.9, ha = a.kracht / 100 * Math.PI * 2;
        lx = cx + Math.cos(ha) * rr; ly = cy + Math.sin(ha) * rr * 0.9;
      }
      const tt = Math.min(1, t * 2.2), sx = cx, sy = H - 234;
      const x = sx + (lx - sx) * tt, y = sy + (ly - sy) * tt;
      c.strokeStyle = '#D8B858'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x, y + 26 * (1 - tt * 0.6)); c.lineTo(x, y); c.stroke();
      c.fillStyle = '#D24A6E';
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 3.4, y + 8); c.lineTo(x + 3.4, y + 8); c.closePath(); c.fill();
      if (tt >= 1) { if (a.raak) sceneVonken(lx, ly, (t - 0.45) * 2, '#E3C878'); puntZweef(lx, ly - 16, a, Math.max(0, t - 0.4)); }
    }
  };
