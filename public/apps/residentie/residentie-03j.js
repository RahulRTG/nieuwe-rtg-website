
  /* ---------- deel 3j: de renbaan-scene ----------
     De Grand Prix: startlicht, kerbstones en karts met gemaskerde
     coureurs; het tik-tempo is het gas. */
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
    gasCfg() { return { rood: 1400, duur: 3500 }; }, // eerst het startlicht, dan pas gas
    gasScore(g) { // wie voor groen tikt, maakt een valse start
      const basis = Math.min(100, Math.round(g.taps * 4.5));
      return g.vals ? Math.round(basis * 0.6) : basis;
    },
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
        const nu = performance.now(), rood = gas && gas.rood && nu < gas.rood;
        const aanTal = rood ? Math.min(3, Math.ceil((1400 - (gas.rood - nu)) / 470)) : 3;
        for (let i = 0; i < 3; i++) { // de startlichten boven de baan
          c.beginPath(); c.arc(W / 2 - 34 + i * 34, 192, 9, 0, Math.PI * 2);
          c.fillStyle = !gas ? 'rgba(242,236,220,0.15)'
            : rood ? (i < aanTal ? '#9E1C40' : 'rgba(242,236,220,0.15)') : '#D8B858';
          c.fill();
        }
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        if (!gas) c.fillText('druk op Geef gas en wacht op het gouden licht', W / 2, 230);
        else if (rood) c.fillText(gas.vals ? 'te vroeg! dat kost u meters' : 'wachten op groen...', W / 2, 230);
        else {
          const rest = Math.max(0, (gas.tot - nu) / 1000);
          c.fillText((gas.vals ? 'valse start -- ' : '') + 'tik, tik, tik -- nog ' + rest.toFixed(1) + ' s', W / 2, 230);
          c.font = '500 34px "Bodoni Moda", serif'; c.fillStyle = '#F2ECDC';
          c.fillText(String(gas.taps), W / 2, 272);
        }
      }
      kopScene('De Grand Prix van het huis', 'wacht op groen en tik u naar de finish');
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

  SCENES.pool = {
    st: null, stoot: null,
    reset() { this.st = null; this.stoot = null; },
    vak(W, H) { const tw = Math.min(W * 0.84, 560), th = tw * 0.62;
      return { tx: (W - tw) / 2, ty: H * 0.2, tw, th }; },
    zakken(tx, ty, tw, th) {
      return [[tx, ty], [tx + tw / 2, ty - 4], [tx + tw, ty],
        [tx, ty + th], [tx + tw / 2, ty + th + 4], [tx + tw, ty + th]];
    },
    // per beurt een andere opstelling: de bal ligt voor een andere zak
    OPSTELLING: [{ b: [0.68, 0.26], z: 2 }, { b: [0.28, 0.7], z: 3 }, { b: [0.5, 0.22], z: 1 }],
    beurtVan(naam) {
      const w = ((P && P.spelers) || []).find(s2 => s2.codenaam === naam);
      return (w && w.punten.length) || 0;
    },
    op(naam) { return this.OPSTELLING[this.beurtVan(naam) % 3]; },
    ballen(tx, ty, tw, th, o) {
      return { wx: tx + tw * 0.25, wy: ty + th * 0.76, bx: tx + tw * o.b[0], by: ty + th * o.b[1] };
    },
    draai() { return performance.now() / 900; },
    tik(m) { // tik een: de keu stilzetten; tik twee: de kracht van de meter
      if (!this.st) { this.st = { hoek: this.draai() % (Math.PI * 2) }; return null; }
      const { tx, ty, tw, th } = this.vak(SW, SH), o = this.op(S.ik);
      const b = this.ballen(tx, ty, tw, th, o);
      const naarBal = Math.atan2(b.by - b.wy, b.bx - b.wx);
      const afw = Math.abs(((this.st.hoek - naarBal) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      const kr = Math.max(0, Math.min(100, Math.round(m - afw * 110)));
      this.stoot = this.st.hoek; this.st = null;
      return kr;
    },
    teken(c, W, H, m, beurt) {
      doek('#131610', '#0A0C08');
      const { tx, ty, tw, th } = this.vak(W, H);
      c.fillStyle = '#4A2F16'; c.fillRect(tx - 16, ty - 16, tw + 32, th + 32);
      c.fillStyle = '#25543A'; c.fillRect(tx, ty, tw, th);
      c.strokeStyle = 'rgba(12,10,7,0.5)'; c.lineWidth = 2; c.strokeRect(tx, ty, tw, th);
      const o = this.op((P && P.aanZet) || S.ik), b = this.ballen(tx, ty, tw, th, o);
      const zk = this.zakken(tx, ty, tw, th);
      zk.forEach(([zx, zy], i) => { // de zes zakken; de doelzak licht op
        c.fillStyle = '#070605'; c.beginPath(); c.arc(zx, zy, 11, 0, Math.PI * 2); c.fill();
        c.strokeStyle = i === o.z ? 'rgba(216,184,88,0.95)' : 'rgba(216,184,88,0.35)';
        c.lineWidth = i === o.z ? 2.4 : 1.2;
        c.beginPath(); c.arc(zx, zy, i === o.z ? 14 : 11, 0, Math.PI * 2); c.stroke();
      });
      if (beurt) {
        const hk = this.st ? this.st.hoek : this.draai();
        c.setLineDash([5, 7]); c.lineWidth = 1.8;
        c.strokeStyle = this.st ? 'rgba(216,184,88,0.95)' : 'rgba(242,236,220,0.6)';
        c.beginPath(); c.moveTo(b.wx, b.wy); c.lineTo(b.wx + Math.cos(hk) * tw * 0.4, b.wy + Math.sin(hk) * tw * 0.4); c.stroke();
        c.setLineDash([]);
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText(this.st ? 'de keu staat -- tik op het topje voor de kracht'
          : 'de keu draait -- tik als de lijn de gekleurde bal pakt', W / 2, 140);
      }
      const bal = (x, y, k) => { c.fillStyle = k; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(x - 2.5, y - 2.5, 2.2, 0, Math.PI * 2); c.fill(); };
      bal(tx + tw * 0.82, ty + th * 0.62, '#C9A94B'); bal(tx + tw * 0.14, ty + th * 0.3, '#1E1910');
      bal(b.bx, b.by, '#9E1C40'); bal(b.wx, b.wy, '#F2ECDC');
      kopScene('Pool', 'pot de bal in de oplichtende zak');
    },
    anim(c, W, H, a, t) {
      const { tx, ty, tw, th } = this.vak(W, H);
      const o = this.OPSTELLING[Math.max(0, this.beurtVan(a.wie) - 1) % 3];
      const b = this.ballen(tx, ty, tw, th, o), zak = this.zakken(tx, ty, tw, th)[o.z];
      const tt = 1 - (1 - t) * (1 - t);
      if (a.raak) { // wit naar de bal, de bal rolt door de zak in
        const f = Math.min(1, tt * 1.7);
        const x = b.wx + (b.bx - b.wx) * f, y = b.wy + (b.by - b.wy) * f;
        c.fillStyle = '#F2ECDC'; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
        if (f >= 1) {
          const g = Math.min(1, (tt - 0.58) / 0.42);
          if (g < 0.96) { c.fillStyle = '#9E1C40';
            c.beginPath(); c.arc(b.bx + (zak[0] - b.bx) * g, b.by + (zak[1] - b.by) * g, 8 * (1 - g * 0.4), 0, Math.PI * 2); c.fill(); }
          else sceneVonken(zak[0], zak[1], (tt - 0.9) * 6, '#E3C878');
        }
      } else { // de misser volgt de eigen keu over het laken
        let dx = b.wx + tw * 0.3, dy = ty + th * 0.9;
        if (a.eigen && this.stoot != null) {
          dx = Math.max(tx + 10, Math.min(tx + tw - 10, b.wx + Math.cos(this.stoot) * tw * 0.45));
          dy = Math.max(ty + 10, Math.min(ty + th - 10, b.wy + Math.sin(this.stoot) * tw * 0.45));
        }
        const f = Math.min(1, tt * 1.4);
        c.fillStyle = '#F2ECDC';
        c.beginPath(); c.arc(b.wx + (dx - b.wx) * f, b.wy + (dy - b.wy) * f, 8, 0, Math.PI * 2); c.fill();
      }
      puntZweef(b.bx, b.by - 22, a, t);
    }
  };
