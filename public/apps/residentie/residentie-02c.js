
  /* ---------- deel 2c: het bal, de biljartkamer en de sterrenwacht ----------
     De tekeningen voor de nieuwe zalen: kroonluchters en een spiegelende
     dansvloer, de biljarttafel, het boogdoel en de telescoop. Zelfde taal:
     goudlijn op donker, licht uit de tekening zelf. */
  VLAKKEN.add('dansvloer');
  VLAKKEN.add('kroonluchter');

  Object.assign(TEKEN, {
    boekenkast: (x, y) => {
      blokje(x, y, 3, 0.5, TH * 2.2, '#1A1712', '#242018');
      ctx.strokeStyle = 'rgba(201,169,75,0.35)'; ctx.lineWidth = 0.8;
      for (let i = 1; i <= 3; i++) { const h = TH * 2.2 * i / 4;
        ctx.beginPath(); ctx.moveTo(isoX(x, y + 0.5), isoY(x, y + 0.5) - h); ctx.lineTo(isoX(x + 3, y + 0.5), isoY(x + 3, y + 0.5) - h); ctx.stroke(); }
    },
    tapijt: (x, y) => {
      ctx.beginPath();
      ctx.moveTo(isoX(x + 1.5, y), isoY(x + 1.5, y) - 1); ctx.lineTo(isoX(x + 3, y + 1), isoY(x + 3, y + 1) - 1);
      ctx.lineTo(isoX(x + 1.5, y + 2), isoY(x + 1.5, y + 2) - 1); ctx.lineTo(isoX(x, y + 1), isoY(x, y + 1) - 1);
      ctx.closePath();
      ctx.fillStyle = 'rgba(127,22,52,0.55)'; ctx.fill();
      ctx.strokeStyle = 'rgba(201,169,75,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
    },
    kroonluchter: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      const top = py - TH * 4.6, fl = Math.sin(Date.now() / 300 + x) * 0.6;
      ctx.strokeStyle = 'rgba(216,184,88,0.75)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, top - TH * 0.8); ctx.lineTo(px, top); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(px, top, TW * 0.34, TH * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(px, top + TH * 0.28, TW * 0.2, TH * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (Math.PI * 2 / 5) * i + 0.4;
        const kx = px + Math.cos(a) * TW * 0.34, ky = top + Math.sin(a) * TH * 0.16;
        const gl = ctx.createRadialGradient(kx, ky - 3, 0.5, kx, ky - 3, 5 + fl);
        gl.addColorStop(0, 'rgba(246,220,140,0.95)'); gl.addColorStop(1, 'rgba(246,220,140,0)');
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(kx, ky - 3, 5 + fl, 0, Math.PI * 2); ctx.fill();
      }
      const poel = ctx.createRadialGradient(px, py, 2, px, py, TW * 1.1);
      poel.addColorStop(0, 'rgba(246,220,140,0.16)'); poel.addColorStop(1, 'rgba(246,220,140,0)');
      ctx.fillStyle = poel;
      ctx.beginPath(); ctx.ellipse(px, py, TW * 1.1, TH * 1.1, 0, 0, Math.PI * 2); ctx.fill();
    },
    dansvloer: (x, y) => {
      vlakRuit(x, y, 2, 2, 'rgba(58,50,34,0.9)', 'rgba(216,184,88,0.55)');
      ctx.strokeStyle = 'rgba(216,184,88,0.28)'; ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(isoX(x + 1, y), isoY(x + 1, y) - 1); ctx.lineTo(isoX(x + 1, y + 2), isoY(x + 1, y + 2) - 1);
      ctx.moveTo(isoX(x, y + 1), isoY(x, y + 1) - 1); ctx.lineTo(isoX(x + 2, y + 1), isoY(x + 2, y + 1) - 1);
      ctx.stroke();
      const sh = ctx.createLinearGradient(isoX(x, y + 1) , isoY(x, y) - 1, isoX(x + 2, y + 1), isoY(x + 2, y + 2));
      sh.addColorStop(0, 'rgba(246,236,220,0)'); sh.addColorStop(0.5, 'rgba(246,236,220,0.08)'); sh.addColorStop(1, 'rgba(246,236,220,0)');
      vlakRuit(x, y, 2, 2, sh);
    },
    biljarttafel: (x, y) => {
      blokje(x, y, 3, 2, TH * 0.72, '#241E14', '#2E6B44');
      ctx.strokeStyle = 'rgba(216,184,88,0.6)'; ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(isoX(x + 0.2, y + 0.2), isoY(x + 0.2, y + 0.2) - TH * 0.72);
      ctx.lineTo(isoX(x + 2.8, y + 0.2), isoY(x + 2.8, y + 0.2) - TH * 0.72);
      ctx.lineTo(isoX(x + 2.8, y + 1.8), isoY(x + 2.8, y + 1.8) - TH * 0.72);
      ctx.lineTo(isoX(x + 0.2, y + 1.8), isoY(x + 0.2, y + 1.8) - TH * 0.72);
      ctx.closePath(); ctx.stroke();
      const bal = (bx, by, kleur) => {
        ctx.fillStyle = kleur;
        ctx.beginPath(); ctx.ellipse(isoX(x + bx, y + by), isoY(x + bx, y + by) - TH * 0.72 - 2, 2.6, 2, 0, 0, Math.PI * 2); ctx.fill();
      };
      bal(1, 0.8, '#F2ECDC'); bal(1.8, 1.2, '#C23A5E'); bal(2.2, 0.6, '#D8B858');
    },
    doelwit: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.strokeStyle = 'rgba(216,184,88,0.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px - TW * 0.14, py); ctx.lineTo(px, py - TH * 1.1); ctx.moveTo(px + TW * 0.14, py); ctx.lineTo(px, py - TH * 1.1); ctx.stroke();
      const r = TW * 0.26, cy2 = py - TH * 1.7;
      for (const [rr, kleur] of [[1, '#F2ECDC'], [0.66, '#D24A6E'], [0.33, '#D8B858']]) {
        ctx.fillStyle = kleur;
        ctx.beginPath(); ctx.arc(px, cy2, r * rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#141210';
      ctx.beginPath(); ctx.arc(px, cy2, r * 0.1, 0, Math.PI * 2); ctx.fill();
    },
    telescoop: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.strokeStyle = 'rgba(216,184,88,0.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px - TW * 0.16, py); ctx.lineTo(px, py - TH * 1);
      ctx.moveTo(px + TW * 0.16, py); ctx.lineTo(px, py - TH * 1);
      ctx.stroke();
      ctx.save();
      ctx.translate(px, py - TH * 1); ctx.rotate(-0.6);
      ctx.fillStyle = '#2A2416';
      ctx.fillRect(-3, -TW * 0.42, 6, TW * 0.46);
      ctx.strokeStyle = 'rgba(216,184,88,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(-3, -TW * 0.42, 6, TW * 0.46);
      ctx.restore();
      const st = Date.now() / 900; // een handvol sterren boven de kijker
      ctx.fillStyle = 'rgba(240,236,220,' + (0.5 + Math.sin(st + x) * 0.3).toFixed(2) + ')';
      for (const [ox, oy] of [[-14, -TH * 2.6], [10, -TH * 3], [2, -TH * 2.2]]) {
        ctx.beginPath(); ctx.arc(px + ox, py + oy, 1.1, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
