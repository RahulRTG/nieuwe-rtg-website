
  /* ---------- deel 3i: de vloerscenes ----------
     De dansvloer als maatspel (tik op elke tel van de kloppende ring) en
     het badhuis als tempospel (gelijkmatig tikken zwemt het snelst). */
  SCENES.dansen = {
    P0: 400, PD: 620, // de eerste tel en de maat, in milliseconden
    gasScore(g) { // niet het tempo maar de maat telt: hoe dichtbij elke tel?
      const start = g.tot - 3500;
      let som = 0;
      for (let k = 0; k < 5; k++) {
        const tel = start + this.P0 + k * this.PD;
        const afw = g.tijden.length ? Math.min(...g.tijden.map(x => Math.abs(x - tel))) : 999;
        som += Math.max(0, 100 - afw / 3);
      }
      return Math.round(som / 5);
    },
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
        // de ring klopt op de maat; op elke slag hoort een tik
        const nu = gas ? performance.now() - (gas.tot - 3500) - this.P0 : Date.now();
        const f = ((nu % this.PD) + this.PD) % this.PD / this.PD;
        const r = 30 + f * (rx - 40);
        c.strokeStyle = 'rgba(240,200,110,' + Math.max(0.15, 1 - f) + ')'; c.lineWidth = 2.6;
        c.beginPath(); c.ellipse(cx, fy, r, r * 0.42, 0, 0, Math.PI * 2); c.stroke();
        c.textAlign = 'center'; c.fillStyle = 'rgba(216,184,88,0.9)'; c.font = '600 11px Inter, sans-serif';
        c.fillText(gas ? 'tik op elke slag van de ring -- ' + gas.taps + ' van 5 tellen'
          : 'druk op Dans en tik dan op de maat van de ring', W / 2, 140);
      }
      kopScene('Het gemaskerde bal', 'wie de maat voelt, danst met gratie');
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

  SCENES.zwemmen = {
    gasScore(g) { // tempo telt, maar een gelijkmatige slag zwemt het snelst
      const basis = Math.min(100, Math.round(g.taps * 5));
      if (g.tijden.length < 3) return Math.min(100, Math.round(g.taps * 4.5));
      const iv = g.tijden.slice(1).map((x, i) => x - g.tijden[i]);
      const gem = iv.reduce((a, b) => a + b, 0) / iv.length;
      const spr = Math.sqrt(iv.reduce((a, b) => a + (b - gem) * (b - gem), 0) / iv.length);
      const factor = 1 - Math.min(0.3, Math.max(0, spr / gem - 0.18));
      return Math.round(basis * factor);
    },
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
        } else c.fillText('druk op Zwem en tik dan snel en gelijkmatig', W / 2, py - 12);
      }
      kopScene('Baantjes trekken', 'een strakke, gelijkmatige slag zwemt het snelst');
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

