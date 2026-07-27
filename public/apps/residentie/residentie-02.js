
  /* ---------- deel 2: de meubels van RTG Maison en de gasten ----------
     Elk meubel is een kleine tekening in goudlijn op donker; de gasten zijn
     elegante pionnen (schaakstuk-taal) op codenaam -- bewust geen poppetjes
     of foto's, wel karakter. */
  function blokje(x, y, b, d, h, zij, top) { // een iso-prisma op tegel x,y
    const x0 = isoX(x, y) - TW / 2, y0 = isoY(x, y);
    const pnt = (tx, ty) => [isoX(tx, ty), isoY(tx, ty)];
    const [ax, ay] = pnt(x, y), [bx, by] = pnt(x + b, y), [cx2, cy2] = pnt(x + b, y + d), [dx2, dy2] = pnt(x, y + d);
    ctx.fillStyle = zij;
    ctx.beginPath(); ctx.moveTo(dx2, dy2 - h); ctx.lineTo(cx2, cy2 - h); ctx.lineTo(cx2, cy2); ctx.lineTo(dx2, dy2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx2, cy2 - h); ctx.lineTo(bx, by - h); ctx.lineTo(bx, by); ctx.lineTo(cx2, cy2); ctx.closePath();
    ctx.fillStyle = schaduw(zij, 0.7); ctx.fill();
    ctx.beginPath(); ctx.moveTo(ax, ay - h); ctx.lineTo(bx, by - h); ctx.lineTo(cx2, cy2 - h); ctx.lineTo(dx2, dy2 - h); ctx.closePath();
    ctx.fillStyle = top; ctx.fill();
    ctx.strokeStyle = 'rgba(201,169,75,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
    return { ax, ay, bx, by, cx: cx2, cy: cy2, dx: dx2, dy: dy2, x0, y0 };
  }
  function schaduw(hex, f) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g2 = (n >> 8) & 255, b2 = n & 255;
    return 'rgb(' + Math.round(r * f) + ',' + Math.round(g2 * f) + ',' + Math.round(b2 * f) + ')';
  }
  const midden = (x, y, b, d) => [isoX(x + b / 2, y + d / 2) - ((b - d) * 0) , isoY(x + b / 2, y + d / 2)];

  /* de meubeltekeningen, per soort */
  const TEKEN = {
    fauteuil: (x, y) => { blokje(x, y, 1, 1, TH * 0.55, '#241E14', '#3A2F1C'); blokje(x, y, 0.28, 1, TH * 1.05, '#241E14', '#4A3C22'); },
    bank: (x, y) => { blokje(x, y, 2, 1, TH * 0.55, '#241E14', '#3A2F1C'); blokje(x, y, 2, 0.3, TH * 1.05, '#241E14', '#4A3C22'); },
    chaise: (x, y) => { blokje(x, y, 2, 1, TH * 0.5, '#2B1420', '#4A2033'); blokje(x, y, 0.5, 1, TH * 0.95, '#2B1420', '#5B2540'); },
    kruk: (x, y) => { blokje(x + 0.25, y + 0.25, 0.5, 0.5, TH * 0.85, '#241E14', '#C9A94B'); },
    tafel: (x, y) => { blokje(x, y, 2, 2, TH * 0.7, '#171310', '#E9E3D8'); ader(x, y, 2, 2, TH * 0.7); },
    bijzet: (x, y) => { blokje(x + 0.15, y + 0.15, 0.7, 0.7, TH * 0.65, '#171310', '#E9E3D8'); },
    vleugel: (x, y) => {
      blokje(x, y, 2, 2, TH * 0.9, '#0E0C0A', '#1C1916');
      const [mx, my] = midden(x, y, 2, 2);
      ctx.beginPath(); ctx.ellipse(mx, my - TH * 0.9, TW * 0.62, TH * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#12100D'; ctx.fill(); ctx.strokeStyle = 'rgba(201,169,75,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    },
    haard: (x, y) => {
      blokje(x, y, 2, 1, TH * 1.5, '#1A1712', '#242018');
      const [mx, my] = midden(x, y, 2, 1);
      const fl = Math.sin(Date.now() / 160) * 2;
      const vuur = ctx.createRadialGradient(mx, my - TH * 0.45, 2, mx, my - TH * 0.45, TW * 0.32 + fl);
      vuur.addColorStop(0, 'rgba(233,180,90,0.95)'); vuur.addColorStop(1, 'rgba(127,22,52,0)');
      ctx.fillStyle = vuur; ctx.beginPath(); ctx.ellipse(mx, my - TH * 0.45, TW * 0.3 + fl, TH * 0.5 + fl, 0, 0, Math.PI * 2); ctx.fill();
    },
    bar: (x, y) => { blokje(x, y, 3, 1, TH * 0.95, '#241E14', '#C9A94B'); },
    palm: (x, y) => {
      blokje(x + 0.28, y + 0.28, 0.45, 0.45, TH * 0.5, '#241E14', '#3A2F1C');
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5) - TH * 0.5;
      ctx.strokeStyle = '#2E4A3A'; ctx.lineWidth = 2;
      for (let i = 0; i < 6; i++) { const a = (Math.PI * 2 / 6) * i;
        ctx.beginPath(); ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.cos(a) * TW * 0.24, py - TH * 1.35, px + Math.cos(a) * TW * 0.52, py - TH * 0.72 + Math.sin(a) * 5);
        ctx.stroke(); }
    },
    lamp: (x, y) => {
      const px = isoX(x + 0.5, y + 0.5), py = isoY(x + 0.5, y + 0.5);
      ctx.strokeStyle = KLEUR.goud; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - TH * 2); ctx.stroke();
      const gl = ctx.createRadialGradient(px, py - TH * 2.15, 2, px, py - TH * 2.15, TW * 0.42);
      gl.addColorStop(0, 'rgba(233,214,150,0.9)'); gl.addColorStop(1, 'rgba(201,169,75,0)');
      ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(px, py - TH * 2.15, TW * 0.42, 0, Math.PI * 2); ctx.fill();
    },
    schaak: (x, y) => {
      blokje(x + 0.1, y + 0.1, 0.8, 0.8, TH * 0.62, '#171310', '#E9E3D8');
      const cx2 = isoX(x + 0.5, y + 0.5), cy2 = isoY(x + 0.5, y + 0.5) - TH * 0.62;
      ctx.fillStyle = '#241E14';
      ruitje(cx2 - TW * 0.09, cy2 - TH * 0.09, TW * 0.16); ruitje(cx2 + TW * 0.09, cy2 + TH * 0.02, TW * 0.16);
    },
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
    fontein: (x, y) => {
      const [mx, my] = midden(x, y, 2, 2);
      ctx.beginPath(); ctx.ellipse(mx, my, TW * 0.7, TH * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#141B20'; ctx.fill(); ctx.strokeStyle = 'rgba(201,169,75,0.5)'; ctx.lineWidth = 1.4; ctx.stroke();
      const t = Date.now() / 500;
      ctx.strokeStyle = 'rgba(120,160,190,0.5)';
      for (let i = 0; i < 3; i++) { const r = ((t + i / 3) % 1);
        ctx.beginPath(); ctx.ellipse(mx, my, TW * 0.7 * r, TH * 0.7 * r, 0, 0, Math.PI * 2); ctx.globalAlpha = 1 - r; ctx.stroke(); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(160,200,230,0.7)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my - TH * 1.3); ctx.stroke();
    }
  };
  function ruitje(cx, cy, s) { ctx.beginPath(); ctx.moveTo(cx, cy - s / 4); ctx.lineTo(cx + s / 2, cy); ctx.lineTo(cx, cy + s / 4); ctx.lineTo(cx - s / 2, cy); ctx.closePath(); ctx.fill(); }
  function ader(x, y, b, d, h) { // een marmerader over het tafelblad
    ctx.strokeStyle = 'rgba(120,110,95,0.5)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(isoX(x + 0.3, y + 0.5), isoY(x + 0.3, y + 0.5) - h);
    ctx.quadraticCurveTo(isoX(x + b / 2, y + d * 0.3), isoY(x + b / 2, y + d * 0.3) - h, isoX(x + b - 0.3, y + d - 0.5), isoY(x + b - 0.3, y + d - 0.5) - h);
    ctx.stroke();
  }

  /* ---------- de gast: een elegante pion op codenaam ---------- */
  function tekenGast(l, zelf) {
    const px = isoX(l.rx + 0.5, l.ry + 0.5), py = isoY(l.rx + 0.5, l.ry + 0.5);
    const hoog = l.zit ? TH * 1.15 : TH * 1.55;
    ctx.beginPath(); ctx.ellipse(px, py, TW * 0.2, TH * 0.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fill();
    const g = ctx.createLinearGradient(px, py - hoog, px, py);
    if (zelf) { g.addColorStop(0, '#E3C878'); g.addColorStop(1, '#8A6F1F'); }
    else { g.addColorStop(0, '#F0EADD'); g.addColorStop(1, '#A99F8A'); }
    ctx.fillStyle = g;
    ctx.beginPath(); // het pion-silhouet: voet, taille, kraag, hoofd
    ctx.moveTo(px - TW * 0.16, py);
    ctx.bezierCurveTo(px - TW * 0.05, py - hoog * 0.38, px - TW * 0.1, py - hoog * 0.52, px - TW * 0.07, py - hoog * 0.66);
    ctx.lineTo(px + TW * 0.07, py - hoog * 0.66);
    ctx.bezierCurveTo(px + TW * 0.1, py - hoog * 0.52, px + TW * 0.05, py - hoog * 0.38, px + TW * 0.16, py);
    ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(px, py - hoog * 0.8, TW * 0.105, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = zelf ? 'rgba(201,169,75,0.8)' : 'rgba(255,255,255,0.25)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(px, py - hoog * 0.66, TW * 0.085, TH * 0.06, 0, 0, Math.PI * 2); ctx.stroke();
    extraGast(l, px, py); // in het water of onder de douche: het effect erbij
    // het naamplaatje
    ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'center';
    const naam = l.codenaam, tb = ctx.measureText(naam).width;
    ctx.fillStyle = 'rgba(12,12,11,0.72)';
    ctx.beginPath(); ctx.roundRect(px - tb / 2 - 6, py - hoog - 26, tb + 12, 15, 7); ctx.fill();
    ctx.fillStyle = zelf ? KLEUR.goud : 'rgba(244,241,236,0.85)';
    ctx.fillText(naam, px, py - hoog - 15);
    // de spreekbubbel en de emote
    if (l.zeg && Date.now() < l.zegTot) tekenBubbel(px, py - hoog - 32, l.zeg);
    if (l.emote && Date.now() < l.emoteTot) {
      const rest = (l.emoteTot - Date.now()) / 1800;
      ctx.globalAlpha = Math.min(1, rest * 2);
      ctx.font = '16px Inter, sans-serif';
      ctx.fillStyle = l.emote === '♥' ? KLEUR.bordeauxLicht : KLEUR.goud;
      ctx.fillText(l.emote, px + TW * 0.22, py - hoog - 6 - (1 - rest) * 26);
      ctx.globalAlpha = 1;
    }
  }
  function tekenBubbel(px, py, tekst) {
    ctx.font = '11px Inter, sans-serif';
    const woorden = tekst.length > 46 ? tekst.slice(0, 45) + '…' : tekst;
    const b = ctx.measureText(woorden).width;
    ctx.fillStyle = 'rgba(21,19,18,0.94)';
    ctx.strokeStyle = 'rgba(201,169,75,0.6)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(px - b / 2 - 9, py - 22, b + 18, 20, 10); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px - 4, py - 3); ctx.lineTo(px, py + 4); ctx.lineTo(px + 4, py - 3); ctx.closePath();
    ctx.fillStyle = 'rgba(21,19,18,0.94)'; ctx.fill();
    ctx.fillStyle = '#F4F1EC'; ctx.textAlign = 'center'; ctx.fillText(woorden, px, py - 8);
  }
