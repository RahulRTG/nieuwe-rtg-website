
  /* ---------- deel 3e: de wereld speelt mee ----------
     Elke beurt is zichtbaar in de zaal: een golfbal rolt naar de hole, een
     pijltje vliegt naar het bord, de kegelbal gaat de baan af, de boogpijl
     zoekt de roos, de witte bal stoot de rode weg, het water spat en de
     dansvloer glanst. En boven de speler zweeft het puntenaantal omhoog. */
  const EFX = [];
  const RAAK = { golf: p => p <= 1, darts: p => p >= 40, kegelen: p => p >= 9, zwemmen: p => p <= 7.5,
    biljart: p => p >= 2, boogschieten: p => p >= 9, dansen: p => p >= 35 };

  function doelVan(spel, l) {
    const zoek = soorten => {
      let best = null, ba = 1e9;
      for (const [soort, mx, my] of (S.kamer.meubels || [])) if (soorten.includes(soort)) {
        const d2 = Math.hypot(mx - l.rx, my - l.ry);
        if (d2 < ba) { ba = d2; best = [mx, my]; }
      }
      return best;
    };
    if (spel === 'golf') return zoek(['golfhole']);
    if (spel === 'darts') return zoek(['dartbord']);
    if (spel === 'kegelen') return zoek(['kegelbaan']);
    if (spel === 'boogschieten') return zoek(['doelwit']);
    if (spel === 'biljart') { const b = zoek(['biljarttafel']); return b && [b[0] + 1, b[1] + 0.5]; }
    if (spel === 'zwemmen') { const b = zoek(['water']); return b && [b[0] + 1, b[1] + 1]; }
    return null; // dansen: om de speler zelf
  }

  function voegEffect(spel, codenaam, punt, tekst) {
    const l = codenaam && S.leden.get(codenaam);
    if (!l || !S.kamer) return;
    const doel = doelVan(spel, l);
    EFX.push({ spel, van: [l.rx + 0.5, l.ry + 0.5], naar: doel ? [doel[0] + 0.5, doel[1] + 0.5] : [l.rx + 0.5, l.ry + 0.5],
      raak: (RAAK[spel] || (() => true))(punt), tekst, t0: performance.now(), duur: spel === 'dansen' ? 1700 : 1200 });
  }

  function tekenEffecten() {
    if (!EFX.length) return;
    const nu = performance.now();
    for (let i = EFX.length - 1; i >= 0; i--) {
      const e = EFX[i], f = Math.min(1, (nu - e.t0) / e.duur);
      if (f >= 1) { EFX.splice(i, 1); continue; }
      const g = Math.min(1, f * 1.45); // het projectiel is eerder klaar dan de nazweving
      const vx = e.van[0] + (e.naar[0] - e.van[0]) * g, vy = e.van[1] + (e.naar[1] - e.van[1]) * g;
      const px = isoX(vx, vy), py = isoY(vx, vy);
      if (e.spel === 'golf' || e.spel === 'kegelen') {
        ctx.fillStyle = e.spel === 'golf' ? '#F2ECDC' : '#2A2A30';
        ctx.beginPath(); ctx.ellipse(px, py - 3, e.spel === 'golf' ? 2.6 : 4, e.spel === 'golf' ? 2.2 : 3.2, 0, 0, Math.PI * 2); ctx.fill();
        if (g >= 1 && e.raak) vonken(px, py - 6, f, '#D8B858');
      } else if (e.spel === 'darts' || e.spel === 'boogschieten') {
        const hoog = TH * (e.spel === 'darts' ? 1.9 : 1.7) * g + Math.sin(Math.PI * g) * TH * 0.6;
        ctx.strokeStyle = '#D8B858'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(px - 6, py - hoog + 3); ctx.lineTo(px + 3, py - hoog - 2); ctx.stroke();
        if (g >= 1) vonken(px, py - hoog, f, e.raak ? '#D24A6E' : '#8A8680');
      } else if (e.spel === 'biljart') {
        const blad = TH * 0.72 + 4;
        ctx.fillStyle = '#F2ECDC';
        ctx.beginPath(); ctx.ellipse(px, py - blad, 2.6, 2, 0, 0, Math.PI * 2); ctx.fill();
        if (g >= 1 && e.raak) {
          const w = (f - 0.68) * 26;
          ctx.fillStyle = '#C23A5E';
          ctx.beginPath(); ctx.ellipse(px + 6 + w, py - blad - w * 0.3, 2.6, 2, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else if (e.spel === 'zwemmen') {
        ctx.strokeStyle = 'rgba(190,225,240,0.8)'; ctx.lineWidth = 1.3;
        for (let r = 0; r < 3; r++) {
          const rf = (f + r / 3) % 1;
          ctx.globalAlpha = 1 - rf;
          ctx.beginPath(); ctx.ellipse(px, py, TW * 0.4 * rf + 3, TH * 0.34 * rf + 2, 0, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else if (e.spel === 'dansen') {
        const sx = isoX(e.van[0], e.van[1]), sy = isoY(e.van[0], e.van[1]);
        for (let s2 = 0; s2 < 6; s2++) {
          const a = f * 5 + s2 * (Math.PI / 3);
          ctx.globalAlpha = 0.85 - f * 0.7;
          ctx.fillStyle = s2 % 2 ? '#D8B858' : '#D24A6E';
          ctx.font = '11px Inter, sans-serif'; ctx.textAlign = 'center';
          ctx.fillText('✶', sx + Math.cos(a) * TW * 0.42, sy - TH * (0.8 + f * 1.1) + Math.sin(a) * TH * 0.28);
        }
        ctx.globalAlpha = 1;
      }
      // het puntenaantal zweeft boven de speler omhoog
      if (e.tekst && f > 0.18) {
        const sx = isoX(e.van[0], e.van[1]), sy = isoY(e.van[0], e.van[1]);
        ctx.globalAlpha = Math.max(0, 1 - (f - 0.18) * 1.35);
        ctx.font = '700 12px Inter, sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = e.raak ? '#E3C878' : 'rgba(244,241,236,0.9)';
        ctx.fillText(e.tekst, sx, sy - TH * 2.1 - f * 26);
        ctx.globalAlpha = 1;
      }
    }
  }
  function vonken(px, py, f, kleur) {
    ctx.fillStyle = kleur;
    for (let v = 0; v < 5; v++) {
      const a = (Math.PI * 2 / 5) * v, r = 4 + f * 10;
      ctx.globalAlpha = Math.max(0, 1.4 - f * 1.6);
      ctx.beginPath(); ctx.arc(px + Math.cos(a) * r, py + Math.sin(a) * r * 0.6, 1.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
