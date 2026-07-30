
  /* ---------- deel 2b: RTG Maison deluxe en de activiteiten ----------
     De tekeningen voor het penthouse (bed, badkamer, keuken, televisie,
     telefoon) en voor de activiteitenzalen (green, water, kegelbaan,
     dartbord). Zelfde taal als deel 2: goudlijn op donker, geen sprites. */
  const VLAKKEN = new Set(['tapijt', 'water', 'green', 'golfhole', 'golfmat', 'kegelbaan', 'douche']);

  function vlakRuit(x, y, b, d, vul, rand) {
    ctx.beginPath();
    ctx.moveTo(isoX(x + b / 2, y), isoY(x + b / 2, y) - 1);
    ctx.lineTo(isoX(x + b, y + d / 2), isoY(x + b, y + d / 2) - 1);
    ctx.lineTo(isoX(x + b / 2, y + d), isoY(x + b / 2, y + d) - 1);
    ctx.lineTo(isoX(x, y + d / 2), isoY(x, y + d / 2) - 1);
    ctx.closePath();
    ctx.fillStyle = vul; ctx.fill();
    if (rand) { ctx.strokeStyle = rand; ctx.lineWidth = 1.2; ctx.stroke(); }
  }

  Object.assign(TEKEN, {
    bed: (x, y) => {
      blokje(x, y, 2, 2, TH * 0.5, '#241E14', '#EDE6D6');
      blokje(x, y, 2, 0.35, TH * 1.1, '#1A1712', '#2B2418'); // hoofdbord
      const [mx, my] = midden(x, y, 2, 2);
      ctx.fillStyle = '#F7F2E6';
      ctx.beginPath(); ctx.ellipse(mx - TW * 0.2, my - TH * 0.62, TW * 0.16, TH * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(mx + TW * 0.05, my - TH * 0.5, TW * 0.16, TH * 0.12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(127,22,52,0.6)'; ctx.lineWidth = 2; // plaid
      ctx.beginPath(); ctx.moveTo(isoX(x + 0.2, y + 1.3), isoY(x + 0.2, y + 1.3) - TH * 0.5);
      ctx.lineTo(isoX(x + 1.8, y + 1.3), isoY(x + 1.8, y + 1.3) - TH * 0.5); ctx.stroke();
    },
    kast: (x, y) => {
      blokje(x, y, 2, 1, TH * 2.1, '#1A1712', '#242018');
      ctx.strokeStyle = 'rgba(201,169,75,0.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(isoX(x + 1, y + 1), isoY(x + 1, y + 1)); ctx.lineTo(isoX(x + 1, y + 1), isoY(x + 1, y + 1) - TH * 2.1); ctx.stroke();
    },
    spiegel: (x, y) => {
      blokje(x + 0.3, y + 0.3, 0.4, 0.4, TH * 1.7, '#1A1712', '#C9A94B');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.fillStyle = 'rgba(180,200,215,0.35)';
      ctx.beginPath(); ctx.ellipse(px, py - TH * 1.1, TW * 0.14, TH * 0.55, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(201,169,75,0.7)'; ctx.lineWidth = 1; ctx.stroke();
    },
    tv: (x, y) => {
      blokje(x, y, 2, 0.35, TH * 1.5, '#0E0C0A', '#12100D');
      const gl = Math.sin(Date.now() / 900) * 0.06 + 0.2;
      ctx.fillStyle = 'rgba(120,160,200,' + gl.toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(isoX(x + 0.2, y + 0.18), isoY(x + 0.2, y + 0.18) - TH * 1.35);
      ctx.lineTo(isoX(x + 1.8, y + 0.18), isoY(x + 1.8, y + 0.18) - TH * 1.35);
      ctx.lineTo(isoX(x + 1.8, y + 0.18), isoY(x + 1.8, y + 0.18) - TH * 0.55);
      ctx.lineTo(isoX(x + 0.2, y + 0.18), isoY(x + 0.2, y + 0.18) - TH * 0.55);
      ctx.closePath(); ctx.fill();
    },
    bureau: (x, y) => { blokje(x, y, 2, 1, TH * 0.72, '#171310', '#3A2F1C'); ader(x, y, 2, 1, TH * 0.72); },
    telefoon: (x, y) => {
      blokje(x + 0.2, y + 0.2, 0.6, 0.6, TH * 0.7, '#171310', '#E9E3D8');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5) - TH * 0.7;
      ctx.strokeStyle = KLEUR.goud; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py - 4, TW * 0.1, Math.PI * 0.15, Math.PI * 0.85, true); ctx.stroke();
      ctx.fillStyle = KLEUR.goud;
      ctx.beginPath(); ctx.arc(px - TW * 0.09, py - 3, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(px + TW * 0.09, py - 3, 2.4, 0, Math.PI * 2); ctx.fill();
    },
    bad: (x, y) => {
      blokje(x, y, 2, 1, TH * 0.62, '#2A2A28', '#F0EBE0');
      ctx.fillStyle = 'rgba(110,160,190,0.55)';
      const [mx, my] = midden(x, y, 2, 1);
      ctx.beginPath(); ctx.ellipse(mx, my - TH * 0.62, TW * 0.52, TH * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    },
    douche: (x, y) => {
      vlakRuit(x, y, 1, 1, 'rgba(120,160,190,0.18)', 'rgba(201,169,75,0.45)');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.strokeStyle = 'rgba(201,169,75,0.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px - TW * 0.28, py); ctx.lineTo(px - TW * 0.28, py - TH * 2); ctx.lineTo(px + TW * 0.1, py - TH * 2.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(px + TW * 0.1, py - TH * 2.1, 3, 0, Math.PI * 2); ctx.fillStyle = KLEUR.goud; ctx.fill();
    },
    wastafel: (x, y) => {
      blokje(x + 0.15, y + 0.15, 0.7, 0.7, TH * 0.75, '#171310', '#E9E3D8');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5) - TH * 0.75;
      ctx.fillStyle = 'rgba(110,160,190,0.4)';
      ctx.beginPath(); ctx.ellipse(px, py, TW * 0.14, TH * 0.11, 0, 0, Math.PI * 2); ctx.fill();
    },
    toilet: (x, y) => {
      blokje(x + 0.2, y + 0.2, 0.6, 0.6, TH * 0.55, '#2A2A28', '#F0EBE0');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5) - TH * 0.55;
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(px, py, TW * 0.13, TH * 0.1, 0, 0, Math.PI * 2); ctx.stroke();
    },
    keuken: (x, y) => {
      blokje(x, y, 3, 1, TH * 0.8, '#1A1712', '#E9E3D8'); ader(x, y, 3, 1, TH * 0.8);
      const px = isoX(x + 2.5, y + 0.5), py = isoY(x + 2.5, y + 0.5) - TH * 0.8;
      ctx.strokeStyle = KLEUR.goud; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 9); ctx.lineTo(px + 6, py - 9); ctx.stroke();
    },
    koelkast: (x, y) => {
      blokje(x + 0.1, y + 0.1, 0.8, 0.8, TH * 1.9, '#26262A', '#3A3A40');
      ctx.strokeStyle = 'rgba(201,169,75,0.5)'; ctx.lineWidth = 1;
      const px = isoX(x + 0.85, y + 0.5), py = isoY(x + 0.85, y + 0.5);
      ctx.beginPath(); ctx.moveTo(px, py - TH * 1.5); ctx.lineTo(px, py - TH * 0.9); ctx.stroke();
    },
    dinertafel: (x, y) => {
      blokje(x + 0.2, y + 0.2, 1.6, 1.6, TH * 0.72, '#2A2622', '#F4EFE2');
      const [mx, my] = midden(x, y, 2, 2), top = my - TH * 0.72;
      const fl = Math.sin(Date.now() / 130) * 1.2;
      ctx.strokeStyle = KLEUR.goud; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(mx, top); ctx.lineTo(mx, top - 8); ctx.stroke();
      const vg = ctx.createRadialGradient(mx, top - 11, 1, mx, top - 11, 7 + fl);
      vg.addColorStop(0, 'rgba(240,200,110,0.95)'); vg.addColorStop(1, 'rgba(240,200,110,0)');
      ctx.fillStyle = vg; ctx.beginPath(); ctx.arc(mx, top - 11, 7 + fl, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(201,169,75,0.8)';
      ctx.beginPath(); ctx.ellipse(mx - TW * 0.22, top + TH * 0.1, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(mx + TW * 0.22, top - TH * 0.1, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
    },
    water: (x, y) => {
      vlakRuit(x, y, 2, 2, 'rgba(38,86,110,0.85)', 'rgba(201,169,75,0.5)');
      const t = Date.now() / 700;
      ctx.strokeStyle = 'rgba(150,200,225,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const f = ((t + i / 2) % 1);
        ctx.globalAlpha = 1 - f;
        ctx.beginPath();
        ctx.ellipse(isoX(x + 1, y + 1), isoY(x + 1, y + 1), TW * 0.8 * f, TH * 0.8 * f, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    green: (x, y) => { vlakRuit(x, y, 2, 2, 'rgba(38,74,52,0.9)', 'rgba(201,169,75,0.4)'); },
    golfhole: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.fillStyle = '#0A0A09';
      ctx.beginPath(); ctx.ellipse(px, py, TW * 0.1, TH * 0.08, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = KLEUR.goud; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - TH * 1.6); ctx.stroke();
      ctx.fillStyle = KLEUR.bordeauxLicht;
      ctx.beginPath(); ctx.moveTo(px, py - TH * 1.6); ctx.lineTo(px + TW * 0.2, py - TH * 1.45); ctx.lineTo(px, py - TH * 1.3); ctx.closePath(); ctx.fill();
    },
    golfmat: (x, y) => { vlakRuit(x + 0.15, y + 0.15, 0.7, 0.7, 'rgba(30,55,40,0.9)', 'rgba(201,169,75,0.5)'); },
    dartbord: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.strokeStyle = 'rgba(201,169,75,0.7)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - TH * 1.7); ctx.stroke();
      const r = TW * 0.2;
      ctx.fillStyle = '#171310';
      ctx.beginPath(); ctx.arc(px, py - TH * 1.9, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = KLEUR.bordeauxLicht;
      ctx.beginPath(); ctx.arc(px, py - TH * 1.9, r * 0.62, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = KLEUR.goud;
      ctx.beginPath(); ctx.arc(px, py - TH * 1.9, r * 0.26, 0, Math.PI * 2); ctx.stroke();
    },
    kegelbaan: (x, y) => {
      vlakRuit(x, y, 1, 5, 'rgba(72,54,30,0.85)', 'rgba(201,169,75,0.45)');
      const px = isoX(x + 0.5, y + 0.35), py = isoY(x + 0.5, y + 0.35);
      ctx.fillStyle = '#EDE6D6';
      for (const [ox, oy] of [[0, 0], [-4, 3], [4, 3], [-8, 6], [0, 6], [8, 6]]) {
        ctx.beginPath(); ctx.ellipse(px + ox, py + oy - 6, 2.2, 4.2, 0, 0, Math.PI * 2); ctx.fill();
      }
    }
  });

  /* effecten om de gast heen: baantjes trekken in het water, de regendouche */
  function extraGast(l, px, py) {
    if (!S.kamer) return;
    const hier = (S.kamer.meubels || []).find(([soort, mx, my]) => {
      const specs = { water: [2, 2], douche: [1, 1] }[soort];
      return specs && l.dx >= mx && l.dx < mx + specs[0] && l.dy >= my && l.dy < my + specs[1];
    });
    if (!hier) return;
    if (hier[0] === 'water') {
      const t = Date.now() / 600;
      ctx.strokeStyle = 'rgba(170,215,235,0.6)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) { const f = ((t + i / 2) % 1);
        ctx.globalAlpha = 1 - f;
        ctx.beginPath(); ctx.ellipse(px, py, TW * 0.34 * f + 4, TH * 0.3 * f + 2, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.globalAlpha = 1;
    } else {
      ctx.strokeStyle = 'rgba(170,210,235,0.55)'; ctx.lineWidth = 1;
      const t = Date.now() / 90;
      for (let i = 0; i < 5; i++) {
        const dy2 = ((t + i * 7) % 26);
        ctx.beginPath(); ctx.moveTo(px - 8 + i * 4, py - TH * 2 + dy2); ctx.lineTo(px - 8 + i * 4, py - TH * 2 + dy2 + 5); ctx.stroke();
      }
    }
  }
